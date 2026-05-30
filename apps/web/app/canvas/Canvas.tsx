'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LedgerSurface } from './LedgerSurface'
import { NotificationsSurface } from './NotificationsSurface'
import { ReaderSurface } from './ReaderSurface'
import { Sidebar } from './Sidebar'
import type { Snapshot, SurfaceId } from './snapshot'
import { SURFACES } from './surfaces'
import { ThreadsSurface } from './ThreadsSurface'

const SURFACE_BY_INDEX: SurfaceId[] = ['threads', 'reader', 'notifications', 'ledger']

const HEADERS: Record<SurfaceId, { title: string; blurb: string }> = {
  threads: { title: 'Threads', blurb: 'Active correspondence. The noise is routed away.' },
  reader: { title: 'Reader', blurb: 'Newsletters and feeds, sized for reading.' },
  notifications: { title: 'Notifications', blurb: 'Dev and automated alerts, grouped by source.' },
  ledger: { title: 'Ledger', blurb: 'Receipts, orders, and shipping.' },
}

export function Canvas({ snapshot }: { snapshot: Snapshot }) {
  const [active, setActive] = useState<SurfaceId>('threads')

  const counts = useMemo(() => {
    const result = {} as Record<SurfaceId, number>
    for (const surface of SURFACES) {
      result[surface.id] = snapshot.surfaces[surface.id].total
    }
    return result
  }, [snapshot])

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (!event.metaKey && !event.ctrlKey) {
      return
    }
    const index = Number.parseInt(event.key, 10) - 1
    const target = SURFACE_BY_INDEX[index]
    if (target) {
      event.preventDefault()
      setActive(target)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const surface = snapshot.surfaces[active]
  const header = HEADERS[active]

  return (
    <div className="flex">
      <Sidebar active={active} counts={counts} onSelect={setActive} account={snapshot.account} />

      <main className="paper-grain min-h-[640px] flex-1 px-8 py-6">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <h1 className="font-serif text-[28px] leading-none font-normal text-ink">
              {header.title}
            </h1>
            <p className="mt-1.5 text-[12px] text-ink-faint">{header.blurb}</p>
          </div>
          <div className="text-[11px] text-ink-faint tabular-nums">{surface.total} total</div>
        </div>

        {active === 'threads' ? <ThreadsSurface items={surface.items} /> : null}
        {active === 'reader' ? <ReaderSurface items={surface.items} /> : null}
        {active === 'notifications' ? <NotificationsSurface items={surface.items} /> : null}
        {active === 'ledger' ? <LedgerSurface items={surface.items} /> : null}
      </main>
    </div>
  )
}
