import { expect, test } from 'vitest'
import { runCli } from '../../testing-utils'

test('cli - output-in-watch', async () => {
  const { stdout, signal } = await runCli({
    directory: __dirname,
    args: ['hello.js', '-w', '-o', 'dist/hello.bundle.js'],
    abortTimeout: 3000,
  })
  expect(stdout).toMatchInlineSnapshot(`
    "Watching changes in the project directory...
    "
  `)
  expect(signal).toBe('SIGTERM') // SIGTERM exit code
})
