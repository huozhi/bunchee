import type { Plugin } from 'rollup'
import { readFile } from 'fs/promises'
import path from 'path'

const NATIVE_ADDON_SUFFIX = '\0native-addon:'

/**
 * Plugin to handle native Node.js addon (.node) files.
 * Copies the binary to the output directory and rewrites import paths.
 */
export function nativeAddon(): Plugin {
  // Map from virtual module id to original absolute path
  const nativeAddonMap = new Map<string, string>()

  return {
    name: 'native-addon',

    resolveId(source, importer) {
      // Check if this is a .node file import
      if (!source.endsWith('.node')) {
        return null
      }

      // Resolve the absolute path of the .node file
      let absolutePath: string
      if (path.isAbsolute(source)) {
        absolutePath = source
      } else if (importer) {
        absolutePath = path.resolve(path.dirname(importer), source)
      } else {
        return null
      }

      // Create a virtual module id for this native addon
      const virtualId = NATIVE_ADDON_SUFFIX + absolutePath

      // Track the mapping
      nativeAddonMap.set(virtualId, absolutePath)

      return virtualId
    },

    async load(id) {
      if (!id.startsWith(NATIVE_ADDON_SUFFIX)) {
        return null
      }

      const absolutePath = nativeAddonMap.get(id)
      if (!absolutePath) {
        return null
      }

      // Get the filename for the output
      const fileName = path.basename(absolutePath)

      // Return code that will require the binary from the same directory
      // Using __dirname to get the directory of the output file at runtime
      return {
        code: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const nativeAddon = require(join(__dirname, ${JSON.stringify(fileName)}));
export default nativeAddon;
`,
        map: null,
        meta: {
          nativeAddon: {
            absolutePath,
            fileName,
          },
        },
      }
    },

    async generateBundle() {
      // Copy all tracked native addon files to the output directory
      for (const [_, absolutePath] of nativeAddonMap) {
        const fileName = path.basename(absolutePath)

        try {
          const fileContent = await readFile(absolutePath)

          // Emit the binary file as an asset
          this.emitFile({
            type: 'asset',
            fileName,
            source: fileContent,
          })
        } catch (error) {
          this.error(
            `[bunchee] Failed to read native addon file: ${absolutePath}`,
          )
        }
      }
    },
  }
}
