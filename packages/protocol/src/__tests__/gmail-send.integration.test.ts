/**
 * Real Gmail send. Opt-in: RUN_GMAIL_SEND=1 pnpm test:integration
 *
 * Sends a test message from one account to the user's own gmail and asserts
 * Gmail accepted it (returns the Message-ID). Sending to yourself keeps it
 * benign. Reads creds from the macOS keychain like the other integration
 * tests. Set SEND_FROM / SEND_TO to override.
 */

import { execFileSync } from 'node:child_process'
import { type Account, newAccountId } from '@postern/core'
import { describe, expect, it } from 'vitest'
import { GmailAdapter } from '../gmail.ts'

const ENABLED = process.env['RUN_GMAIL_SEND'] === '1'
const FROM = process.env['SEND_FROM'] ?? 'marquis@cleverer.tech'
const TO = process.env['SEND_TO'] ?? 'greatnessinabox@gmail.com'

function kc(service: string, account: string): string {
  return execFileSync('security', ['find-generic-password', '-w', '-s', service, '-a', account], {
    encoding: 'utf8',
  }).trim()
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

const account: Account = {
  id: newAccountId(),
  provider: 'gmail',
  address: FROM,
  displayName: 'Postern Send Test',
  spaceIds: [],
  createdAt: new Date(),
}

describe.skipIf(!ENABLED)('GmailAdapter.send against real Gmail', () => {
  it('sends a message and Gmail accepts it', async () => {
    const adapter = new GmailAdapter(async () => ({
      kind: 'oauth',
      accessToken: await accessToken(FROM),
    }))
    const connection = await adapter.connect(account)
    try {
      const stamp = new Date().toISOString()
      const messageId = await adapter.send(connection, {
        subject: `Postern send test ${stamp}`,
        toAddresses: [TO],
        ccAddresses: [],
        bccAddresses: [],
        body: `This message was sent by Postern from ${FROM} at ${stamp}.\n\nIf you are reading this in your inbox, send works.`,
        attachmentRefs: [],
      })
      console.log(`\nSent from ${FROM} to ${TO}. Message-ID: ${messageId}`)
      expect(messageId).toMatch(/^<.+@.+>$/)
    } finally {
      await connection.close()
    }
  }, 45_000)
})
