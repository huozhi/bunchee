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

test('a condition graph made only of a subpath entry shares the build-wide source root', async () => {
  const files = await getFileContents(distDir)
  // Only `./client` has a react-server file, yet its shared module still
  // lands under utils/ rather than being rejected as outside the root.
  expect(files['client/index.react-server.js']).toContain(
    "'../utils/env.react-server.js'",
  )
  expect(files['client/index.js']).toContain("'../utils/env.js'")
})

test('declarations are emitted once per format, not per runtime condition', async () => {
  // TypeScript does not resolve types through react-server, development or
  // edge-light, so condition-specific declarations would never be read.
  const files = await getFileContents(distDir)
  expect(files['index.d.ts']).toContain("'./utils/env.js'")
  expect(files['utils/env.d.ts']).toContain('mode')
  expect(
    Object.keys(files).filter((file) =>
      /\.(?:development|production|react-server|edge-light)\.d\.ts$/.test(file),
    ),
  ).toEqual([])
})
