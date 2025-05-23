import {
  createAsyncTest,
  executeBunchee,
  type ExcuteBuncheeResult,
} from './shared'

export async function runCli({
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
  return await createAsyncTest<ExcuteBuncheeResult>({
    directory,
    args: args ?? [],
    options: options ?? {},
    abortTimeout,
    run: executeBunchee,
  })
}
