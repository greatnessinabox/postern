# @postern/desktop

The Tauri 2 desktop wrapper. It packages `@postern/web` (the Next.js app) as a native window for macOS, Windows, and Linux.

## Scaffolded

`src-tauri/` holds the Tauri project: `Cargo.toml`, `tauri.conf.json`, `src/`, `build.rs`, icons, capabilities. Identifier `so.postern.desktop`. The window is 1280x832, titled Postern. The Rust side compiles (verified with `cargo build`).

## Run it

Needs the Rust toolchain (`rustup`) and, on macOS, Xcode for the system WebView.

```bash
# dev: launches the web dev server and the native window
pnpm --filter @postern/desktop tauri:dev

# release bundle (see the export note below first)
pnpm --filter @postern/desktop tauri:build
```

`tauri:dev` is wired to start `pnpm --filter @postern/web dev` and load `http://localhost:3000`, so dev works today.

## One decision before production bundling

`tauri.conf.json` sets `frontendDist` to `../../web/out`, a static export. The web app does not set `output: 'export'` yet, so `tauri:build` will not find `out/` until it does. This is a real call: a static export makes the desktop app self-contained (local-first, client-rendered, no Node server), which fits Postern, but it constrains the web deployment to static too. Decide before the first release build. `tauri:dev` is unaffected (it uses the dev URL).

## Architecture notes

- The window content is the `apps/web` Next.js app. Keep the desktop layer thin; the UI lives in web, shared by all three shells.
- Per ADR-0002, only the sync loop and IMAP IDLE listener should move into Rust (`src-tauri/src/`) later. Everything else stays in TypeScript, shared with web and mobile.
- `tauri-plugin-stronghold` will hold secrets on desktop (the CredentialResolver the IMAP adapter expects).
- The macOS menubar companion (`apps/macos-menubar`, native SwiftUI) is a separate binary that launches this app and shows unread counts. Not part of the Tauri build.

## Not committed

`src-tauri/target/` (build output) and `src-tauri/gen/schemas` are gitignored. `Cargo.lock` is committed for reproducible builds.
