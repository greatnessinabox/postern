/**
 * Sender trust signals derived from email authentication headers.
 *
 * SPF, DKIM, and DMARC tell you whether a message actually came from who
 * it claims to. An email client has a duty to surface this so a user can
 * spot a spoof. These types are protocol-neutral; the parser that fills
 * them lives in the protocol layer.
 */

export type AuthResult =
  | 'pass'
  | 'fail'
  | 'softfail'
  | 'neutral'
  | 'none'
  | 'temperror'
  | 'permerror'

export type TrustVerdict = 'trusted' | 'caution' | 'failed' | 'unknown'

export interface TrustSignals {
  readonly spf: AuthResult
  readonly dkim: AuthResult
  readonly dmarc: AuthResult
  readonly verdict: TrustVerdict
}
