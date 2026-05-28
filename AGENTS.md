# Agent Guide

Postern is built in the open with AI agents (Claude Code, Copilot, Cursor,
Cline, Aider). This file is the entry point for any agent working in the
repo. It follows the AGENTS.md convention, so most tools read it
automatically.

## Read these first

- `docs/PRINCIPLES.md` — the seven rule-breaks. Every change is measured
  against them. If a change violates a rule-break, it is wrong.
- `docs/ARCHITECTURE.md` — the eight canonical primitives, the layer
  boundaries, the adapter contracts.
- `docs/VOICE.md` — how Postern writes. Applies to code comments, commits,
  PR descriptions, docs, and product copy.

## The eight canonical primitives

Account, Handle, Space, Thread, Message, Part, Boost, Command. They live in
`packages/core/src/types/`. Anything that does not fit one of these eight
should make you pause and ask.

## Hard architectural rules

- The UI never imports from `packages/protocol`, `packages/ai`, or
  `packages/storage`. Everything flows through `packages/core`.
- Postern's internal model is not JMAP. Protocols are adapters that
  translate into the core primitives.
- AI is a Function interface (`draft`, `summarize`, `classify`, `search`,
  `embed`, `suggest`) with swappable providers. Every AI feature has a
  non-AI fallback. Postern is never AI-required.
- Brand assets are self-hosted. No third-party CDN for fonts or icons.

## Commands

```bash
pnpm install         # bootstrap (Node 22, pnpm 10)
pnpm dev             # run dev servers
pnpm typecheck       # tsc --noEmit across packages
pnpm lint            # Biome check
pnpm test            # Vitest
make check           # lint + typecheck + test
```

## Working style

- Stacked, single-concern commits. Conventional commit messages
  (commitlint enforces this).
- Match `docs/VOICE.md`. No em dashes for parenthetical breaks. No AI
  vocabulary. No correlative constructions ("X, not Y"). Direct and dry.
- Do not add a Co-Authored-By trailer to commits.
- Run `pnpm typecheck && pnpm lint && pnpm test` before opening a PR.
- Check the PR against `docs/PRINCIPLES.md` and the checklist in
  `.github/pull_request_template.md`.
