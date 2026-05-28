/**
 * The eight canonical primitives plus their shared building blocks.
 * Re-exported from a single entry point so the rest of the codebase
 * pulls them through one import.
 */

export type { Account } from './account.ts'
export type { Boost, BoostKind, BoostScope } from './boost.ts'
export type { Command, CommandKind, CommandShortcut } from './command.ts'
export type {
  AccountId,
  BoostId,
  CommandId,
  EmailAddress,
  HandleId,
  ImapConfig,
  MessageId,
  OAuthState,
  PartId,
  ProviderKind,
  SmtpConfig,
  SpaceId,
  ThreadId,
} from './common.ts'
export type { Handle } from './handle.ts'
export type {
  Message,
  MessageClassification,
  MessageRecipient,
  MessageState,
} from './message.ts'
export type { ParsedMessage, ParsedPart } from './parsed.ts'
export type { Part, PartKind } from './part.ts'
export type { Space, SpaceTheme } from './space.ts'
export type {
  Thread,
  ThreadParticipant,
  ThreadState,
} from './thread.ts'
