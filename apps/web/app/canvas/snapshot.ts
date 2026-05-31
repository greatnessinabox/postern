import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FALLBACK, parseSnapshot, type Snapshot } from './snapshot-data'

export type {
  Card,
  Snapshot,
  Space,
  SpaceGlyph,
  SurfaceData,
  SurfaceId,
  Trust,
} from './snapshot-data'
export { parseSnapshot } from './snapshot-data'

export function readSnapshot(): Snapshot {
  try {
    const path = join(process.cwd(), 'app/canvas/snapshot.json')
    const raw = readFileSync(path, 'utf8')
    return parseSnapshot(JSON.parse(raw))
  } catch {
    return FALLBACK
  }
}
