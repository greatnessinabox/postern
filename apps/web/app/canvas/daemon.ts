import { parseSnapshot, type Snapshot } from './snapshot-data'

const DEFAULT_DAEMON_URL = 'http://127.0.0.1:8787'
const FETCH_TIMEOUT_MS = 1500

function daemonUrl(): string {
  const configured = process.env['NEXT_PUBLIC_POSTERN_DAEMON_URL']
  const base =
    typeof configured === 'string' && configured.length > 0 ? configured : DEFAULT_DAEMON_URL
  return base.replace(/\/+$/, '')
}

async function fetchJson(path: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(`${daemonUrl()}${path}`, { ...init, signal: controller.signal })
    if (!response.ok) {
      return null
    }
    return await response.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface Body {
  html: string
  blockedImages: number
}

export interface SendPayload {
  account: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  inReplyTo?: string
}

export async function fetchSpaces(): Promise<Snapshot | null> {
  const raw = await fetchJson('/spaces')
  if (raw === null) {
    return null
  }
  return parseSnapshot(raw)
}

export async function fetchBody(account: string, messageId: string): Promise<Body | null> {
  const params = new URLSearchParams({ account, messageId })
  const raw = await fetchJson(`/body?${params.toString()}`)
  if (typeof raw !== 'object' || raw === null) {
    return null
  }
  const record = raw as Record<string, unknown>
  const html = record['html']
  const blockedImages = record['blockedImages']
  if (typeof html !== 'string') {
    return null
  }
  return {
    html,
    blockedImages: typeof blockedImages === 'number' ? blockedImages : 0,
  }
}

export async function sendMessage(payload: SendPayload): Promise<{ messageId: string } | null> {
  const raw = await fetchJson('/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (typeof raw !== 'object' || raw === null) {
    return null
  }
  const messageId = (raw as Record<string, unknown>)['messageId']
  if (typeof messageId !== 'string') {
    return null
  }
  return { messageId }
}
