# Threat Model

Postern handles private correspondence, OAuth tokens, IMAP passwords, AI keys, and a local copy of years of mail across desktop, mobile, and web. This doc turns that exposure into specified, PR-checkable decisions. It plays the same role for security that PRINCIPLES.md plays for product. If a PR violates a decision here, the PR is wrong unless the decision itself is being amended, in which case the doc gets updated first.

## What we defend against

Every message Postern renders is untrusted input authored by someone who may want to attack the reader. Every credential Postern holds unlocks an account. Every byte that leaves the device is a byte the user did not choose to send. The threats follow from that.

- A sender crafts HTML or CSS that runs code, exfiltrates data, or tracks the open.
- A Boost author ships JavaScript that reads the user's mail or calls home.
- An attacker with disk access reads the local store or the credential file.
- A model provider, or anyone on the wire to it, sees message content the user did not knowingly share.
- A spoofer forges a trusted sender.
- A dependency in the tree ships a backdoor through a postinstall script.

## Decisions

### 1. HTML email rendering

This is the number-one attack surface. Untrusted HTML and CSS arrive from every sender, and the naive path renders it straight into the app.

**What we do.** Sanitize first, render second, in isolation. The sanitizer is `createEmailSanitizer` in `@postern/utils`, already built on DOMPurify. It runs a tag allowlist (text, lists, tables, links, images, no more), an attribute allowlist, and a URI scheme allowlist that permits `https`, `http`, `mailto`, `tel`, and `cid` while blocking `javascript:`, `data:`, `vbscript:`, and `file:`. It strips `script`, `style`, `iframe`, `form`, and `embed`, drops every `on*` handler, and forbids data attributes. Links get rewritten with `rel="noopener noreferrer"` and `target="_blank"`. Remote content can be blocked with a returned count, so the UI can show "12 images blocked" and offer a one-click load. The sanitized string then renders inside a sandboxed iframe under a strict CSP: no scripts, no same-origin, no remote fetch. The sanitizer layer ships today. The iframe sandbox is pending the UI shell and lands with it.

**Anti-pattern.** Setting `innerHTML` with sender HTML anywhere in the app DOM. Rendering email outside the sandboxed iframe because it is "already sanitized." Relaxing the allowlist to make one newsletter render. Loading remote images by default. Treating the sanitizer as optional for trusted senders.

### 2. Boost sandboxing

Rule-break #6 runs user-authored JavaScript inside the client. A Boost that can touch the DOM or the network is a Boost that can steal mail.

**What we do.** Isolate the code and hand it a capability-based API, never the raw runtime. A Boost runs in a Web Worker with no network access, or in a QuickJS/wasm interpreter, decided when Boosts ship. It cannot reach `document`, `fetch`, the file system, or the keychain. It calls a documented API surface that exposes only what its declared permissions grant: read this thread's text, transform this rendering, return a prompt template. Permissions are per-Boost and visible. The canonical Boost directory carries a review step before a Boost is listed. These gates land when Boosts land, in Phase 7. The sandbox is a precondition for the feature, not a follow-up.

**Anti-pattern.** An RPC bridge from a Boost to the rest of the app. Giving a Boost `fetch` so it can "pull avatars." Running a Boost in the main thread for speed. A permission model that asks once and grants everything. Listing a Boost in the directory without review.

### 3. Credentials

OAuth tokens, IMAP and SMTP passwords, and AI provider keys are the keys to the accounts.

**What we do.** Store every secret in the OS keychain (Tauri keychain plugin, iOS Keychain, Android EncryptedSharedPreferences). The SQLite database references a secret by handle, never by value. No token, password, or key is ever written to the DB in plaintext. OAuth uses PKCE on every flow. Scopes are requested at the minimum the feature needs, read-only where the feature is read-only. The client ID is dual-mode: signed binaries carry the verified Postern client ID, source builds bring their own, per the BYO-OAUTH walkthrough. A token refresh failure surfaces a reconnect prompt, it does not fall back to asking for a password.

**Anti-pattern.** A `tokens` column in any table. Logging a token or key, even at debug level. Requesting full-mailbox scope when headers are enough. Storing the AI key in a config file or environment variable that ships with the app. An OAuth flow without PKCE.

### 4. At-rest encryption

A laptop gets stolen, a phone gets seized, a backup leaks. The local store holds the user's correspondence.

