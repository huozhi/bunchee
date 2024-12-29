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
  const baseNames = new Set<string>()
  const duplicateBaseNames = new Set<string>()

  for (const file of entryFiles) {
    // Check if there are multiple files with the same base name
    // e.g. index.js, index.ts, index.mjs
    // e.g. <name>.ext and <name>./index.ext
    let baseName = getPathWithoutExtension(file)
    const indexSuffix = '/index'
    if (baseName.endsWith(indexSuffix)) {
      baseName = baseName.slice(0, -indexSuffix.length)
    }

    if (baseNames.has(baseName)) {
      duplicateBaseNames.add(
        // Add a dot if the base name is empty, 'foo' -> './foo', '' -> '.'
        '.' + (baseName !== '' ? '/' : '') + baseName,
      )
    }
    baseNames.add(baseName)
  }

  if (duplicateBaseNames.size > 0) {
    throw new Error(
      `Conflicted entry files found for entries: ${[...duplicateBaseNames].join(
        ', ',
      )}`,
    )
  }
}
