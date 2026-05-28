/**
 * IMAP integration test against a real GreenMail server.
 *
 * Excluded from the default unit run (it needs a server). Run with
 * `pnpm test:integration` after starting GreenMail:
 *   docker compose -f docker-compose.test.yml up -d
 * CI runs it as a service job. GreenMail starts with auth disabled, so
 * any login auto-creates the mailbox.
 */

import { type Account, newAccountId } from '@postern/core'
import { ImapFlow } from 'imapflow'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ImapAdapter } from '../imap.ts'

const HOST = process.env['GREENMAIL_HOST'] ?? '127.0.0.1'
const PORT = Number(process.env['GREENMAIL_IMAP_PORT'] ?? '3143')
const USER = 'tester@postern.test'

const account: Account = {
  id: newAccountId(),
  provider: 'imap',
  address: USER,
  displayName: 'Tester',
  spaceIds: [],
  createdAt: new Date(),
  imapConfig: {
    host: HOST,
    port: PORT,
    security: 'plain',
    username: USER,
    passwordRef: 'unused-greenmail-auth-disabled',
  },
}

const rawMessage = [
  'From: Sarah Chen <sarah@example.com>',
  `To: ${USER}`,
  'Subject: Integration test',
  'Message-ID: <int-1@example.com>',
  'Authentication-Results: greenmail; spf=pass; dkim=pass; dmarc=pass',
  '',
  'Hello from GreenMail.',
].join('\r\n')

async function seedInbox(): Promise<void> {
  const client = new ImapFlow({
    host: HOST,
    port: PORT,
    secure: false,
    auth: { user: USER, pass: 'seed' },
    logger: false,
  })
  await client.connect()
  await client.append('INBOX', Buffer.from(rawMessage))
  await client.logout()
}

describe('ImapAdapter against GreenMail', () => {
  // GreenMail runs with auth disabled, so any non-empty password works.
  const adapter = new ImapAdapter(async () => 'seed')

  beforeAll(async () => {
    await seedInbox()
  }, 30_000)

  afterAll(async () => {
    // Each run appends; GreenMail is ephemeral per container so no cleanup
    // is needed in CI. Local re-runs accumulate, which the assertions tolerate.
  })

  it('connects, lists folders, and fetches the seeded message with trust', async () => {
    const connection = await adapter.connect(account)
    try {
      const folders = await adapter.listFolders(connection)
      const inbox = folders.find((f) => f.role === 'inbox')
      expect(inbox).toBeDefined()
      if (inbox === undefined) throw new Error('GreenMail returned no INBOX')

      const delta = await adapter.fetchSince(connection, inbox)
      const found = delta.messages.find((m) => m.subject === 'Integration test')
      expect(found).toBeDefined()
      expect(found?.from).toEqual({
        local: 'sarah',
        domain: 'example.com',
        displayName: 'Sarah Chen',
      })
      expect(found?.trust.verdict).toBe('trusted')
      expect(delta.cursor.folder).toBe(inbox.path)
    } finally {
      await connection.close()
    }
  }, 30_000)
})
