import {
  createTest,
  executeBunchee,
  type ExcuteBuncheeResult,
} from '../testing-utils'

export * from '../testing-utils'

type IntegrationTestOptions = {
  args?: string[]
  options?: { env?: NodeJS.ProcessEnv }
  abortTimeout?: number
  directory: string
}

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
