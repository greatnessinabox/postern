/**
 * Ingestion: a ParsedMessage becomes rows.
 *
 * Resolves addresses to Handles (find or create), dedups by Message-ID
 * within the account, threads messages together (by In-Reply-To, then by
 * normalized subject, else a new thread), and keeps thread aggregates
 * current. This is the bridge from the protocol layer to storage.
 */

import {
  type AccountId,
  type EmailAddress,
  type HandleId,
  type MessageId,
  newHandleId,
  newMessageId,
  newPartId,
  newThreadId,
  type ParsedMessage,
  type SpaceId,
  type ThreadId,
} from '@postern/core'
import { and, eq } from 'drizzle-orm'
import type { Database } from './client.ts'
import {
  handleAddresses,
  handles,
  messageRecipients,
  messages,
  parts,
  threadParticipants,
  threads,
} from './schema.ts'

export interface IngestContext {
  readonly accountId: AccountId
  readonly spaceId: SpaceId
  readonly ownAddress: string
}

export interface IngestResult {
  readonly threadId: ThreadId
  readonly messageId: MessageId
  readonly created: boolean
}

function addressString(addr: EmailAddress): string {
  return `${addr.local}@${addr.domain}`
}

function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(\s*(re|fwd|fw)\s*:\s*)+/i, '')
    .trim()
    .toLowerCase()
}

async function resolveHandle(
  db: Database,
  addr: EmailAddress,
  cache?: Map<string, HandleId>,
): Promise<HandleId> {
  const key = addressString(addr)
  const cached = cache?.get(key)
  if (cached !== undefined) return cached

  const existing = await db
    .select({ handleId: handleAddresses.handleId })
    .from(handleAddresses)
    .where(and(eq(handleAddresses.local, addr.local), eq(handleAddresses.domain, addr.domain)))
    .limit(1)
  const found = existing[0]
  if (found !== undefined) {
    cache?.set(key, found.handleId)
    return found.handleId
  }

  const handleId = newHandleId()
  await db.insert(handles).values({
    id: handleId,
    displayName: addr.displayName ?? addressString(addr),
  })
  await db.insert(handleAddresses).values({
    handleId,
    local: addr.local,
    domain: addr.domain,
    ...(addr.displayName !== undefined ? { displayName: addr.displayName } : {}),
  })
  cache?.set(key, handleId)
  return handleId
}

async function resolveThread(
  db: Database,
  parsed: ParsedMessage,
  ctx: IngestContext,
  normalized: string,
): Promise<ThreadId> {
  if (parsed.inReplyTo !== undefined && parsed.inReplyTo.length > 0) {
    const parent = await db
      .select({ threadId: messages.threadId })
      .from(messages)
      .where(
        and(eq(messages.accountId, ctx.accountId), eq(messages.messageIdHeader, parsed.inReplyTo)),
      )
      .limit(1)
    const found = parent[0]
    if (found !== undefined) return found.threadId
  }

  if (normalized.length > 0) {
    const match = await db
      .select({ id: threads.id })
      .from(threads)
      .where(and(eq(threads.accountId, ctx.accountId), eq(threads.subjectNormalized, normalized)))
      .limit(1)
    const found = match[0]
    if (found !== undefined) return found.id
  }

  const threadId = newThreadId()
  await db.insert(threads).values({
    id: threadId,
    accountId: ctx.accountId,
    spaceId: ctx.spaceId,
    subject: parsed.subject,
    subjectNormalized: normalized,
    messageCount: 0,
    yourTurn: false,
    firstMessageAt: parsed.date,
    lastMessageAt: parsed.date,
  })
  return threadId
}

