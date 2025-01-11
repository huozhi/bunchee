import { createIntegrationTest, existsFile } from '../../testing-utils'

describe('integration js-only', () => {
  beforeEach(() => {
    // Mock the 'typescript' module to throw an error on import
    jest.mock('typescript', () => {
      throw new Error('typescript module should not be imported')
    })
  })

  afterEach(() => {
    // Restore the original module after each test
    jest.resetModules() // Reset the module registry to ensure clean state
    jest.clearAllMocks() // Clear mocks after each test
  })
  it('should work with js only project', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFile = `${distDir}/index.js`
        expect(await existsFile(distFile)).toBe(true)
      },
    )
  })
})
