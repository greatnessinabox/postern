/**
 * Storage: SQLite (libsql) on every platform, wrapped by Drizzle.
 *
 * The eight canonical primitives map to tables in schema.ts. FTS5 and
 * sqlite-vec virtual tables land in a later migration.
 */

export const STORAGE_VERSION = 1

export {
  createDatabase,
  type Database,
  type DatabaseHandle,
  runMigrations,
} from './client.ts'
export * as schema from './schema.ts'
