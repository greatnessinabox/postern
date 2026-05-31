/**
 * Local store: open the libsql file, run migrations, seed the configured
 * accounts and Spaces once. The daemon syncs mail into this DB and serves
 * the UI from it, so the inbox opens instantly instead of refetching the
 * provider on every request.
 *
 * Seeding is idempotent: Spaces match by name, accounts by address. The
 * returned map gives sync and query the stable branded IDs for each
 * configured account.
 */

import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { type AccountId, newAccountId, newSpaceId, type SpaceId } from '@postern/core'
import {
  createDatabase,
  type Database,
  type DatabaseHandle,
  runMigrations,
  schema,
} from '@postern/storage'
import { eq } from 'drizzle-orm'
import { ACCOUNTS, type AccountConfig } from './accounts.ts'

export interface AccountIds {
  readonly accountId: AccountId
  readonly spaceId: SpaceId
}

export interface Store {
  readonly handle: DatabaseHandle
  readonly ids: ReadonlyMap<string, AccountIds>
}

const TINT: Record<string, 'parchment-warm' | 'parchment-cool' | 'parchment-neutral'> = {
  work: 'parchment-cool',
  personal: 'parchment-warm',
  'side-projects': 'parchment-neutral',
}

let store: Store | undefined
let opening: Promise<Store> | undefined

function dbPath(): string {
  const env = process.env['POSTERN_DB_PATH']
  return env !== undefined && env.length > 0 ? env : join(homedir(), '.postern', 'postern.db')
}

function migrationsDir(): string {
  const env = process.env['POSTERN_MIGRATIONS_DIR']
  return env !== undefined && env.length > 0 ? env : join(__dirname, 'migrations')
}

async function ensureSpace(db: Database, cfg: AccountConfig, position: number): Promise<SpaceId> {
  const existing = await db
    .select({ id: schema.spaces.id })
    .from(schema.spaces)
    .where(eq(schema.spaces.name, cfg.name))
    .limit(1)
  const found = existing[0]
  if (found !== undefined) return found.id
  const id = newSpaceId()
  await db.insert(schema.spaces).values({
    id,
    name: cfg.name,
    themeAccent: cfg.accent,
    themeBackgroundTint: TINT[cfg.spaceId] ?? 'parchment-neutral',
    themeGlyph: cfg.glyph,
    position,
  })
  return id
}

async function ensureAccount(db: Database, cfg: AccountConfig): Promise<AccountId> {
  const existing = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(eq(schema.accounts.address, cfg.account))
    .limit(1)
  const found = existing[0]
  if (found !== undefined) return found.id
  const id = newAccountId()
  await db.insert(schema.accounts).values({
    id,
    provider: 'gmail',
    address: cfg.account,
    displayName: cfg.name,
    createdAt: new Date(),
  })
  return id
}

async function seed(db: Database): Promise<Map<string, AccountIds>> {
  const ids = new Map<string, AccountIds>()
  let position = 0
  for (const cfg of ACCOUNTS) {
    const spaceId = await ensureSpace(db, cfg, position)
    const accountId = await ensureAccount(db, cfg)
    await db.insert(schema.accountSpaces).values({ accountId, spaceId }).onConflictDoNothing()
    ids.set(cfg.account, { accountId, spaceId })
    position += 1
  }
  return ids
}

export async function openStore(): Promise<Store> {
  if (store !== undefined) return store
  if (opening === undefined) {
    opening = (async () => {
      const path = dbPath()
      mkdirSync(dirname(path), { recursive: true })
      const handle = createDatabase(`file:${path}`)
      await runMigrations(handle.db, migrationsDir())
      await handle.client.execute('pragma foreign_keys = on')
      const ids = await seed(handle.db)
      store = { handle, ids }
      return store
    })().finally(() => {
      opening = undefined
    })
  }
  return opening
}
