/**
 * Daemon entry point. Starts the loopback HTTP service on PORT (default 8787).
 * Tauri spawns this as a sidecar; in dev it runs via `pnpm --filter
 * @postern/daemon dev`.
 */

import { startServer } from './server.ts'

const port = Number(process.env['POSTERN_DAEMON_PORT'] ?? '8787')
startServer(port)
