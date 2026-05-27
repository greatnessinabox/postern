# ADR-0002: Tauri 2.9 for the desktop shell

## Status

Accepted

## Context

Postern needs a desktop shell that wraps the Next.js application on macOS, Windows, and Linux. The two viable options are Electron and Tauri.

Electron ships Chromium and Node.js inside every binary. Installed size lands around 150 to 200 MB before any application code. Memory footprint is high. The security model is "trust the renderer with Node," patched over with context isolation and IPC bridges. The ecosystem is large and battle-tested.

Tauri 2.9 uses the host operating system's webview (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux). Installed size lands around 10 to 20 MB. The backend is Rust, the IPC bridge is explicit, and the security model defaults to denying filesystem and network access until the application opts in.

Postern is a long-lived correspondence client. Binary size, memory footprint, and a sober security default matter more than ecosystem maturity.

## Decision

The desktop shell uses Tauri 2.9. The Tauri project lives at `apps/desktop`. The Next.js build from `apps/web` is the inner content. Native platform integration (keychain access, system notifications, OS-level URL handlers) goes through Tauri commands written in Rust.

Tauri ships on macOS, Windows, and Linux from the same codebase. The macOS menubar companion at `apps/macos-menubar` is a separate SwiftUI application, not a Tauri target. The menubar app exists because the desktop shell is a webview, and a webview cannot carry an NSStatusItem, drive Spotlight indexing, or schedule a system notification with the same fidelity as native AppKit. The two ship together on macOS and communicate through a documented IPC contract.

## Consequences

Binaries stay small. Builds are faster than Electron. The security default flips from "renderer has Node" to "renderer has nothing until you allowlist it."

Webview parity is now a real concern. WebKit on macOS, WebView2 on Windows, and WebKitGTK on Linux are three different rendering engines with three different sets of CSS bugs and three different JavaScript engine quirks. Postern accepts the cost of testing all three. The cost is paid in cross-platform testing rather than in binary size.

The macOS native companion is a second codebase in a second language. This is the trade. A Tauri-only build would skip the SwiftUI app and lose the native menubar, the native notifications, and the Spotlight indexing. Those features are worth the second codebase.

If the WebView2 or WebKitGTK situation gets worse (Microsoft sunsets WebView2, a major WebKitGTK regression lands), the escape hatch is Electron on the affected platform. The web build inside the Tauri shell is portable to any web-host. The migration is one app target, not the whole stack.

## References

- https://tauri.app
- https://v2.tauri.app/
- The bundle-size and footprint numbers come from Tauri's published benchmarks against Electron, verified against the TopBlob SwiftUI codebase for the macOS baseline.
