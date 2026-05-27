/**
 * Command: a callable action surfaced via Cmd-K.
 *
 * Search, compose, switch Space, run a Boost, invoke an AI Function.
 * Each Command has stable input/output shapes so the bar remains
 * scriptable for years.
 */

import type { CommandId } from './common.ts'

export type CommandKind =
  | 'search'
  | 'compose'
  | 'navigate'
  | 'space-switch'
  | 'boost-run'
  | 'ai-function'
  | 'thread-action'

export interface CommandShortcut {
  readonly mac: string
  readonly other: string
}

export interface Command {
  readonly id: CommandId
  readonly kind: CommandKind
  readonly title: string
  readonly subtitle?: string
  readonly shortcut?: CommandShortcut
  readonly keywords: readonly string[]
  readonly icon?: string
  readonly enabled: boolean
}
