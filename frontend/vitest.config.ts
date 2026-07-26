import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, './src') } },
  test: { setupFiles: ['./tests/setup.ts'], fileParallelism: false, clearMocks: true }
})
