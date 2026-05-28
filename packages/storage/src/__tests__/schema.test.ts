import { fileURLToPath } from 'node:url'
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
    const now = new Date()
    await handle.db.insert(accounts).values({
      id: 'acc_1',
      provider: 'gmail',
      address: 'marquis@gmail.com',
      displayName: 'Marquis Nobles',
      createdAt: now,
    })

    const rows = await handle.db.select().from(accounts).where(eq(accounts.id, 'acc_1'))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.provider).toBe('gmail')
    expect(rows[0]?.address).toBe('marquis@gmail.com')
  })

  it('links an account to a space through the join table', async () => {
    const now = new Date()
    await handle.db.insert(spaces).values({
      id: 'spc_work',
      name: 'Work',
      themeAccent: '#4A5568',
      themeBackgroundTint: 'parchment-cool',
      themeGlyph: 'ted',
      position: 0,
    })
    await handle.db.insert(accounts).values({
      id: 'acc_ted',
      provider: 'microsoft',
      address: 'marquis@ted.com',
      displayName: 'Marquis at TED',
      createdAt: now,
    })
    await handle.db.insert(accountSpaces).values({ accountId: 'acc_ted', spaceId: 'spc_work' })

    const links = await handle.db
      .select()
      .from(accountSpaces)
      .where(eq(accountSpaces.spaceId, 'spc_work'))
    expect(links).toHaveLength(1)
    expect(links[0]?.accountId).toBe('acc_ted')
  })

  it('models a handle with multiple addresses', async () => {
    await handle.db.insert(handles).values({
      id: 'hdl_marquis',
      displayName: 'Marquis Nobles',
    })
    await handle.db.insert(handleAddresses).values([
      { handleId: 'hdl_marquis', local: 'marquis', domain: 'cleverer.tech' },
      { handleId: 'hdl_marquis', local: 'marquis', domain: 'ted.com' },
      { handleId: 'hdl_marquis', local: 'marquis', domain: 'gmail.com' },
    ])

    const addrs = await handle.db
      .select()
      .from(handleAddresses)
      .where(eq(handleAddresses.handleId, 'hdl_marquis'))
    expect(addrs).toHaveLength(3)
    expect(addrs.map((a) => a.domain).sort()).toEqual(['cleverer.tech', 'gmail.com', 'ted.com'])
  })

  it('cascades thread deletes to messages', async () => {
    const now = new Date()
    await handle.client.execute('pragma foreign_keys = on')
    await handle.db.insert(spaces).values({
      id: 'spc_1',
      name: 'Personal',
      themeAccent: '#B08E5C',
      themeBackgroundTint: 'parchment-warm',
      themeGlyph: 'home',
      position: 1,
    })
    await handle.db.insert(accounts).values({
      id: 'acc_2',
      provider: 'imap',
      address: 'm@example.com',
      displayName: 'M',
      createdAt: now,
    })
    await handle.db.insert(handles).values({
      id: 'hdl_1',
      displayName: 'Sender',
    })
    await handle.db.insert(threads).values({
      id: 'thr_1',
      accountId: 'acc_2',
      spaceId: 'spc_1',
      subject: 'Q3 review prep',
      subjectNormalized: 'q3 review prep',
      firstMessageAt: now,
      lastMessageAt: now,
    })
    await handle.db.insert(messages).values({
      id: 'msg_1',
      threadId: 'thr_1',
      accountId: 'acc_2',
      messageIdHeader: '<a@example.com>',
      state: 'received',
      fromHandleId: 'hdl_1',
      subject: 'Q3 review prep',
      receivedAt: now,
    })

    await handle.db.delete(threads).where(eq(threads.id, 'thr_1'))

    const remaining = await handle.db.select().from(messages).where(eq(messages.threadId, 'thr_1'))
    expect(remaining).toHaveLength(0)
  })
})
