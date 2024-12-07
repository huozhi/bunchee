import { posix } from 'path'
import picomatch from 'picomatch'

export const matchFile = (matchingPattern: string[], filePath: string) => {
  return matchingPattern.some((pattern) => {
    // pattern is always posix
    const normalizedPattern = posix.normalize(pattern)
    const expandedPattern = normalizedPattern.endsWith('/')
      ? `${normalizedPattern}**`
      : `${normalizedPattern}/**`

    const matcher = picomatch(expandedPattern)

    const normalizedFilePath = posix.normalize(filePath)
    return matcher(normalizedFilePath)
  })
}
