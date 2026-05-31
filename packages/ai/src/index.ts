/**
 * AI Function interface.
 *
 * Stable functions live here. Model providers (Claude, OpenAI, Ollama)
 * are adapters that conform to AIFunctions. The interface survives the
 * post-LLM transition; the providers swap out underneath.
 *
 * Every function has a non-AI fallback path documented in its
 * implementation. Postern is never AI-required.
 */

import type { Message, MessageClassification, SpaceId, Thread } from '@postern/core'

export { AnthropicProvider, type AnthropicProviderOptions } from './anthropic.ts'
export {
  buildTriageUserPrompt,
  parseTriageResponse,
  TRIAGE_SYSTEM,
  type TriageInput,
  type TriageResult,
} from './triage.ts'

export interface DraftContext {
  readonly thread: Thread
  readonly recentMessages: readonly Message[]
  readonly spaceId: SpaceId
  readonly intent?: 'match-tone' | 'decline' | 'confirm' | 'free-form'
  readonly userPrompt?: string
}

export interface DraftResult {
  readonly body: string
  readonly confidence: number
  readonly provider: string
}

export interface Summary {
  readonly bullets: readonly string[]
  readonly oneLine: string
  readonly provider: string
}

export interface Classification {
  readonly classification: MessageClassification
  readonly confidence: number
  readonly reason: string
}

export interface SearchScope {
  readonly spaceIds?: readonly SpaceId[]
  readonly fromDate?: Date
  readonly toDate?: Date
  readonly limit: number
}

export interface SearchResult {
  readonly thread: Thread
  readonly score: number
  readonly snippet: string
}

export type ActionKind =
  | 'archive'
  | 'snooze'
  | 'schedule-with'
  | 'mark-your-turn'
  | 'forward'
  | 'reply-draft'

export interface ActionContext {
  readonly thread: Thread
  readonly recentMessages: readonly Message[]
}

export interface SuggestedAction {
  readonly kind: ActionKind
  readonly label: string
  readonly reason: string
  readonly confidence: number
  readonly payload?: Record<string, unknown>
}

export interface AIFunctions {
  draft(context: DraftContext): Promise<DraftResult>
  summarize(thread: Thread, messages: readonly Message[]): Promise<Summary>
  classify(message: Message): Promise<Classification>
  search(query: string, scope: SearchScope): Promise<readonly SearchResult[]>
  embed(text: string): Promise<readonly number[]>
  suggest(context: ActionContext): Promise<readonly SuggestedAction[]>
}

export interface AIProvider extends AIFunctions {
  readonly name: 'anthropic' | 'openai' | 'ollama' | 'lmstudio' | 'none'
  readonly capabilities: {
    readonly streaming: boolean
    readonly tools: boolean
    readonly embeddings: boolean
    readonly vision: boolean
  }
}
