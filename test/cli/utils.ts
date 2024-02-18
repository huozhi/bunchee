import {
  createTest,
  executeBunchee,
  type ExcuteBuncheeResult,
} from '../testing-utils'

export async function createCliTest(
  {
    args,
    options,
    abortTimeout,
    directory,
  }: {
    args?: string[]
    options?: { env?: NodeJS.ProcessEnv }
    abortTimeout?: number
    directory: string
  },
  testFn: Parameters<typeof createTest<ExcuteBuncheeResult>>[1],
): Promise<void> {
  await createTest<ExcuteBuncheeResult>(
    {
      directory,
      args: args ?? [],
      options: options ?? {},
      abortTimeout,
      run: executeBunchee,
    },
    testFn,
  )
}
