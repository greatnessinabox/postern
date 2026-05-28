import { accentFor, type Thread } from './mock-data'

export function ThreadTile({ thread }: { thread: Thread }) {
  return (
    <article className="tile shadow-tile relative flex h-[280px] flex-col rounded-md border border-ink/10 bg-parchment">
      <span
        aria-hidden="true"
        className="absolute top-3 bottom-3 left-0 w-[1px] rounded-r"
        style={{ background: accentFor(thread.space) }}
      />
      {thread.yourTurn ? <span className="brass-dot absolute top-3.5 right-3.5" /> : null}

      <div className="flex items-center justify-between px-4 pt-3.5">
        {thread.pinned ? (
          <span className="inline-flex items-center gap-1 rounded-[3px] border border-ink/15 px-1.5 py-[1px] text-[9.5px] font-medium tracking-wide text-ink-soft uppercase">
            {thread.label}
          </span>
        ) : (
          <span className="text-[10.5px] text-ink-faint">{thread.label}</span>
        )}
        <span className={`text-[10.5px] text-ink-faint ${thread.yourTurn ? 'mr-3' : ''}`}>
          {thread.timestamp}
        </span>
      </div>

      <h2 className="mt-2 px-4 font-serif text-[17px] leading-snug text-ink">{thread.subject}</h2>

      <div className="mt-3 flex-1 space-y-2 px-4 pb-4">
        {thread.messages.map((message, index) =>
          message.direction === 'sent' ? (
            <p
              // biome-ignore lint/suspicious/noArrayIndexKey: static mock previews, order is stable
              key={index}
              className="text-right text-[12px] leading-snug"
              style={{ color: 'var(--color-slate-space)' }}
            >
              {message.preview}
            </p>
          ) : (
            <p
              // biome-ignore lint/suspicious/noArrayIndexKey: static mock previews, order is stable
              key={index}
              className="text-[12px] leading-snug text-ink"
            >
              <span className="font-medium">{message.sender}</span> · {message.preview}
            </p>
          ),
        )}
      </div>

      <div className="flex items-center justify-between border-t border-ink/10 px-4 py-2.5">
        <span className="text-[10.5px] text-ink-faint">{thread.messages.length} messages</span>
        <span className="text-[10.5px] text-ink-faint">{thread.participants}</span>
      </div>
    </article>
  )
}
