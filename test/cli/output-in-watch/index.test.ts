import { createJob } from '../../testing-utils'

describe('cli - output-in-watch', () => {
  const { job } = createJob({
    directory: __dirname,
    args: ['hello.js', '-w', '-o', 'dist/hello.bundle.js'],
    abortTimeout: 3000,
  })
  it(`cli output-in-watch should work properly`, async () => {
    const { signal, stdout } = job

    expect(stdout).toMatchInlineSnapshot(`
      "Watching changes in the project directory...
      "
    `)
    expect(signal).toBe('SIGTERM') // SIGTERM exit code
  })
})
