import { describe, expect, it } from 'vitest'
import {
  type ClassificationSignals,
  classifyMessage,
  type MessageClassification,
  surfaceFor,
} from '../index.ts'

function signals(p: Partial<ClassificationSignals>): ClassificationSignals {
  return {
    fromLocal: 'someone',
    fromDomain: 'example.com',
    subject: '',
    hasListUnsubscribe: false,
    hasListId: false,
    precedence: '',
    autoSubmitted: '',
    hasGithubEventHeader: false,
    ...p,
  }
}

// Cases drawn from the real greatnessinabox@gmail.com inbox sample.
const cases: ReadonlyArray<[string, ClassificationSignals, MessageClassification]> = [
  [
    'GitHub PR notification',
    signals({
      fromLocal: 'notifications',
      fromDomain: 'github.com',
      subject: 'Re: [tedconf/Games] Add shared game-config (PR #1284)',
    }),
    'notification',
  ],
  [
    'GitHub via x-github-event header',
    signals({ fromDomain: 'random.example', subject: 'anything', hasGithubEventHeader: true }),
    'notification',
  ],
  [
    'Cava newsletter (bulk, no promo words)',
    signals({
      fromLocal: 'hello',
      fromDomain: 'em.cava.com',
      subject: 'Hot summer. Spicy hummus.',
      hasListUnsubscribe: true,
    }),
    'newsletter',
  ],
  [
    'RetailMeNot promo (bulk + deal words)',
    signals({
      fromLocal: 'mail',
      fromDomain: 'mail.retailmenot.com',
      subject: 'Shake Shack Free Burger | CVS | Old Navy 60% Off',
      hasListUnsubscribe: true,
    }),
    'promotional',
  ],
  [
    'YouTube TV membership paused (no-reply, transactional subject)',
    signals({
      fromLocal: 'noreply-purchases',
      fromDomain: 'youtube.com',
      subject: 'Your YouTube TV membership will be paused',
    }),
    'transactional',
  ],
  [
    'Walmart order reminder (was mislabeled personal)',
    signals({
      fromLocal: 'help',
      fromDomain: 'walmart.com',
      subject: 'Reminder for your upcoming order',
    }),
    'transactional',
  ],
  [
    'Etsy purchase download (transaction@, was mislabeled personal)',
    signals({
      fromLocal: 'transaction',
      fromDomain: 'account.etsy.com',
      subject: 'Download Your Etsy Purchase from DesignTempleDigital',
    }),
    'transactional',
  ],
  [
    'Google Calendar notification',
    signals({
      fromLocal: 'calendar-notification',
      fromDomain: 'google.com',
      subject: 'Notification: Archie Hair Appt @ Fri May 29',
    }),
    'transactional',
  ],
  [
    'Upwork job alert',
    signals({
      fromLocal: 'donotreply',
      fromDomain: 'upwork.com',
      subject: 'New job alert: Full Stack AI & Web Developer',
    }),
    'job',
  ],
  [
    'A real human reply',
    signals({
      fromLocal: 'sarah',
      fromDomain: 'gmail.com',
      subject: 'Re: dinner Friday?',
    }),
    'personal',
  ],
  [
    'A colleague at a company domain',
    signals({
      fromLocal: 'tori',
      fromDomain: 'cleverer.tech',
      subject: 'thoughts on the deck',
    }),
    'personal',
  ],
]

describe('classifyMessage', () => {
  for (const [name, input, expected] of cases) {
    it(name, () => {
      expect(classifyMessage(input)).toBe(expected)
    })
  }
})

describe('surfaceFor', () => {
  it('routes personal to threads', () => {
    expect(surfaceFor('personal')).toBe('threads')
    expect(surfaceFor('unclassified')).toBe('threads')
  })
  it('routes newsletters and promos to reader', () => {
    expect(surfaceFor('newsletter')).toBe('reader')
    expect(surfaceFor('promotional')).toBe('reader')
  })
  it('routes notifications and jobs to notifications', () => {
    expect(surfaceFor('notification')).toBe('notifications')
    expect(surfaceFor('job')).toBe('notifications')
  })
  it('routes transactional to ledger', () => {
    expect(surfaceFor('transactional')).toBe('ledger')
  })
})
