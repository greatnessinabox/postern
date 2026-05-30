/**
 * Heuristic message classification and surface routing.
 *
 * Pure: header/sender/subject signals in, a category out. No network, no
 * model. AI triage refines the ambiguous cases later (the plan's
 * triage-on-arrival); these rules carry the ~90% that headers settle
 * outright. Tuned against a real 85k-message inbox where the naive rule
 * mislabeled brand transactional mail (Walmart, Etsy, Honey) as personal.
 *
 * Bias: strict about "personal". A message is personal only when no bulk,
 * automated, notification, or transactional signal fires. False
 * transactional is cheaper than a cluttered home, which is the whole point.
 */

import type { MessageClassification } from './types/message.ts'

export type Surface = 'threads' | 'reader' | 'notifications' | 'ledger'

export interface ClassificationSignals {
  readonly fromLocal: string
  readonly fromDomain: string
  readonly subject: string
  readonly hasListUnsubscribe: boolean
  readonly hasListId: boolean
  readonly precedence: string
  readonly autoSubmitted: string
  readonly hasGithubEventHeader: boolean
}

const NOTIFICATION_DOMAINS = [
  'github.com',
  'gitlab.com',
  'atlassian.net',
  'linear.app',
  'slack.com',
  'asana.com',
  'figma.com',
  'vercel.com',
  'notion.so',
  'trello.com',
  'sentry.io',
  'circleci.com',
  'pagerduty.com',
]

const JOB_DOMAINS = [
  'upwork.com',
  'indeed.com',
  'linkedin.com',
  'ziprecruiter.com',
  'glassdoor.com',
  'dice.com',
  'wellfound.com',
]

// Local-parts that only ever belong to a machine or a brand mailbox.
const AUTOMATED_LOCAL =
  /^(no-?reply|do-?not-?reply|donotreply|noreply|notifications?|mailer|automated|auto|bounce|postmaster|transactions?|receipts?|billing|invoices?|orders?|offers?|deals?|news|account)/

const TRANSACTIONAL_SUBJECT =
  /receipt|order\b|order #|invoice|payment|statement|your bill|shipped|out for delivery|delivery|tracking|confirmation|refund|transaction|membership|subscription|appointment|\bappt\b|reminder for your|your (order|purchase|booking|reservation|ticket)/i

const PROMO_SUBJECT =
  /% off|\bsale\b|\bdeal\b|\bsave\b|discount|extra \d|coupon|clearance|ends (soon|today)|shop now|\bbuy\b|limited time|free \w|bogo|black friday|cyber monday/i

function endsWithDomain(domain: string, base: string): boolean {
  return domain === base || domain.endsWith(`.${base}`)
}

export function classifyMessage(s: ClassificationSignals): MessageClassification {
  const domain = s.fromDomain.toLowerCase()
  const local = s.fromLocal.toLowerCase()
  const { subject } = s

  const bulk = s.hasListUnsubscribe || s.hasListId || /\b(bulk|list)\b/i.test(s.precedence)
  const automated = /auto-(generated|replied)/i.test(s.autoSubmitted)

  if (s.hasGithubEventHeader || NOTIFICATION_DOMAINS.some((d) => endsWithDomain(domain, d))) {
    return 'notification'
  }

  if (
    JOB_DOMAINS.some((d) => endsWithDomain(domain, d)) &&
    /job|alert|application|interview|hiring|position|\brole\b/i.test(subject)
  ) {
    return 'job'
  }

  if (bulk) {
    return PROMO_SUBJECT.test(subject) ? 'promotional' : 'newsletter'
  }

  if (automated || AUTOMATED_LOCAL.test(local) || TRANSACTIONAL_SUBJECT.test(subject)) {
    return 'transactional'
  }

  return 'personal'
}

export function surfaceFor(category: MessageClassification): Surface {
  switch (category) {
    case 'newsletter':
    case 'promotional':
      return 'reader'
    case 'notification':
    case 'job':
      return 'notifications'
    case 'transactional':
      return 'ledger'
    default:
      return 'threads'
  }
}
