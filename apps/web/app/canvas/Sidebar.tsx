import { accentFor, type Space, type SpaceId, spaces } from './mock-data'

function SpaceGlyph({ space }: { space: Space }) {
  if (space.accent === 'slate') {
    return (
      <span
        className="grid h-5 w-5 place-items-center rounded-[3px]"
        style={{ background: 'var(--color-slate-space)' }}
      >
        <span className="block h-1.5 w-1.5 rounded-[1px] bg-parchment" />
      </span>
    )
  }

  if (space.accent === 'brass') {
    return (
      <span className="grid h-5 w-5 place-items-center">
        <span className="block h-3 w-3 rounded-full" style={{ background: 'var(--color-brass)' }} />
      </span>
    )
  }

  return (
    <span className="grid h-5 w-5 place-items-center">
      <svg viewBox="0 0 14 14" className="h-4 w-4" aria-hidden="true">
        <path
          d="M2 13V7a5 5 0 0 1 10 0v6"
          fill="none"
          stroke="var(--color-clay-space)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M2 13h10"
          fill="none"
          stroke="var(--color-clay-space)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

function OtherGlyph() {
  return (
    <span className="grid h-5 w-5 place-items-center">
      <svg viewBox="0 0 14 14" className="h-4 w-4" aria-hidden="true">
        <path
          d="M2.5 12V7a4.5 4.5 0 0 1 9 0v5"
          fill="none"
          stroke="var(--color-ink-faint)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M2.5 12h9"
          fill="none"
          stroke="var(--color-ink-faint)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

export function Sidebar({ activeSpace }: { activeSpace: SpaceId }) {
  return (
    <aside className="w-[224px] shrink-0 border-r border-ink/10 bg-parchment-deep/40 p-4">
      <div className="px-2 pb-3">
        <span className="frame-label">Spaces</span>
      </div>

      <ul className="space-y-1">
        {spaces.map((space) => {
          const isActive = space.id === activeSpace
          return (
            <li key={space.id}>
              <div
                className={`space-item relative flex items-center gap-3 rounded-md py-2 pr-3 pl-4 ${
                  isActive ? 'bg-ink/[0.04]' : ''
                }`}
              >
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 bottom-1.5 left-0 w-[2px] rounded-r"
                    style={{ background: accentFor(space.id) }}
                  />
                ) : null}
                <SpaceGlyph space={space} />
                <span
                  className={
                    isActive ? 'text-[13px] font-medium text-ink' : 'text-[13px] text-ink-soft'
                  }
                >
                  {space.name}
                </span>
                <span
                  className={`ml-auto text-[11px] ${
                    isActive ? 'text-ink-faint' : 'text-ink-ghost'
                  }`}
                >
                  {space.shortcut}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-8 px-2">
        <span className="frame-label">Other</span>
      </div>
      <ul className="mt-2 space-y-1">
        <li>
          <div className="space-item flex items-center gap-3 rounded-md px-4 py-2">
            <OtherGlyph />
            <span className="text-[13px] text-ink-soft">Reader</span>
            <span className="ml-auto text-[11px] text-ink-ghost">G R</span>
          </div>
        </li>
        <li>
          <div className="space-item flex items-center gap-3 rounded-md px-4 py-2">
            <OtherGlyph />
            <span className="text-[13px] text-ink-soft">Ledger</span>
            <span className="ml-auto text-[11px] text-ink-ghost">G L</span>
          </div>
        </li>
      </ul>

      <div className="mt-10 border-t border-ink/10 pt-4">
        <div className="flex items-center gap-2 px-2">
          <span
            className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-medium text-parchment"
            style={{ background: 'var(--color-slate-space)' }}
          >
            MN
          </span>
          <div className="leading-tight">
            <div className="text-[12px] font-medium text-ink">Marquis Nobles</div>
            <div className="text-[10.5px] text-ink-faint">3 accounts connected</div>
          </div>
        </div>
        <button
          type="button"
          className="space-item mt-2 flex w-full items-center gap-3 rounded-md px-2 py-2 text-left"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full border border-dashed border-ink/25 text-ink-faint">
            <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                d="M7 2v10M2 7h10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="text-[12px] text-ink-faint">Add account</span>
        </button>
      </div>
    </aside>
  )
}
