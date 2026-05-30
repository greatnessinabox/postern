import type { Card } from './snapshot'
import { domainOf, formatDate } from './surfaces'
import { TrustGlyph } from './TrustGlyph'

export function LedgerSurface({ items }: { items: Card[] }) {
  const ordered = [...items].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-ink/15">
          <th className="w-[180px] px-2 py-2 text-[10.5px] font-medium tracking-[0.08em] text-ink-faint uppercase">
            Vendor
          </th>
          <th className="px-2 py-2 text-[10.5px] font-medium tracking-[0.08em] text-ink-faint uppercase">
            Subject
          </th>
          <th className="w-[100px] px-2 py-2 text-right text-[10.5px] font-medium tracking-[0.08em] text-ink-faint uppercase">
            Date
          </th>
        </tr>
      </thead>
      <tbody>
        {ordered.map((card) => (
          <tr
            key={`${card.fromAddress}-${card.date}-${card.subject}`}
            className="space-item border-b border-ink/[0.07]"
          >
            <td className="px-2 py-2.5 align-top">
              <span className="text-[12.5px] text-ink">
                {card.fromName || domainOf(card.fromAddress)}
              </span>
            </td>
            <td className="px-2 py-2.5 align-top">
              <span className="flex items-center gap-2 text-[12.5px] text-ink-soft">
                {card.subject}
                <TrustGlyph trust={card.trust} />
              </span>
            </td>
            <td className="px-2 py-2.5 text-right align-top text-[11.5px] text-ink-faint tabular-nums">
              {formatDate(card.date)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
