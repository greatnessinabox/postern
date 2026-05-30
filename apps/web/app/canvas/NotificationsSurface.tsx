import type { Card } from './snapshot'
import { formatDate } from './surfaces'
import { TrustGlyph } from './TrustGlyph'

const REPO_PREFIX = /^\[([^\]]+)\]\s*/

interface RepoGroup {
  repo: string
  cards: Card[]
}

interface SingleRow {
  card: Card
}

type Row = ({ kind: 'group' } & RepoGroup) | ({ kind: 'single' } & SingleRow)

function buildRows(items: Card[]): Row[] {
  const ordered = [...items].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  const groups = new Map<string, Card[]>()
  const singles: Card[] = []

  for (const card of ordered) {
    const match = REPO_PREFIX.exec(card.subject)
    const repo = match?.[1]
    if (repo) {
      const existing = groups.get(repo)
      if (existing) {
        existing.push(card)
      } else {
        groups.set(repo, [card])
      }
    } else {
      singles.push(card)
    }
  }

  const groupRows: Row[] = [...groups.entries()].map(([repo, cards]) => ({
    kind: 'group',
    repo,
    cards,
  }))
  const singleRows: Row[] = singles.map((card) => ({ kind: 'single', card }))
  return [...groupRows, ...singleRows]
}

function stripPrefix(subject: string): string {
  return subject.replace(REPO_PREFIX, '')
}

function GroupRow({ repo, cards }: RepoGroup) {
  const latest = cards[0]
  if (!latest) {
    return null
  }
  return (
    <article className="space-item flex items-baseline gap-3 border-b border-ink/[0.07] px-2 py-3">
      <span className="font-mono text-[12px] text-ink">{repo}</span>
      <span className="rounded-[3px] border border-ink/15 px-1.5 py-[1px] text-[10px] text-ink-faint tabular-nums">
        {cards.length}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-soft">
        {stripPrefix(latest.subject)}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-[11px] text-ink-faint tabular-nums">
        <TrustGlyph trust={latest.trust} />
        {formatDate(latest.date)}
      </span>
    </article>
  )
}

function IndividualRow({ card }: SingleRow) {
  return (
    <article className="space-item flex items-baseline gap-3 border-b border-ink/[0.07] px-2 py-3">
      <span className="font-mono text-[12px] text-ink-faint">{card.fromName}</span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-soft">{card.subject}</span>
      <span className="flex shrink-0 items-center gap-2 text-[11px] text-ink-faint tabular-nums">
        <TrustGlyph trust={card.trust} />
        {formatDate(card.date)}
      </span>
    </article>
  )
}

export function NotificationsSurface({ items }: { items: Card[] }) {
  const rows = buildRows(items)
  return (
    <div className="-mx-2">
      {rows.map((row) =>
        row.kind === 'group' ? (
          <GroupRow key={`group-${row.repo}`} repo={row.repo} cards={row.cards} />
        ) : (
          <IndividualRow
            key={`single-${row.card.fromAddress}-${row.card.date}-${row.card.subject}`}
            card={row.card}
          />
        ),
      )}
    </div>
  )
}
