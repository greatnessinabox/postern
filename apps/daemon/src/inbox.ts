/**
 * Inbox orchestration: fetch, classify, AI-triage, bucket into Spaces, fetch
 * and sanitize bodies, and send. This is the service logic the HTTP layer
 * exposes. It sits above the protocol/ai/utils layers and below the UI.
 */

import { AnthropicProvider, type TriageInput } from '@postern/ai'
import { type Account, newAccountId, surfaceFor } from '@postern/core'
import { type Draft, GmailAdapter } from '@postern/protocol'
import { createEmailSanitizer } from '@postern/utils'
import { JSDOM } from 'jsdom'
import {
  ACCOUNTS,
  type AccountConfig,
  anthropicKey,
  hasCredentials,
  oauthResolver,
} from './accounts.ts'

const FETCH = Number(process.env['DAEMON_FETCH'] ?? '120')
const PER_SURFACE = 16

export interface Card {
  subject: string
  fromName: string
  fromAddress: string
  date: string
  category: string
  trust: string
  messageCount: number
  messageIdHeader: string
}

export interface SpaceSnapshot {
  id: string
  name: string
  account: string
  accent: string
  glyph: string
  surfaces: Record<string, { total: number; items: Card[] }>
}

export interface InboxSnapshot {
  generatedAt: string
  spaces: SpaceSnapshot[]
}

const norm = (s: string) =>
  s
    .replace(/^(\s*(re|fwd|fw)\s*:\s*)+/i, '')
    .trim()
    .toLowerCase()

function accountFor(account: string): Account {
  return {
    id: newAccountId(),
    provider: 'gmail',
    address: account,
    displayName: account,
    spaceIds: [],
    createdAt: new Date(),
  }
}

async function applyTriage(
  provider: AnthropicProvider,
  buckets: Record<string, Card[]>,
): Promise<void> {
  const threads = buckets['threads']
  if (threads === undefined || threads.length === 0) return
  const inputs: TriageInput[] = threads.map((c) => ({
    fromName: c.fromName,
    fromAddress: c.fromAddress,
    subject: c.subject,
    snippet: '',
    heuristicCategory: 'personal',
  }))
  const results = await provider.triage(inputs)
  const byIndex = new Map(results.map((r) => [r.index, r]))
  const kept: Card[] = []
  for (let i = 0; i < threads.length; i += 1) {
    const card = threads[i]
    if (card === undefined) continue
    const r = byIndex.get(i)
    const target = r === undefined ? 'threads' : surfaceFor(r.category)
    if (r === undefined || target === 'threads') {
      kept.push(card)
      continue
    }
    card.category = r.category
    buckets[target]?.push(card)
  }
  buckets['threads'] = kept
}

async function snapshotAccount(
  cfg: AccountConfig,
  triage: AnthropicProvider | undefined,
): Promise<SpaceSnapshot['surfaces']> {
  const adapter = new GmailAdapter(oauthResolver(cfg.account))
  const connection = await adapter.connect(accountFor(cfg.account))
  const buckets: Record<string, Card[]> = { threads: [], reader: [], notifications: [], ledger: [] }
  const seen: Record<string, Set<string>> = {
    threads: new Set(),
    reader: new Set(),
    notifications: new Set(),
    ledger: new Set(),
  }
  try {
    const folders = await adapter.listFolders(connection)
    const inbox = folders.find((f) => f.role === 'inbox') ?? folders[0]
    if (inbox === undefined) throw new Error('no inbox folder')
    const delta = await adapter.fetchSince(connection, inbox, undefined, FETCH)
    for (const m of delta.messages) {
      const surface = surfaceFor(m.classification)
      const bucket = buckets[surface]
      const seenKeys = seen[surface]
      if (bucket === undefined || seenKeys === undefined) continue
      const key = norm(m.subject)
      if (seenKeys.has(key)) {
        const existing = bucket.find((c) => norm(c.subject) === key)
        if (existing !== undefined) existing.messageCount += 1
        continue
      }
      seenKeys.add(key)
      bucket.push({
        subject: m.subject || '(no subject)',
        fromName: m.from.displayName ?? '',
        fromAddress: `${m.from.local}@${m.from.domain}`,
        date: m.date.toISOString(),
        category: m.classification,
        trust: m.trust.verdict,
        messageCount: 1,
        messageIdHeader: m.messageIdHeader,
      })
    }
    if (triage !== undefined) await applyTriage(triage, buckets)
  } finally {
    await connection.close()
  }
  return Object.fromEntries(
    Object.entries(buckets).map(([s, cards]) => [
      s,
      {
        total: cards.length,
        items: cards.sort((a, b) => b.date.localeCompare(a.date)).slice(0, PER_SURFACE),
      },
    ]),
  )
}

export async function buildSnapshot(): Promise<InboxSnapshot> {
  const key = anthropicKey()
  const triage = key !== undefined ? new AnthropicProvider({ apiKey: key }) : undefined
  const spaces: SpaceSnapshot[] = []
  for (const cfg of ACCOUNTS) {
    if (!hasCredentials(cfg.account)) continue
    try {
      const surfaces = await snapshotAccount(cfg, triage)
      spaces.push({
        id: cfg.spaceId,
        name: cfg.name,
        account: cfg.account,
        accent: cfg.accent,
        glyph: cfg.glyph,
        surfaces,
      })
    } catch {
      // One account failing must not break the others.
    }
  }
  return { generatedAt: new Date().toISOString(), spaces }
}

export async function fetchBody(
  account: string,
  messageIdHeader: string,
): Promise<{ html: string; blockedImages: number }> {
  const adapter = new GmailAdapter(oauthResolver(account))
  const connection = await adapter.connect(accountFor(account))
  try {
    const folders = await adapter.listFolders(connection)
    const inbox = folders.find((f) => f.role === 'inbox') ?? folders[0]
    if (inbox === undefined) return { html: '', blockedImages: 0 }
    const parts = await adapter.fetchBody(connection, inbox, messageIdHeader)
    const html = parts.find((p) => p.includes('<')) ?? parts[0] ?? ''
    const sanitizer = createEmailSanitizer(
      new JSDOM('').window as unknown as Parameters<typeof createEmailSanitizer>[0],
    )
    const clean = sanitizer.sanitize(html, { blockRemoteContent: true })
    return { html: clean.html, blockedImages: clean.blockedRemoteCount }
  } finally {
    await connection.close()
  }
}

export async function send(account: string, draft: Draft): Promise<string> {
  const adapter = new GmailAdapter(oauthResolver(account))
  const connection = await adapter.connect(accountFor(account))
  try {
    return await adapter.send(connection, draft)
  } finally {
    await connection.close()
  }
}
