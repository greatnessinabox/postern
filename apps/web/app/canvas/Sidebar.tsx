import type { SurfaceId } from './snapshot'
import { SURFACES } from './surfaces'

function SurfaceGlyph({ surface }: { surface: SurfaceId }) {
  if (surface === 'threads') {
    return (
      <span className="grid h-5 w-5 place-items-center">
        <svg viewBox="0 0 14 14" className="h-4 w-4" aria-hidden="true">
          <path
            d="M2 13V7a5 5 0 0 1 10 0v6"
            fill="none"
            stroke="var(--color-slate-space)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M2 13h10"
            fill="none"
            stroke="var(--color-slate-space)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
    )
  }
  if (surface === 'reader') {
    return (
      <span className="grid h-5 w-5 place-items-center">
        <span className="block h-3 w-3 rounded-full" style={{ background: 'var(--color-brass)' }} />
      </span>
    )
  }
  if (surface === 'notifications') {
    return (
      <span
        className="grid h-5 w-5 place-items-center rounded-[3px]"
        style={{ background: 'var(--color-clay-space)' }}
      >
        <span className="block h-1.5 w-1.5 rounded-[1px] bg-parchment" />
      </span>
    )
  }
  return (
    <span className="grid h-5 w-5 place-items-center">
      <svg viewBox="0 0 14 14" className="h-4 w-4" aria-hidden="true">
        <path
          d="M2.5 2.5h9M2.5 7h9M2.5 11.5h9"
          fill="none"
          stroke="var(--color-ink-faint)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

interface SidebarProps {
  active: SurfaceId
  counts: Record<SurfaceId, number>
  onSelect: (surface: SurfaceId) => void
  account: string
}

export function Sidebar({ active, counts, onSelect, account }: SidebarProps) {
  return (
    <aside className="w-[224px] shrink-0 border-r border-ink/10 bg-parchment-deep/40 p-4">
      <div className="px-2 pb-3">
        <span className="frame-label">Surfaces</span>
      </div>

      <ul className="space-y-1">
        {SURFACES.map((surface) => {
          const isActive = surface.id === active
          return (
            <li key={surface.id}>
              <button
                type="button"
                onClick={() => onSelect(surface.id)}
                className={`space-item relative flex w-full items-center gap-3 rounded-md py-2 pr-3 pl-4 text-left ${
                  isActive ? 'bg-ink/[0.04]' : ''
                }`}
              >
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 bottom-1.5 left-0 w-[2px] rounded-r"
                    style={{ background: surface.accent }}
                  />
                ) : null}
                <SurfaceGlyph surface={surface.id} />
                <span
                  className={
                    isActive ? 'text-[13px] font-medium text-ink' : 'text-[13px] text-ink-soft'
                  }
                >
                  {surface.name}
                </span>
                <span
                  className={`ml-auto text-[11px] tabular-nums ${
                    isActive ? 'text-ink-faint' : 'text-ink-ghost'
                  }`}
                >
                  {counts[surface.id]}
                </span>
                <span
                  className={`text-[11px] ${isActive ? 'text-ink-faint' : 'text-ink-ghost'}`}
                  aria-hidden="true"
                >
                  {surface.shortcut}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-10 border-t border-ink/10 pt-4">
        <div className="flex items-center gap-2 px-2">
          <span
            className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-medium text-parchment"
            style={{ background: 'var(--color-slate-space)' }}
          >
            MN
          </span>
          <div className="min-w-0 leading-tight">
            <div className="text-[12px] font-medium text-ink">Marquis Nobles</div>
            <div className="truncate text-[10.5px] text-ink-faint">{account}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
