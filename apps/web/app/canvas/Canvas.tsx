'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LedgerSurface } from './LedgerSurface'
import { LetterView } from './LetterView'
import { NotificationsSurface } from './NotificationsSurface'
import { ReaderSurface } from './ReaderSurface'
import { Sidebar } from './Sidebar'
import type { Card, Snapshot, Space, SurfaceId } from './snapshot'
import { SURFACES } from './surfaces'
import { ThreadsSurface } from './ThreadsSurface'

const HEADERS: Record<SurfaceId, { title: string; blurb: string }> = {
  threads: { title: 'Threads', blurb: 'Active correspondence. The noise is routed away.' },
  reader: { title: 'Reader', blurb: 'Newsletters and feeds, sized for reading.' },
  notifications: { title: 'Notifications', blurb: 'Dev and automated alerts, grouped by source.' },
  ledger: { title: 'Ledger', blurb: 'Receipts, orders, and shipping.' },
}

const EMPTY: Record<SurfaceId, string> = {
  threads: 'Nothing active here.',
  reader: 'Nothing to read here.',
  notifications: 'No alerts here.',
  ledger: 'No receipts here.',
}

function firstSpaceId(spaces: Space[]): string {
  return spaces[0]?.id ?? ''
}

export function Canvas({ snapshot }: { snapshot: Snapshot }) {
  const { spaces } = snapshot
  const [activeSpaceId, setActiveSpaceId] = useState<string>(() => firstSpaceId(spaces))
  const [activeSurface, setActiveSurface] = useState<SurfaceId>('threads')
  const [readingCard, setReadingCard] = useState<Card | null>(null)

  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? spaces[0],
    [spaces, activeSpaceId],
  )

  const selectSpace = useCallback((id: string) => {
    setReadingCard(null)
    setActiveSpaceId(id)
  }, [])

  const selectSurface = useCallback((id: SurfaceId) => {
    setReadingCard(null)
    setActiveSurface(id)
  }, [])

  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) {
        return
      }
      const index = Number.parseInt(event.key, 10) - 1
      const target = spaces[index]
      if (target) {
        event.preventDefault()
        selectSpace(target.id)
      }
    },
    [spaces, selectSpace],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  if (!activeSpace) {
    return null
  }

  const accent = activeSpace.accent
  const surface = activeSpace.surfaces[activeSurface]
  const header = HEADERS[activeSurface]
  const isEmpty = surface.items.length === 0

  return (
    <div className="flex">
      <Sidebar
        spaces={spaces}
        activeSpaceId={activeSpace.id}
        onSelect={selectSpace}
        account={activeSpace.account}
      />

      <main className="paper-grain min-h-[640px] flex-1 px-8 py-6">
        <nav className="mb-5 flex items-center gap-1 border-b border-ink/10 pb-3">
          {SURFACES.map((meta) => {
            const isActive = meta.id === activeSurface
            const total = activeSpace.surfaces[meta.id].total
            return (
              <button
                key={meta.id}
                type="button"
                onClick={() => selectSurface(meta.id)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors ${
                  isActive ? 'font-medium' : 'text-ink-faint hover:text-ink-soft'
                }`}
                style={isActive ? { color: accent, background: `${accent}12` } : undefined}
              >
                {meta.name}
                <span
                  className="text-[10.5px] tabular-nums"
                  style={isActive ? { color: accent } : undefined}
                >
                  {total}
                </span>
              </button>
            )
          })}
        </nav>

        {readingCard ? (
          <LetterView card={readingCard} accent={accent} onClose={() => setReadingCard(null)} />
        ) : (
          <>
            <div className="mb-6 flex items-baseline justify-between">
              <div>
                <h1 className="font-serif text-[28px] leading-none font-normal text-ink">
                  {header.title}
                </h1>
                <p className="mt-1.5 text-[12px] text-ink-faint">{header.blurb}</p>
              </div>
              <div className="text-[11px] text-ink-faint tabular-nums">{surface.total} total</div>
            </div>

            {isEmpty ? (
              <p className="text-[13px] text-ink-faint">{EMPTY[activeSurface]}</p>
            ) : (
              <>
                {activeSurface === 'threads' ? (
                  <ThreadsSurface items={surface.items} accent={accent} onOpen={setReadingCard} />
                ) : null}
                {activeSurface === 'reader' ? <ReaderSurface items={surface.items} /> : null}
                {activeSurface === 'notifications' ? (
                  <NotificationsSurface items={surface.items} />
                ) : null}
                {activeSurface === 'ledger' ? <LedgerSurface items={surface.items} /> : null}
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
