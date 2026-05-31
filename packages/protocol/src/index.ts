/**
 * Protocol adapters: IMAP, JMAP, Gmail REST, MS Graph.
 *
 * Each adapter implements ProtocolAdapter, translating the upstream
 * protocol into the core's protocol-neutral primitives. The UI never
 * imports from this package directly; everything flows through
 * @postern/core types.
 */

import type { Account, Message, PartId, ThreadId } from '@postern/core'
import type { ParsedMessage } from './mime.ts'

export {
  buildRawMessage,
  GmailAdapter,
  gmailMetadataToParsed,
  labelClause,
  recencyClause,
  roleFromLabel,
} from './gmail.ts'
export { type CredentialResolver, ImapAdapter, type ImapCredential } from './imap.ts'
export type { ParsedMessage, ParsedPart } from './mime.ts'
export { parseRawMessage } from './mime.ts'
export type { TrustInput } from './trust.ts'
export { summarizeTrust } from './trust.ts'

export interface Folder {
  readonly name: string
  readonly path: string
  readonly role: 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive' | 'other'
  readonly uidValidity?: number
  readonly modseq?: number
}

export interface SyncCursor {
  readonly folder: string
  readonly lastUid?: number
  readonly lastModseq?: number
  readonly lastSyncedAt: Date
}

export interface SyncDelta {
  readonly messages: readonly ParsedMessage[]
  readonly cursor: SyncCursor
}

export interface Draft {
  readonly threadId?: ThreadId
  readonly inReplyTo?: string
  readonly subject: string
  readonly toAddresses: readonly string[]
  readonly ccAddresses: readonly string[]
  readonly bccAddresses: readonly string[]
  readonly body: string
  readonly attachmentRefs: readonly PartId[]
}

export interface Connection {
  readonly accountId: Account['id']
  close(): Promise<void>
}

export interface ProtocolAdapter {
  readonly providerKind: Account['provider']
  connect(account: Account): Promise<Connection>
  listFolders(connection: Connection): Promise<readonly Folder[]>
  fetchSince(
    connection: Connection,
    folder: Folder,
    cursor?: SyncCursor,
    limit?: number,
  ): Promise<SyncDelta>
  fetchBody(
    connection: Connection,
    folder: Folder,
    messageIdHeader: string,
  ): Promise<readonly string[]>
  send(connection: Connection, draft: Draft): Promise<Message['messageIdHeader']>
}
