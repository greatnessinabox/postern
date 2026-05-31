# Architecture

The technical shape of Postern. The eight canonical primitives, the layer boundaries, the protocol adapter contract, the AI Function interface, and the things Postern will not do.

## Overview

Postern is three shells plus a macOS menubar companion, all sitting on a shared TypeScript core.

- **`apps/web`** is the Next.js 16 application. It is the primary surface and the inner content of the desktop shell.
- **`apps/desktop`** is a Tauri 2.9 wrapper around the web build, packaging it for macOS, Windows, and Linux.
- **`apps/mobile`** is an Expo / React Native build for iOS and Android, sharing the core but providing its own native UI.
- **`apps/macos-menubar`** is a native SwiftUI companion. It carries the unread badge, system notifications, and Spotlight indexing on macOS. It talks to the core through a documented IPC contract.

Underneath the shells, the eight canonical primitives are the stable interface. Protocols, AI providers, storage engines, and crypto libraries are swappable adapters. The interface lasts. The adapters change.

## The eight canonical primitives

Each primitive is a TypeScript type defined in `packages/core/src/types/`. The types are the contract between the UI layer and everything below.

```ts
// packages/core/src/types/common.ts

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

export interface OAuthState {
  readonly accessTokenRef: string
  readonly refreshTokenRef: string
  readonly expiresAt: Date
  readonly scopes: readonly string[]
}
```

### 1. Account

A connected mail source. One row per provider connection. An Account belongs to one or more Spaces.

```ts
// packages/core/src/types/account.ts

export type AccountProvider =
  | 'gmail'
  | 'microsoft'
  | 'jmap'
  | 'imap'
  | 'fastmail'

export interface Account {
  readonly id: AccountId
  readonly provider: AccountProvider
  readonly address: EmailAddress
  readonly displayName: string
  readonly spaceIds: readonly SpaceId[]
  readonly oauthState?: OAuthState
  readonly imapConfig?: ImapConfig
  readonly aiEnabled: boolean
  readonly createdAt: Date
  readonly lastSyncAt?: Date
}

export interface ImapConfig {
  readonly host: string
  readonly port: number
  readonly security: 'tls' | 'starttls' | 'plain'
  readonly username: string
  readonly passwordRef: string
}

// SMTP is its own config, not inlined into ImapConfig.
export interface SmtpConfig {
  readonly host: string
  readonly port: number
  readonly security: 'tls' | 'starttls' | 'plain'
  readonly username: string
  readonly passwordRef: string
}
```

### 2. Handle

A person, merged across all known addresses. The address-to-Handle mapping is built from header analysis and explicit user merges.

```ts
// packages/core/src/types/handle.ts

export interface Handle {
  readonly id: HandleId
  readonly displayName: string
  readonly addresses: readonly EmailAddress[]
  readonly avatarRef?: string
  readonly threadCount: number
  readonly lastContactedAt?: Date
  readonly mergedFrom: readonly HandleId[]
  readonly createdAt: Date
}
```

### 3. Space

An identity container. Carries theme, accent color, signature, and AI persona.

```ts
// packages/core/src/types/space.ts

export interface SpaceTheme {
  readonly accent: string
  readonly background: 'warm' | 'cool' | 'neutral'
  readonly glyph: string
}

export interface Space {
  readonly id: SpaceId
  readonly name: string
  readonly theme: SpaceTheme
  readonly accountIds: readonly AccountId[]
  readonly signature: string
  readonly aiPersonaRef?: string
  readonly position: number
  readonly createdAt: Date
}
```

### 4. Thread

A conversation. Threads are the unit of work in Postern. Messages live inside Threads.

```ts
// packages/core/src/types/thread.ts

export type ThreadStatus =
  | 'active'
  | 'archived'
  | 'snoozed'
  | 'muted'

export interface Thread {
  readonly id: ThreadId
  readonly accountId: AccountId
  readonly spaceId: SpaceId
  readonly subject: string
  readonly participantHandleIds: readonly HandleId[]
  readonly messageIds: readonly MessageId[]
  readonly status: ThreadStatus
  readonly pinned: boolean
  readonly yourTurn: boolean
  readonly snoozedUntil?: Date
  readonly lastActivityAt: Date
  readonly createdAt: Date
}
```

