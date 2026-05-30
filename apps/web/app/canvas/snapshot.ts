import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type SurfaceId = 'threads' | 'reader' | 'notifications' | 'ledger'

export type Trust = 'trusted' | 'caution' | 'failed' | 'unknown'

export interface Card {
  subject: string
  fromName: string
  fromAddress: string
  date: string
  category: string
  trust: Trust
  messageCount: number
}

export interface SurfaceData {
  total: number
  items: Card[]
}

export interface Snapshot {
  generatedAt: string
  account: string
  surfaces: Record<SurfaceId, SurfaceData>
}

const SURFACE_IDS: readonly SurfaceId[] = ['threads', 'reader', 'notifications', 'ledger']

const TRUST_VALUES: readonly Trust[] = ['trusted', 'caution', 'failed', 'unknown']

// Used when snapshot.json is absent (it's gitignored, so missing in CI/Vercel).
// Same shape as the real file so the canvas renders and `next build` succeeds.
const FALLBACK: Snapshot = {
  generatedAt: '1970-01-01T00:00:00.000Z',
  account: 'demo@postern.so',
  surfaces: {
    threads: {
      total: 1,
      items: [
        {
          subject: 'Welcome to Postern.',
          fromName: 'Marquis Nobles',
          fromAddress: 'marquis@postern.so',
          date: '1970-01-01T00:00:00.000Z',
          category: 'personal',
          trust: 'trusted',
          messageCount: 1,
        },
      ],
    },
    reader: {
      total: 1,
      items: [
        {
          subject: 'The home screen is threads you are in the middle of',
          fromName: 'Postern',
          fromAddress: 'hello@postern.so',
          date: '1970-01-01T00:00:00.000Z',
          category: 'newsletter',
          trust: 'trusted',
          messageCount: 1,
        },
      ],
    },
    notifications: {
      total: 1,
      items: [
        {
          subject: '[postern/postern] Snapshot missing, using fallback data (PR #1)',
          fromName: 'Postern',
          fromAddress: 'notifications@postern.so',
          date: '1970-01-01T00:00:00.000Z',
          category: 'notification',
          trust: 'trusted',
          messageCount: 1,
        },
      ],
    },
    ledger: {
      total: 1,
      items: [
        {
          subject: 'Receipt for your Postern subscription',
          fromName: 'Postern',
          fromAddress: 'billing@postern.so',
          date: '1970-01-01T00:00:00.000Z',
          category: 'transactional',
          trust: 'trusted',
          messageCount: 1,
        },
      ],
    },
  },
}

function toTrust(value: unknown): Trust {
  return TRUST_VALUES.find((t) => t === value) ?? 'unknown'
}

function toCard(value: unknown): Card | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const raw = value as Record<string, unknown>
  const subject = raw['subject']
  const fromName = raw['fromName']
  const fromAddress = raw['fromAddress']
  const date = raw['date']
  const category = raw['category']
  const messageCount = raw['messageCount']
  if (
    typeof subject !== 'string' ||
    typeof fromName !== 'string' ||
    typeof fromAddress !== 'string' ||
    typeof date !== 'string' ||
    typeof category !== 'string'
  ) {
    return null
  }
  return {
    subject,
    fromName,
    fromAddress,
    date,
    category,
    trust: toTrust(raw['trust']),
    messageCount: typeof messageCount === 'number' ? messageCount : 1,
  }
}

function toSurfaceData(value: unknown): SurfaceData {
  if (typeof value !== 'object' || value === null) {
    return { total: 0, items: [] }
  }
  const raw = value as Record<string, unknown>
  const rawItems = raw['items']
  const items = Array.isArray(rawItems)
    ? rawItems.map(toCard).filter((card): card is Card => card !== null)
    : []
  const total = raw['total']
  return { total: typeof total === 'number' ? total : items.length, items }
}

function parseSnapshot(value: unknown): Snapshot {
  if (typeof value !== 'object' || value === null) {
    return FALLBACK
  }
  const raw = value as Record<string, unknown>
  const surfacesRaw = raw['surfaces']
  const surfacesObj =
    typeof surfacesRaw === 'object' && surfacesRaw !== null
      ? (surfacesRaw as Record<string, unknown>)
      : {}
  const surfaces = {} as Record<SurfaceId, SurfaceData>
  for (const id of SURFACE_IDS) {
    surfaces[id] = toSurfaceData(surfacesObj[id])
  }
  const generatedAt = raw['generatedAt']
  const account = raw['account']
  return {
    generatedAt: typeof generatedAt === 'string' ? generatedAt : FALLBACK.generatedAt,
    account: typeof account === 'string' ? account : FALLBACK.account,
    surfaces,
  }
}

export function readSnapshot(): Snapshot {
  try {
    const path = join(process.cwd(), 'app/canvas/snapshot.json')
    const raw = readFileSync(path, 'utf8')
    return parseSnapshot(JSON.parse(raw))
  } catch {
    return FALLBACK
  }
}
