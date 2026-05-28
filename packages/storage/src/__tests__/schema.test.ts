import { fileURLToPath } from 'node:url'
import { newAccountId, newHandleId, newMessageId, newSpaceId, newThreadId } from '@postern/core'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type DatabaseHandle, runMigrations } from '../client.ts'
import {
  accountSpaces,
  accounts,
  handleAddresses,
  handles,
  messages,
  spaces,
  threads,
} from '../schema.ts'

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

async function freshDb(): Promise<DatabaseHandle> {
  const handle = createDatabase(':memory:')
  await runMigrations(handle.db, migrationsFolder)
  return handle
}

describe('storage schema', () => {
  let handle: DatabaseHandle

  beforeEach(async () => {
    handle = await freshDb()
  })

  it('creates all 13 tables via migration', async () => {
    const result = await handle.client.execute(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '__drizzle%'",
    )
    const tableNames = result.rows.map((r) => r['name']).sort()
    expect(tableNames).toEqual([
      'account_spaces',
      'accounts',
      'boosts',
      'handle_addresses',
      'handles',
      'message_recipients',
      'messages',
      'parts',
      'schema_version',
      'spaces',
      'sync_cursors',
      'thread_participants',
      'threads',
    ])
  })

  it('inserts and reads an account', async () => {
    const accId = newAccountId()
    await handle.db.insert(accounts).values({
      id: accId,
      provider: 'gmail',
      address: 'marquis@gmail.com',
      displayName: 'Marquis Nobles',
      createdAt: new Date(),
    })

    const rows = await handle.db.select().from(accounts).where(eq(accounts.id, accId))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.provider).toBe('gmail')
    expect(rows[0]?.address).toBe('marquis@gmail.com')
  })

  it('links an account to a space through the join table', async () => {
    const accId = newAccountId()
    const spaceId = newSpaceId()
    await handle.db.insert(spaces).values({
      id: spaceId,
      name: 'Work',
      themeAccent: '#4A5568',
      themeBackgroundTint: 'parchment-cool',
      themeGlyph: 'ted',
      position: 0,
    })
    await handle.db.insert(accounts).values({
      id: accId,
      provider: 'microsoft',
      address: 'marquis@ted.com',
      displayName: 'Marquis at TED',
      createdAt: new Date(),
    })
    await handle.db.insert(accountSpaces).values({ accountId: accId, spaceId })

    const links = await handle.db
      .select()
      .from(accountSpaces)
      .where(eq(accountSpaces.spaceId, spaceId))
    expect(links).toHaveLength(1)
    expect(links[0]?.accountId).toBe(accId)
  })

  it('models a handle with multiple addresses', async () => {
    const handleId = newHandleId()
    await handle.db.insert(handles).values({
      id: handleId,
      displayName: 'Marquis Nobles',
    })
    await handle.db.insert(handleAddresses).values([
      { handleId, local: 'marquis', domain: 'cleverer.tech' },
      { handleId, local: 'marquis', domain: 'ted.com' },
      { handleId, local: 'marquis', domain: 'gmail.com' },
    ])

    const addrs = await handle.db
      .select()
      .from(handleAddresses)
      .where(eq(handleAddresses.handleId, handleId))
    expect(addrs).toHaveLength(3)
    expect(addrs.map((a) => a.domain).sort()).toEqual(['cleverer.tech', 'gmail.com', 'ted.com'])
  })

  it('cascades thread deletes to messages', async () => {
    const accId = newAccountId()
    const spaceId = newSpaceId()
    const handleId = newHandleId()
    const threadId = newThreadId()
    const messageId = newMessageId()
    const now = new Date()
    await handle.client.execute('pragma foreign_keys = on')
    await handle.db.insert(spaces).values({
      id: spaceId,
      name: 'Personal',
      themeAccent: '#B08E5C',
      themeBackgroundTint: 'parchment-warm',
      themeGlyph: 'home',
      position: 1,
    })
    await handle.db.insert(accounts).values({
      id: accId,
      provider: 'imap',
      address: 'm@example.com',
      displayName: 'M',
      createdAt: now,
    })
    await handle.db.insert(handles).values({ id: handleId, displayName: 'Sender' })
    await handle.db.insert(threads).values({
      id: threadId,
      accountId: accId,
      spaceId,
      subject: 'Q3 review prep',
      subjectNormalized: 'q3 review prep',
      firstMessageAt: now,
      lastMessageAt: now,
    })
    await handle.db.insert(messages).values({
      id: messageId,
      threadId,
      accountId: accId,
      messageIdHeader: '<a@example.com>',
      state: 'received',
      fromHandleId: handleId,
      subject: 'Q3 review prep',
      receivedAt: now,
    })

    await handle.db.delete(threads).where(eq(threads.id, threadId))

    const remaining = await handle.db.select().from(messages).where(eq(messages.threadId, threadId))
    expect(remaining).toHaveLength(0)
  })
})