### 5. Message

A single piece of correspondence inside a Thread. Immutable once received.

```ts
// packages/core/src/types/message.ts

export type MessageDirection = 'inbound' | 'outbound'

export interface Message {
  readonly id: MessageId
  readonly threadId: ThreadId
  readonly accountId: AccountId
  readonly providerMessageId: string
  readonly inReplyTo?: MessageId
  readonly direction: MessageDirection
  readonly fromHandleId: HandleId
  readonly toHandleIds: readonly HandleId[]
  readonly ccHandleIds: readonly HandleId[]
  readonly bccHandleIds: readonly HandleId[]
  readonly subject: string
  readonly partIds: readonly PartId[]
  readonly receivedAt: Date
  readonly sentAt?: Date
  readonly flags: ReadonlySet<MessageFlag>
}

export type MessageFlag =
  | 'seen'
  | 'flagged'
  | 'draft'
  | 'answered'
  | 'recent'
```

### 6. Part

A section of a Message. Text body, HTML body, attachment, inline image, signature. Derived from MIME but expressed as core types.

```ts
// packages/core/src/types/part.ts

export type PartKind = 'text' | 'html' | 'attachment' | 'inline-image' | 'signature'

export interface Part {
  readonly id: PartId
  readonly messageId: MessageId
  readonly kind: PartKind
  readonly contentType: string
  readonly filename?: string
  readonly contentRef: string
  readonly sizeBytes: number
  readonly contentId?: string
  readonly isInline: boolean
}
```

### 7. Boost

A scriptable customization. CSS lens, JS thread transform, or AI prompt template. Attached to a sender, a Space, or a thread filter.

```ts
// packages/core/src/types/boost.ts

export type BoostKind =
  | 'css-lens'
  | 'js-transform'
  | 'ai-prompt'

export type BoostScope =
  | { readonly type: 'sender'; readonly handleId: HandleId }
  | { readonly type: 'space'; readonly spaceId: SpaceId }
  | { readonly type: 'thread-filter'; readonly query: string }

export interface Boost {
  readonly id: BoostId
  readonly name: string
  readonly kind: BoostKind
  readonly scope: BoostScope
  readonly sourceRef: string
  readonly version: string
  readonly enabled: boolean
  readonly installedAt: Date
  readonly installedFrom?: string
}
```

### 8. Command

A callable action surfaced via Cmd-K. Search, compose, snooze, switch Space, run a Boost, invoke an AI Function.

```ts
// packages/core/src/types/command.ts

export type CommandKind =
  | 'navigation'
  | 'mutation'
  | 'query'
  | 'ai-invocation'

export interface CommandArgument {
  readonly name: string
  readonly kind: 'string' | 'date' | 'handle' | 'space' | 'thread'
  readonly required: boolean
}

export interface Command {
  readonly id: CommandId
  readonly verb: string
  readonly description: string
  readonly kind: CommandKind
  readonly args: readonly CommandArgument[]
  readonly keybinding?: string
  readonly hidden: boolean
}
```

## Layer boundaries

The layers stack. Each layer talks only to the layer directly below it. Skipping layers is a violation.

```
┌────────────────────────────────────────────────────────────┐
│ apps/web · apps/desktop · apps/mobile · apps/macos-menubar │   View layer
│ packages/ui                                                │
└──────────────────────────────┬─────────────────────────────┘
                               │  imports types and functions
                               ▼
┌────────────────────────────────────────────────────────────┐
│ packages/core                                              │   Core layer
│ Exposes the eight primitives plus orchestration functions  │
└────┬─────────────────┬────────────────┬────────────────┬───┘
     │                 │                │                │
     ▼                 ▼                ▼                ▼
┌──────────┐    ┌────────────┐   ┌────────────┐   ┌────────────┐
│ protocol │    │  storage   │   │     ai     │   │   crypto   │   Adapter
│  imap    │    │  drizzle   │   │ anthropic  │   │ libsodium  │   layer
│  jmap    │    │  libsql    │   │  ollama    │   │  openpgp   │
│  gmail   │    │  fts5      │   │  openai    │   │            │
│  graph   │    │  sqlite-vec│   │            │   │            │
└──────────┘    └────────────┘   └────────────┘   └────────────┘
```

