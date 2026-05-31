import { describe, expect, it } from 'vitest'
import { parseRawMessage } from '../mime.ts'

const plainText = [
  'From: Sarah Chen <sarah@example.com>',
  'To: Marquis Nobles <marquis@cleverer.tech>',
  'Subject: Q3 review prep',
  'Message-ID: <abc123@example.com>',
  'Date: Wed, 27 May 2026 14:30:00 +0000',
  '',
  'Reviewed the draft. One edit: team velocity to team output.',
].join('\r\n')

const htmlReply = [
  'From: "Marquis Nobles" <marquis@ted.com>',
  'To: sarah@example.com',
  'Cc: alex@example.com, jordan@example.com',
  'Subject: Re: Q3 review prep',
  'Message-ID: <def456@ted.com>',
  'In-Reply-To: <abc123@example.com>',
  'Date: Wed, 27 May 2026 15:00:00 +0000',
  'Content-Type: multipart/alternative; boundary="b1"',
  '',
  '--b1',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Got it. Pushing the update now.',
  '--b1',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<p>Got it. <strong>Pushing</strong> the update now.</p>',
  '--b1--',
].join('\r\n')

const withAttachment = [
  'From: billing@stripe.com',
  'To: marquis@gmail.com',
  'Subject: Your receipt',
  'Message-ID: <rcpt@stripe.com>',
  'Date: Wed, 27 May 2026 16:00:00 +0000',
  'Content-Type: multipart/mixed; boundary="m1"',
  '',
  '--m1',
  'Content-Type: text/plain',
  '',
  'Receipt attached.',
  '--m1',
  'Content-Type: application/pdf; name="receipt.pdf"',
  'Content-Disposition: attachment; filename="receipt.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  'JVBERi0xLjQK',
  '--m1--',
].join('\r\n')

describe('parseRawMessage', () => {
  it('parses a plain text message into core shape', async () => {
    const msg = await parseRawMessage(plainText)
    expect(msg.messageIdHeader).toBe('<abc123@example.com>')
    expect(msg.subject).toBe('Q3 review prep')
    expect(msg.from).toEqual({
      local: 'sarah',
      domain: 'example.com',
      displayName: 'Sarah Chen',
    })
    expect(msg.to).toEqual([
      { local: 'marquis', domain: 'cleverer.tech', displayName: 'Marquis Nobles' },
    ])
    expect(msg.hasAttachments).toBe(false)
    expect(msg.parts).toHaveLength(1)
    expect(msg.parts[0]?.kind).toBe('text')
    expect(msg.snippet).toContain('Reviewed the draft')
    expect(msg.inReplyTo).toBeUndefined()
  })

  it('parses a multipart html reply with cc and in-reply-to', async () => {
    const msg = await parseRawMessage(htmlReply)
    expect(msg.subject).toBe('Re: Q3 review prep')
    expect(msg.inReplyTo).toBe('<abc123@example.com>')
    expect(msg.from.domain).toBe('ted.com')
    expect(msg.cc).toHaveLength(2)
    expect(msg.cc.map((a) => a.local).sort()).toEqual(['alex', 'jordan'])
    const kinds = msg.parts.map((p) => p.kind).sort()
    expect(kinds).toEqual(['html', 'text'])
    const html = msg.parts.find((p) => p.kind === 'html')
    expect(html?.content).toContain('<strong>Pushing</strong>')
  })

  it('extracts an attachment as a part and flags hasAttachments', async () => {
    const msg = await parseRawMessage(withAttachment)
    expect(msg.hasAttachments).toBe(true)
    const attachment = msg.parts.find((p) => p.kind === 'attachment')
    expect(attachment).toBeDefined()
    expect(attachment?.filename).toBe('receipt.pdf')
    expect(attachment?.contentType).toBe('application/pdf')
    expect(attachment?.inline).toBe(false)
  })

  it('handles an address with no display name', async () => {
    const msg = await parseRawMessage(withAttachment)
    expect(msg.from).toEqual({ local: 'billing', domain: 'stripe.com' })
    expect(msg.from.displayName).toBeUndefined()
  })

  it('falls back to a sentinel address when From is missing', async () => {
    const noFrom = [
      'To: marquis@cleverer.tech',
      'Subject: who sent this',
      'Message-ID: <nofrom@example.com>',
      'Date: Wed, 27 May 2026 14:30:00 +0000',
      '',
      'No From header.',
    ].join('\r\n')
    const msg = await parseRawMessage(noFrom)
    expect(msg.from).toEqual({ local: 'unknown', domain: 'invalid' })
  })
})
