import { describe, expect, it } from 'vitest'
import { gmailMetadataToParsed, labelClause, recencyClause, roleFromLabel } from '../gmail.ts'

interface Header {
  readonly name: string
  readonly value: string
}

function header(name: string, value: string): Header {
  return { name, value }
}

// internalDate is a millisecond epoch string. 2026-05-27T14:30:00Z.
const SENT_AT = '1779892200000'

describe('gmailMetadataToParsed', () => {
  it('classifies a GitHub notification and parses the envelope', () => {
    const headers = [
      header('From', 'GitHub <notifications@github.com>'),
      header('To', 'marquis@cleverer.tech'),
      header('Subject', '[postern] New comment on issue #12'),
      header('Message-ID', '<gh-1@github.com>'),
      header('X-GitHub-Event', 'issue_comment'),
    ]
    const msg = gmailMetadataToParsed(headers, 'A new comment was posted', SENT_AT)
    expect(msg.classification).toBe('notification')
    expect(msg.from).toEqual({
      local: 'notifications',
      domain: 'github.com',
      displayName: 'GitHub',
    })
    expect(msg.to).toEqual([{ local: 'marquis', domain: 'cleverer.tech' }])
    expect(msg.messageIdHeader).toBe('<gh-1@github.com>')
    expect(msg.snippet).toBe('A new comment was posted')
    expect(msg.parts).toEqual([])
    expect(msg.hasAttachments).toBe(false)
    expect(msg.date.getTime()).toBe(Number(SENT_AT))
  })

  it('classifies a newsletter from a List-Unsubscribe header', () => {
    const headers = [
      header('From', 'The Weekly <hello@news.example.com>'),
      header('To', 'marquis@cleverer.tech'),
      header('Subject', 'This week in tech'),
      header('Message-ID', '<news-1@news.example.com>'),
      header('List-Unsubscribe', '<https://news.example.com/unsub>'),
    ]
    const msg = gmailMetadataToParsed(headers, 'Top stories', SENT_AT)
    expect(msg.classification).toBe('newsletter')
  })

  it('reports a trusted verdict when spf, dkim, and dmarc all pass', () => {
    const headers = [
      header('From', 'Sarah Chen <sarah@example.com>'),
      header('To', 'marquis@cleverer.tech'),
      header('Subject', 'Q3 review prep'),
      header('Message-ID', '<abc123@example.com>'),
      header(
        'Authentication-Results',
        'mx.google.com; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass',
      ),
    ]
    const msg = gmailMetadataToParsed(headers, 'Reviewed the draft', SENT_AT)
    expect(msg.trust.verdict).toBe('trusted')
    expect(msg.trust.spf).toBe('pass')
    expect(msg.trust.dkim).toBe('pass')
    expect(msg.trust.dmarc).toBe('pass')
  })

  it('classifies a plain personal message', () => {
    const headers = [
      header('From', 'Sarah Chen <sarah@example.com>'),
      header('To', 'marquis@cleverer.tech'),
      header('Subject', 'lunch tomorrow?'),
      header('Message-ID', '<personal-1@example.com>'),
    ]
    const msg = gmailMetadataToParsed(headers, 'Are you free?', SENT_AT)
    expect(msg.classification).toBe('personal')
  })

  it('parses a quoted display name with local and domain', () => {
    const headers = [header('From', '"Sarah Chen" <sarah@example.com>')]
    const msg = gmailMetadataToParsed(headers, '', SENT_AT)
    expect(msg.from).toEqual({
      local: 'sarah',
      domain: 'example.com',
      displayName: 'Sarah Chen',
    })
  })

  it('parses multiple Cc addresses and keeps a display-name comma intact', () => {
    const headers = [
      header('From', 'sender@example.com'),
      header('Cc', '"Chen, Sarah" <sarah@example.com>, jordan@example.com'),
    ]
    const msg = gmailMetadataToParsed(headers, '', SENT_AT)
    expect(msg.cc).toEqual([
      { local: 'sarah', domain: 'example.com', displayName: 'Chen, Sarah' },
      { local: 'jordan', domain: 'example.com' },
    ])
  })

  it('falls back to now when internalDate is unparseable', () => {
    const before = Date.now()
    const msg = gmailMetadataToParsed([header('From', 'a@b.com')], '', '')
    expect(msg.date.getTime()).toBeGreaterThanOrEqual(before)
  })

  it('parses an address with a trailing RFC comment after the brackets', () => {
    const msg = gmailMetadataToParsed([header('From', 'Bob <bob@x.com> (work)')], '', SENT_AT)
    expect(msg.from).toEqual({ local: 'bob', domain: 'x.com', displayName: 'Bob' })
  })

  it('falls back to a sentinel address when From is missing or unparseable', () => {
    const msg = gmailMetadataToParsed([], '', SENT_AT)
    expect(msg.from).toEqual({ local: 'unknown', domain: 'invalid' })
  })
})

describe('roleFromLabel', () => {
  it('maps Gmail system labels to roles', () => {
    expect(roleFromLabel('INBOX', 'system')).toBe('inbox')
    expect(roleFromLabel('SENT', 'system')).toBe('sent')
    expect(roleFromLabel('DRAFT', 'system')).toBe('drafts')
    expect(roleFromLabel('TRASH', 'system')).toBe('trash')
    expect(roleFromLabel('SPAM', 'system')).toBe('spam')
    expect(roleFromLabel('ALL', 'system')).toBe('archive')
  })
  it('treats category tabs and user labels as other', () => {
    expect(roleFromLabel('CATEGORY_PROMOTIONS', 'system')).toBe('other')
    expect(roleFromLabel('Label_42', 'user')).toBe('other')
    expect(roleFromLabel('INBOX', undefined)).toBe('other')
  })
})

describe('Gmail query clauses', () => {
  it('uses in:inbox for the inbox and label: for others', () => {
    expect(labelClause({ name: 'Inbox', path: 'INBOX', role: 'inbox' })).toBe('in:inbox')
    expect(labelClause({ name: 'Work', path: 'Label_7', role: 'other' })).toBe('label:Label_7')
  })
  it('builds an after: clause from the cursor and a lookback otherwise', () => {
    expect(recencyClause({ folder: 'INBOX', lastSyncedAt: new Date(2026, 4, 9, 12) })).toBe(
      'after:2026/05/09',
    )
    expect(recencyClause(undefined)).toMatch(/^newer_than:\d+d$/)
  })
})
