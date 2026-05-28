import { activeSpace, spaces, threads } from './canvas/mock-data'
import { Sidebar } from './canvas/Sidebar'
import { ThreadTile } from './canvas/ThreadTile'

export default function HomePage() {
  const space = spaces.find((s) => s.id === activeSpace)
  const visible = threads.filter((thread) => thread.space === activeSpace)
  const ordered = [...visible].sort((a, b) => Number(b.pinned) - Number(a.pinned))
  const pinnedCount = ordered.filter((thread) => thread.pinned).length

  return (
    <div className="min-h-screen px-8 py-12">
      <div className="mx-auto max-w-[1200px] overflow-hidden rounded-[14px] border border-ink/10 bg-parchment shadow-[0_1px_0_rgba(26,22,18,0.03),0_24px_60px_-32px_rgba(26,22,18,0.15)]">
        <div className="flex items-center gap-2 border-b border-ink/10 bg-parchment-deep/60 px-4 py-3">
          <span className="block h-3 w-3 rounded-full bg-ink/15" />
          <span className="block h-3 w-3 rounded-full bg-ink/15" />
          <span className="block h-3 w-3 rounded-full bg-ink/15" />
          <div className="ml-4 flex items-center gap-2">
            <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true">
              <path
                d="M2 13V6a5 5 0 0 1 10 0v7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <path
                d="M2 13h10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <circle cx="7" cy="1.6" r="0.9" fill="var(--color-brass)" />
            </svg>
            <span className="text-[11px] font-medium tracking-wide text-ink-faint">Postern</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="rounded-md border border-ink/10 px-2 py-0.5 text-[10px] text-ink-ghost">
              ⌘K
            </span>
          </div>
        </div>

        <div className="flex">
          <Sidebar activeSpace={activeSpace} />

          <main className="paper-grain min-h-[640px] flex-1 px-8 py-6">
            <div className="mb-6 flex items-baseline justify-between">
              <div>
                <h1 className="font-serif text-[28px] leading-none font-normal text-ink">
                  {space?.name ?? 'Work'}
                </h1>
                <p className="mt-1.5 text-[12px] text-ink-faint">
                  Active correspondence, last 14 days
                </p>
              </div>
              <div className="text-[11px] text-ink-faint">
                <span>{ordered.length} threads</span>
                <span className="mx-2 text-ink/15">·</span>
                <span>{pinnedCount} pinned</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {ordered.map((thread) => (
                <ThreadTile key={thread.id} thread={thread} />
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
