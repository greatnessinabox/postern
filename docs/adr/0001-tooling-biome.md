# ADR-0001: Biome replaces ESLint and Prettier

## Status

Accepted

## Context

Postern needs a linter and a formatter. The default JavaScript toolchain ships ESLint plus Prettier, two tools with overlapping responsibilities, conflicting config files, and a long history of plugin sprawl. Setting them up in a new monorepo means picking a Prettier config, an ESLint config preset, the right TypeScript ESLint plugin set, a Tailwind class-order plugin, and the integration glue that keeps them from fighting each other.

A monorepo with eight packages and four apps multiplies the surface area. Each package wants its own lint config, each app has framework-specific rules, and the install graph grows accordingly.

Biome is a single Rust binary that lints and formats JavaScript, TypeScript, and JSON. It ships as one tool with one config file. It is roughly an order of magnitude faster than the ESLint plus Prettier pair on the codebases that have measured it.

## Decision

Biome 2.x replaces ESLint and Prettier across the repo. The config lives in `biome.json` at the repo root. The package `@postern/eslint-config` keeps its name for legacy reasons but exports Biome configuration, not ESLint configuration.

The `lint` script in the root package.json runs `biome check`. The `format` script runs `biome format --write`.

## Consequences

Setup is one devDependency and one config file. Lint and format run in the same pass. CI is faster.

The plugin ecosystem is smaller. A handful of ESLint rules do not have a Biome equivalent yet, and a few framework-specific rule sets (the React Hooks plugin, the Tailwind class-order plugin) are still ESLint-only as of Biome 2.x. Postern accepts this gap. The rules that matter most for correctness are present in Biome. The class-order rule is replaced by the convention "match the order in the Tailwind docs" enforced in review.

Switching back to ESLint plus Prettier later is a config rewrite, not a code rewrite. Biome and Prettier produce nearly identical output, and the lint surface in `biome.json` maps cleanly to ESLint flat config. The escape hatch exists if Biome stalls.

## References

- https://biomejs.dev
- The decision to bundle lint and format in one tool follows the lead taken by Deno's `deno fmt` and `deno lint`.
