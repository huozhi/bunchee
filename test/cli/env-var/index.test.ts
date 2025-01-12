import fs from 'fs'
import { runCli } from '../../testing-utils'

test(`cli env-var should work properly`, async () => {
  const { code, distFile } = await runCli({
    directory: __dirname,
    args: ['index.js', '--env', 'MY_TEST_ENV', '-o', 'dist/index.js'],
    options: {
      env: {
        MY_TEST_ENV: 'my-test-value',
      },
    },
  })
  const content = fs.readFileSync(distFile, { encoding: 'utf-8' })
  expect(content.includes('my-test-value')).toBe(true)
  expect(code).toBe(0)
})
