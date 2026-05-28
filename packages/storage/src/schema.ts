/**
 * SQLite schema for the eight canonical primitives.
 *
 * Tables map to the core types one-to-one where the shape is flat.
 * Many-to-many relations (account/space) and one-to-many collections
 * (handle addresses, thread participants, message recipients) get their
 * own tables so they stay queryable.
 *
 * ID columns carry the branded core types via $type, so reads and writes
 * stay type-safe end to end with no casts. Dates store as Unix epoch
 * integers. FTS5 and vec0 virtual tables land in a later migration.
 */

import type {
  AccountId,
  BoostId,
  HandleId,
  MessageId,
  PartId,
  SpaceId,
  ThreadId,
} from '@postern/core'
import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const accounts = sqliteTable('accounts', {
  id: text('id').$type<AccountId>().primaryKey(),
  provider: text('provider', {
    enum: ['gmail', 'microsoft', 'jmap', 'imap'],
  }).notNull(),
  address: text('address').notNull(),
  displayName: text('display_name').notNull(),
  oauthAccessTokenRef: text('oauth_access_token_ref'),
  oauthRefreshTokenRef: text('oauth_refresh_token_ref'),
  oauthExpiresAt: integer('oauth_expires_at', { mode: 'timestamp' }),
  imapHost: text('imap_host'),
  imapPort: integer('imap_port'),
  imapPasswordRef: text('imap_password_ref'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
})

export const handles = sqliteTable('handles', {
  id: text('id').$type<HandleId>().primaryKey(),
  displayName: text('display_name').notNull(),
  threadCount: integer('thread_count').notNull().default(0),
  lastContactedAt: integer('last_contacted_at', { mode: 'timestamp' }),
  avatarUrl: text('avatar_url'),
  notes: text('notes'),
})

export const handleAddresses = sqliteTable(
  'handle_addresses',
  {
    handleId: text('handle_id')
      .$type<HandleId>()
      .notNull()
      .references(() => handles.id, { onDelete: 'cascade' }),
    local: text('local').notNull(),
    domain: text('domain').notNull(),
    displayName: text('display_name'),
  },
  (t) => [
    primaryKey({ columns: [t.handleId, t.local, t.domain] }),
    index('handle_addresses_email_idx').on(t.local, t.domain),
  ],
)

export const spaces = sqliteTable('spaces', {
  id: text('id').$type<SpaceId>().primaryKey(),
  name: text('name').notNull(),
  themeAccent: text('theme_accent').notNull(),
  themeBackgroundTint: text('theme_background_tint', {
    enum: ['parchment-warm', 'parchment-cool', 'parchment-neutral'],
  }).notNull(),
  themeGlyph: text('theme_glyph').notNull(),
  signature: text('signature').notNull().default(''),
  aiPersona: text('ai_persona'),
  position: integer('position').notNull(),
  readStyle: text('read_style', { enum: ['letter', 'side-panel'] })
    .notNull()
    .default('letter'),
})

export const accountSpaces = sqliteTable(
  'account_spaces',
  {
    accountId: text('account_id')
      .$type<AccountId>()
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    spaceId: text('space_id')
      .$type<SpaceId>()
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.spaceId] })],
)

