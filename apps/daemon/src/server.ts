/**
 * The daemon's HTTP surface. Loopback only. The UI (the Tauri webview, or
 * the Next dev server) calls these routes; nothing here imports the UI.
 *
 * Routes:
 *   GET  /health
 *   GET  /spaces            categorized snapshot, served from the local store
 *                           (?refresh=1 syncs the provider first)
 *   GET  /body?account&messageId   sanitized message body
 *   POST /send              { account, to[], cc?, bcc?, subject, body, inReplyTo? }
 *
 * If POSTERN_DAEMON_TOKEN is set, every route except /health requires
 * Authorization: Bearer <token>. The Tauri shell generates the token and
 * passes it to both the sidecar and the webview.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Draft } from '@postern/protocol'
import { openStore } from './db.ts'
import { fetchBody, type InboxSnapshot, send } from './inbox.ts'
import { buildSnapshotFromStore } from './query.ts'
import { syncAll } from './sync.ts'

const TOKEN = process.env['POSTERN_DAEMON_TOKEN']
const SYNC_INTERVAL_MS = Number(process.env['DAEMON_SYNC_INTERVAL_MS'] ?? String(5 * 60_000))

function isEmpty(snap: InboxSnapshot): boolean {
  return snap.spaces.every((s) => Object.values(s.surfaces).every((surface) => surface.total === 0))
}

async function getSnapshot(refresh: boolean): Promise<InboxSnapshot> {
  if (refresh) await syncAll()
  let snap = await buildSnapshotFromStore()
  // First run: the store is empty until the initial sync lands, so block this
  // one request on it rather than return an empty inbox.
  if (isEmpty(snap)) {
    await syncAll()
    snap = await buildSnapshotFromStore()
  }
  return snap
}

function authorized(req: IncomingMessage): boolean {
  if (TOKEN === undefined) return true
  return req.headers.authorization === `Bearer ${TOKEN}`
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  })
  res.end(body)
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString('utf8')
  return text.length > 0 ? JSON.parse(text) : {}
}

interface SendRequest {
  account: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  inReplyTo?: string
}

function isSendRequest(value: unknown): value is SendRequest {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['account'] === 'string' &&
    Array.isArray(v['to']) &&
    typeof v['subject'] === 'string' &&
    typeof v['body'] === 'string'
  )
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')

  if (req.method === 'OPTIONS') {
    json(res, 204, {})
    return
  }
  if (url.pathname === '/health') {
    json(res, 200, { ok: true })
    return
  }
  if (!authorized(req)) {
    json(res, 401, { error: 'unauthorized' })
    return
  }

  if (req.method === 'GET' && url.pathname === '/spaces') {
    const snap = await getSnapshot(url.searchParams.get('refresh') === '1')
    json(res, 200, snap)
    return
  }

  if (req.method === 'GET' && url.pathname === '/body') {
    const account = url.searchParams.get('account')
    const messageId = url.searchParams.get('messageId')
    if (account === null || messageId === null) {
      json(res, 400, { error: 'account and messageId required' })
      return
    }
    json(res, 200, await fetchBody(account, messageId))
    return
  }

  if (req.method === 'POST' && url.pathname === '/send') {
    const payload = await readBody(req)
    if (!isSendRequest(payload)) {
      json(res, 400, { error: 'invalid send request' })
      return
    }
    const draft: Draft = {
      subject: payload.subject,
      body: payload.body,
      toAddresses: payload.to,
      ccAddresses: payload.cc ?? [],
      bccAddresses: payload.bcc ?? [],
      attachmentRefs: [],
      ...(payload.inReplyTo !== undefined ? { inReplyTo: payload.inReplyTo } : {}),
    }
    const messageId = await send(payload.account, draft)
    json(res, 200, { messageId })
    return
  }

  json(res, 404, { error: 'not found' })
}

export function startServer(port: number, host = '127.0.0.1'): void {
  const server = createServer((req, res) => {
    route(req, res).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      json(res, 500, { error: message })
    })
  })
  server.listen(port, host, () => {
    console.log(`postern daemon listening on http://${host}:${port}`)
    // Open the store and warm it in the background; serve from it meanwhile.
    openStore()
      .then(() => syncAll())
      .catch(() => {})
    if (SYNC_INTERVAL_MS > 0) {
      const timer = setInterval(() => {
        syncAll().catch(() => {})
      }, SYNC_INTERVAL_MS)
      timer.unref()
    }
  })
}
