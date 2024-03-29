import { readFileSync, promises as fsp } from 'fs'
import { assertFilesContent, createIntegrationTest } from '../utils'
import path from 'path'

describe('integration shared-module', () => {
  it('should split shared module into one chunk layer', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const files = await fsp.readdir(distDir)
        const sharedUtilModuleFiles = files.filter((file) =>
          file.startsWith('util'),
        )
        const entryModuleFiles = files.filter(
          (file) => !file.includes('shared-'),
        )
        const appContextSharedFiles = files.filter(
          (file) =>
            file.startsWith('app-context-shared-') &&
            readFileSync(path.join(distDir, file), 'utf-8').includes(
              'use client',
            ),
        )

        expect(sharedUtilModuleFiles).toHaveLength(2)
        expect(entryModuleFiles).toHaveLength(5)

        const indexFileMatcher = (content: string) => {
          return (
            !content.includes('common:shared') && content.includes('sharedApi')
          )
        }

        const anotherFileMatcher = (content: string) => {
          return (
            !content.includes('common:shared') &&
            content.includes('anotherSharedApi')
          )
        }

        const appContextSharedFileMatcher = (content: string) => {
          return (
            content.includes('use client') && content.includes('createContext')
          )
        }

        await assertFilesContent(distDir, {
          [sharedUtilModuleFiles[0]]: /'common:shared'/,
          [sharedUtilModuleFiles[1]]: /'common:shared'/,
          ['index.js']: indexFileMatcher,
          ['index.cjs']: indexFileMatcher,
          ['another.js']: anotherFileMatcher,
          ['another.cjs']: anotherFileMatcher,
          [appContextSharedFiles[0]]: appContextSharedFileMatcher,
          [appContextSharedFiles[1]]: appContextSharedFileMatcher,
        })
      },
    )
  })
})
