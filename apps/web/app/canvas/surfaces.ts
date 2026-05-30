import type { Card, SurfaceId } from './snapshot'

export interface SurfaceMeta {
  id: SurfaceId
  name: string
  shortcut: string
  accent: string
}

export const SURFACES: SurfaceMeta[] = [
  { id: 'threads', name: 'Threads', shortcut: '⌘1', accent: 'var(--color-slate-space)' },
  { id: 'reader', name: 'Reader', shortcut: '⌘2', accent: 'var(--color-brass)' },
  { id: 'notifications', name: 'Notifications', shortcut: '⌘3', accent: 'var(--color-clay-space)' },
  { id: 'ledger', name: 'Ledger', shortcut: '⌘4', accent: 'var(--color-ink-soft)' },
]

export function accentFor(surface: SurfaceId): string {
  return SURFACES.find((s) => s.id === surface)?.accent ?? 'var(--color-slate-space)'
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function domainOf(address: string): string {
  const at = address.lastIndexOf('@')
  return at === -1 ? address : address.slice(at + 1)
}

export function needsTrustWarning(trust: Card['trust']): boolean {
  return trust === 'caution' || trust === 'failed'
}
