import { createCliTest } from '../utils'

describe('cli', () => {
  it(`cli output-in-watch should work properly`, async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: ['hello.js', '-w', '-o', 'dist/hello.bundle.js'],
        abortTimeout: 3000,
      },
      ({ signal, stdout, stderr }) => {
        console.log('stdout', stdout, stderr)
        expect(stdout.includes('Watching project')).toBe(true)
        expect(stderr.includes('Building')).toBe(true)
        expect(stdout.includes('Exports')).toBe(false)
        expect(signal).toBe('SIGTERM') // SIGTERM exit code
        // const watchOutputRegex = /Built in \d+(.\d{2})ms/
        // expect(watchOutputRegex.test(stdout)).toBe(true)
      },
    )
  })
})
