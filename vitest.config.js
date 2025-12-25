import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',

    alias: {
      '^bunchee$': '/src/index.ts', // Adjusted to use absolute paths
    },

    exclude: [
      '**/node_modules/**',
      '**/test/integration/**/src/**',
      '**/test/fixtures/**',
    ],
    // Test timeout
    testTimeout: 60 * 1000,
    hookTimeout: 30 * 1000,
  },
  resolve: {
    conditions: ['import', 'default'], // Prefer ES modules if available
  },
})
