import { fileURLToPath } from 'node:url'
import {
  type AccountId,
  type EmailAddress,
  newAccountId,
  newSpaceId,
  type ParsedMessage,
  type SpaceId,
} from '@postern/core'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type Database, type DatabaseHandle, runMigrations } from '../client.ts'
import { ingestMessage } from '../ingest.ts'
import { accounts, handleAddresses, handles, messages, spaces, threads } from '../schema.ts'

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))
const OWN = 'marquis@gmail.com'

function addr(local: string, domain: string, displayName?: string): EmailAddress {
  return displayName !== undefined ? { local, domain, displayName } : { local, domain }
}

function buildMessage(
  fields: Pick<ParsedMessage, 'messageIdHeader' | 'subject' | 'from' | 'date'> &
    Partial<ParsedMessage>,
): ParsedMessage {
  return {
    to: [addr('marquis', 'gmail.com')],
    cc: [],
    bcc: [],
    snippet: '',
    parts: [{ kind: 'text', contentType: 'text/plain', size: 4, inline: true, content: 'hi' }],
    hasAttachments: false,
    trust: { spf: 'none', dkim: 'none', dmarc: 'none', verdict: 'unknown' },
    classification: 'unclassified',
    ...fields,
  }
}

describe('ingestMessage', () => {
  let handle: DatabaseHandle
  let db: Database
  let accountId: AccountId
  let spaceId: SpaceId

  beforeEach(async () => {
    handle = createDatabase(':memory:')
    db = handle.db
    await runMigrations(db, migrationsFolder)
    accountId = newAccountId()
    spaceId = newSpaceId()
    await db.insert(spaces).values({
      id: spaceId,
      name: 'Personal',
      themeAccent: '#B08E5C',
      themeBackgroundTint: 'parchment-warm',
      themeGlyph: 'home',
      position: 0,
    })
    await db.insert(accounts).values({
      id: accountId,
      provider: 'gmail',
      address: OWN,
      displayName: 'Marquis',
      createdAt: new Date(),
    })
  })

  const ctx = () => ({ accountId, spaceId, ownAddress: OWN })

  it('creates a handle, thread, and message for an inbound email', async () => {
    const result = await ingestMessage(
      db,
      buildMessage({
        messageIdHeader: '<a@example.com>',
        subject: 'Q3 review prep',
        from: addr('sarah', 'example.com', 'Sarah Chen'),
        date: new Date('2026-05-27T14:00:00Z'),
      }),
      ctx(),
    )
    expect(result.created).toBe(true)

    const threadRows = await db.select().from(threads).where(eq(threads.id, result.threadId))
    expect(threadRows[0]?.subject).toBe('Q3 review prep')
    expect(threadRows[0]?.yourTurn).toBe(true)
    expect(threadRows[0]?.messageCount).toBe(1)

    const msgRows = await db.select().from(messages).where(eq(messages.id, result.messageId))
    expect(msgRows[0]?.state).toBe('received')
  })

  it('threads a reply onto the same thread via in-reply-to', async () => {
    const first = await ingestMessage(
      db,
      buildMessage({
        messageIdHeader: '<a@example.com>',
        subject: 'Q3 review prep',
        from: addr('sarah', 'example.com'),
        date: new Date('2026-05-27T14:00:00Z'),
      }),
      ctx(),
    )
    const second = await ingestMessage(
      db,
      buildMessage({
        messageIdHeader: '<b@gmail.com>',
        inReplyTo: '<a@example.com>',
        subject: 'Re: Q3 review prep',
        from: addr('marquis', 'gmail.com'),
        date: new Date('2026-05-27T15:00:00Z'),
      }),
      ctx(),
    )
    expect(second.threadId).toBe(first.threadId)

    const threadRows = await db.select().from(threads).where(eq(threads.id, first.threadId))
    expect(threadRows[0]?.messageCount).toBe(2)
    expect(threadRows[0]?.yourTurn).toBe(false)
  })

  it('threads by normalized subject when there is no in-reply-to', async () => {
    const first = await ingestMessage(
      db,
      buildMessage({
        messageIdHeader: '<x1@example.com>',
        subject: 'Project kickoff',
        from: addr('sarah', 'example.com'),
        date: new Date('2026-05-27T10:00:00Z'),
      }),
      ctx(),
    )
    const second = await ingestMessage(
      db,
      buildMessage({
        messageIdHeader: '<x2@example.com>',
        subject: 'RE: Project kickoff',
        from: addr('alex', 'example.com'),
        date: new Date('2026-05-27T11:00:00Z'),
      }),
      ctx(),
    )
    expect(second.threadId).toBe(first.threadId)
  })

  it('dedups a message already ingested by Message-ID', async () => {
    const message = buildMessage({
      messageIdHeader: '<dup@example.com>',
      subject: 'Only once',
      from: addr('sarah', 'example.com'),
      date: new Date('2026-05-27T10:00:00Z'),
    })
    const first = await ingestMessage(db, message, ctx())
    const second = await ingestMessage(db, message, ctx())
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.messageId).toBe(first.messageId)

    const allMessages = await db.select().from(messages)
    expect(allMessages).toHaveLength(1)
  })

  it('marks an outbound message as sent and clears your-turn', async () => {
    const result = await ingestMessage(
      db,
      buildMessage({
        messageIdHeader: '<sent@gmail.com>',
        subject: 'Heads up',
        from: addr('marquis', 'gmail.com'),
        date: new Date('2026-05-27T12:00:00Z'),
      }),
      ctx(),
    )
    const msgRows = await db.select().from(messages).where(eq(messages.id, result.messageId))
    expect(msgRows[0]?.state).toBe('sent')

    const threadRows = await db.select().from(threads).where(eq(threads.id, result.threadId))
    expect(threadRows[0]?.yourTurn).toBe(false)
  })

  it('persists the sender trust verdict on the message row', async () => {
    const result = await ingestMessage(
      db,
      buildMessage({
        messageIdHeader: '<trust@example.com>',
        subject: 'Authenticated',
        from: addr('sarah', 'example.com'),
        date: new Date('2026-05-27T13:00:00Z'),
        trust: { spf: 'pass', dkim: 'pass', dmarc: 'pass', verdict: 'trusted' },
      }),
      ctx(),
    )
    const msgRows = await db.select().from(messages).where(eq(messages.id, result.messageId))
    expect(msgRows[0]?.trustVerdict).toBe('trusted')
    expect(msgRows[0]?.trustSpf).toBe('pass')
  })

  it('reuses one handle for the same address across messages', async () => {
    await ingestMessage(
      db,
      buildMessage({
        messageIdHeader: '<h1@example.com>',
        subject: 'First',
        from: addr('sarah', 'example.com', 'Sarah Chen'),
        date: new Date('2026-05-27T10:00:00Z'),
      }),
      ctx(),
    )
    await ingestMessage(
      db,
      buildMessage({
        messageIdHeader: '<h2@example.com>',
        subject: 'Second unrelated subject',
        from: addr('sarah', 'example.com', 'Sarah Chen'),
        date: new Date('2026-05-27T11:00:00Z'),
      }),
      ctx(),
    )

    const sarahAddrs = await db
      .select()
      .from(handleAddresses)
      .where(eq(handleAddresses.domain, 'example.com'))
    expect(sarahAddrs).toHaveLength(1)
    const allHandles = await db.select().from(handles)
    // marquis (own, from the 'to' field) + sarah
    expect(allHandles.length).toBe(2)
  })
})
