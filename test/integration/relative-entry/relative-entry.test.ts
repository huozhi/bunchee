import fsp from 'fs/promises'
import { assertFilesContent, createIntegrationTest } from '../utils'

describe('integration relative-entry', () => {
  it('should generate proper assets for each exports', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const indexContent = await fsp.readFile(`${distDir}/index.js`, 'utf-8')
        expect(indexContent).toMatchSnapshot()
        // await assertFilesContent(distDir, {
        //   'index.js': `from './relative.js'`,
        // })
      },
    )
  })
})
