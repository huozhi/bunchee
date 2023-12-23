import fs from 'fs/promises'
import path from 'path'
import stripAnsi from 'strip-ansi'

export function stripANSIColor(str: string) {
  return stripAnsi(str)
}

export async function existsFile(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return false
    }
    throw err
  }
}

export async function assertFilesContent(
  dir: string,
  contentsRegex: Record<string, RegExp | string>,
) {
  const distFiles = Object.keys(contentsRegex)
  for (const relativeFile of distFiles) {
    const file = path.join(dir, relativeFile)
    expect({
      [file]: (await existsFile(file)) ? 'existed' : 'missing',
    }).toMatchObject({ [file]: 'existed' })
  }

  for (const [file, regex] of Object.entries(contentsRegex)) {
    const content = await fs.readFile(path.join(dir, file), {
      encoding: 'utf-8',
    })
    if (regex instanceof RegExp) {
      expect(content).toMatch(regex)
    } else {
      expect(content).toContain(regex)
    }
  }
}

// bundle.min.js => .min.js
export const fullExtension = (filename: string) =>
  filename.slice(filename.indexOf('.'))
