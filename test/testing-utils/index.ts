import { glob } from 'glob'

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, '/')
}
export * from './helpers'

export { runCli } from './cli'
export { createJob } from './integration'

export async function getFileNamesFromDirectory(directory: string) {
  const files = await glob(['**/*.{,c,m}js', '**/*.{,c,m}d.ts'], {
    cwd: directory,
  })

  return files.sort().map((file) => normalizePath(file))
}

export const isWindows = process.platform === 'win32'
