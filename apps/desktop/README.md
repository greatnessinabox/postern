# @postern/desktop

The Tauri 2.9 desktop wrapper. It packages `@postern/web` (the Next.js app) as a native window for macOS, Windows, and Linux.

## Status

Not scaffolded yet. The Tauri shell needs the Rust toolchain to build, which is not present in the CI or current dev sandbox. The web app it wraps (`apps/web`) is built and verified. The Tauri layer is the next step on a Rust-equipped machine (Marquis's, which already runs Xcode for the macOS menubar companion).

## Setup (on a machine with Rust)

1. Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. Install the Tauri CLI in this package: `pnpm --filter @postern/desktop add -D @tauri-apps/cli@^2`
3. Initialize the Tauri scaffold here: `pnpm --filter @postern/desktop exec tauri init`
   - App name: Postern
   - Window title: Postern
   - Frontend dev server URL: `http://localhost:3000` (the `apps/web` dev server)
   - Frontend dist dir: the `apps/web` build output
   - Before-dev command: `pnpm --filter @postern/web dev`
   - Before-build command: `pnpm --filter @postern/web build`
4. Run: `pnpm --filter @postern/desktop exec tauri dev`

## Architecture notes

- The window content is the `apps/web` Next.js app. Keep the desktop layer thin: the UI lives in web, shared by all three shells.
- Per ADR-0002, only the sync loop and IMAP IDLE listener should move into Rust (`src-tauri/src/sync.rs`) later. Everything else stays in TypeScript so it is shared with web and mobile.
- `tauri-plugin-stronghold` holds secrets on desktop (the SecretResolver the IMAP adapter expects).
- The macOS menubar companion (`apps/macos-menubar`, native SwiftUI) is a separate binary that launches this app and shows unread counts. It is not part of the Tauri build.

## Why config is not committed yet

Committing a `tauri.conf.json` and `Cargo.toml` that cannot be compiled in this environment would ship unverified config. The scaffold lands when it can be built and run.
