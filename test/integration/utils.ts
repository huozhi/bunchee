import type { ExcuteBuncheeResult } from '../testing-utils'
import {
  assertContainFiles,
  assertFilesContent,
  createTest,
  executeBunchee,
} from '../testing-utils'

export async function createIntegrationTest(
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

export function assertFixturesContainFiles(
  directory: string,
  files: string[],
): void {
  const fixturesDir = `${directory}/fixtures`
  assertContainFiles(fixturesDir, files)
}

export function assertFixturesFilesContent(
  directory: string,
  contentsRegex: Record<string, RegExp | string>,
): void {
  const fixturesDir = `${directory}/fixtures`
  assertFilesContent(fixturesDir, contentsRegex)
}
