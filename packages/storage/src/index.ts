/**
 * Storage adapters: SQLite (libsql) on every platform.
 *
 * Schemas live here. Drizzle ORM wraps libsql. The eight canonical
 * primitives map to tables one-to-one. FTS5 indexes message bodies.
 * sqlite-vec indexes embeddings.
 *
 * Schema definitions land in subsequent commits once drizzle-orm is
 * installed.
 */

export const STORAGE_VERSION = 1
