import { defineConfig } from 'vitest/config'

// Integration tests only. They need a real server (see docker-compose.test.yml).
// Run with `pnpm test:integration` after `docker compose -f docker-compose.test.yml up -d`.
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['**/*.integration.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.turbo/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