async function bumpThread(
  db: Database,
  threadId: ThreadId,
  date: Date,
  direction: 'sent' | 'received',
): Promise<void> {
  const rows = await db.select().from(threads).where(eq(threads.id, threadId)).limit(1)
  const thread = rows[0]
  if (thread === undefined) return
  const isLatest = date.getTime() >= thread.lastMessageAt.getTime()
  await db
    .update(threads)
    .set({
      messageCount: thread.messageCount + 1,
      lastMessageAt: isLatest ? date : thread.lastMessageAt,
      firstMessageAt:
        date.getTime() < thread.firstMessageAt.getTime() ? date : thread.firstMessageAt,
      yourTurn: isLatest ? direction === 'received' : thread.yourTurn,
    })
    .where(eq(threads.id, threadId))
}

export async function ingestMessage(
  db: Database,
  parsed: ParsedMessage,
  ctx: IngestContext,
  handleCache?: Map<string, HandleId>,
): Promise<IngestResult> {
  // Messages with no Message-ID (some automated senders, drafts) still get a
  // deterministic dedup key from account + sender + subject + time, so
  // re-ingesting one does not insert a duplicate row.
  const dedupeKey =
    parsed.messageIdHeader.length > 0
      ? parsed.messageIdHeader
      : `synthetic:${addressString(parsed.from)}:${normalizeSubject(parsed.subject)}:${parsed.date.getTime()}`

  const dup = await db
    .select({ id: messages.id, threadId: messages.threadId })
    .from(messages)
    .where(and(eq(messages.accountId, ctx.accountId), eq(messages.messageIdHeader, dedupeKey)))
    .limit(1)
  const existing = dup[0]
  if (existing !== undefined) {
    return { threadId: existing.threadId, messageId: existing.id, created: false }
  }

  const fromHandleId = await resolveHandle(db, parsed.from, handleCache)
  const direction = addressString(parsed.from) === ctx.ownAddress ? 'sent' : 'received'
  const normalized = normalizeSubject(parsed.subject)
  const threadId = await resolveThread(db, parsed, ctx, normalized)

  const messageId = newMessageId()
  await db.insert(messages).values({
    id: messageId,
    threadId,
    accountId: ctx.accountId,
    messageIdHeader: dedupeKey,
    state: direction,
    fromHandleId,
    subject: parsed.subject,
    snippet: parsed.snippet,
    classification: parsed.classification,
    hasAttachments: parsed.hasAttachments,
    trustSpf: parsed.trust.spf,
    trustDkim: parsed.trust.dkim,
    trustDmarc: parsed.trust.dmarc,
    trustVerdict: parsed.trust.verdict,
    receivedAt: parsed.date,
    ...(parsed.inReplyTo !== undefined ? { inReplyTo: parsed.inReplyTo } : {}),
    ...(direction === 'sent' ? { sentAt: parsed.date } : {}),
  })

  for (const part of parsed.parts) {
    await db.insert(parts).values({
      id: newPartId(),
      messageId,
      kind: part.kind,
      contentType: part.contentType,
      size: part.size,
      inline: part.inline,
      ...(part.filename !== undefined ? { filename: part.filename } : {}),
      ...(part.content !== undefined ? { content: part.content } : {}),
      ...(part.contentId !== undefined ? { contentId: part.contentId } : {}),
    })
  }

  const recipientGroups = [
    { role: 'to' as const, list: parsed.to },
    { role: 'cc' as const, list: parsed.cc },
    { role: 'bcc' as const, list: parsed.bcc },
  ]
  for (const group of recipientGroups) {
    for (const addr of group.list) {
      const handleId = await resolveHandle(db, addr, handleCache)
      await db
        .insert(messageRecipients)
        .values({ messageId, handleId, role: group.role })
        .onConflictDoNothing()
      await db
        .insert(threadParticipants)
        .values({ threadId, handleId, role: group.role })
        .onConflictDoNothing()
    }
  }
  await db
    .insert(threadParticipants)
    .values({ threadId, handleId: fromHandleId, role: 'from' })
    .onConflictDoNothing()

  await bumpThread(db, threadId, parsed.date, direction)

  return { threadId, messageId, created: true }
}
