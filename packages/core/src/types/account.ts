/**
 * Account: a connected mail source. One row per provider connection.
 * An Account belongs to one or more Spaces.
 */

import type {
  AccountId,
  ImapConfig,
  OAuthState,
  ProviderKind,
  SmtpConfig,
  SpaceId,
} from './common.ts'

export interface Account {
  readonly id: AccountId
  readonly provider: ProviderKind
  readonly address: string
  readonly displayName: string
  readonly spaceIds: readonly SpaceId[]
  readonly oauthState?: OAuthState
  readonly imapConfig?: ImapConfig
  readonly smtpConfig?: SmtpConfig
  readonly createdAt: Date
  readonly lastSyncedAt?: Date
}
