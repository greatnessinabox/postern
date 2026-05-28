import { describe, expect, it } from 'vitest'
import { summarizeTrust } from '../trust.ts'

describe('summarizeTrust', () => {
  it('reads a full pass from Authentication-Results', () => {
    const t = summarizeTrust({
      authenticationResults: [
        'mx.google.com; spf=pass smtp.mailfrom=sarah@example.com; dkim=pass header.d=example.com; dmarc=pass (p=none)',
      ],
    })
    expect(t).toEqual({ spf: 'pass', dkim: 'pass', dmarc: 'pass', verdict: 'trusted' })
  })

  it('flags a dmarc fail as failed (likely spoof)', () => {
    const t = summarizeTrust({
      authenticationResults: ['mx.test; spf=fail; dkim=fail; dmarc=fail'],
    })
    expect(t.verdict).toBe('failed')
  })

  it('returns caution when spf passes but dkim fails and no dmarc', () => {
    const t = summarizeTrust({
      authenticationResults: ['mx.test; spf=pass; dkim=fail'],
    })
    expect(t.spf).toBe('pass')
    expect(t.dkim).toBe('fail')
    expect(t.dmarc).toBe('none')
    expect(t.verdict).toBe('caution')
  })

  it('returns unknown when there are no signals', () => {
    expect(summarizeTrust({})).toEqual({
      spf: 'none',
      dkim: 'none',
      dmarc: 'none',
      verdict: 'unknown',
    })
  })

  it('falls back to Received-SPF when Authentication-Results lacks spf', () => {
    const t = summarizeTrust({
      receivedSpf: 'pass (google.com: domain of sarah@example.com designates 1.2.3.4)',
    })
    expect(t.spf).toBe('pass')
  })

  it('marks dkim neutral when only a DKIM-Signature is present', () => {
    const t = summarizeTrust({ hasDkimSignature: true })
    expect(t.dkim).toBe('neutral')
  })

  it('normalizes hardfail to fail', () => {
    const t = summarizeTrust({ authenticationResults: ['mx.test; spf=hardfail'] })
    expect(t.spf).toBe('fail')
  })

  it('takes the first header result per method across multiple hops', () => {
    const t = summarizeTrust({
      authenticationResults: [
        'mx.final.com; spf=pass; dkim=pass; dmarc=pass',
        'mx.intermediate.com; spf=fail; dkim=fail; dmarc=fail',
      ],
    })
    expect(t.verdict).toBe('trusted')
  })

  it('is case-insensitive on method results', () => {
    const t = summarizeTrust({
      authenticationResults: ['mx.test; SPF=Pass; DKIM=PASS; DMARC=pass'],
    })
    expect(t.verdict).toBe('trusted')
  })
})
