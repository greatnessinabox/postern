import type { Card } from './snapshot'
import { formatDate } from './surfaces'
import { TrustGlyph } from './TrustGlyph'

function ThreadCard({ card, yourTurn, accent }: { card: Card; yourTurn: boolean; accent: string }) {
  return (
    <article className="tile shadow-tile relative flex min-h-[200px] flex-col rounded-md border border-ink/10 bg-parchment">
      <span
        aria-hidden="true"
        className="absolute top-3 bottom-3 left-0 w-[1px] rounded-r"
        style={{ background: accent }}
      />
      {yourTurn ? <span className="brass-dot absolute top-3.5 right-3.5" /> : null}

      <div className="flex items-center justify-between px-4 pt-3.5">
        <span className="text-[10.5px] text-ink-faint">{card.fromName}</span>
        <span className={`text-[10.5px] text-ink-faint ${yourTurn ? 'mr-3' : ''}`}>
          {formatDate(card.date)}
        </span>
      </div>

      <h2 className="mt-2 flex-1 px-4 font-serif text-[17px] leading-snug text-ink">
        {card.subject}
      </h2>

      <div className="flex items-center justify-between border-t border-ink/10 px-4 py-2.5">
        <span className="text-[10.5px] text-ink-faint">{card.fromAddress}</span>
        <span className="flex items-center gap-2 text-[10.5px] text-ink-faint">
          <TrustGlyph trust={card.trust} />
          {card.messageCount > 1 ? <span>{card.messageCount} messages</span> : null}
        </span>
      </div>
    </article>
  )
}

export function ThreadsSurface({ items, accent }: { items: Card[]; accent: string }) {
  const ordered = [...items].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  const newestDate = ordered[0]?.date

  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        {ordered.map((card) => (
          <ThreadCard
            key={`${card.fromAddress}-${card.date}-${card.subject}`}
            card={card}
            yourTurn={card.date === newestDate}
            accent={accent}
          />
        ))}
      </div>
      {ordered.length <= 8 ? (
        <p className="mt-6 text-[12px] text-ink-faint">
          {ordered.length} conversations. The rest is filed.
        </p>
      ) : null}
    </div>
  )
}
