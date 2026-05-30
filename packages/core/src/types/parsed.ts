/**
 * ParsedMessage: the protocol-neutral parsed representation of one
 * message, before branded IDs and Handle resolution.
 *
 * Every protocol adapter produces this shape. The ingestion layer
 * consumes it. It lives in core because it is protocol-neutral: a
 * Gmail message, an IMAP message, and a JMAP message all normalize to
 * the same ParsedMessage.
 */

import type { EmailAddress } from './common.ts'
import type { MessageClassification } from './message.ts'
import type { PartKind } from './part.ts'
import type { TrustSignals } from './trust.ts'

export interface ParsedPart {
  readonly kind: PartKind
  readonly contentType: string
  readonly filename?: string
  readonly size: number
  readonly inline: boolean
  readonly content?: string
  readonly contentId?: string
}

export interface ParsedMessage {
  readonly messageIdHeader: string
  readonly inReplyTo?: string
  readonly subject: string
  readonly from: EmailAddress
  readonly to: readonly EmailAddress[]
  readonly cc: readonly EmailAddress[]
  readonly bcc: readonly EmailAddress[]
  readonly date: Date
  readonly snippet: string
  readonly parts: readonly ParsedPart[]
  readonly hasAttachments: boolean
  readonly trust: TrustSignals
  readonly classification: MessageClassification
}
