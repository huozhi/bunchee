import { type FilterPattern, createFilter } from '@rollup/pluginutils'
import type { Plugin } from 'rollup'

export function rawContent({ exclude }: { exclude: FilterPattern }): Plugin {
  const filter = createFilter(['**/*.data', '**/*.txt'], exclude)

  return {
    name: 'string',

    transform(code, id) {
      if (filter(id)) {
        return {
          code: `const data = ${JSON.stringify(code)};\nexport default data;`,
          map: null,
        }
      }
      return null
    }
  }
}