export const threads = sqliteTable(
  'threads',
  {
    id: text('id').$type<ThreadId>().primaryKey(),
    accountId: text('account_id')
      .$type<AccountId>()
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    spaceId: text('space_id')
      .$type<SpaceId>()
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    subject: text('subject').notNull(),
    subjectNormalized: text('subject_normalized').notNull(),
    state: text('state', {
      enum: ['active', 'pinned', 'snoozed', 'archived', 'muted'],
    })
      .notNull()
      .default('active'),
    yourTurn: integer('your_turn', { mode: 'boolean' }).notNull().default(false),
    snoozeUntil: integer('snooze_until', { mode: 'timestamp' }),
    messageCount: integer('message_count').notNull().default(0),
    firstMessageAt: integer('first_message_at', { mode: 'timestamp' }).notNull(),
    lastMessageAt: integer('last_message_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [
    index('threads_space_last_message_idx').on(t.spaceId, t.lastMessageAt),
    index('threads_state_idx').on(t.state),
  ],
)

export const threadParticipants = sqliteTable(
  'thread_participants',
  {
    threadId: text('thread_id')
      .$type<ThreadId>()
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    handleId: text('handle_id')
      .$type<HandleId>()
      .notNull()
      .references(() => handles.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['from', 'to', 'cc', 'bcc'] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.threadId, t.handleId, t.role] })],
)

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').$type<MessageId>().primaryKey(),
    threadId: text('thread_id')
      .$type<ThreadId>()
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .$type<AccountId>()
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    messageIdHeader: text('message_id_header').notNull(),
    inReplyTo: text('in_reply_to'),
    state: text('state', {
      enum: ['received', 'sent', 'draft', 'outbox'],
    }).notNull(),
    fromHandleId: text('from_handle_id')
      .$type<HandleId>()
      .notNull()
      .references(() => handles.id),
    subject: text('subject').notNull(),
    snippet: text('snippet').notNull().default(''),
    classification: text('classification', {
      enum: ['personal', 'newsletter', 'transactional', 'unclassified'],
    })
      .notNull()
      .default('unclassified'),
    hasAttachments: integer('has_attachments', { mode: 'boolean' }).notNull().default(false),
    receivedAt: integer('received_at', { mode: 'timestamp' }).notNull(),
    sentAt: integer('sent_at', { mode: 'timestamp' }),
    readAt: integer('read_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('messages_thread_idx').on(t.threadId, t.receivedAt),
    index('messages_header_idx').on(t.messageIdHeader),
  ],
)

export const messageRecipients = sqliteTable(
  'message_recipients',
  {
    messageId: text('message_id')
      .$type<MessageId>()
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    handleId: text('handle_id')
      .$type<HandleId>()
      .notNull()
      .references(() => handles.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['to', 'cc', 'bcc'] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.handleId, t.role] })],
)

export const parts = sqliteTable(
  'parts',
  {
    id: text('id').$type<PartId>().primaryKey(),
    messageId: text('message_id')
      .$type<MessageId>()
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    kind: text('kind', {
      enum: ['text', 'html', 'attachment', 'inline-image', 'signature'],
    }).notNull(),
    contentType: text('content_type').notNull(),
    filename: text('filename'),
    size: integer('size').notNull().default(0),
    inline: integer('inline', { mode: 'boolean' }).notNull().default(false),
    content: text('content'),
    blobRef: text('blob_ref'),
    contentId: text('content_id'),
  },
  (t) => [index('parts_message_idx').on(t.messageId)],
)

export const boosts = sqliteTable('boosts', {
  id: text('id').$type<BoostId>().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  kind: text('kind', { enum: ['css', 'transform', 'prompt'] }).notNull(),
  source: text('source').notNull(),
  scopeSenderDomains: text('scope_sender_domains'),
  scopeSenderAddresses: text('scope_sender_addresses'),
  scopeSpaceId: text('scope_space_id')
    .$type<SpaceId>()
    .references(() => spaces.id, { onDelete: 'cascade' }),
  scopeThreadSubjectPattern: text('scope_thread_subject_pattern'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  author: text('author'),
  version: text('version').notNull().default('0.0.0'),
  installedAt: integer('installed_at', { mode: 'timestamp' }).notNull(),
})

export const syncCursors = sqliteTable(
  'sync_cursors',
  {
    accountId: text('account_id')
      .$type<AccountId>()
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    folder: text('folder').notNull(),
    lastUid: integer('last_uid'),
    lastModseq: integer('last_modseq'),
    lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.folder] })],
)

export const schemaVersion = sqliteTable('schema_version', {
  version: integer('version').primaryKey(),
  appliedAt: integer('applied_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})
