/**
 * Anthropic provider. Implements the AI Function interface against Claude.
 *
 * Triage (classification refinement) is the v0.1 feature: Haiku, with the
 * category rubric cached as a stable system prompt so repeated batches are
 * cheap. The other functions (draft, summarize, search, embed, suggest)
 * are declared by the interface and land in later phases; they reject
 * clearly for now rather than pretend.
 *
 * Model defaults to claude-haiku-4-5: triage is high-volume per-message
 * classification, which is what Haiku is for, and Postern is BYO-key so
 * cost per message matters. Postern's plan specifies Haiku for triage.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Message, Thread } from '@postern/core'
import type {
  ActionContext,
  AIProvider,
  Classification,
  DraftContext,
  DraftResult,
  SearchResult,
  SearchScope,
  SuggestedAction,
  Summary,
} from './index.ts'
import {
  buildTriageUserPrompt,
  parseTriageResponse,
  TRIAGE_SYSTEM,
  type TriageInput,
  type TriageResult,
} from './triage.ts'

const DEFAULT_MODEL = 'claude-haiku-4-5'

export interface AnthropicProviderOptions {
  readonly apiKey: string
  readonly model?: string
}

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic'
  readonly capabilities = {
    streaming: true,
    tools: true,
    embeddings: false,
    vision: true,
  }
  readonly #client: Anthropic
  readonly #model: string

  constructor(options: AnthropicProviderOptions) {
    this.#client = new Anthropic({ apiKey: options.apiKey })
    this.#model = options.model ?? DEFAULT_MODEL
  }

  /** Refine a batch of ambiguous classifications. The system rubric caches. */
  async triage(inputs: readonly TriageInput[]): Promise<TriageResult[]> {
    if (inputs.length === 0) return []
    const response = await this.#client.messages.create({
      model: this.#model,
      max_tokens: 2048,
      system: [{ type: 'text', text: TRIAGE_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildTriageUserPrompt(inputs) }],
    })
    let text = ''
    for (const block of response.content) {
      if (block.type === 'text') text += block.text
    }
    return parseTriageResponse(text)
  }

  async classify(message: Message): Promise<Classification> {
    const results = await this.triage([
      {
        fromName: '',
        fromAddress: '',
        subject: message.subject,
        snippet: message.snippet,
        heuristicCategory: message.classification,
      },
    ])
    const result = results[0]
    if (result === undefined) {
      return { classification: message.classification, confidence: 0, reason: 'no result' }
    }
    return {
      classification: result.category,
      confidence: result.confidence,
      reason: result.reason,
    }
  }

  draft(_context: DraftContext): Promise<DraftResult> {
    return Promise.reject(new Error('draft is not implemented in the Anthropic provider yet'))
  }

  summarize(_thread: Thread, _messages: readonly Message[]): Promise<Summary> {
    return Promise.reject(new Error('summarize is not implemented in the Anthropic provider yet'))
  }

  search(_query: string, _scope: SearchScope): Promise<readonly SearchResult[]> {
    return Promise.reject(new Error('semantic search runs on client-side embeddings, not here'))
  }

  embed(_text: string): Promise<readonly number[]> {
    return Promise.reject(
      new Error('embeddings use a dedicated provider, not the Anthropic chat API'),
    )
  }

  suggest(_context: ActionContext): Promise<readonly SuggestedAction[]> {
    return Promise.reject(new Error('suggest is not implemented in the Anthropic provider yet'))
  }
}
