import { performance } from 'perf_hooks'

export const PROFILE_PREFIX = 'BUNCHEE_PROFILE '

type ProfileDetail = string | number | boolean | null
export type ProfileDetails = Record<string, ProfileDetail | undefined>

export type ProfileEvent = {
  schemaVersion: 1
  phase: string
  durationMs: number
  pid: number
  details?: Record<string, ProfileDetail>
}

export function isProfileEnabled(): boolean {
  return process.env.PROFILE === '1'
}

/**
 * Capture a phase start without paying for a clock read when profiling is off.
 */
export function startProfile(): number | undefined {
  return isProfileEnabled() ? performance.now() : undefined
}

/**
 * Start a timer at the beginning of the Node.js process lifetime.
 *
 * Used by the CLI total so module loading is represented in the profile, while
 * individual build phases use `startProfile`.
 */
export function startProcessProfile(): number | undefined {
  return isProfileEnabled() ? 0 : undefined
}

export function createProfileEvent(
  phase: string,
  durationMs: number,
  details?: ProfileDetails,
): ProfileEvent {
  const filteredDetails = details
    ? Object.fromEntries(
        Object.entries(details).filter(
          (entry): entry is [string, ProfileDetail] => {
            return entry[1] !== undefined
          },
        ),
      )
    : undefined

  return {
    schemaVersion: 1,
    phase,
    durationMs: Number(durationMs.toFixed(3)),
    pid: process.pid,
    ...(filteredDetails && Object.keys(filteredDetails).length > 0
      ? { details: filteredDetails }
      : {}),
  }
}

/**
 * Emit one machine-readable JSON line. The prefix lets callers share stdout
 * with Bunchee's normal output and select profile records without parsing it.
 */
export function endProfile(
  phase: string,
  startedAt: number | undefined,
  details?: ProfileDetails,
): void {
  if (startedAt === undefined) return
  const event = createProfileEvent(
    phase,
    performance.now() - startedAt,
    details,
  )
  process.stdout.write(PROFILE_PREFIX + JSON.stringify(event) + '\n')
}