**What we do.** Encrypt the SQLite database and attachment blobs at rest. libsql provides ChaCha20-Poly1305 page encryption. The encryption key lives in the OS keychain, fetched at unlock, never persisted next to the data it protects. Attachments stored in the app data directory are encrypted with the same key material. The database file on disk is unreadable without the keychain entry.

**Anti-pattern.** An unencrypted SQLite file "for now." Writing the encryption key to disk or to a dotfile. Storing attachments as plaintext blobs in the filesystem. Caching decrypted content to a temp directory that survives lock.

### 5. AI egress

Sending message content to a model provider is data leaving the device. The user has to know it is happening and be able to stop it.

**What we do.** Treat every AI call as a network egress event with an explicit policy.

| What | Default | Where it goes | When |
|---|---|---|---|
| Draft, summarize, classify | The user's own provider key | The provider the key belongs to (Anthropic by default) | Only on an explicit user action, or arrival-triage the user enabled |
| Embeddings | Local model | Stays on device | Background, off the sync path |
| Any feature | Local Ollama, if configured | Stays on device | Same triggers, no network |

Bring-your-own-key is the default, so the user picks the provider and pays the bill. Per-message opt-out exists, keyed off the `Sensitivity:` header and a manual "do not process" mark, and a per-account hard switch disables AI entirely. A permanent, visible indicator shows whenever AI has processed a message, no silent processing. Every AI feature has a verifiable local-only path through Ollama, so the user can run the client with zero egress and confirm it from network logs.

**Anti-pattern.** Sending message bodies to a provider by default, before the user adds a key. AI processing with no visible indicator. A "smart" feature with no local fallback. Sending more context than the feature needs (the whole mailbox when one thread would do). Routing AI calls through a Postern-operated server.

### 6. Sender trust

A forged sender is the front door for phishing. The authentication result is already in the headers.

**What we do.** Parse SPF, DKIM, and DMARC into a single verdict with `summarizeTrust` in `@postern/protocol`, already built. It reads `Authentication-Results` (RFC 8601), falls back to `Received-SPF`, and notes a present-but-unverified DKIM signature. The output is one of `trusted`, `caution`, `failed`, or `unknown`. The UI surfaces `failed` and `caution` as a spoof warning on the message, plainly worded, not buried. `unknown` is neutral, `trusted` needs no chrome.

**Anti-pattern.** Computing the verdict and never showing it. Showing a green checkmark for `unknown`. Burying the warning behind a hover. Trusting the display name without checking the verdict behind it.

### 7. Transport

Credentials and message content travel to and from the mail provider.

**What we do.** TLS for every IMAP, SMTP, and JMAP connection, with certificate validation on. No plaintext fallback, no STARTTLS downgrade to cleartext, no "allow insecure" toggle. A failed certificate is a failed connection with a clear error, not a prompt to continue anyway.

**Anti-pattern.** Connecting in plaintext when TLS negotiation fails. An "ignore certificate errors" setting. Disabling validation to support a misconfigured server.

### 8. Supply chain

A backdoored dependency is a backdoor in Postern.

**What we do.** Dependabot watches the tree, with major-version bumps held for manual review. CodeQL runs on every PR. pnpm blocks build scripts by default, and only packages on an explicit `allowBuilds` list may run `postinstall`. The dependency surface stays small, and a new direct dependency is a reviewable decision, not a reflex.

**Anti-pattern.** Auto-merging major bumps. Disabling CodeQL to clear a noisy finding. Adding a package to `allowBuilds` without reading what its build script does. Pulling in a heavy dependency for one helper function.

## PR security checklist

The reviewer asks these before approving any PR that touches mail rendering, credentials, storage, AI, or the dependency tree.

1. Does any code render sender HTML outside the sanitize-then-sandboxed-iframe path, or set `innerHTML` with untrusted content?
2. Does any secret (token, password, AI key, encryption key) land anywhere but the OS keychain, including logs?
3. Does new local storage write message content or attachments unencrypted?
4. Does any AI feature send content by default, lack a visible processing indicator, or lack a local-only fallback?
5. Does a Boost or other user-supplied code get raw DOM, network, or filesystem access instead of the capability API?
6. Does any network connection allow a plaintext or cert-validation-disabled fallback?
7. Does this PR add a dependency with a build script, or auto-merge a major bump?
8. Does the UI hide a `failed` or `caution` trust verdict instead of warning on it?

A clean answer to all eight clears the PR for normal review. A dirty answer means the security decision is the breaking change, and that review happens first.
