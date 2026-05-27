/**
 * Boost: a scriptable customization attached to a sender, Space, or
 * thread filter.
 *
 * Three kinds, run by the Boost engine when rendering threads:
 *   - css: a stylesheet applied inside the thread body's shadow DOM
 *   - transform: a JS function (sandboxed) that mutates the rendered DOM
 *   - prompt: a prompt template the AI Function uses for that context
 *
 * Boosts are local files, version-controlled, shareable as gists.
 */

import type { BoostId, SpaceId } from './common.ts'

export type BoostKind = 'css' | 'transform' | 'prompt'

export interface BoostScope {
  readonly senderDomains?: readonly string[]
  readonly senderAddresses?: readonly string[]
  readonly spaceId?: SpaceId
  readonly threadSubjectPattern?: string
}

export interface Boost {
  readonly id: BoostId
  readonly name: string
  readonly description?: string
  readonly kind: BoostKind
  readonly source: string
  readonly scope: BoostScope
  readonly enabled: boolean
  readonly author?: string
  readonly version: string
  readonly installedAt: Date
}
