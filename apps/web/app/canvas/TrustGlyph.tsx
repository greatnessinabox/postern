import type { Card } from './snapshot'
import { needsTrustWarning } from './surfaces'

export function TrustGlyph({ trust }: { trust: Card['trust'] }) {
  if (!needsTrustWarning(trust)) {
    return null
  }
  const label = trust === 'failed' ? 'Authentication failed' : 'Unverified sender'
  return (
    <span
      role="img"
      className="inline-flex items-center gap-1 text-[10px] text-ink-faint"
      title={label}
      aria-label={label}
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
        <path
          d="M6 1.5 11 10.5H1L6 1.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <path
          d="M6 5v2.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <circle cx="6" cy="9" r="0.55" fill="currentColor" />
      </svg>
    </span>
  )
}
