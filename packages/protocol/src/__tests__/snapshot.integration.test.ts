/**
 * Generates a real-inbox snapshot for the web canvas. Opt-in:
 *   RUN_SNAPSHOT=1 pnpm test:integration
 *
 * Uses the fast envelope + headers path (no full-body download): classifies
 * with the shipped classifier, scores trust from auth headers, buckets by
 * surface, and writes apps/web/app/canvas/snapshot.json (gitignored, it
 * holds private mail). The canvas reads it if present.
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { classifyMessage, surfaceFor } from '@postern/core'
import { ImapFlow } from 'imapflow'
import { describe, expect, it } from 'vitest'
import { summarizeTrust } from '../trust.ts'

const ENABLED = process.env['RUN_SNAPSHOT'] === '1'
const ACCT = process.env['POSTERN_GMAIL_ACCOUNT'] ?? 'greatnessinabox@gmail.com'
const FETCH = Number(process.env['SNAPSHOT_FETCH'] ?? '300')
const PER_SURFACE = 16

const kc = (s: string) =>
  execFileSync('security', ['find-generic-password', '-w', '-s', s, '-a', ACCT], {
    encoding: 'utf8',
  }).trim()

const dir = fileURLToPath(new URL('../../../../apps/web/app/canvas/', import.meta.url))

function parseHeaders(buf: Buffer | undefined): Map<string, string> {
  const map = new Map<string, string>()
  if (buf === undefined) return map
  for (const line of buf.toString().split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) map.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim())
  }
  return map
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

describe.skipIf(!ENABLED)('inbox snapshot', () => {
  it('writes a categorized snapshot from real Gmail', async () => {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: kc('postern-gmail-client-id'),
        client_secret: kc('postern-gmail-client-secret'),
        refresh_token: kc('postern-gmail-refresh'),
        grant_type: 'refresh_token',
      }),
    })
    const { access_token } = (await res.json()) as { access_token: string }
    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: ACCT, accessToken: access_token },
      logger: false,
    })
    await client.connect()
    const lock = await client.getMailboxLock('INBOX', { readOnly: true })

    const buckets: Record<string, Card[]> = {
      threads: [],
      reader: [],
      notifications: [],
      ledger: [],
    }
    const seen: Record<string, Set<string>> = {
      threads: new Set(),
      reader: new Set(),
      notifications: new Set(),
      ledger: new Set(),
    }

    try {
      const mailbox = client.mailbox
      if (mailbox === false) throw new Error('INBOX did not open')
      const start = Math.max(1, mailbox.exists - FETCH + 1)
      for await (const m of client.fetch(`${start}:*`, {
        envelope: true,
        headers: [
          'list-unsubscribe',
          'list-id',
          'precedence',
          'auto-submitted',
          'x-github-event',
          'authentication-results',
          'received-spf',
          'dkim-signature',
        ],
      })) {
        const env = m.envelope
        if (env === undefined) continue
        const h = parseHeaders(m.headers)
        const fromEntry = env.from?.[0]
        const addr = (fromEntry?.address ?? '').toLowerCase()
        const at = addr.indexOf('@')
        const subject = env.subject ?? '(no subject)'
        const category = classifyMessage({
          fromLocal: at >= 0 ? addr.slice(0, at) : addr,
          fromDomain: at >= 0 ? addr.slice(at + 1) : '',
          subject,
          hasListUnsubscribe: h.has('list-unsubscribe'),
          hasListId: h.has('list-id'),
          precedence: h.get('precedence') ?? '',
          autoSubmitted: h.get('auto-submitted') ?? '',
          hasGithubEventHeader: h.has('x-github-event'),
        })
        const surface = surfaceFor(category)
        const bucket = buckets[surface]
        const seenKeys = seen[surface]
        if (bucket === undefined || seenKeys === undefined) continue

        const key = norm(subject)
        if (seenKeys.has(key)) {
          const existing = bucket.find((c) => norm(c.subject) === key)
          if (existing !== undefined) existing.messageCount += 1
          continue
        }
        seenKeys.add(key)

        const authResults = h.get('authentication-results')
        const trust = summarizeTrust({
          authenticationResults: authResults !== undefined ? [authResults] : [],
          hasDkimSignature: h.has('dkim-signature'),
          ...(h.has('received-spf') ? { receivedSpf: h.get('received-spf') ?? '' } : {}),
        })

        bucket.push({
          subject,
          fromName: fromEntry?.name ?? '',
          fromAddress: addr,
          date: (env.date ?? new Date(0)).toISOString(),
          category,
          trust: trust.verdict,
          messageCount: 1,
        })
      }
    } finally {
      lock.release()
      await client.logout()
    }

    const snapshot = {
      generatedAt: new Date().toISOString(),
      account: ACCT,
      surfaces: Object.fromEntries(
        Object.entries(buckets).map(([s, cards]) => [
          s,
          {
            total: cards.length,
            items: cards.sort((a, b) => b.date.localeCompare(a.date)).slice(0, PER_SURFACE),
          },
        ]),
      ),
    }

    mkdirSync(dir, { recursive: true })
    writeFileSync(`${dir}snapshot.json`, `${JSON.stringify(snapshot, null, 2)}\n`)
    console.log(`\nSnapshot written. Surface totals:`)
    for (const [s, b] of Object.entries(snapshot.surfaces))
      console.log(`  ${s.padEnd(14)} ${b.total}`)
    expect(Object.keys(snapshot.surfaces)).toContain('threads')
  }, 60_000)
})
