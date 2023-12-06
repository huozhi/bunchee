import { type FilterPattern, createFilter } from '@rollup/pluginutils'
import type { Plugin } from 'rollup'

export function rawContent({ exclude }: { exclude: FilterPattern }): Plugin {
  /\.(data|txt)$/
  const filter = createFilter(['**/*.data', '**/*.txt'], exclude)

  return {
    name: "string",

    transform(code, id) {
      if (filter(id)) {
        return {
          code: `export default ${JSON.stringify(code)}`,
          map: undefined,
        }
      }
      return undefined
    }
  }
}

