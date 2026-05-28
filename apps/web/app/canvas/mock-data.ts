// Static mock data for the v0.1 canvas. No storage layer yet; the Node-only
// store and the browser data layer land in later phases.

export type SpaceId = 'work' | 'personal' | 'side-projects'

export type SpaceAccent = 'slate' | 'brass' | 'clay'

export interface Space {
  id: SpaceId
  name: string
  accent: SpaceAccent
  shortcut: string
}

export interface MessagePreview {
  sender: string
  preview: string
  direction: 'sent' | 'received'
}

export interface Thread {
  id: string
  space: SpaceId
  label: string
  subject: string
  timestamp: string
  messages: MessagePreview[]
  participants: string
  yourTurn: boolean
  pinned: boolean
}

export const spaces: Space[] = [
  { id: 'work', name: 'Work', accent: 'slate', shortcut: '⌘1' },
  { id: 'personal', name: 'Personal', accent: 'brass', shortcut: '⌘2' },
  { id: 'side-projects', name: 'Side Projects', accent: 'clay', shortcut: '⌘3' },
]

export const activeSpace: SpaceId = 'work'

// Welcome tile content is the canonical voice example from the plan.
export const threads: Thread[] = [
  {
    id: 'welcome',
    space: 'work',
    label: 'Pinned',
    subject: 'Welcome to Postern.',
    timestamp: 'today',
    pinned: true,
    yourTurn: false,
    participants: 'from Marquis',
    messages: [
      {
        sender: 'Marquis Nobles',
        direction: 'received',
        preview:
          "No inbox here. The home screen is threads you're in the middle of, sent or received in the last 14 days.",
      },
      {
        sender: 'Marquis Nobles',
        direction: 'received',
        preview:
          'Newsletters and receipts get their own home in a later version. Archive this when you’re done.',
      },
    ],
  },
  {
    id: 'q3-review',
    space: 'work',
    label: 'Re: Q3 review prep',
    subject: 'Q3 review prep',
    timestamp: '2h',
    pinned: false,
    yourTurn: true,
    participants: 'Priya, you, Marcus',
    messages: [
      {
        sender: 'You',
        direction: 'sent',
        preview: "Sent draft of the agenda this morning, lmk what's missing.",
      },
      {
        sender: 'Priya Shah',
        direction: 'received',
        preview: "Looks solid. Two things I'd add before Thursday...",
      },
      {
        sender: 'Priya Shah',
        direction: 'received',
        preview: 'Also, can you loop Marcus in on the metrics section?',
      },
    ],
  },
  {
    id: 'stalwart',
    space: 'work',
    label: 'Vendor contracts',
    subject: 'Stalwart MX trial extension',
    timestamp: 'yesterday',
    pinned: false,
    yourTurn: false,
    participants: 'with Henrik',
    messages: [
      {
        sender: 'Henrik Olsen',
        direction: 'received',
        preview: 'Happy to extend, no issue. Just send the renewal date.',
      },
      {
        sender: 'You',
        direction: 'sent',
        preview: 'Appreciate it. Will follow up Monday with the paperwork.',
      },
    ],
  },
  {
    id: 'onboarding-copy',
    space: 'work',
    label: 'Design crit',
    subject: 'Onboarding copy, second pass',
    timestamp: 'Mon',
    pinned: false,
    yourTurn: false,
    participants: 'Talia, you',
    messages: [
      {
        sender: 'You',
        direction: 'sent',
        preview: 'Trimmed the second screen down to one paragraph.',
      },
      {
        sender: 'Talia Kerr',
        direction: 'received',
        preview: 'This reads way better. Ship it once Marcus signs off.',
      },
      { sender: 'You', direction: 'sent', preview: 'Will do.' },
    ],
  },
  {
    id: 'backend-candidate',
    space: 'work',
    label: 'Hiring',
    subject: 'Backend candidate, second round',
    timestamp: 'Mon',
    pinned: false,
    yourTurn: false,
    participants: 'Devon, you',
    messages: [
      {
        sender: 'Devon Lee',
        direction: 'received',
        preview: 'Strong on systems, a bit thin on React.',
      },
      {
        sender: 'You',
        direction: 'sent',
        preview: 'That tracks with what I saw. Push to a third round?',
      },
    ],
  },
  {
    id: 'cdn-runbook',
    space: 'work',
    label: 'Ops',
    subject: 'CDN purge runbook',
    timestamp: 'Mon',
    pinned: false,
    yourTurn: false,
    participants: 'Sam, you',
    messages: [
      {
        sender: 'You',
        direction: 'sent',
        preview: 'Drafted the POP confirmation step you asked about.',
      },
      {
        sender: 'Sam Beckwith',
        direction: 'received',
        preview: 'Perfect. Add a fallback for the IAD region.',
      },
    ],
  },
  {
    id: 'reader-scope',
    space: 'work',
    label: 'Roadmap',
    subject: 'Reader surface, scope check',
    timestamp: 'Fri',
    pinned: false,
    yourTurn: false,
    participants: 'Iris, you',
    messages: [
      {
        sender: 'Iris Mensah',
        direction: 'received',
        preview: 'Want to land it in Phase 3, not Phase 5.',
      },
      {
        sender: 'You',
        direction: 'sent',
        preview: "Agreed. I'll sketch the routing rules tomorrow.",
      },
    ],
  },
  {
    id: 'agpl-cla',
    space: 'work',
    label: 'Legal',
    subject: 'AGPL CLA wording',
    timestamp: 'Thu',
    pinned: false,
    yourTurn: false,
    participants: 'Counsel, you',
    messages: [
      {
        sender: 'You',
        direction: 'sent',
        preview: 'Pulled the Grafana CLA as the reference text.',
      },
      {
        sender: 'Counsel',
        direction: 'received',
        preview: 'Two tweaks before we publish. Sending redlines.',
      },
    ],
  },
  {
    id: 'talk-followup',
    space: 'work',
    label: 'External',
    subject: 'Conference talk follow-up',
    timestamp: 'Thu',
    pinned: false,
    yourTurn: false,
    participants: 'Nora, you',
    messages: [
      {
        sender: 'Nora Castile',
        direction: 'received',
        preview: 'Loved the stacked PRs walkthrough. Slides up?',
      },
      {
        sender: 'You',
        direction: 'sent',
        preview: 'Posting them tonight, will send the link.',
      },
    ],
  },
]

const accentColor: Record<SpaceAccent, string> = {
  slate: 'var(--color-slate-space)',
  brass: 'var(--color-brass)',
  clay: 'var(--color-clay-space)',
}

export function accentFor(space: SpaceId): string {
  const match = spaces.find((s) => s.id === space)
  return accentColor[match?.accent ?? 'slate']
}
