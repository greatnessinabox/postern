/**
 * Live AI triage against the real inbox snapshot. Opt-in: RUN_AI_TEST=1
 * pnpm test:integration (reads the Anthropic key from the macOS keychain:
 * service anthropic-api-key, account postern).
 *
 * Takes every message the heuristics routed to Threads (category personal)
 * across all Spaces and asks Haiku to re-judge. Prints which ones the AI
 * pulls out of the home surface, the cleanup the heuristics couldn't do.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AnthropicProvider, type TriageInput } from '../index.ts'

const ENABLED = process.env['RUN_AI_TEST'] === '1'

function apiKey(): string {
  const env = process.env['ANTHROPIC_API_KEY']
  if (env !== undefined && env.length > 0) return env
  return execFileSync(
    'security',
    ['find-generic-password', '-w', '-s', 'anthropic-api-key', '-a', 'postern'],
    { encoding: 'utf8' },
  ).trim()
}

interface Card {
  subject: string
  fromName: string
  fromAddress: string
  category: string
}
interface Space {
  name: string
  surfaces: Record<string, { items: Card[] }>
}
interface Snapshot {
  spaces: Space[]
}

const snapshotPath = fileURLToPath(
  new URL('../../../../apps/web/app/canvas/snapshot.json', import.meta.url),
)

describe.skipIf(!ENABLED)('live triage', () => {
  it('re-judges the Threads tail with Haiku', async () => {
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as Snapshot
    const cards: Array<Card & { space: string }> = []
    for (const space of snapshot.spaces) {
      const threads = space.surfaces['threads']
      if (threads === undefined) continue
      for (const card of threads.items) cards.push({ ...card, space: space.name })
    }

    const inputs: TriageInput[] = cards.map((c) => ({
      fromName: c.fromName,
      fromAddress: c.fromAddress,
      subject: c.subject,
      snippet: '',
      heuristicCategory: 'personal',
    }))

    const provider = new AnthropicProvider({ apiKey: apiKey() })
    const results = await provider.triage(inputs)
    const byIndex = new Map(results.map((r) => [r.index, r]))

    let rerouted = 0
    let kept = 0
    console.log(`\nTriaging ${cards.length} Threads messages with Haiku:\n`)
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]
      const r = byIndex.get(i)
      if (c === undefined || r === undefined) continue
      if (r.category === 'personal') {
        kept += 1
        console.log(`  KEEP   [${c.space}] ${c.subject.slice(0, 50)} — ${c.fromAddress}`)
      } else {
        rerouted += 1
        console.log(
          `  -> ${r.category.toUpperCase().padEnd(13)} [${c.space}] ${c.subject.slice(0, 46)} — ${c.fromAddress}  (${r.reason})`,
        )
      }
    }
    console.log(
      `\nHaiku kept ${kept} as personal, re-routed ${rerouted} out of Threads (${cards.length} total).`,
    )
    expect(results.length).toBeGreaterThan(0)
  }, 120_000)
})
