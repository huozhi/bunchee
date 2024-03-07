import { createIntegrationTest } from '../utils'

describe('integration multi-entries', () => {
  it('should contain files', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({}) => {},
    )
  })
})
