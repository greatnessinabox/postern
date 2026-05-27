/**
 * Branded ID types and shared building blocks.
 *
 * Every primitive carries a branded ID so the type system catches
 * cross-primitive ID mix-ups at compile time without runtime cost.
 */

export type AccountId = string & { readonly __brand: 'AccountId' }
export type HandleId = string & { readonly __brand: 'HandleId' }
export type SpaceId = string & { readonly __brand: 'SpaceId' }
export type ThreadId = string & { readonly __brand: 'ThreadId' }
export type MessageId = string & { readonly __brand: 'MessageId' }
export type PartId = string & { readonly __brand: 'PartId' }
export type BoostId = string & { readonly __brand: 'BoostId' }
export type CommandId = string & { readonly __brand: 'CommandId' }

export interface EmailAddress {
  readonly local: string
  readonly domain: string
  readonly displayName?: string
}

export type ProviderKind = 'gmail' | 'microsoft' | 'jmap' | 'imap'

export interface OAuthState {
  readonly accessTokenRef: string
  readonly refreshTokenRef: string
  readonly expiresAt: Date
  readonly scopes: readonly string[]
}

export interface ImapConfig {
  readonly host: string
  readonly port: number
  readonly security: 'tls' | 'starttls' | 'plain'
  readonly username: string
  readonly passwordRef: string
}

export interface SmtpConfig {
  readonly host: string
  readonly port: number
  readonly security: 'tls' | 'starttls' | 'plain'
  readonly username: string
  readonly passwordRef: string
}
