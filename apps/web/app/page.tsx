import { Canvas } from './canvas/Canvas'
import { readSnapshot } from './canvas/snapshot'

export default function HomePage() {
  const snapshot = readSnapshot()

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

        <Canvas snapshot={snapshot} />
      </div>
    </div>
  )
}
