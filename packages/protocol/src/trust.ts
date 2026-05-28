/**
 * Parse SPF, DKIM, and DMARC results from email authentication headers
 * into a trust verdict.
 *
 * The receiving server records its verdict in Authentication-Results
 * (RFC 8601). Received-SPF is a fallback for SPF. A DKIM-Signature header
 * means the message was signed, even if no server reported a pass. We
 * surface this so the UI can warn on a likely spoof.
 *
 * Pure: header strings in, a TrustSignals summary out.
 */

import type { AuthResult, TrustSignals, TrustVerdict } from '@postern/core'

export interface TrustInput {
  readonly authenticationResults?: readonly string[]
  readonly receivedSpf?: string
  readonly hasDkimSignature?: boolean
}

type Method = 'spf' | 'dkim' | 'dmarc'

const RESULTS: Record<string, AuthResult> = {
  pass: 'pass',
  fail: 'fail',
  hardfail: 'fail',
  softfail: 'softfail',
  neutral: 'neutral',
  none: 'none',
  temperror: 'temperror',
  permerror: 'permerror',
}

const METHOD_RE =
  /\b(spf|dkim|dmarc)\s*=\s*(pass|hardfail|softfail|fail|neutral|none|temperror|permerror)\b/gi

function classify(token: string): AuthResult {
  return RESULTS[token.toLowerCase()] ?? 'none'
}

function parseAuthResults(values: readonly string[]): Record<Method, AuthResult> {
  const found: Record<Method, AuthResult> = { spf: 'none', dkim: 'none', dmarc: 'none' }
  const seen: Record<Method, boolean> = { spf: false, dkim: false, dmarc: false }

  for (const value of values) {
    for (const match of value.matchAll(METHOD_RE)) {
      const rawMethod = match[1]
      const rawResult = match[2]
      if (rawMethod === undefined || rawResult === undefined) continue
      const method = rawMethod.toLowerCase()
      if (method !== 'spf' && method !== 'dkim' && method !== 'dmarc') continue
      if (!seen[method]) {
        found[method] = classify(rawResult)
        seen[method] = true
      }
    }
  }
  return found
}

function verdictOf(s: Record<Method, AuthResult>): TrustVerdict {
  if (s.dmarc === 'pass') return 'trusted'
  if (s.dmarc === 'fail') return 'failed'
  if (s.spf === 'pass' && s.dkim === 'pass') return 'trusted'
  if (s.spf === 'fail' || s.dkim === 'fail') return 'caution'
  if (s.spf === 'none' && s.dkim === 'none' && s.dmarc === 'none') return 'unknown'
  return 'caution'
}

export function summarizeTrust(input: TrustInput): TrustSignals {
  const signals = parseAuthResults(input.authenticationResults ?? [])

  if (signals.spf === 'none' && input.receivedSpf !== undefined) {
    const firstToken = input.receivedSpf.trim().split(/\s/)[0]
    if (firstToken !== undefined && firstToken.length > 0) {
      signals.spf = classify(firstToken)
    }
  }

  if (signals.dkim === 'none' && input.hasDkimSignature === true) {
    // Signed, but no server reported a verdict. Present, not verified.
    signals.dkim = 'neutral'
  }

  return {
    spf: signals.spf,
    dkim: signals.dkim,
    dmarc: signals.dmarc,
    verdict: verdictOf(signals),
  }
}
