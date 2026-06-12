import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    hmr: {
      port: Number(process.env.HMR_PORT || 24678),
    },
    watch: {
      ignored: ['**/_hdv/**', '**/workspace/**', '**/tests/fixtures/workspace/**'],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'],
  },
})
