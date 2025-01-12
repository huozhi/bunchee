import { createTest, executeBunchee, type ExcuteBuncheeResult } from './shared'

export async function createCliJob({
  args,
  options,
  abortTimeout,
  directory,
}: {
  args?: string[]
  options?: { env?: NodeJS.ProcessEnv }
  abortTimeout?: number
  directory: string
}) {
  return await createTest<ExcuteBuncheeResult>({
    directory,
    args: args ?? [],
    options: options ?? {},
    abortTimeout,
    run: executeBunchee,
  })
}
