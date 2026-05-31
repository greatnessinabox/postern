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

// Social networks that send bulk digests without standard list headers.
// They are read-content, so they route to the Reader surface.
const SOCIAL_DOMAINS = [
  'nextdoor.com',
  'facebookmail.com',
  'mail.instagram.com',
  'reddit.com',
  'redditmail.com',
  'meetup.com',
  'x.com',
  'twitter.com',
  'nextdoor.co.uk',
]

// Local-parts that only ever belong to a machine or a brand mailbox. The
// trailing (?![a-z]) stops a token from matching a longer human name:
// "news" must not swallow "newsom", "care" must not swallow "carey".
const AUTOMATED_LOCAL =
  /^(no-?reply|do-?not-?reply|donotreply|noreply|notifications?|mailer|automated|auto|bounce|postmaster|transactions?|receipts?|billing|invoices?|orders?|offers?|deals?|news|account|feedback|customer-?service|customer-?care|express|care)(?![a-z])/

const TRANSACTIONAL_SUBJECT =
  /receipt|order\b|order #|invoice|payment|statement|your bill|shipped|delivered|out for delivery|delivery|tracking|confirmation|refund|transaction|membership|subscription|appointment|\bappt\b|reservation|reminder for your|(your|review your|review this) (order|purchase|booking|reservation|ticket|review)|your review/i

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

  if (SOCIAL_DOMAINS.some((d) => endsWithDomain(domain, d))) {
    return 'newsletter'
  }

  // For bulk mail, the subject decides: a deal is promotional, an order or
  // shipping confirmation that happens to carry List-Unsubscribe is
  // transactional (Ledger, not Reader), everything else is a newsletter.
  // The sender local-part (news@, offers@) does not override this; those
  // are newsletter senders.
  if (bulk) {
    if (PROMO_SUBJECT.test(subject)) return 'promotional'
    if (TRANSACTIONAL_SUBJECT.test(subject)) return 'transactional'
    return 'newsletter'
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
