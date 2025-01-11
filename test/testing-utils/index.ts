import { glob } from 'glob'
import {
  createSyncTest,
  createTest,
  executeBunchee,
  type ExcuteBuncheeResult,
} from './shared'

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, '/')
}
export * from './helpers'

type IntegrationTestOptions = {
  args?: string[]
  options?: { env?: NodeJS.ProcessEnv }
  abortTimeout?: number
  directory: string
}

export { createCliTest } from './cli'

/**
 * @deprecated
 * Use createJob instead
 */
export async function createIntegrationTest(
  { args, options, abortTimeout, directory }: IntegrationTestOptions,
  testFn?: Parameters<typeof createTest<ExcuteBuncheeResult>>[1],
) {
  return await createTest<ExcuteBuncheeResult>(
    {
      args: args ?? [],
      options: options ?? {},
      abortTimeout,
      directory,
      run: executeBunchee,
    },
    testFn,
  )
}

/** Sync testing helper */
export function createJob({
  args,
  options,
  abortTimeout,
  directory,
}: IntegrationTestOptions) {
  return createSyncTest<ExcuteBuncheeResult>({
    args: args ?? [],
    options: options ?? {},
    abortTimeout,
    directory,
    run: executeBunchee,
  })
}

export function createIntegration(
  integrationTestOptions: IntegrationTestOptions,
  testFn?: Parameters<typeof createTest<ExcuteBuncheeResult>>[1],
): {
  code: number | null
  stdout: string
  stderr: string
  dir: string
  distDir: string
  distFile: string
} {
  let result: any
  beforeAll(async () => {
    result = await createIntegrationTest(integrationTestOptions, testFn)
  })

  const proxy = new Proxy(
    {},
    {
      get(_, key) {
        return result?.[key] ?? null
      },
    },
  ) as any

  return {
    get code() {
      return proxy.code ?? null
    },
    get stdout() {
      return proxy.stdout ?? ''
    },
    get stderr() {
      return proxy.stderr ?? ''
    },
    get dir() {
      return integrationTestOptions.directory
    },
    get distDir() {
      console.log('distDir', proxy.distDir, result)
      return proxy.distDir ?? ''
    },
    get distFile() {
      return proxy.distFile ?? null
    },
  }
}

export async function getFileNamesFromDirectory(directory: string) {
  const files = await glob(['**/*.{,c,m}js', '**/*.{,c,m}d.ts'], {
    cwd: directory,
  })

  return files.sort().map((file) => normalizePath(file))
}

export const isWindows = process.platform === 'win32'
