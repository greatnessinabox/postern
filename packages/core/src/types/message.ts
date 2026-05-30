/**
 * Message: a single piece of correspondence within a Thread.
 *
 * Messages are immutable once received. Flags (read, starred) are
 * server-versioned via IMAP CONDSTORE or the JMAP state token. Drafts
 * are messages with state 'draft' and no server-side persistence yet.
 */

import type { AccountId, HandleId, MessageId, PartId, ThreadId } from './common.ts'

export type MessageState = 'received' | 'sent' | 'draft' | 'outbox'

export type MessageClassification =
  | 'personal'
  | 'newsletter'
  | 'notification'
  | 'transactional'
  | 'promotional'
  | 'job'
  | 'unclassified'

export interface MessageRecipient {
  readonly handleId: HandleId
  readonly role: 'to' | 'cc' | 'bcc'
}

export interface Message {
  readonly id: MessageId
  readonly threadId: ThreadId
  readonly accountId: AccountId
  readonly messageIdHeader: string
  readonly inReplyTo?: string
  readonly state: MessageState
  readonly fromHandleId: HandleId
  readonly recipients: readonly MessageRecipient[]
  readonly subject: string
  readonly snippet: string
  readonly partIds: readonly PartId[]
  readonly classification: MessageClassification
  readonly hasAttachments: boolean
  readonly receivedAt: Date
  readonly sentAt?: Date
  readonly readAt?: Date
}
