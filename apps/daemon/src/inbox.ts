/**
 * Body and send service logic, plus the snapshot shape the HTTP layer
 * returns. The categorized snapshot now comes from the local store (see
 * sync.ts and query.ts); this module keeps the two operations that still go
 * straight to the provider: loading a message body on open, and sending.
 */

import { type Account, newAccountId } from '@postern/core'
import { type Draft, GmailAdapter } from '@postern/protocol'
import { createEmailSanitizer } from '@postern/utils'
import { JSDOM } from 'jsdom'
import { oauthResolver } from './accounts.ts'

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

/** An ephemeral Account for the adapter connection. The persistent account
 * row (with its stable branded id) lives in the store; the Gmail adapter
 * only reads address and provider, so a fresh id here is harmless. */
export function accountFor(account: string): Account {
  return {
    id: newAccountId(),
    provider: 'gmail',
    address: account,
    displayName: account,
    spaceIds: [],
    createdAt: new Date(),
  }
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
