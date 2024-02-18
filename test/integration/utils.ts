import type { ExcuteBuncheeResult } from '../testing-utils'
import { createTest, executeBunchee } from '../testing-utils'

export * from '../testing-utils'
export async function createIntegrationTest(
  {
    args,
    options,
    abortTimeout,
    filesToRemove,
    directory,
  }: {
    args?: string[]
    options?: { env?: NodeJS.ProcessEnv }
    abortTimeout?: number
    filesToRemove?: string[]
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
      filesToRemove,
      run: executeBunchee,
    },
    testFn,
  )
}
