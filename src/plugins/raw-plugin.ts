import { type FilterPattern, createFilter } from '@rollup/pluginutils'
import type { Plugin } from 'rollup'
import { readFile } from 'fs/promises'

export function rawContent({ exclude }: { exclude: FilterPattern }): Plugin {
  const filter = createFilter(['**/*.data', '**/*.txt'], exclude)

  return {
    name: 'string',

    resolveId(id, importer) {
      // Handle ?raw query parameter
      if (id.includes('?raw')) {
        const cleanId = id.split('?')[0]
        // Resolve the actual file path
        if (importer) {
          const path = require('path')
          return path.resolve(path.dirname(importer), cleanId) + '?raw'
        }
        return cleanId + '?raw'
      }
      return null
    },

    async load(id) {
      // Handle ?raw query parameter - read the actual file without the query
      if (id.includes('?raw')) {
        const cleanId = id.split('?')[0]
        try {
          const content = await readFile(cleanId, 'utf-8')
          // Normalize line endings: convert \r\n to \n for cross-platform compatibility
          return content.replace(/\r\n/g, '\n')
        } catch (error) {
          this.error(`[bunchee] failed to read file: ${cleanId}`)
        }
      }
      return null
    },

    transform(code, id) {
      // Check if the file has ?raw query parameter
      const isRawQuery = id.includes('?raw')
      const cleanId = isRawQuery ? id.split('?')[0] : id

      if (filter(cleanId) || isRawQuery) {
        // Normalize line endings for .txt and .data files as well
        const normalizedCode = code.replace(/\r\n/g, '\n')
        return {
          code: `const data = ${JSON.stringify(normalizedCode)};\nexport default data;`,
          map: null,
        }
      }
      return null
    },
  }
}
