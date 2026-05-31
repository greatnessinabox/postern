/**
 * Sync: pull new mail from each account into the local store.
 *
 * Reads the saved cursor per account so each run only fetches what arrived
 * since the last sync (Gmail's after: filter is day-granular; ingest dedups
 * by Message-ID so the day's overlap costs nothing). Newly-arrived personal
 * mail gets one AI-triage pass to demote the bulk that slipped past the
 * heuristics. The provider stays the source of truth; this only catches the
 * store up to it.
 */

import { AnthropicProvider, type TriageInput } from '@postern/ai'
import type { AccountId, MessageId } from '@postern/core'
import { type Folder, GmailAdapter, type SyncCursor } from '@postern/protocol'
import { type Database, ingestMessage, schema } from '@postern/storage'
import { and, eq } from 'drizzle-orm'
import {
  ACCOUNTS,
  type AccountConfig,
  anthropicKey,
  hasCredentials,
  oauthResolver,
} from './accounts.ts'
import { type AccountIds, openStore } from './db.ts'
import { accountFor } from './inbox.ts'

const FETCH = Number(process.env['DAEMON_FETCH'] ?? '120')

let running: Promise<void> | undefined

async function readCursor(
  db: Database,
  accountId: AccountId,
  folder: string,
): Promise<SyncCursor | undefined> {
  const rows = await db
    .select()
    .from(schema.syncCursors)
    .where(and(eq(schema.syncCursors.accountId, accountId), eq(schema.syncCursors.folder, folder)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) return undefined
  return {
    folder: row.folder,
    lastSyncedAt: row.lastSyncedAt,
    ...(row.lastUid !== null ? { lastUid: row.lastUid } : {}),
    ...(row.lastModseq !== null ? { lastModseq: row.lastModseq } : {}),
  }
}

async function writeCursor(db: Database, accountId: AccountId, cursor: SyncCursor): Promise<void> {
  const values = {
    accountId,
    folder: cursor.folder,
    lastSyncedAt: cursor.lastSyncedAt,
    lastUid: cursor.lastUid ?? null,
    lastModseq: cursor.lastModseq ?? null,
  }
  await db
    .insert(schema.syncCursors)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.syncCursors.accountId, schema.syncCursors.folder],
      set: {
        lastSyncedAt: values.lastSyncedAt,
        lastUid: values.lastUid,
        lastModseq: values.lastModseq,
      },
    })
}

async function triagePersonal(
  db: Database,
  provider: AnthropicProvider,
  items: readonly { messageId: MessageId; input: TriageInput }[],
): Promise<void> {
  const results = await provider.triage(items.map((i) => i.input))
  for (const r of results) {
    const item = items[r.index]
    if (item === undefined || r.category === 'personal') continue
    await db
      .update(schema.messages)
      .set({ classification: r.category })
      .where(eq(schema.messages.id, item.messageId))
  }
}

async function syncAccount(
  db: Database,
  cfg: AccountConfig,
  ids: AccountIds,
  provider: AnthropicProvider | undefined,
  force: boolean,
): Promise<void> {
  const adapter = new GmailAdapter(oauthResolver(cfg.account))
  const connection = await adapter.connect(accountFor(cfg.account))
  try {
    const folders = await adapter.listFolders(connection)
    const inbox: Folder | undefined = folders.find((f) => f.role === 'inbox') ?? folders[0]
    if (inbox === undefined) return
    const cursor = force ? undefined : await readCursor(db, ids.accountId, inbox.path)
    const delta = await adapter.fetchSince(connection, inbox, cursor, FETCH)

    const fresh: { messageId: MessageId; input: TriageInput }[] = []
    for (const m of delta.messages) {
      const result = await ingestMessage(
        db,
        m,
        { accountId: ids.accountId, spaceId: ids.spaceId, ownAddress: cfg.account },
        undefined,
      )
      if (result.created && m.classification === 'personal') {
        fresh.push({
          messageId: result.messageId,
          input: {
            fromName: m.from.displayName ?? '',
            fromAddress: `${m.from.local}@${m.from.domain}`,
            subject: m.subject,
            snippet: m.snippet,
            heuristicCategory: 'personal',
          },
        })
      }
    }

    await writeCursor(db, ids.accountId, delta.cursor)
    await db
      .update(schema.accounts)
      .set({ lastSyncedAt: new Date() })
      .where(eq(schema.accounts.id, ids.accountId))

    if (provider !== undefined && fresh.length > 0) await triagePersonal(db, provider, fresh)
  } finally {
    await connection.close()
  }
}

/**
 * Sync every credentialed account into the store. Serialized behind a single
 * promise so overlapping triggers (startup + a refresh request) coalesce.
 * `force` ignores cursors for a full re-pull.
 */
export function syncAll(force = false): Promise<void> {
  if (running !== undefined) return running
  running = (async () => {
    const { handle, ids } = await openStore()
    const key = anthropicKey()
    const provider = key !== undefined ? new AnthropicProvider({ apiKey: key }) : undefined
    for (const cfg of ACCOUNTS) {
      if (!hasCredentials(cfg.account)) continue
      const idPair = ids.get(cfg.account)
      if (idPair === undefined) continue
      try {
        await syncAccount(handle.db, cfg, idPair, provider, force)
      } catch {
        // One account failing must not stop the others.
      }
    }
  })().finally(() => {
    running = undefined
  })
  return running
}
