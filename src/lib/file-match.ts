import path from 'path'
import picomatch from 'picomatch'

export const matchFile = (matchingPattern: string[], filePath: string) => {
  return matchingPattern.some((pattern) => {
    // pattern is always posix
    const normalizedPattern = path.posix.normalize(pattern)
    const expandedPattern = normalizedPattern.endsWith('/')
      ? `${normalizedPattern}**`
      : `${normalizedPattern}/**`

    const matcher = picomatch(expandedPattern)

    const normalizedFilePath = path.normalize(filePath.replace(/\\/g, '/'))
    return matcher(normalizedFilePath)
  })
}
