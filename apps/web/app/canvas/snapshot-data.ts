import type { MessageClassification, Surface, TrustVerdict } from '@postern/core'

// The canonical primitives live in @postern/core; the UI consumes them
// rather than re-declaring literals that could drift.
export type SurfaceId = Surface
export type Trust = TrustVerdict

export type SpaceGlyph = 'home' | 'ted' | 'builder'

export interface Card {
  subject: string
  fromName: string
  fromAddress: string
  date: string
  category: MessageClassification
  trust: Trust
  messageCount: number
  messageIdHeader: string
  bodyHtml?: string
  blockedImages?: number
}

export interface SurfaceData {
  total: number
  items: Card[]
}

export interface Space {
  id: string
  name: string
  account: string
  accent: string
  glyph: SpaceGlyph
  surfaces: Record<SurfaceId, SurfaceData>
}

export interface Snapshot {
  generatedAt: string
  spaces: Space[]
}

const SURFACE_IDS: readonly SurfaceId[] = ['threads', 'reader', 'notifications', 'ledger']

const TRUST_VALUES: readonly Trust[] = ['trusted', 'caution', 'failed', 'unknown']

const GLYPH_VALUES: readonly SpaceGlyph[] = ['home', 'ted', 'builder']

// Used when snapshot.json is absent (it's gitignored, so missing in CI/Vercel).
// Same shape as the real file so the canvas renders and `next build` succeeds.
export const FALLBACK: Snapshot = {
  generatedAt: '1970-01-01T00:00:00.000Z',
  spaces: [
    {
      id: 'personal',
      name: 'Personal',
      account: 'demo@postern.so',
      accent: '#B08E5C',
      glyph: 'home',
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
              messageIdHeader: '',
            },
          ],
        },
        reader: {
          total: 1,
          items: [
            {
              subject: 'Each Space is a room with its own theme and signature',
              fromName: 'Postern',
              fromAddress: 'hello@postern.so',
              date: '1970-01-01T00:00:00.000Z',
              category: 'newsletter',
              trust: 'trusted',
              messageCount: 1,
              messageIdHeader: '',
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
              messageIdHeader: '',
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
              messageIdHeader: '',
            },
          ],
        },
      },
    },
    {
      id: 'work',
      name: 'Work',
      account: 'demo@ted.com',
      accent: '#4A5568',
      glyph: 'ted',
      surfaces: {
        threads: {
          total: 1,
          items: [
            {
              subject: 'Switch Spaces with Cmd-1, Cmd-2, Cmd-3',
              fromName: 'Postern',
              fromAddress: 'hello@postern.so',
              date: '1970-01-01T00:00:00.000Z',
              category: 'personal',
              trust: 'trusted',
              messageCount: 1,
              messageIdHeader: '',
            },
          ],
        },
        reader: { total: 0, items: [] },
        notifications: { total: 0, items: [] },
        ledger: { total: 0, items: [] },
      },
    },
  ],
}

const CLASSIFICATIONS: readonly MessageClassification[] = [
  'personal',
  'newsletter',
  'notification',
  'transactional',
  'promotional',
  'job',
  'unclassified',
]

function toTrust(value: unknown): Trust {
  return TRUST_VALUES.find((t) => t === value) ?? 'unknown'
}

function toClassification(value: unknown): MessageClassification {
  return CLASSIFICATIONS.find((c) => c === value) ?? 'unclassified'
}

function toGlyph(value: unknown): SpaceGlyph {
  return GLYPH_VALUES.find((g) => g === value) ?? 'home'
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
  const messageIdHeader = raw['messageIdHeader']
  const bodyHtml = raw['bodyHtml']
  const blockedImages = raw['blockedImages']
  if (
    typeof subject !== 'string' ||
    typeof fromName !== 'string' ||
    typeof fromAddress !== 'string' ||
    typeof date !== 'string' ||
    typeof category !== 'string'
  ) {
    return null
  }
  const card: Card = {
    subject,
    fromName,
    fromAddress,
    date,
    category: toClassification(category),
    trust: toTrust(raw['trust']),
    messageCount: typeof messageCount === 'number' ? messageCount : 1,
    messageIdHeader: typeof messageIdHeader === 'string' ? messageIdHeader : '',
  }
  if (typeof bodyHtml === 'string') {
    card.bodyHtml = bodyHtml
  }
  if (typeof blockedImages === 'number') {
    card.blockedImages = blockedImages
  }
  return card
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

function toSpace(value: unknown): Space | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const raw = value as Record<string, unknown>
  const id = raw['id']
  const name = raw['name']
  const account = raw['account']
  const accent = raw['accent']
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof account !== 'string' ||
    typeof accent !== 'string'
  ) {
    return null
  }
  const surfacesRaw = raw['surfaces']
  const surfacesObj =
    typeof surfacesRaw === 'object' && surfacesRaw !== null
      ? (surfacesRaw as Record<string, unknown>)
      : {}
  const surfaces = {} as Record<SurfaceId, SurfaceData>
  for (const surfaceId of SURFACE_IDS) {
    surfaces[surfaceId] = toSurfaceData(surfacesObj[surfaceId])
  }
  return {
    id,
    name,
    account,
    accent,
    glyph: toGlyph(raw['glyph']),
    surfaces,
  }
}

export function parseSnapshot(value: unknown): Snapshot {
  if (typeof value !== 'object' || value === null) {
    return FALLBACK
  }
  const raw = value as Record<string, unknown>
  const rawSpaces = raw['spaces']
  const spaces = Array.isArray(rawSpaces)
    ? rawSpaces.map(toSpace).filter((space): space is Space => space !== null)
    : []
  if (spaces.length === 0) {
    return FALLBACK
  }
  const generatedAt = raw['generatedAt']
  return {
    generatedAt: typeof generatedAt === 'string' ? generatedAt : FALLBACK.generatedAt,
    spaces,
  }
}
