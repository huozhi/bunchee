import {
  createSyncTest,
  executeBunchee,
  type ExcuteBuncheeResult,
} from './shared'

type IntegrationTestOptions = {
  args?: string[]
  options?: { env?: NodeJS.ProcessEnv }
  abortTimeout?: number
  directory: string
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
