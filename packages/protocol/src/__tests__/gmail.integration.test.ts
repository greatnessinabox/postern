/**
 * Real Gmail integration test. Connects to imap.gmail.com over XOAUTH2
 * using credentials stashed in the macOS keychain by scripts/oauth-token.mjs.
 *
 * Opt-in: runs only when RUN_GMAIL_TEST=1, since it needs a real account.
 *   RUN_GMAIL_TEST=1 pnpm test:integration
 *
 * Reads three keychain entries (account = the Gmail address):
 *   postern-gmail-client-id, postern-gmail-client-secret, postern-gmail-refresh
 */

import { execFileSync } from 'node:child_process'
import { type Account, newAccountId } from '@postern/core'
import { describe, expect, it } from 'vitest'
import { ImapAdapter } from '../imap.ts'

const ENABLED = process.env['RUN_GMAIL_TEST'] === '1'
const ACCOUNT = process.env['POSTERN_GMAIL_ACCOUNT'] ?? 'greatnessinabox@gmail.com'

function keychain(service: string): string {
  return execFileSync('security', ['find-generic-password', '-w', '-s', service, '-a', ACCOUNT], {
    encoding: 'utf8',
  }).trim()
}

async function freshAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: keychain('postern-gmail-client-id'),
      client_secret: keychain('postern-gmail-client-secret'),
      refresh_token: keychain('postern-gmail-refresh'),
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`)
  }
  const json = (await res.json()) as { access_token?: string }
  if (json.access_token === undefined) {
    throw new Error('Token refresh returned no access_token')
  }
  return json.access_token
}

const account: Account = {
  id: newAccountId(),
  provider: 'imap',
  address: ACCOUNT,
  displayName: 'Gmail',
  spaceIds: [],
  createdAt: new Date(),
  imapConfig: {
    host: 'imap.gmail.com',
    port: 993,
    security: 'tls',
    username: ACCOUNT,
    passwordRef: 'keychain:postern-gmail-refresh',
  },
}

describe.skipIf(!ENABLED)('ImapAdapter against real Gmail', () => {
  const adapter = new ImapAdapter(async () => ({
    kind: 'oauth',
    accessToken: await freshAccessToken(),
  }))

  it('connects over XOAUTH2 and fetches recent messages from the inbox', async () => {
    const connection = await adapter.connect(account)
    try {
      const folders = await adapter.listFolders(connection)
      const inbox = folders.find((f) => f.role === 'inbox')
      expect(inbox).toBeDefined()
      if (inbox === undefined) throw new Error('Gmail returned no INBOX')

      const since = new Date()
      since.setDate(since.getDate() - 7)
      const delta = await adapter.fetchSince(connection, inbox, {
        folder: inbox.path,
        lastSyncedAt: since,
      })

      // Print the first few subjects so the run shows real inbox content.
      for (const m of delta.messages.slice(0, 8)) {
        console.log(`  [${m.trust.verdict}] ${m.subject} — ${m.from.local}@${m.from.domain}`)
      }
      console.log(`Fetched ${delta.messages.length} message(s) from the last 7 days.`)

      expect(Array.isArray(delta.messages)).toBe(true)
      expect(delta.cursor.folder).toBe(inbox.path)
    } finally {
      await connection.close()
    }
  }, 45_000)
})
