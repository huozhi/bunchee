import { expect, test } from 'vitest'
import { createJob, getFileContents } from '../../testing-utils'
const { job, distDir } = createJob({
  directory: __dirname,
  args: ['--unbundle'],
})
test('condition graphs keep their own internal module suffix and env replacement', async () => {
  expect(job.code).toBe(0)
  const files = await getFileContents(distDir)
  for (const condition of [
    'development',
    'production',
    'react-server',
    'edge-light',
  ]) {
    expect(files[`index.${condition}.js`]).toContain(
      `'./utils/env.${condition}.js'`,
    )
    expect(files[`utils/env.${condition}.js`]).toBeDefined()
  }
  expect(files['index.js']).toContain("'./utils/env.js'")
  expect(files['utils/env.development.js']).toContain('"development"')
  expect(files['utils/env.production.js']).toContain('"production"')
  expect(files['utils/env.edge-light.js']).not.toContain('typeof EdgeRuntime')
})

test('nested conditions preserve the filename suffix order', async () => {
  const files = await getFileContents(distDir)
  expect(files['combined.development.react-server.js']).toContain(
    "'./utils/env.development.react-server.js'",
  )
  expect(files['utils/env.development.react-server.js']).toContain(
    '"development"',
  )
})

test('condition-specific declarations get the same suffixes and JS import extensions', async () => {
  const files = await getFileContents(distDir)
  for (const condition of [
    'development',
    'production',
    'react-server',
    'edge-light',
  ]) {
    expect(files[`index.${condition}.d.ts`]).toContain(
      `'./utils/env.${condition}.js'`,
    )
    expect(files[`utils/env.${condition}.d.ts`]).toBeDefined()
  }
  expect(files['combined.development.react-server.d.ts']).toContain(
    "'./utils/env.development.react-server.js'",
  )
})
