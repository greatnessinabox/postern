'use client'

import { useEffect, useState } from 'react'
import { type SendPayload, sendMessage } from './daemon'

export interface ComposerDraft {
  to: string
  subject: string
  inReplyTo?: string
}

function replySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`
}

export function composerDraftFor(card: {
  fromAddress: string
  subject: string
  messageIdHeader: string
}): ComposerDraft {
  const draft: ComposerDraft = {
    to: card.fromAddress,
    subject: replySubject(card.subject),
  }
  if (card.messageIdHeader.length > 0) {
    draft.inReplyTo = card.messageIdHeader
  }
  return draft
}

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function Composer({
  account,
  accent,
  draft,
  onClose,
}: {
  account: string
  accent: string
  draft: ComposerDraft
  onClose: () => void
}) {
  const [to, setTo] = useState(draft.to)
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const recipients = to
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
  const canSend = recipients.length > 0 && status !== 'sending'

  const send = async () => {
    if (!canSend) {
      return
    }
    setStatus('sending')
    setError('')
    const payload: SendPayload = {
      account,
      to: recipients,
      subject,
      body,
    }
    if (draft.inReplyTo !== undefined) {
      payload.inReplyTo = draft.inReplyTo
    }
    const result = await sendMessage(payload)
    if (result === null) {
      setStatus('error')
      setError('The message could not be sent. The daemon may be offline.')
      return
    }
    setStatus('sent')
    setTimeout(onClose, 900)
  }

  const fieldClass =
    'w-full rounded-md border border-ink/10 bg-parchment px-3 py-2 text-[13px] text-ink outline-none focus:border-ink/25'

  return (
    <div className="rounded-md border border-ink/10 bg-parchment-deep/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="frame-label">
          {draft.inReplyTo !== undefined ? 'Reply' : 'New message'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="space-item rounded-md px-2 py-1 text-[12px] text-ink-faint hover:text-ink-soft"
        >
          Close
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder="To"
          aria-label="To"
          className={fieldClass}
        />
        <input
          type="text"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Subject"
          aria-label="Subject"
          className={fieldClass}
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write your message"
          aria-label="Message"
          rows={8}
          className={`${fieldClass} resize-y font-serif leading-relaxed`}
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            void send()
          }}
          disabled={!canSend}
          className="rounded-md px-3 py-1.5 text-[12.5px] font-medium text-parchment transition-opacity disabled:opacity-40"
          style={{ background: accent }}
        >
          {status === 'sending' ? 'Sending' : 'Send'}
        </button>
        {status === 'sent' ? <span className="text-[12px] text-ink-faint">Sent.</span> : null}
        {status === 'error' ? <span className="text-[12px] text-ink-soft">{error}</span> : null}
      </div>
    </div>
  )
}
