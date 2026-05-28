/**
 * Database client. Wraps libsql with Drizzle.
 *
 * Same code path on every platform. Pass ':memory:' for tests, a file
 * URL for desktop and mobile, or a libsql server URL for the optional
 * sync relay.
 */

import { type Client, createClient } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from './schema.ts'

export type Database = LibSQLDatabase<typeof schema>

export interface DatabaseHandle {
  readonly db: Database
  readonly client: Client
}

export function createDatabase(url: string): DatabaseHandle {
  const client = createClient({ url })
  const db = drizzle(client, { schema })
  return { db, client }
}

export async function runMigrations(db: Database, migrationsFolder: string): Promise<void> {
  await migrate(db, { migrationsFolder })
}
