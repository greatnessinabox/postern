# Bring-your-own OAuth (Gmail and Microsoft)

Postern connects to existing accounts. Gmail and Microsoft 365 require
OAuth. The official signed binaries will bundle a verified OAuth client
(through Google's CASA review). Source builds, forks, and dev work bring
their own client. This doc covers the dev and self-host path.

## Why a client is needed

Gmail IMAP and the Gmail API both reject plain passwords. Access goes
through an OAuth 2.0 token. To mint tokens you need an OAuth client ID
registered in a Google Cloud project, plus a one-time consent from the
account owner.

## Dev project (already provisioned)

A dev project exists under greatnessinabox@gmail.com:

- Project ID: `postern-dev-01271`
- Gmail API: enabled

The OAuth client and consent are the remaining steps. They need a
browser, so they are done by hand once.

## Create the OAuth client (5 minutes, browser)

1. Open the OAuth consent screen for the project:
   `https://console.cloud.google.com/auth/overview?project=postern-dev-01271`
2. Configure it as External, User type. Add greatnessinabox@gmail.com as a
   test user (test mode allows up to 100 users without verification, which
   is enough for dev).
3. Create credentials, OAuth client ID, application type Desktop app.
   Name it "Postern Dev".
4. Download the client ID and client secret.

## Scopes

- IMAP and SMTP over OAuth (reuses the ImapAdapter via XOAUTH2):
  `https://mail.google.com/`
- Gmail API (a future REST adapter): `https://www.googleapis.com/auth/gmail.modify`

Request the narrowest scope the feature needs. For the current IMAP
adapter, `https://mail.google.com/` is the one.

## Get a token

Run a one-time local OAuth flow with the downloaded client (a small
google-auth-library script, the gcloud `application-default login` flow
with the Gmail scope, or the OAuth Playground). It returns a refresh
token. Postern exchanges the refresh token for short-lived access tokens
at connect time.

Store the client ID, client secret, and refresh token in the OS keychain.
The adapter never reads them from disk in plaintext; the CredentialResolver
hands the adapter a fresh access token.

## How the adapter uses it

`ImapAdapter` takes a `CredentialResolver`. For a Gmail account the
resolver returns `{ kind: 'oauth', accessToken }`; the adapter connects to
`imap.gmail.com:993` over TLS and authenticates with XOAUTH2. For a generic
IMAP account the resolver returns `{ kind: 'password', secret }`.

## Self-hosters and forks

Source builds ship with placeholder credentials and fail loudly. Register
your own Google Cloud project, enable the Gmail API, create a Desktop OAuth
client, and stay under the 100-user test cap until you choose to verify.
The official signed binaries are the only ones with the convenience client
that has passed CASA.

## Microsoft 365

Register one multi-tenant Entra ID app with PKCE. Microsoft has no
CASA equivalent. Documented when the Graph adapter lands.
