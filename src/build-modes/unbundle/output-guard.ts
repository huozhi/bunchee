import type { Plugin } from 'rollup'
import { resolve } from 'path'
import { claimUnbundleOutput, unbundleError } from './paths'

export function unbundleOutputGuard(registry: Map<string, string>): Plugin {
  return {
    name: 'unbundle-output-paths',
    onLog(_level, log) {
      if (log.code === 'FILE_NAME_CONFLICT')
        throw unbundleError(
          'BUNCHEE_UNBUNDLE_OUTPUT_CONFLICT',
          `${log.message} Rename the conflicting asset or exports path.`,
        )
    },
    // Chunks are claimed while they are named (createUnbundleFileNames), before
    // Rollup could deconflict them with a numeric suffix. Assets are named by
    // the plugins that emit them, so claim them once the bundle is complete.
    generateBundle: {
      order: 'post',
      handler(options, bundle) {
        const dir = options.dir!
        for (const file of Object.values(bundle)) {
          if (file.type !== 'asset') continue
          const owners = file.originalFileNames.length
            ? file.originalFileNames
            : [`asset:${file.fileName}`]
          for (const owner of owners)
            claimUnbundleOutput(
              registry,
              resolve(dir, file.fileName),
              owner,
              dir,
            )
        }
      },
    },
  }
}
