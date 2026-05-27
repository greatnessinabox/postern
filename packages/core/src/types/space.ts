/**
 * Space: an identity container with its own theme, signature, and AI persona.
 *
 * Work, Personal, Side Projects, etc. Each Space carries the visual
 * accent, the signature appended to drafts, and a persona description
 * the AI Function adapters use when drafting on the user's behalf.
 */

import type { AccountId, SpaceId } from './common.ts'

export interface SpaceTheme {
  readonly accent: string
  readonly backgroundTint: 'parchment-warm' | 'parchment-cool' | 'parchment-neutral'
  readonly glyph: string
}

export interface Space {
  readonly id: SpaceId
  readonly name: string
  readonly theme: SpaceTheme
  readonly signature: string
  readonly aiPersona?: string
  readonly accountIds: readonly AccountId[]
  readonly position: number
  readonly readStyle: 'letter' | 'side-panel'
}
