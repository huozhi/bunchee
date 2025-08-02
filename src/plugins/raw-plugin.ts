import { type FilterPattern, createFilter } from '@rollup/pluginutils'
import type { Plugin } from 'rollup'
import { readFileSync } from 'fs'

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

    load(id) {
      // Handle ?raw query parameter - read the actual file without the query
      if (id.includes('?raw')) {
        const cleanId = id.split('?')[0]
        try {
          return readFileSync(cleanId, 'utf-8')
        } catch (error) {
          this.error(`Failed to read file: ${cleanId}`)
        }
      }
      return null
    },

    transform(code, id) {
      // Check if the file has ?raw query parameter
      const isRawQuery = id.includes('?raw')
      const cleanId = isRawQuery ? id.split('?')[0] : id

      if (filter(cleanId) || isRawQuery) {
        return {
          code: `const data = ${JSON.stringify(code)};\nexport default data;`,
          map: null,
        }
      }
      return null
    },
  }
}
