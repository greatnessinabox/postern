'use client'

import { useEffect } from 'react'
import type { Card } from './snapshot'
import { formatDate, formatTime } from './surfaces'

// Defense in depth on top of the sanitizer and the empty sandbox: a CSP
// that forbids every remote fetch. Even if a remote URL survived
// sanitizing, the document cannot load it. data: and cid: cover inline
// images; styles stay inline.
const CSP =
  "default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"

function framedDoc(bodyHtml: string): string {
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${CSP}"></head><body>${bodyHtml}</body></html>`
}

export function LetterView({
  card,
  accent,
  onClose,
}: {
  card: Card
  accent: string
  onClose: () => void
}) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const blocked = card.blockedImages ?? 0

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onClose}
        className="space-item mb-5 inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] text-ink-faint hover:text-ink-soft"
        style={{ color: accent }}
      >
        <span aria-hidden="true" className="text-[14px] leading-none">
          ‹
        </span>
        Back
      </button>

      <header className="mb-5 border-b border-ink/10 pb-5">
        <h1 className="font-serif text-[28px] leading-snug font-normal text-ink">{card.subject}</h1>
        <p className="mt-2 text-[12px] text-ink-faint">
          <span className="text-ink-soft">{card.fromName}</span> {card.fromAddress}
          <span className="mx-1.5 text-ink-ghost">·</span>
          {formatDate(card.date)} {formatTime(card.date)}
        </p>
      </header>

      {blocked > 0 ? (
        <p className="mb-3 text-[11.5px] text-ink-faint">
          {blocked} tracked {blocked === 1 ? 'image' : 'images'} blocked.
        </p>
      ) : null}

      {card.bodyHtml ? (
        <iframe
          title={card.subject}
          sandbox=""
          srcDoc={framedDoc(card.bodyHtml)}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="w-full rounded-md border border-ink/10 bg-parchment"
          style={{ height: '70vh', minHeight: 400 }}
        />
      ) : (
        <p className="text-[13px] text-ink-faint">No preview available.</p>
      )}
    </div>
  )
}
