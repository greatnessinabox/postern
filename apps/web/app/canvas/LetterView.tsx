'use client'

import { useEffect, useState } from 'react'
import { Composer, composerDraftFor } from './Composer'
import { fetchBody } from './daemon'
import type { Card } from './snapshot-data'
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

type BodyState =
  | { phase: 'ready'; html: string; blockedImages: number }
  | { phase: 'loading' }
  | { phase: 'empty' }

export function LetterView({
  card,
  account,
  accent,
  onClose,
}: {
  card: Card
  account: string
  accent: string
  onClose: () => void
}) {
  const [body, setBody] = useState<BodyState>(() =>
    card.bodyHtml !== undefined
      ? { phase: 'ready', html: card.bodyHtml, blockedImages: card.blockedImages ?? 0 }
      : { phase: 'loading' },
  )
  const [composing, setComposing] = useState(false)

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    if (card.bodyHtml !== undefined) {
      setBody({ phase: 'ready', html: card.bodyHtml, blockedImages: card.blockedImages ?? 0 })
      return
    }
    if (card.messageIdHeader.length === 0) {
      setBody({ phase: 'empty' })
      return
    }
    let active = true
    setBody({ phase: 'loading' })
    fetchBody(account, card.messageIdHeader).then((result) => {
      if (!active) {
        return
      }
      setBody(
        result === null
          ? { phase: 'empty' }
          : { phase: 'ready', html: result.html, blockedImages: result.blockedImages },
      )
    })
    return () => {
      active = false
    }
  }, [account, card.bodyHtml, card.blockedImages, card.messageIdHeader])

  const blocked = body.phase === 'ready' ? body.blockedImages : 0

  return (
    <div className="flex flex-col">
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="space-item inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] text-ink-faint hover:text-ink-soft"
          style={{ color: accent }}
        >
          <span aria-hidden="true" className="text-[14px] leading-none">
            ‹
          </span>
          Back
        </button>
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="space-item rounded-md px-2 py-1.5 text-[12.5px] text-ink-faint hover:text-ink-soft"
          style={{ color: accent }}
        >
          Reply
        </button>
      </div>

      <header className="mb-5 border-b border-ink/10 pb-5">
        <h1 className="font-serif text-[28px] leading-snug font-normal text-ink">{card.subject}</h1>
        <p className="mt-2 text-[12px] text-ink-faint">
          <span className="text-ink-soft">{card.fromName}</span> {card.fromAddress}
          <span className="mx-1.5 text-ink-ghost">·</span>
          {formatDate(card.date)} {formatTime(card.date)}
        </p>
      </header>

      {composing ? (
        <div className="mb-5">
          <Composer
            account={account}
            accent={accent}
            draft={composerDraftFor(card)}
            onClose={() => setComposing(false)}
          />
        </div>
      ) : null}

      {blocked > 0 ? (
        <p className="mb-3 text-[11.5px] text-ink-faint">
          {blocked} tracked {blocked === 1 ? 'image' : 'images'} blocked.
        </p>
      ) : null}

      {body.phase === 'ready' ? (
        <iframe
          title={card.subject}
          sandbox=""
          srcDoc={framedDoc(body.html)}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="w-full rounded-md border border-ink/10 bg-parchment"
          style={{ height: '70vh', minHeight: 400 }}
        />
      ) : null}
      {body.phase === 'loading' ? (
        <p className="text-[13px] text-ink-faint">Loading the message.</p>
      ) : null}
      {body.phase === 'empty' ? (
        <p className="text-[13px] text-ink-faint">No preview available.</p>
      ) : null}
    </div>
  )
}
