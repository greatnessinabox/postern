/**
 * Gmail REST adapter. Reads mail through the Gmail API instead of IMAP.
 *
 * Workspace orgs often disable IMAP, so the IMAP adapter can't reach those
 * accounts. The Gmail API stays available with an OAuth scope. Same contract
 * as the IMAP adapter: translate the upstream into ParsedMessage, hand bodies
 * to parseRawMessage, leave send to a separate concern.
 *
 * Stateless. Each connect resolves a Bearer access token; the resolver mints a
 * fresh one so a connection never carries an expired token.
 */

import { randomUUID } from 'node:crypto'
import type { Account, EmailAddress, Message } from '@postern/core'
import { classifyMessage } from '@postern/core'
import type { CredentialResolver } from './imap.ts'
import type { Connection, Draft, Folder, ProtocolAdapter, SyncCursor, SyncDelta } from './index.ts'
import { type ParsedMessage, parseRawMessage } from './mime.ts'
import { summarizeTrust } from './trust.ts'

type FolderRole = Folder['role']

const API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const DEFAULT_LOOKBACK_DAYS = 90
const DEFAULT_BATCH = 50

const METADATA_HEADERS = [
  'From',
  'To',
  'Cc',
  'Subject',
  'Date',
  'Message-ID',
  'In-Reply-To',
  'List-Unsubscribe',
  'List-Id',
  'Precedence',
  'Auto-Submitted',
  'X-GitHub-Event',
  'Authentication-Results',
  'Received-SPF',
  'DKIM-Signature',
] as const

interface GmailHeader {
  readonly name: string
  readonly value: string
}

interface GmailMessageRef {
  readonly id: string
  readonly threadId: string
}

interface GmailListResponse {
  readonly messages?: readonly GmailMessageRef[]
  readonly nextPageToken?: string
}

interface GmailMetadataResponse {
  readonly id: string
  readonly threadId: string
  readonly snippet?: string
  readonly internalDate?: string
  readonly payload?: { readonly headers?: readonly GmailHeader[] }
}

interface GmailRawResponse {
  readonly raw?: string
}

interface GmailLabel {
  readonly id: string
  readonly name: string
  readonly type?: string
}

interface GmailLabelsResponse {
  readonly labels?: readonly GmailLabel[]
}

interface GmailRequestInit {
  readonly method: string
  readonly body: string
  readonly contentType: string
}

type GmailFetch = (path: string, init?: GmailRequestInit) => Promise<unknown>

interface GmailConnection extends Connection {
  readonly request: GmailFetch
  readonly address: string
}

function isGmailConnection(connection: Connection): connection is GmailConnection {
  return 'request' in connection && typeof connection.request === 'function'
}

function requireRequest(connection: Connection): GmailFetch {
  if (!isGmailConnection(connection)) {
    throw new Error('Connection was not created by GmailAdapter.connect')
  }
  return connection.request
}

/**
 * Map a Gmail system label to a Folder role. User labels and Gmail's category
 * tabs (CATEGORY_*) are "other". ALL is Gmail's archive concept.
 */
export function roleFromLabel(labelId: string, type: string | undefined): FolderRole {
  if (type !== 'system') return 'other'
  switch (labelId) {
    case 'INBOX':
      return 'inbox'
    case 'SENT':
      return 'sent'
    case 'DRAFT':
      return 'drafts'
    case 'TRASH':
      return 'trash'
    case 'SPAM':
      return 'spam'
    case 'ALL':
      return 'archive'
    default:
      return 'other'
  }
}

function headerValue(headers: readonly GmailHeader[], name: string): string | undefined {
  const target = name.toLowerCase()
  for (const header of headers) {
    if (header.name.toLowerCase() === target) return header.value
  }
  return undefined
}

