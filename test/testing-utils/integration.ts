import {
  createSyncTest,
  executeBunchee,
  type ExcuteBuncheeResult,
} from './shared'

type IntegrationTestOptions = {
  args?: string[]
  options?: { env?: NodeJS.ProcessEnv }
  abortTimeout?: number
  hookTimeout?: number
  directory: string
}

/** Sync testing helper */
export function createJob({
  args,
  options,
  abortTimeout,
  hookTimeout,
  directory,
}: IntegrationTestOptions) {
  return createSyncTest<ExcuteBuncheeResult>({
    args: args ?? [],
    options: options ?? {},
    abortTimeout,
    hookTimeout,
    directory,
    run: executeBunchee,
  })
}
