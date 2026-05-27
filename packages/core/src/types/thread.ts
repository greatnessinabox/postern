/**
 * Thread: a conversation. The unit of work.
 *
 * Sent and received messages live together in the same Thread,
 * ordered by time. The "your turn" state is derived from whether
 * the last message is inbound and unreplied.
 */

import type { AccountId, HandleId, SpaceId, ThreadId } from './common.ts'

export type ThreadState = 'active' | 'pinned' | 'snoozed' | 'archived' | 'muted'

export interface ThreadParticipant {
  readonly handleId: HandleId
  readonly role: 'from' | 'to' | 'cc' | 'bcc'
}

export interface Thread {
  readonly id: ThreadId
  readonly accountId: AccountId
  readonly spaceId: SpaceId
  readonly subject: string
  readonly subjectNormalized: string
  readonly participants: readonly ThreadParticipant[]
  readonly state: ThreadState
  readonly yourTurn: boolean
  readonly snoozeUntil?: Date
  readonly messageCount: number
  readonly firstMessageAt: Date
  readonly lastMessageAt: Date
}
