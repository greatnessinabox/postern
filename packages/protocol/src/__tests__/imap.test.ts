import { describe, expect, it } from 'vitest'
import { roleFromSpecialUse } from '../imap.ts'

describe('roleFromSpecialUse', () => {
  it('maps standard special-use flags to roles', () => {
    expect(roleFromSpecialUse('\\Inbox')).toBe('inbox')
    expect(roleFromSpecialUse('\\Sent')).toBe('sent')
    expect(roleFromSpecialUse('\\Drafts')).toBe('drafts')
    expect(roleFromSpecialUse('\\Trash')).toBe('trash')
    expect(roleFromSpecialUse('\\Junk')).toBe('spam')
    expect(roleFromSpecialUse('\\Archive')).toBe('archive')
    expect(roleFromSpecialUse('\\All')).toBe('archive')
  })

  it('falls back to other for unknown or missing flags', () => {
    expect(roleFromSpecialUse('\\Flagged')).toBe('other')
    expect(roleFromSpecialUse(undefined)).toBe('other')
    expect(roleFromSpecialUse('')).toBe('other')
  })
})
