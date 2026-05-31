/**
 * Read the categorized snapshot from the local store. This is the fast path
 * the UI hits: no provider round-trip, just the synced rows bucketed into
 * surfaces. Messages collapse to one card per thread, latest first.
 */

import { type AccountId, surfaceFor } from '@postern/core'
import { type Database, schema } from '@postern/storage'
import { desc, eq } from 'drizzle-orm'
import { ACCOUNTS } from './accounts.ts'
import { openStore } from './db.ts'
import type { Card, InboxSnapshot, SpaceSnapshot } from './inbox.ts'

const PER_SURFACE = 16
const SCAN = 2000
const SURFACES = ['threads', 'reader', 'notifications', 'ledger'] as const

async function addressMap(db: Database, accountId: AccountId): Promise<Map<string, string>> {
  const rows = await db
    .selectDistinct({
      handleId: schema.handleAddresses.handleId,
      local: schema.handleAddresses.local,
      domain: schema.handleAddresses.domain,
    })
    .from(schema.handleAddresses)
    .innerJoin(schema.messages, eq(schema.messages.fromHandleId, schema.handleAddresses.handleId))
    .where(eq(schema.messages.accountId, accountId))
  const map = new Map<string, string>()
  for (const r of rows) {
    if (!map.has(r.handleId)) map.set(r.handleId, `${r.local}@${r.domain}`)
  }
  return map
}

async function surfacesFor(db: Database, accountId: AccountId): Promise<SpaceSnapshot['surfaces']> {
  const rows = await db
    .select({
      threadId: schema.messages.threadId,
      subject: schema.messages.subject,
      classification: schema.messages.classification,
      trust: schema.messages.trustVerdict,
      receivedAt: schema.messages.receivedAt,
      header: schema.messages.messageIdHeader,
      fromHandleId: schema.messages.fromHandleId,
      fromName: schema.handles.displayName,
    })
    .from(schema.messages)
    .innerJoin(schema.handles, eq(schema.handles.id, schema.messages.fromHandleId))
    .where(eq(schema.messages.accountId, accountId))
    .orderBy(desc(schema.messages.receivedAt))
    .limit(SCAN)

  const addrs = await addressMap(db, accountId)
  const buckets: Record<string, Map<string, Card>> = {
    threads: new Map(),
    reader: new Map(),
    notifications: new Map(),
    ledger: new Map(),
  }
  for (const row of rows) {
    const bucket = buckets[surfaceFor(row.classification)]
    if (bucket === undefined) continue
    const existing = bucket.get(row.threadId)
    if (existing !== undefined) {
      existing.messageCount += 1
      continue
    }
    bucket.set(row.threadId, {
      subject: row.subject || '(no subject)',
      fromName: row.fromName,
      fromAddress: addrs.get(row.fromHandleId) ?? '',
      date: row.receivedAt.toISOString(),
      category: row.classification,
      trust: row.trust,
      messageCount: 1,
      messageIdHeader: row.header,
    })
  }

  return Object.fromEntries(
    SURFACES.map((s) => {
      const cards = [...(buckets[s]?.values() ?? [])]
      return [s, { total: cards.length, items: cards.slice(0, PER_SURFACE) }]
    }),
  )
}

export async function buildSnapshotFromStore(): Promise<InboxSnapshot> {
  const { handle, ids } = await openStore()
  const spaces: SpaceSnapshot[] = []
  for (const cfg of ACCOUNTS) {
    const idPair = ids.get(cfg.account)
    if (idPair === undefined) continue
    spaces.push({
      id: cfg.spaceId,
      name: cfg.name,
      account: cfg.account,
      accent: cfg.accent,
      glyph: cfg.glyph,
      surfaces: await surfacesFor(handle.db, idPair.accountId),
    })
  }
  return { generatedAt: new Date().toISOString(), spaces }
}
