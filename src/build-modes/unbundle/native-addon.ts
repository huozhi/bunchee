import type { Plugin } from 'rollup'
import { readFile } from 'fs/promises'
import { basename, dirname, isAbsolute, resolve } from 'path'

/** Rollup file references keep binaries reachable from preserved virtual files. */
export function unbundledNativeAddon(): Plugin {
  const prefix = '\0native-addon:'
  return {
    name: 'native-addon',
    resolveId(source, importer) {
      if (!source.endsWith('.node')) return null
      if (isAbsolute(source)) return prefix + source
      return importer ? prefix + resolve(dirname(importer), source) : null
    },
    async load(id) {
      if (!id.startsWith(prefix)) return null
      const file = id.slice(prefix.length)
      const reference = this.emitFile({
        type: 'asset',
        fileName: basename(file),
        originalFileName: file,
        source: await readFile(file),
      })
      return `
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
export default require(fileURLToPath(import.meta.ROLLUP_FILE_URL_${reference}));
`
    },
  }
}
