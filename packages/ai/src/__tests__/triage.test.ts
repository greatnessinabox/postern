import { describe, expect, it } from 'vitest'
import {
  buildTriageUserPrompt,
  parseTriageResponse,
  TRIAGE_SYSTEM,
  type TriageInput,
} from '../index.ts'

const input: TriageInput = {
  fromName: 'Walmart.com',
  fromAddress: 'help@walmart.com',
  subject: 'Your package should arrive by 5:01pm',
  snippet: 'Track your order.',
  heuristicCategory: 'personal',
}

describe('buildTriageUserPrompt', () => {
  it('renders each message with from, subject, preview, and heuristic guess', () => {
    const prompt = buildTriageUserPrompt([input])
    expect(prompt).toContain('Classify these 1 message')
    expect(prompt).toContain('Walmart.com <help@walmart.com>')
    expect(prompt).toContain('Your package should arrive')
    expect(prompt).toContain('Heuristic guess: personal')
  })

  it('collapses whitespace and bounds long fields', () => {
    const prompt = buildTriageUserPrompt([
      { ...input, subject: `a${' '.repeat(50)}b`, snippet: 'x'.repeat(300) },
    ])
    expect(prompt).toContain('a b')
    expect(prompt).not.toContain('x'.repeat(200))
  })
})

describe('TRIAGE_SYSTEM', () => {
  it('is stable (cacheable) and names the strict-personal rule', () => {
    expect(TRIAGE_SYSTEM).toContain('Be strict about personal')
    expect(TRIAGE_SYSTEM).toContain('Walmart')
    expect(TRIAGE_SYSTEM).toContain('JSON array')
  })
})

describe('parseTriageResponse', () => {
  it('parses a clean JSON array', () => {
    const r = parseTriageResponse(
      '[{"index":0,"category":"transactional","confidence":0.95,"reason":"delivery notice"}]',
    )
    expect(r).toEqual([
      { index: 0, category: 'transactional', confidence: 0.95, reason: 'delivery notice' },
    ])
  })

  it('tolerates surrounding prose and code fences', () => {
    const r = parseTriageResponse(
      'Here you go:\n```json\n[{"index":0,"category":"promotional","confidence":0.8,"reason":"deal"}]\n```',
    )
    expect(r).toHaveLength(1)
    expect(r[0]?.category).toBe('promotional')
  })

  it('drops entries with an invalid category', () => {
    const r = parseTriageResponse(
      '[{"index":0,"category":"spam","confidence":1,"reason":"x"},{"index":1,"category":"personal","confidence":0.9,"reason":"real human"}]',
    )
    expect(r).toEqual([{ index: 1, category: 'personal', confidence: 0.9, reason: 'real human' }])
  })

  it('defaults confidence and reason when missing', () => {
    const r = parseTriageResponse('[{"index":2,"category":"newsletter"}]')
    expect(r[0]).toEqual({ index: 2, category: 'newsletter', confidence: 0.5, reason: '' })
  })

  it('returns empty on non-JSON or no array', () => {
    expect(parseTriageResponse('no json here')).toEqual([])
    expect(parseTriageResponse('{"not":"an array"}')).toEqual([])
    expect(parseTriageResponse('[broken')).toEqual([])
  })

  it('ignores a stray closing bracket in trailing prose', () => {
    const r = parseTriageResponse(
      '[{"index":0,"category":"job","confidence":0.7,"reason":"alert"}]\n\nNote: see item [2] above.',
    )
    expect(r).toEqual([{ index: 0, category: 'job', confidence: 0.7, reason: 'alert' }])
  })

  it('handles a bracket inside a reason string', () => {
    const r = parseTriageResponse(
      '[{"index":0,"category":"personal","confidence":1,"reason":"a [b] c"}]',
    )
    expect(r[0]?.reason).toBe('a [b] c')
  })
})