function parseAddress(raw: string): EmailAddress {
  const trimmed = raw.trim()
  // Allow a trailing RFC 5322 comment after the angle brackets, e.g.
  // `Bob <bob@x.com> (work)`. Without this the whole value falls through to
  // a naive @-split and produces a garbage address, which would split the
  // same sender into a second Handle versus the IMAP path.
  const angle = trimmed.match(/^(.*)<([^>]+)>\s*(?:\([^)]*\)\s*)?$/)
  const displayRaw = angle?.[1]?.trim() ?? ''
  const addressRaw = angle?.[2]?.trim() ?? trimmed
  const display = displayRaw.replace(/^"(.*)"$/, '$1').trim()
  const at = addressRaw.lastIndexOf('@')
  const local = at >= 0 ? addressRaw.slice(0, at) : addressRaw
  const domain = at >= 0 ? addressRaw.slice(at + 1) : ''
  return display.length > 0 ? { local, domain, displayName: display } : { local, domain }
}

/**
 * Split a header value into individual addresses, respecting quoted display
 * names that contain commas. RFC 5322 separates addresses with commas; a comma
 * inside double quotes is part of the display name, not a separator.
 */
function splitAddressList(raw: string): EmailAddress[] {
  const out: EmailAddress[] = []
  let current = ''
  let inQuotes = false
  for (const ch of raw) {
    if (ch === '"') inQuotes = !inQuotes
    if (ch === ',' && !inQuotes) {
      if (current.trim().length > 0) out.push(parseAddress(current))
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim().length > 0) out.push(parseAddress(current))
  return out
}

function parseAddresses(value: string | undefined): EmailAddress[] {
  if (value === undefined || value.trim().length === 0) return []
  return splitAddressList(value)
}

/**
 * Build a ParsedMessage from Gmail metadata headers. Pure: header array in,
 * structured message out. Bodies aren't in metadata, so parts is empty and
 * fetchBody loads them on demand. Trust and classification come from the same
 * helpers the IMAP path uses, so a Gmail message and an IMAP message of the
 * same mail produce the same verdict.
 */
export function gmailMetadataToParsed(
  headers: readonly GmailHeader[],
  snippet: string,
  internalDate: string,
): ParsedMessage {
  const fromList = parseAddresses(headerValue(headers, 'From'))
  const from: EmailAddress = fromList[0] ?? { local: 'unknown', domain: 'invalid' }
  const subject = headerValue(headers, 'Subject') ?? ''

  const authenticationResults: string[] = []
  let receivedSpf: string | undefined
  let hasDkimSignature = false
  let hasListUnsubscribe = false
  let hasListId = false
  let precedence = ''
  let autoSubmitted = ''
  let hasGithubEventHeader = false
  for (const header of headers) {
    const key = header.name.toLowerCase()
    if (key === 'authentication-results') authenticationResults.push(header.value)
    else if (key === 'received-spf' && receivedSpf === undefined) receivedSpf = header.value
    else if (key === 'dkim-signature') hasDkimSignature = true
    else if (key === 'list-unsubscribe') hasListUnsubscribe = true
    else if (key === 'list-id') hasListId = true
    else if (key === 'precedence') precedence = header.value
    else if (key === 'auto-submitted') autoSubmitted = header.value
    else if (key === 'x-github-event') hasGithubEventHeader = true
  }

  const trust = summarizeTrust({
    authenticationResults,
    hasDkimSignature,
    ...(receivedSpf !== undefined ? { receivedSpf } : {}),
  })

  const classification = classifyMessage({
    fromLocal: from.local,
    fromDomain: from.domain,
    subject,
    hasListUnsubscribe,
    hasListId,
    precedence,
    autoSubmitted,
    hasGithubEventHeader,
  })

  const epoch = Number.parseInt(internalDate, 10)
  const date = Number.isFinite(epoch) ? new Date(epoch) : new Date()
  const inReplyTo = headerValue(headers, 'In-Reply-To')

  return {
    messageIdHeader: headerValue(headers, 'Message-ID') ?? '',
    subject,
    from,
    to: parseAddresses(headerValue(headers, 'To')),
    cc: parseAddresses(headerValue(headers, 'Cc')),
    bcc: [],
    date,
    snippet,
    parts: [],
    hasAttachments: false,
    trust,
    classification,
    ...(inReplyTo !== undefined ? { inReplyTo } : {}),
  }
}

function isListResponse(value: unknown): value is GmailListResponse {
  return typeof value === 'object' && value !== null
}

function isMetadataResponse(value: unknown): value is GmailMetadataResponse {
  return typeof value === 'object' && value !== null && 'id' in value
}

function isRawResponse(value: unknown): value is GmailRawResponse {
  return typeof value === 'object' && value !== null
}

function isLabelsResponse(value: unknown): value is GmailLabelsResponse {
  return typeof value === 'object' && value !== null
}

function buildRequest(accessToken: string): GmailFetch {
  return async (path: string, init?: GmailRequestInit): Promise<unknown> => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init !== undefined ? { 'Content-Type': init.contentType } : {}),
      },
      ...(init !== undefined ? { body: init.body } : {}),
    })
    if (!res.ok) {
      const body = await res.text()
      if (res.status === 401) {
        throw new Error(
          `Gmail API 401 on ${path}: access token rejected, likely expired. The resolver should mint a fresh token per connect. Body: ${body}`,
        )
      }
      throw new Error(`Gmail API ${res.status} on ${path}: ${body}`)
    }
    return res.json()
  }
}

