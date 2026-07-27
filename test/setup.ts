import { afterAll, beforeAll, expect } from 'vitest'
import {
  type FixtureSnapshot,
  restoreFixtures,
  snapshotFixtures,
} from './testing-utils/fixture-state'

// Loaded through `setupFiles`, so this hook pair wraps every test file: the
// fixture directory is captured before the first build runs and put back
// afterwards. That is why no test suite removes its own `dist`, deletes the
// tsconfig.json a build wrote next to its fixture, or reverts the package.json
// `bunchee prepare` rewrote — anything a run creates or changes in there is
// undone here.
let snapshots: FixtureSnapshot[] = []

beforeAll(async () => {
  snapshots = await snapshotFixtures(expect.getState().testPath)
})

afterAll(async () => {
  // Escape hatch for inspecting build output after a run.
  if (process.env.TEST_NOT_CLEANUP) return
  await restoreFixtures(snapshots)
})
