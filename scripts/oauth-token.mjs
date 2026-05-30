#!/usr/bin/env node
/**
 * One-time Gmail OAuth helper. Runs the Desktop-app flow in your browser
 * and prints a refresh token. Postern exchanges that refresh token for
 * short-lived access tokens at connect time (XOAUTH2 over IMAP).
 *
 * No dependencies. Node 22+ (global fetch). macOS opens the browser; on
 * other platforms it prints the URL to paste.
 *
 * Setup:
 *   1. Create a Desktop OAuth client (see docs/BYO-OAUTH.md) and grab the
 *      client ID and secret.
 *   2. export GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
 *   3. node scripts/oauth-token.mjs            print the tokens
 *      node scripts/oauth-token.mjs --store    also save to the macOS keychain
 *
 * The keychain entry (service "postern-gmail-refresh", account = your
 * email) is what the adapter's CredentialResolver reads.
 */

import { exec } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import http from 'node:http'

const CLIENT_ID = process.env['GOOGLE_CLIENT_ID']
const CLIENT_SECRET = process.env['GOOGLE_CLIENT_SECRET']
const SCOPE = 'https://mail.google.com/'
const STORE = process.argv.includes('--store')

if (CLIENT_ID === undefined || CLIENT_SECRET === undefined) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.')
  console.error('See docs/BYO-OAUTH.md to create a Desktop OAuth client.')
  process.exit(1)
}

const base64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const verifier = base64url(randomBytes(32))
const challenge = base64url(createHash('sha256').update(verifier).digest())

function openBrowser(url) {
  const cmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`
  exec(cmd, (err) => {
    if (err !== null) {
      console.log('\nOpen this URL in your browser:\n')
      console.log(url, '\n')
    }
  })
}

async function exchangeCode(code, redirectUri) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

function storeInKeychain(account, refreshToken) {
  return new Promise((resolve) => {
    const args = [
      'add-generic-password',
      '-a',
      account,
      '-s',
      'postern-gmail-refresh',
      '-w',
      refreshToken,
      '-U',
    ]
    const child = exec(`security ${args.map((a) => JSON.stringify(a)).join(' ')}`, (err) => {
      resolve(err === null)
    })
    child.on('error', () => resolve(false))
  })
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1`)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  res.writeHead(200, { 'content-type': 'text/html' })
  res.end(
    `<html><body style="font-family: -apple-system, sans-serif; padding: 3rem; color: #1A1612; background: #FAF7F2">
      <h2>${error !== null ? 'Authorization failed' : 'Postern is connected'}</h2>
      <p>${error !== null ? error : 'You can close this tab and return to the terminal.'}</p>
    </body></html>`,
  )

  if (error !== null) {
    console.error(`\nAuthorization failed: ${error}`)
    server.close()
    process.exit(1)
  }
  if (code === null) return

  const port = server.address().port
  exchangeCode(code, `http://127.0.0.1:${port}`)
    .then(async (tokens) => {
      console.log('\nAccess token (expires in', tokens.expires_in, 'seconds):')
      console.log(tokens.access_token)
      console.log('\nRefresh token (this is the one to keep):')
      console.log(tokens.refresh_token, '\n')
      if (tokens.refresh_token === undefined) {
        console.log(
          'No refresh token returned. Revoke the app at',
          'https://myaccount.google.com/permissions and rerun (prompt=consent forces it).',
        )
      } else if (STORE) {
        const account = process.env['POSTERN_GMAIL_ACCOUNT'] ?? 'greatnessinabox@gmail.com'
        const ok = await storeInKeychain(account, tokens.refresh_token)
        console.log(
          ok
            ? `Stored in keychain (service postern-gmail-refresh, account ${account}).`
            : 'Could not write to keychain; copy the refresh token above by hand.',
        )
      }
      server.close()
      process.exit(0)
    })
    .catch((err) => {
      console.error(err.message)
      server.close()
      process.exit(1)
    })
})

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port
  const redirectUri = `http://127.0.0.1:${port}`
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString()
  console.log('Opening your browser to authorize Gmail access...')
  openBrowser(authUrl)
})