The hard rules:

- `apps/*` and `packages/ui` import only from `packages/core`. They never import from `packages/protocol`, `packages/storage`, `packages/ai`, or `packages/crypto`.
- `packages/core` imports from `packages/protocol`, `packages/storage`, `packages/ai`, and `packages/crypto`. It does not import from `apps/*` or `packages/ui`.
- Adapter packages do not import from each other. The IMAP adapter does not know the JMAP adapter exists.
- `packages/core` exposes typed functions. The view layer calls those functions and gets back primitive types. No raw protocol objects ever reach the UI.

The dependency graph enforces this. Each app and `packages/ui` declares
only `@postern/core` as a `@postern/*` dependency in its package.json, and
pnpm's isolated `node_modules` means a package cannot import a workspace
package it does not declare. So `apps/web` physically cannot resolve
`@postern/protocol`. (A Biome `noRestrictedImports` rule scoped to `apps/**`
would add a second, earlier signal; Biome overrides do not currently apply
an added lint rule to a glob, so this is a tracked follow-up.)

## Protocol adapter contract

Every mail protocol that Postern supports implements one interface, defined
in `packages/protocol/src/index.ts`. Adapters produce the protocol-neutral
`ParsedMessage` (envelope, parts, trust, classification); the ingestion
layer in `packages/storage` assigns branded IDs and resolves Handles. The
adapter never returns core `Message`/`Thread` objects directly, because
those require IDs the adapter does not mint. Provider terms (Gmail label,
IMAP mailbox) collapse into a single `Folder`.

```ts
// packages/protocol/src/index.ts (current shape)

import type { Account, Message } from '@postern/core'
import type { ParsedMessage } from './mime.ts'

export interface Connection {
  readonly accountId: Account['id']
  close(): Promise<void>
}

export type FolderRole =
  | 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive' | 'other'

export interface Folder {
  readonly name: string
  readonly path: string
  readonly role: FolderRole
  readonly uidValidity?: number
  readonly modseq?: number
}

export interface SyncCursor {
  readonly folder: string
  readonly lastUid?: number
  readonly lastModseq?: number
  readonly lastSyncedAt: Date
}

export interface SyncDelta {
  readonly messages: readonly ParsedMessage[]
  readonly cursor: SyncCursor
}

export interface Draft {
  readonly threadId?: ThreadId
  readonly inReplyTo?: string
  readonly subject: string
  readonly toAddresses: readonly string[]
  readonly ccAddresses: readonly string[]
  readonly bccAddresses: readonly string[]
  readonly body: string
  readonly attachmentRefs: readonly PartId[]
}

export interface ProtocolAdapter {
  readonly providerKind: Account['provider']
  connect(account: Account): Promise<Connection>
  listFolders(connection: Connection): Promise<readonly Folder[]>
  fetchSince(
    connection: Connection,
    folder: Folder,
    cursor?: SyncCursor,
    limit?: number,
  ): Promise<SyncDelta>
  fetchBody(
    connection: Connection,
    folder: Folder,
    messageIdHeader: string,
  ): Promise<readonly string[]>
  send(connection: Connection, draft: Draft): Promise<Message['messageIdHeader']>
}
```

`fetchSince` is envelope-first and bounded by `limit`; bodies load on demand
through `fetchBody`. The IMAP adapter (`imap.ts`) wraps ImapFlow with a
CredentialResolver (password or XOAUTH2). The Gmail adapter (`gmail.ts`) uses
the Gmail REST API, which works for Workspace accounts even when IMAP is
disabled, and fetches envelopes via `format=metadata`. `send` is not yet
implemented on either adapter (the outbox lands in a later phase).

The internal model is not JMAP. JMAP is one of four implementations behind the same interface.

## AI Function interface

AI is a Function interface, not a chat surface. The functions are stable. The providers are adapters.

