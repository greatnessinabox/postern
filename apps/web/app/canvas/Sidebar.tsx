import type { Space, SpaceGlyph } from './snapshot'

function SpaceGlyphMark({ glyph, color }: { glyph: SpaceGlyph; color: string }) {
  if (glyph === 'ted') {
    return (
      <span className="grid h-5 w-5 place-items-center">
        <span
          className="grid h-5 w-5 place-items-center rounded-[4px] text-[8px] font-semibold tracking-[0.04em] text-parchment"
          style={{ background: color }}
        >
          TED
        </span>
      </span>
    )
  }
  if (glyph === 'builder') {
    return (
      <span className="grid h-5 w-5 place-items-center">
        <svg viewBox="0 0 14 14" className="h-4 w-4" aria-hidden="true">
          <path
            d="M2.5 5 7 2l4.5 3v6L7 12 2.5 11Z"
            fill="none"
            stroke={color}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M7 2v10" fill="none" stroke={color} strokeWidth="1.4" />
        </svg>
      </span>
    )
  }
  return (
    <span className="grid h-5 w-5 place-items-center">
      <svg viewBox="0 0 14 14" className="h-4 w-4" aria-hidden="true">
        <path
          d="M2 6.5 7 2.5l5 4V12H2V6.5Z"
          fill="none"
          stroke={color}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

interface SidebarProps {
  spaces: Space[]
  activeSpaceId: string
  onSelect: (spaceId: string) => void
  account: string
}

export function Sidebar({ spaces, activeSpaceId, onSelect, account }: SidebarProps) {
  return (
    <aside className="w-[224px] shrink-0 border-r border-ink/10 bg-parchment-deep/40 p-4">
      <div className="px-2 pb-3">
        <span className="frame-label">Spaces</span>
      </div>

      <ul className="space-y-1">
        {spaces.map((space, index) => {
          const isActive = space.id === activeSpaceId
          const shortcut = index < 9 ? `⌘${index + 1}` : ''
          return (
            <li key={space.id}>
              <button
                type="button"
                onClick={() => onSelect(space.id)}
                className={`space-item relative flex w-full items-center gap-3 rounded-md py-2 pr-3 pl-4 text-left ${
                  isActive ? 'bg-ink/[0.04]' : ''
                }`}
                style={isActive ? { background: `${space.accent}14` } : undefined}
              >
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 bottom-1.5 left-0 w-[1px] rounded-r"
                    style={{ background: space.accent }}
                  />
                ) : null}
                <SpaceGlyphMark glyph={space.glyph} color={space.accent} />
                <span
                  className={
                    isActive ? 'text-[13px] font-medium text-ink' : 'text-[13px] text-ink-soft'
                  }
                  style={isActive ? { color: space.accent } : undefined}
                >
                  {space.name}
                </span>
                {shortcut ? (
                  <span
                    className={`ml-auto text-[11px] ${isActive ? 'text-ink-faint' : 'text-ink-ghost'}`}
                    aria-hidden="true"
                  >
                    {shortcut}
                  </span>
                ) : null}
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
        <button
          type="button"
          className="space-item mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-ink-faint"
        >
          <span className="grid h-5 w-5 place-items-center rounded-md border border-dashed border-ink/25 text-[13px] leading-none text-ink-ghost">
            +
          </span>
          Add account
        </button>
      </div>
    </aside>
  )
}
