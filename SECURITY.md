# Security Policy

Postern handles private correspondence, OAuth tokens, and local message
storage. Security reports get priority.

## Reporting a Vulnerability

Do NOT open a public GitHub issue for security vulnerabilities.

Email security concerns to **security@marquis.codes**.

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

## What to Expect

- Acknowledgment within 48 hours
- An assessment of severity
- A coordinated fix and disclosure
- Credit in the release notes, unless you prefer anonymity

During the documented 2026 maintenance pause (see
docs/2026-blastmojis-pause.md), security reports still get attention.
Everything else waits.

## Scope

This policy covers:

- The Postern desktop, web, and mobile apps
- The packages in this repo (core, protocol, storage, crypto, ai, ui)
- The optional self-hostable sync relay
- This GitHub repository

## Out of Scope

- Your own mail provider (Gmail, Outlook, your IMAP server). Report to them.
- Third-party dependencies. Report to their maintainers.
- Boosts authored by third parties. The Boost engine sandboxes them on a
  best-effort basis; review any Boost before installing it.
- Social engineering attacks.

## Supported Versions

Postern is pre-1.0. The `main` branch and the latest tagged release get
security fixes. Older tags do not.

## Security Practices in Postern

- OAuth tokens and IMAP passwords live in the OS keychain, referenced by
  handle, never written to the database in plaintext.
- The local SQLite store is encrypted at rest.
- Tracking pixels are blocked by default. The image proxy runs in-process.
- AI features are bring-your-own-key. No message content leaves the device
  unless the user configures a model provider.
