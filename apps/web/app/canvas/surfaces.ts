import type { Card, SurfaceId } from './snapshot'

export interface SurfaceMeta {
  id: SurfaceId
  name: string
}

export const SURFACES: SurfaceMeta[] = [
  { id: 'threads', name: 'Threads' },
  { id: 'reader', name: 'Reader' },
  { id: 'notifications', name: 'Notifications' },
  { id: 'ledger', name: 'Ledger' },
]

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
