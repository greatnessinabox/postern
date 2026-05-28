/**
 * MIME normalization. Raw RFC 5322 message to protocol-neutral shape.
 *
 * Every protocol adapter (IMAP, JMAP, Gmail REST, MS Graph) produces a
 * ParsedMessage. A higher layer assigns branded IDs and resolves
 * addresses to Handles. This module stays pure: bytes in, structured
 * data out, no database, no IDs.
 */

import type { EmailAddress, ParsedMessage, ParsedPart } from '@postern/core'
import { type AddressObject, simpleParser } from 'mailparser'

export type { ParsedMessage, ParsedPart } from '@postern/core'

function toEmailAddress(address: string, name: string): EmailAddress {
  const at = address.lastIndexOf('@')
  const local = at >= 0 ? address.slice(0, at) : address
  const domain = at >= 0 ? address.slice(at + 1) : ''
  return name.length > 0 ? { local, domain, displayName: name } : { local, domain }
}

function extractAddresses(obj: AddressObject | AddressObject[] | undefined): EmailAddress[] {
  if (obj === undefined) return []
  const groups = Array.isArray(obj) ? obj : [obj]
  const out: EmailAddress[] = []
  for (const group of groups) {
    for (const entry of group.value) {
      if (entry.address !== undefined && entry.address.length > 0) {
        out.push(toEmailAddress(entry.address, entry.name))
      }
    }
  }
  return out
}

function makeSnippet(text: string | undefined, html: string | false): string {
  const source = text ?? (typeof html === 'string' ? html.replace(/<[^>]+>/g, ' ') : '')
  return source.replace(/\s+/g, ' ').trim().slice(0, 140)
}

export async function parseRawMessage(raw: string | Buffer): Promise<ParsedMessage> {
  const mail = await simpleParser(raw)

  const fromList = extractAddresses(mail.from)
  const from: EmailAddress = fromList[0] ?? { local: 'unknown', domain: 'invalid' }

  const parts: ParsedPart[] = []
  if (mail.text !== undefined) {
    parts.push({
      kind: 'text',
      contentType: 'text/plain',
      size: Buffer.byteLength(mail.text),
      inline: true,
      content: mail.text,
    })
  }
  if (typeof mail.html === 'string') {
    parts.push({
      kind: 'html',
      contentType: 'text/html',
      size: Buffer.byteLength(mail.html),
      inline: true,
      content: mail.html,
    })
  }
  for (const att of mail.attachments) {
    const inline = att.related === true || att.contentDisposition === 'inline'
    const isInlineImage = inline && att.contentType.startsWith('image/')
    parts.push({
      kind: isInlineImage ? 'inline-image' : 'attachment',
      contentType: att.contentType,
      size: att.size,
      inline,
      ...(att.filename !== undefined ? { filename: att.filename } : {}),
      ...(att.contentId !== undefined ? { contentId: att.contentId } : {}),
    })
  }

  return {
    messageIdHeader: mail.messageId ?? '',
    subject: mail.subject ?? '',
    from,
    to: extractAddresses(mail.to),
    cc: extractAddresses(mail.cc),
    bcc: extractAddresses(mail.bcc),
    date: mail.date ?? new Date(),
    snippet: makeSnippet(mail.text, mail.html),
    parts,
    hasAttachments: mail.attachments.length > 0,
    ...(mail.inReplyTo !== undefined ? { inReplyTo: mail.inReplyTo } : {}),
  }
}
