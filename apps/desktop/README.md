# @postern/desktop

The Tauri 2 desktop shell. It packages two things into one app: the web UI
(`@postern/web`) in the window, and the backend service (`@postern/daemon`)
as a sidecar.

## Why a sidecar

The protocol, storage, and AI layers are TypeScript (Node). Tauri's shell is
Rust. Rather than rewrite the backend in Rust, the desktop app runs the TS
backend as a local loopback HTTP service (`@postern/daemon`) and the webview
talks to it over `http://127.0.0.1`. The UI never imports the protocol layer;
it fetches the daemon. This is the standard Tauri pattern for a TS backend.

```
  Tauri window (Rust shell)
  ├── webview  ->  @postern/web   (UI, imports only @postern/core)
  │                   │  fetch http://127.0.0.1:8787
  └── sidecar  ->  @postern/daemon (protocol + storage + ai + keychain)
```

## Run it (dev)

Two processes today (the Rust shell does not spawn the daemon in dev yet):

```bash
# 1. the backend service (builds the bundle, runs on :8787)
pnpm --filter @postern/daemon dev

# 2. the desktop window (starts the Next dev server + the Tauri window)
pnpm --filter @postern/desktop tauri:dev
```

The web UI prefers the daemon and falls back to the static snapshot if it is
not reachable, so the window renders either way. Needs the Rust toolchain
(`rustup`) and, on macOS, Xcode for the system WebView. `cargo build` of
`src-tauri` is verified.

## What is left for production bundling

1. **Daemon as a self-contained binary.** A Tauri sidecar is a real
   executable, not `node dist/daemon.cjs`. Compile the daemon bundle into a
   single binary (Node SEA or `bun build --compile`), name it with the target
   triple, and list it in `tauri.conf.json` `bundle.externalBin`.
2. **Spawn it from Rust on startup.** The shell launches the sidecar with a
   generated `POSTERN_DAEMON_TOKEN` and passes the same token to the webview
   (so only this app can call the loopback API). Use the Tauri shell/process
   plugin.
3. **Static frontend.** Set `output: 'export'` on `@postern/web` so
   `frontendDist` (`../../web/out`) has static files for the bundle. The
   daemon, not a Next server, provides the data, so a static export is the
   right shape. `tauri:dev` is unaffected (it uses the dev URL).

## Architecture notes

- Keep the desktop layer thin. The UI lives in web, the logic in the daemon,
  shared across all three shells (web, desktop, mobile).
- Per ADR-0002, only the sync loop and IMAP IDLE listener should move into
  Rust later. Everything else stays in TypeScript.
- `tauri-plugin-stronghold` replaces the macOS-keychain credential access in
  the daemon (`apps/daemon/src/accounts.ts`) on desktop.
- The macOS menubar companion (`apps/macos-menubar`, native SwiftUI) is a
  separate binary that launches this app; not part of the Tauri build.

## Not committed

`src-tauri/target/`, `src-tauri/gen/schemas`, and the daemon's `dist/` are
gitignored. `Cargo.lock` is committed.
