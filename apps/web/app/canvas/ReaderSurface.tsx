import type { Card } from './snapshot'
import { formatDate } from './surfaces'
import { TrustGlyph } from './TrustGlyph'

function ReaderRow({ card }: { card: Card }) {
  return (
    <article className="space-item group flex items-baseline gap-4 border-b border-ink/[0.07] px-2 py-3.5">
      <span className="w-[160px] shrink-0 truncate text-[10.5px] tracking-[0.08em] text-ink-faint uppercase">
        {card.fromName}
      </span>
      <h2 className="min-w-0 flex-1 truncate font-serif text-[16px] leading-snug text-ink-soft group-hover:text-ink">
        {card.subject}
      </h2>
      <span className="flex shrink-0 items-center gap-2 text-[11px] text-ink-faint tabular-nums">
        <TrustGlyph trust={card.trust} />
        {formatDate(card.date)}
      </span>
    </article>
  )
}

export function ReaderSurface({ items }: { items: Card[] }) {
  const ordered = [...items].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  return (
    <div className="-mx-2">
      {ordered.map((card) => (
        <ReaderRow key={`${card.fromAddress}-${card.date}-${card.subject}`} card={card} />
      ))}
    </div>
  )
}
