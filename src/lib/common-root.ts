import { sep } from 'path'

/** Deepest directory containing every directory in the list. */
export function commonRootDir(dirs: string[]): string {
  const [first, ...rest] = dirs.map((dir) => dir.split(sep))
  let end = first.length
  for (const parts of rest) {
    let i = 0
    while (i < end && i < parts.length && parts[i] === first[i]) i++
    end = i
  }
  return first.slice(0, end).join(sep) || sep
}
