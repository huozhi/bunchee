import fs from 'fs'
import { createCliTest } from 'testing-utils'

describe('cli', () => {
  it(`cli env-var should work properly`, async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: ['index.js', '--env', 'MY_TEST_ENV', '-o', 'dist/index.js'],
        options: {
          env: {
            MY_TEST_ENV: 'my-test-value',
          },
        },
      },
      ({ code, distFile }) => {
        const content = fs.readFileSync(distFile, { encoding: 'utf-8' })
        expect(content.includes('my-test-value')).toBe(true)
        expect(code).toBe(0)
      },
    )
  })
})
