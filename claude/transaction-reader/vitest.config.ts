import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Node-style unit tests by default (parsing, merge, file I/O). Component
    // tests under src/renderer opt into jsdom via the glob below.
    environment: 'node',
    environmentMatchGlobs: [['src/renderer/**', 'jsdom']],
    setupFiles: ['src/test-setup.ts'],
  },
})
