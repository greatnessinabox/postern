/**
 * AI triage: refine the ambiguous classifications the heuristics can't
 * settle. Pure prompt construction and response parsing live here so they
 * test without a network. The Anthropic provider wraps these.
 *
 * The system prompt is stable (cacheable); the per-batch message list is
 * the only volatile part, so repeated triage calls hit the prompt cache.
 */

import type { MessageClassification } from '@postern/core'

export interface TriageInput {
  readonly fromName: string
  readonly fromAddress: string
  readonly subject: string
  readonly snippet: string
  readonly heuristicCategory: MessageClassification
}

export interface TriageResult {
  readonly index: number
  readonly category: MessageClassification
  readonly confidence: number
  readonly reason: string
}

const CATEGORIES: readonly MessageClassification[] = [
  'personal',
  'newsletter',
  'notification',
  'transactional',
  'promotional',
  'job',
]

/** Stable system prompt. Keep byte-identical across calls so it caches. */
export const TRIAGE_SYSTEM = `You triage email for Postern, a client whose home screen shows only genuine human correspondence. Classify each message into exactly one category.

- personal: a real person wrote it to this reader and a reply is plausible. Friend, family, colleague, client, a back-and-forth thread. Never a brand, never a no-reply address, never automated.
- newsletter: a publication, blog, or social digest the reader subscribed to. Read-once content.
- notification: an automated alert from a tool or service (GitHub, GitLab, Slack, calendar, CI).
- transactional: a receipt, order, shipping or delivery update, booking, reservation, statement, account notice, or a brand "review your purchase" request. An automated record of a transaction.
- promotional: marketing, deals, sales, discounts, coupons from a brand.
- job: a job alert or recruiting message from a job board.

Be strict about personal. A message from a brand, a store, a no-reply or automated sender is NOT personal even when it lacks an unsubscribe link and even when the subject sounds friendly. Walmart order reminders, Etsy purchase emails, Honey price drops, "review your recent purchase" requests are transactional or promotional. Reserve personal for real human-to-human mail.

Return ONLY a JSON array, one object per message, in input order. No prose, no code fences:
[{"index":0,"category":"personal","confidence":0.0,"reason":"short"}]`

function escapeLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 160)
}

export function buildTriageUserPrompt(inputs: readonly TriageInput[]): string {
  const lines = inputs.map((m, i) => {
    const from = m.fromName.length > 0 ? `${m.fromName} <${m.fromAddress}>` : m.fromAddress
    return [
      `[${i}] From: ${escapeLine(from)}`,
      `    Subject: ${escapeLine(m.subject)}`,
      `    Preview: ${escapeLine(m.snippet)}`,
      `    Heuristic guess: ${m.heuristicCategory}`,
    ].join('\n')
  })
  return `Classify these ${inputs.length} message(s):\n\n${lines.join('\n\n')}`
}

function isCategory(value: unknown): value is MessageClassification {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

/**
 * Parse the model's JSON array. Tolerant of surrounding prose or code
 * fences: extracts the first bracketed array, validates each entry, and
 * keeps only well-formed results. Missing or malformed entries are dropped
 * (the caller keeps the heuristic category for those).
 */
export function parseTriageResponse(text: string): TriageResult[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const out: TriageResult[] = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue
    const rec = entry as Record<string, unknown>
    const index = rec['index']
    const category = rec['category']
    if (typeof index !== 'number' || !isCategory(category)) continue
    const confidence = typeof rec['confidence'] === 'number' ? rec['confidence'] : 0.5
    const reason = typeof rec['reason'] === 'string' ? rec['reason'] : ''
    out.push({ index, category, confidence, reason })
  }
  return out
}
