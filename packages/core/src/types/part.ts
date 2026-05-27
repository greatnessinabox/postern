/**
 * Part: a section of a Message.
 *
 * Text body, HTML body, attachment, signature block. MIME-derived but
 * exposed in a protocol-neutral shape so adapters can normalize across
 * IMAP, JMAP, Gmail REST, and MS Graph.
 */

import type { MessageId, PartId } from './common.ts'

export type PartKind = 'text' | 'html' | 'attachment' | 'inline-image' | 'signature'

export interface Part {
  readonly id: PartId
  readonly messageId: MessageId
  readonly kind: PartKind
  readonly contentType: string
  readonly filename?: string
  readonly size: number
  readonly inline: boolean
  readonly content?: string
  readonly blobRef?: string
  readonly contentId?: string
}
