import path from 'path'

// Example: ./src/util/foo.ts -> ./src/util/foo
// Example: ./src/util/foo/index.ts -> ./src/util/foo
// Example: ./src/util/foo.d.ts -> ./src/util/foo
export const getPathWithoutExtension = (filePath: string): string => {
  const pathWithoutExtension = filePath
    // Remove the file extension first
    .replace(/(\.\w+)+$/, '')
    // Remove '/index' if it exists at the end of the path
    .replace(/\/index$/, '')

  return pathWithoutExtension
}

// Example: ./src/util/foo.development.ts -> foo.development
// Example: ./src/util/foo.react-server.ts -> foo.react-server
export const baseNameWithoutExtension = (filePath: string): string => {
  return path.basename(filePath, path.extname(filePath))
}

export function validateEntryFiles(entryFiles: string[]) {
  const fileBasePaths = new Set<string>()
  const duplicatePaths = new Set<string>()

  for (const filePath of entryFiles) {
    // Check if there are multiple files with the same base name
    const filePathWithoutExt = filePath
      .slice(0, -path.extname(filePath).length)
      .replace(/\\/g, '/')
    const segments = filePathWithoutExt.split('/')

    let lastSegment = segments[segments.length - 1]
    while (lastSegment && (lastSegment === 'index' || lastSegment === '')) {
      segments.pop()
      lastSegment = segments[segments.length - 1]
    }
    const fileBasePath = segments.join('/')

    if (fileBasePaths.has(fileBasePath)) {
      duplicatePaths.add(
        // Add a dot if the base name is empty, 'foo' -> './foo', '' -> '.'
        './' + filePath.replace(/\\/g, '/'),
      )
    }
    fileBasePaths.add(fileBasePath)
  }

  if (duplicatePaths.size > 0) {
    throw new Error(
      `Conflicted entry files found for entries: ${[...duplicatePaths].join(
        ', ',
      )}`,
    )
  }
}
