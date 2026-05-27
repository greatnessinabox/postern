# Contributing to Postern

Postern is open source, but the contribution model changes across phases. The short version is below. The long version is the rest of this file.

## The short version

Through Phase 2, Postern is a solo build. Issues are open as discussions only. Pull requests are not accepted.

From Phase 3 onward, issues and pull requests are open. The four required reading documents stay the same.

Required reading before any non-trivial contribution:

- `docs/VOICE.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `CLA.md`

## Why the gate

The product opinions in `docs/PRINCIPLES.md` are the product. A pull request that violates one of the seven rule-breaks gets rejected, regardless of how clean the code is. The principles get amended only by amending the document first, in a pull request that argues the change on its own.

The voice in `docs/VOICE.md` is the same gate, applied to anything that ships text: README content, error strings, UI copy, ADRs, commit messages, this file.

## Where to file things

- **Bug reports:** GitHub Issues, using the bug template.
- **Feature requests:** GitHub Issues, using the feature template. The template asks which rule-break the request fits under. "Introduces a new rule-break" is a valid answer, it just requires more discussion.
- **Questions:** GitHub Issues, using the question template, or GitHub Discussions for open-ended threads.
- **Security reports:** Email `security@postern.so`. Do not file a public issue for a security vulnerability.

## How to propose a change

1. Open an issue first if the change is more than a small fix. The issue is where the design conversation happens.
2. For accepted issues, fork the repo and open a pull request against `main`.
3. The pull request template has a short checklist. Tick it honestly.
4. Sign the CLA in `CLA.md` on first contribution.

Small fixes (a typo, an obvious bug under five lines) can skip the issue step.

## Code review

Every pull request runs through the five-question review from `docs/PRINCIPLES.md`:

1. Does this PR violate any of the seven rule-breaks?
2. Which of the eight canonical primitives does this PR touch, and does it preserve their shape?
3. Does any code in `apps/*` or `packages/ui` import directly from `packages/protocol`, `packages/ai`, or `packages/storage`?
4. Is any AI feature missing a non-AI fallback?
5. Is any brand asset loaded from a third-party CDN?

If any answer is dirty, the principle is the breaking change, not the implementation.

## Commit style

Conventional commits. The commitlint hook enforces it. A typical commit looks like:

```
feat(core): add Handle merge function
fix(protocol): handle CRLF in IMAP literal responses
docs(adr): record the Tauri decision
```

The trailing line on a commit message is the description. No `Co-Authored-By` trailers unless the change has a real human co-author.

## Running the toolchain

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

Node 22, pnpm 10. The repo refuses npm and yarn through the `packageManager` field in `package.json` and the engines block.

## License

Postern is AGPL-3.0. The CLA in `CLA.md` grants Marquis Nobles (or the future Postern entity) the right to relicense contributions, so that a future managed-hosted Postern Cloud is possible without re-asking every contributor for permission. The repo and self-hosted builds stay AGPL.