/**
 * The recency clause for a list query. A cursor's lastSyncedAt becomes
 * after:YYYY/MM/DD (Gmail's date filter is day-granular). With no cursor, fall
 * back to a fixed lookback so the first sync doesn't pull the whole mailbox.
 */
export function recencyClause(cursor: SyncCursor | undefined): string {
  if (cursor !== undefined) {
    const d = cursor.lastSyncedAt
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `after:${y}/${m}/${day}`
  }
  return `newer_than:${DEFAULT_LOOKBACK_DAYS}d`
}

/**
 * The label clause for a folder. INBOX reads better as in:inbox; everything
 * else filters by label id, which Gmail accepts in label: alongside names.
 */
export function labelClause(folder: Folder): string {
  if (folder.path === 'INBOX') return 'in:inbox'
  return `label:${folder.path}`
}

export class GmailAdapter implements ProtocolAdapter {
  readonly providerKind = 'gmail'
  readonly #resolveCredential: CredentialResolver

  constructor(resolveCredential: CredentialResolver) {
    this.#resolveCredential = resolveCredential
  }

  async connect(account: Account): Promise<Connection> {
    const credential = await this.#resolveCredential(account)
    if (credential.kind !== 'oauth') {
      throw new Error(
        `Account ${account.id} resolved a ${credential.kind} credential; the Gmail API needs an OAuth access token`,
      )
    }

    const request = buildRequest(credential.accessToken)
    const connection: GmailConnection = {
      accountId: account.id,
      address: account.address,
      request,
      close() {
        // Stateless REST. Nothing to tear down.
        return Promise.resolve()
      },
    }
    return connection
  }

  async listFolders(connection: Connection): Promise<readonly Folder[]> {
    const request = requireRequest(connection)
    const data = await request('/labels')
    if (!isLabelsResponse(data) || data.labels === undefined) return []
    return data.labels.map((label) => ({
      name: label.name,
      path: label.id,
      role: roleFromLabel(label.id, label.type),
    }))
  }

  async fetchSince(
    connection: Connection,
    folder: Folder,
    cursor?: SyncCursor,
    limit: number = DEFAULT_BATCH,
  ): Promise<SyncDelta> {
    const request = requireRequest(connection)
    const query = `${labelClause(folder)} ${recencyClause(cursor)}`
    const listed = await request(`/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`)

    const refs = isListResponse(listed) ? (listed.messages ?? []) : []
    const messages: ParsedMessage[] = []
    for (const ref of refs) {
      const metaQuery = METADATA_HEADERS.map((h) => `&metadataHeaders=${h}`).join('')
      const meta = await request(`/messages/${ref.id}?format=metadata${metaQuery}`)
      if (!isMetadataResponse(meta)) continue
      const headers = meta.payload?.headers ?? []
      messages.push(gmailMetadataToParsed(headers, meta.snippet ?? '', meta.internalDate ?? ''))
    }

    return {
      messages,
      cursor: { folder: folder.path, lastSyncedAt: new Date() },
    }
  }

