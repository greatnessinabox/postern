/**
 * IMAP adapter. Reads mail from any IMAP server via ImapFlow.
 *
 * Translates IMAP into the protocol-neutral ParsedMessage. The ingestion
 * layer assigns branded IDs and resolves Handles. This module fetches raw
 * RFC 5322 sources and hands them to parseRawMessage. Send lives elsewhere
 * (SMTP via nodemailer); this adapter is read-only.
 */

import type { Account, ImapConfig, Message } from '@postern/core'
import { ImapFlow, type ListResponse } from 'imapflow'
import type { Connection, Draft, Folder, ProtocolAdapter, SyncCursor, SyncDelta } from './index.ts'
import { parseRawMessage } from './mime.ts'

type FolderRole = Folder['role']

const DEFAULT_LOOKBACK_DAYS = 90

interface ImapConnection extends Connection {
  readonly client: ImapFlow
}

function isImapConnection(connection: Connection): connection is ImapConnection {
  return 'client' in connection && connection.client instanceof ImapFlow
}

function requireClient(connection: Connection): ImapFlow {
  if (!isImapConnection(connection)) {
    throw new Error('Connection was not created by ImapAdapter.connect')
  }
  return connection.client
}

/**
 * Map an IMAP special-use flag (RFC 6154) to a Folder role. INBOX carries
 * the non-standard "\Inbox" flag in ImapFlow. Anything unrecognized is "other".
 */
export function roleFromSpecialUse(specialUse: string | undefined): FolderRole {
  switch (specialUse) {
    case '\\Inbox':
      return 'inbox'
    case '\\Sent':
      return 'sent'
    case '\\Drafts':
      return 'drafts'
    case '\\Trash':
      return 'trash'
    case '\\Junk':
      return 'spam'
    case '\\Archive':
    case '\\All':
      return 'archive'
    default:
      return 'other'
  }
}

function toFolder(entry: ListResponse): Folder {
  return {
    name: entry.name,
    path: entry.path,
    role: roleFromSpecialUse(entry.specialUse),
  }
}

function buildClient(config: ImapConfig, password: string): ImapFlow {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.security === 'tls',
    auth: { user: config.username, pass: password },
    logger: false,
  })
}

/**
 * Resolves a passwordRef (an opaque keychain handle) to the secret itself.
 * The adapter never stores secrets; packages/crypto injects this resolver.
 */
export type SecretResolver = (passwordRef: string) => Promise<string>

export class ImapAdapter implements ProtocolAdapter {
  readonly providerKind = 'imap'
  readonly #resolveSecret: SecretResolver

  constructor(resolveSecret: SecretResolver) {
    this.#resolveSecret = resolveSecret
  }

  async connect(account: Account): Promise<Connection> {
    const config = account.imapConfig
    if (config === undefined) {
      throw new Error(`Account ${account.id} has no imapConfig; cannot connect over IMAP`)
    }

    const password = await this.#resolveSecret(config.passwordRef)
    const client = buildClient(config, password)
    await client.connect()

    const connection: ImapConnection = {
      accountId: account.id,
      client,
      async close() {
        await client.logout()
      },
    }
    return connection
  }

  async listFolders(connection: Connection): Promise<readonly Folder[]> {
    const client = requireClient(connection)
    const entries = await client.list()
    return entries.map(toFolder)
  }

  async fetchSince(
    connection: Connection,
    folder: Folder,
    cursor?: SyncCursor,
  ): Promise<SyncDelta> {
    const client = requireClient(connection)
    const lock = await client.getMailboxLock(folder.path, { readOnly: true })
    try {
      const since = cursor?.lastSyncedAt ?? lookbackStart()
      const uids = await client.search({ since }, { uid: true })

      const messages = []
      let highestUid = cursor?.lastUid ?? 0
      if (uids !== false && uids.length > 0) {
        for await (const item of client.fetch(uids, { uid: true, source: true }, { uid: true })) {
          if (item.uid > highestUid) highestUid = item.uid
          if (item.source !== undefined) {
            messages.push(await parseRawMessage(item.source))
          }
        }
      }

      const nextCursor: SyncCursor = {
        folder: folder.path,
        lastSyncedAt: new Date(),
        ...(highestUid > 0 ? { lastUid: highestUid } : {}),
      }
      return { messages, cursor: nextCursor }
    } finally {
      lock.release()
    }
  }

  async fetchBody(
    connection: Connection,
    folder: Folder,
    messageIdHeader: string,
  ): Promise<readonly string[]> {
    const client = requireClient(connection)
    const lock = await client.getMailboxLock(folder.path, { readOnly: true })
    try {
      // Locate by Message-ID header, then re-parse the raw source. A bytes-level
      // per-part fetch would save a round trip, but reusing parseRawMessage keeps
      // one MIME code path. TODO(perf): fetch BODYSTRUCTURE parts directly for
      // large messages instead of pulling the full source.
      const uids = await client.search({ header: { 'message-id': messageIdHeader } }, { uid: true })
      const uid = uids === false ? undefined : uids[uids.length - 1]
      if (uid === undefined) return []

      const item = await client.fetchOne(`${uid}`, { uid: true, source: true }, { uid: true })
      if (item === false || item.source === undefined) return []

      const parsed = await parseRawMessage(item.source)
      const bodies: string[] = []
      for (const part of parsed.parts) {
        if ((part.kind === 'text' || part.kind === 'html') && part.content !== undefined) {
          bodies.push(part.content)
        }
      }
      return bodies
    } finally {
      lock.release()
    }
  }

  send(_connection: Connection, _draft: Draft): Promise<Message['messageIdHeader']> {
    // SMTP send is a separate concern handled by the outbox via nodemailer, not
    // by the IMAP read adapter. TODO(smtp): wire send to packages/protocol/smtp.ts.
    return Promise.reject(
      new Error('IMAP adapter does not send. Use the SMTP adapter (nodemailer) for outbound mail.'),
    )
  }
}

// TODO(idle): add an IDLE loop for push so the sync engine gets server-driven
// EXISTS/EXPUNGE events instead of polling fetchSince. Later phase.

function lookbackStart(): Date {
  const d = new Date()
  d.setDate(d.getDate() - DEFAULT_LOOKBACK_DAYS)
  return d
}
