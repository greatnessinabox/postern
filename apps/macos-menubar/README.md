# @postern/macos-menubar

This is a Swift project. It lives in the monorepo but sits outside the pnpm workspace.

No `package.json` here on purpose. The pnpm-workspace.yaml glob picks up `apps/*`, so adding one would pull Swift sources into a JavaScript dependency graph that does not understand them.

Build and run via Xcode or `swift build` from this directory once sources land.
