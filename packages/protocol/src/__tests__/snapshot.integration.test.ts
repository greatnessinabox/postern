/**
 * Generates a multi-account, Space-mapped inbox snapshot for the web
 * canvas. Opt-in: RUN_SNAPSHOT=1 pnpm test:integration
 *
 * Uses the Gmail REST adapter (GmailAdapter), which works for consumer and
 * Workspace Gmail regardless of the IMAP toggle. One account per Space. For
 * each account with credentials in the keychain (run scripts/oauth-token.mjs
 * --store per account), it fetches recent mail (envelope-first via the Gmail
 * metadata endpoint, already classified + trust-scored by the adapter),
 * collapses same-subject threads, and buckets by surface. Accounts that fail
 * (no creds, API blocked) are skipped. Writes apps/web/app/canvas/snapshot.json
 * (gitignored).
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { AnthropicProvider, type TriageInput } from '@postern/ai'
import { type Account, newAccountId, surfaceFor } from '@postern/core'
import { describe, expect, it } from 'vitest'
import { GmailAdapter } from '../gmail.ts'

const ENABLED = process.env['RUN_SNAPSHOT'] === '1'
const FETCH = Number(process.env['SNAPSHOT_FETCH'] ?? '150')
const PER_SURFACE = 16

interface AccountConfig {
  readonly account: string
  readonly spaceId: string
  readonly name: string
  readonly accent: string
  readonly glyph: string
}

const ACCOUNTS: readonly AccountConfig[] = [
  { account: 'marquis@ted.com', spaceId: 'work', name: 'Work', accent: '#4A5568', glyph: 'ted' },
  {
    account: 'greatnessinabox@gmail.com',
    spaceId: 'personal',
    name: 'Personal',
    accent: '#B08E5C',
    glyph: 'home',
  },
  {
    account: 'marquis@cleverer.tech',
    spaceId: 'side-projects',
    name: 'Side Projects',
    accent: '#8B5E3C',
    glyph: 'builder',
  },
]

function kc(service: string, account: string): string {
  return execFileSync('security', ['find-generic-password', '-w', '-s', service, '-a', account], {
    encoding: 'utf8',
  }).trim()
}

function hasCreds(account: string): boolean {
  try {
    return kc('postern-gmail-refresh', account).length > 0
  } catch {
    return false
  }
}

async function accessToken(account: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: kc('postern-gmail-client-id', account),
      client_secret: kc('postern-gmail-client-secret', account),
      refresh_token: kc('postern-gmail-refresh', account),
      grant_type: 'refresh_token',
    }),
  })
  const json = (await res.json()) as { access_token?: string }
  if (json.access_token === undefined) throw new Error(`No access token for ${account}`)
  return json.access_token
}

interface Card {
  subject: string
  fromName: string
  fromAddress: string
  date: string
  category: string
  trust: string
  messageCount: number
}

const norm = (s: string) =>
  s
    .replace(/^(\s*(re|fwd|fw)\s*:\s*)+/i, '')
    .trim()
    .toLowerCase()

function anthropicKey(): string | undefined {
  const env = process.env['ANTHROPIC_API_KEY']
  if (env !== undefined && env.length > 0) return env
  try {
    const k = execFileSync(
      'security',
      ['find-generic-password', '-w', '-s', 'anthropic-api-key', '-a', 'postern'],
      { encoding: 'utf8' },
    ).trim()
    return k.length > 0 ? k : undefined
  } catch {
    return undefined
  }
}

/**
 * AI triage pass: re-judge the heuristic Threads bucket and move anything
 * the model says is not personal to its correct surface. This is what makes
 * the home show only real correspondence.
 */
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
  for (let i = 0; i < threads.length; i++) {
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
  triageProvider?: AnthropicProvider,
): Promise<Record<string, { total: number; items: Card[] }>> {
  const account: Account = {
    id: newAccountId(),
    provider: 'gmail',
    address: cfg.account,
    displayName: cfg.name,
    spaceIds: [],
    createdAt: new Date(),
  }
  const adapter = new GmailAdapter(async () => ({
    kind: 'oauth',
    accessToken: await accessToken(cfg.account),
  }))
  const connection = await adapter.connect(account)
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
      })
    }
  } finally {
    await connection.close()
  }
  if (triageProvider !== undefined) {
    await applyTriage(triageProvider, buckets)
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

const dir = fileURLToPath(new URL('../../../../apps/web/app/canvas/', import.meta.url))

describe.skipIf(!ENABLED)('inbox snapshot', () => {
  it('writes a multi-account, Space-mapped snapshot via the Gmail API', async () => {
    const key = anthropicKey()
    const triage = key !== undefined ? new AnthropicProvider({ apiKey: key }) : undefined
    console.log(triage !== undefined ? '  AI triage: on' : '  AI triage: off (no key)')
    const spaces = []
    for (const cfg of ACCOUNTS) {
      if (!hasCreds(cfg.account)) {
        console.log(`  skip ${cfg.account} (no keychain creds)`)
        continue
      }
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
        const totals = Object.entries(surfaces)
          .map(([s, b]) => `${s}:${b.total}`)
          .join(' ')
        console.log(`  ${cfg.name.padEnd(14)} ${cfg.account.padEnd(28)} ${totals}`)
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        console.log(`  skip ${cfg.account} (fetch failed: ${reason})`)
      }
    }

    const snapshot = { generatedAt: new Date().toISOString(), spaces }
    mkdirSync(dir, { recursive: true })
    writeFileSync(`${dir}snapshot.json`, `${JSON.stringify(snapshot, null, 2)}\n`)
    console.log(`\n${spaces.length} Space(s) written.`)
    expect(spaces.length).toBeGreaterThan(0)
  }, 180_000)
})
