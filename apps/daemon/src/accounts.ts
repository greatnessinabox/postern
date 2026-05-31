/**
 * Account configuration and credential access for the daemon.
 *
 * One account per Space. Credentials live in the OS keychain (written by
 * scripts/oauth-token.mjs). The daemon reads them and mints fresh Gmail
 * access tokens on demand, so a connection never carries an expired token.
 *
 * macOS keychain via `security` for now; a cross-platform secret store
 * (tauri-plugin-stronghold on desktop) replaces this later.
 */

import { execFileSync } from 'node:child_process'
import type { ImapCredential } from '@postern/protocol'

export interface AccountConfig {
  readonly account: string
  readonly spaceId: string
  readonly name: string
  readonly accent: string
  readonly glyph: 'home' | 'ted' | 'builder'
}

export const ACCOUNTS: readonly AccountConfig[] = [
  { account: 'marquis@ted.com', spaceId: 'work', name: 'Work', accent: '#4A5568', glyph: 'ted' },
  {
    account: 'greatnessinabox@gmail.com',
    spaceId: 'personal',
    name: 'Personal',
    accent: '#B08E5C',
    glyph: 'home',
  },
  {
    account: 'marquis@cleverer.tech',
    spaceId: 'side-projects',
    name: 'Side Projects',
    accent: '#8B5E3C',
    glyph: 'builder',
  },
]

function keychain(service: string, account: string): string {
  return execFileSync('security', ['find-generic-password', '-w', '-s', service, '-a', account], {
    encoding: 'utf8',
  }).trim()
}

export function hasCredentials(account: string): boolean {
  try {
    return keychain('postern-gmail-refresh', account).length > 0
  } catch {
    return false
  }
}

export function anthropicKey(): string | undefined {
  const env = process.env['ANTHROPIC_API_KEY']
  if (env !== undefined && env.length > 0) return env
  try {
    const k = keychain('anthropic-api-key', 'postern')
    return k.length > 0 ? k : undefined
  } catch {
    return undefined
  }
}

async function accessToken(account: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: keychain('postern-gmail-client-id', account),
      client_secret: keychain('postern-gmail-client-secret', account),
      refresh_token: keychain('postern-gmail-refresh', account),
      grant_type: 'refresh_token',
    }),
  })
  const json = (await res.json()) as { access_token?: string }
  if (json.access_token === undefined) throw new Error(`No access token for ${account}`)
  return json.access_token
}

/** A CredentialResolver bound to a specific account, for the Gmail adapter. */
export function oauthResolver(account: string): () => Promise<ImapCredential> {
  return async () => ({ kind: 'oauth', accessToken: await accessToken(account) })
}