  async fetchBody(
    _connection: Connection,
    _folder: Folder,
    messageIdHeader: string,
  ): Promise<readonly string[]> {
    const request = requireRequest(_connection)

    // Find the Gmail id by RFC822 Message-ID, then pull the full raw source and
    // run it through the one MIME code path. rfc822msgid expects the id without
    // angle brackets.
    const bare = messageIdHeader.replace(/^<|>$/g, '')
    const listed = await request(
      `/messages?q=${encodeURIComponent(`rfc822msgid:${bare}`)}&maxResults=1`,
    )
    const refs = isListResponse(listed) ? (listed.messages ?? []) : []
    const first = refs[0]
    if (first === undefined) return []

    const raw = await request(`/messages/${first.id}?format=raw`)
    if (!isRawResponse(raw) || raw.raw === undefined) return []

    const source = Buffer.from(raw.raw, 'base64url')
    const parsed = await parseRawMessage(source)
    const bodies: string[] = []
    for (const part of parsed.parts) {
      if ((part.kind === 'text' || part.kind === 'html') && part.content !== undefined) {
        bodies.push(part.content)
      }
    }
    return bodies
  }

  async send(connection: Connection, draft: Draft): Promise<Message['messageIdHeader']> {
    if (!isGmailConnection(connection)) {
      throw new Error('Connection was not created by GmailAdapter.connect')
    }
    const domain = parseAddress(connection.address).domain || 'localhost'
    const messageId = `<${randomUUID()}@${domain}>`
    const raw = buildRawMessage(connection.address, draft, messageId)
    const encoded = Buffer.from(raw, 'utf8').toString('base64url')
    await connection.request('/messages/send', {
      method: 'POST',
      contentType: 'application/json',
      body: JSON.stringify({ raw: encoded }),
    })
    return messageId
  }
}

// RFC 2047 encoded-word for a non-ASCII header value; ASCII passes through.
function encodeHeaderWord(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value
  return `=?utf-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

/**
 * Build an RFC 5322 message from a Draft. Plain text body, base64-encoded so
 * any UTF-8 is safe. In-Reply-To and References thread a reply. The Message-ID
 * is passed in so the caller can return it and the function stays pure.
 * Attachments and HTML bodies land in a later phase.
 */
export function buildRawMessage(from: string, draft: Draft, messageId: string): string {
  const lines: string[] = [`From: ${from}`, `To: ${draft.toAddresses.join(', ')}`]
  if (draft.ccAddresses.length > 0) lines.push(`Cc: ${draft.ccAddresses.join(', ')}`)
  if (draft.bccAddresses.length > 0) lines.push(`Bcc: ${draft.bccAddresses.join(', ')}`)
  lines.push(`Subject: ${encodeHeaderWord(draft.subject)}`)
  lines.push(`Message-ID: ${messageId}`)
  if (draft.inReplyTo !== undefined && draft.inReplyTo.length > 0) {
    lines.push(`In-Reply-To: ${draft.inReplyTo}`)
    lines.push(`References: ${draft.inReplyTo}`)
  }
  lines.push('MIME-Version: 1.0')
  lines.push('Content-Type: text/plain; charset=utf-8')
  lines.push('Content-Transfer-Encoding: base64')
  lines.push('')
  const b64 = Buffer.from(draft.body, 'utf8').toString('base64')
  lines.push(b64.match(/.{1,76}/g)?.join('\r\n') ?? b64)
  return lines.join('\r\n')
}