```ts
// packages/ai/src/functions.ts

import type {
  Thread,
  Message,
  Handle,
  Space,
} from '@postern/core'

export interface DraftContext {
  readonly threadId?: Thread['id']
  readonly recipientHandleIds: readonly Handle['id'][]
  readonly spaceId: Space['id']
  readonly userIntent: string
}

export interface DraftResult {
  readonly body: string
  readonly bodyHtml?: string
  readonly model: string
  readonly tokensIn: number
  readonly tokensOut: number
}

export interface Summary {
  readonly text: string
  readonly keyPoints: readonly string[]
  readonly model: string
}

export interface Classification {
  readonly category: 'personal' | 'newsletter' | 'transactional' | 'other'
  readonly confidence: number
  readonly reasoning?: string
}

export interface SearchScope {
  readonly spaceIds?: readonly Space['id'][]
  readonly handleIds?: readonly Handle['id'][]
  readonly since?: Date
  readonly until?: Date
}

export interface SearchResults {
  readonly threadIds: readonly Thread['id'][]
  readonly messageIds: readonly Message['id'][]
  readonly scores: ReadonlyMap<string, number>
}

export type SuggestedActionKind =
  | 'archive'
  | 'snooze'
  | 'mark-your-turn'
  | 'schedule-with'
  | 'forward'

export interface SuggestedAction {
  readonly kind: SuggestedActionKind
  readonly confidence: number
  readonly args: Readonly<Record<string, string>>
}

export interface ActionContext {
  readonly threadId: Thread['id']
  readonly latestMessageId: Message['id']
}

export interface AIFunctions {
  draft(context: DraftContext): Promise<DraftResult>
  summarize(thread: Thread): Promise<Summary>
  classify(message: Message): Promise<Classification>
  search(query: string, scope: SearchScope): Promise<SearchResults>
  embed(text: string): Promise<number[]>
  suggest(context: ActionContext): Promise<readonly SuggestedAction[]>
}
```

Each AI provider implements `AIFunctions`. The Anthropic adapter calls Claude. The Ollama adapter calls a locally running model server. The OpenAI adapter is available for users who prefer it.

Every function has a non-AI fallback. The classifier falls back to a rule-based engine using header heuristics. Search falls back to FTS5. Suggest falls back to local heuristics. Draft and summarize are skipped when no AI provider is available, with UI affordances disabled rather than throwing. The interface stays stable, the absence of an AI provider degrades the product without breaking it.

```ts
// packages/ai/src/registry.ts

export interface AIProviderRegistry {
  getActive(): AIFunctions | null
  setActive(provider: 'anthropic' | 'ollama' | 'openai' | null): Promise<void>
  list(): readonly AIProviderInfo[]
}

export interface AIProviderInfo {
  readonly name: 'anthropic' | 'ollama' | 'openai'
  readonly displayName: string
  readonly available: boolean
  readonly requiresApiKey: boolean
  readonly localOnly: boolean
}
```

The Function interface survives even if the LLM era ends. The signatures look the same in 2046 as they do in 2026. The models behind them are different.

## What we will not do

A list of architectural anti-patterns. These are decisions that have already been argued and lost.

- **No JMAP as the internal model.** JMAP is one protocol of four. The core is one step more abstract.
- **No protocol types in the UI.** A Gmail Label, an IMAP UID, a JMAP Mailbox object: none of these reach `apps/*` or `packages/ui`. The view layer sees Threads, Messages, Folders.
- **No hosted-only AI.** Every AI feature has a non-AI fallback or a local-model path. Postern does not require a cloud key.
- **No CDN-loaded brand assets.** Fonts, icons, illustrations are bundled in `packages/ui`. Google Fonts is not used. No SVG fetched from a CDN at runtime.
- **No proprietary email address.** Postern does not run a postern.so MX. The product is a client. Self-hosted mail providers (Stalwart, Cyrus, Dovecot) are supported through standard protocols.
- **No CRDT sync.** Email is wrong-shaped for CRDTs. CONDSTORE, QRESYNC, and provider-side versioning are sufficient. The server-provider is source of truth except for drafts and the outbox.
- **No plugin RPC bridge without a sandbox.** Boosts run in sandboxed workers with a documented API. No direct DOM access from a Boost, no filesystem access without an explicit permission.
- **No analytics by default.** Telemetry is opt-in. The schema is published in the repo. The endpoint is self-hostable.
