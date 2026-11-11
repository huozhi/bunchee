import type { Plugin } from 'rollup'

type ModuleGroup = {
  entries: Set<string>
  suffix: string
  files: Set<string>
  /** Set once the JS graph has generated, i.e. `files` is complete. */
  built: boolean
}

type ModuleOptions = {
  dts: boolean
  inputs: Record<string, string>
  suffix: string
  entrySources: Set<string>
  allowJs: boolean
}

/** Track each JS graph's sources so implementation modules also get declarations. */
export function createUnbundleModuleTracker() {
  const groups: ModuleGroup[] = []
  return ({
    dts,
    inputs,
    suffix,
    entrySources,
    allowJs,
  }: ModuleOptions): Plugin => {
    if (dts) {
      return {
        name: 'unbundle-declaration-inputs',
        options(options) {
          const input = { ...(options.input as Record<string, string>) }
          const publicInputs = Object.values(input)
          const roots = new Set(publicInputs)
          for (const group of groups) {
            // JS-only public entries have no DTS input: the declaration graph
            // can own a subset of a corresponding JS graph's public roots.
            if (
              group.suffix !== suffix ||
              !publicInputs.every((id) => group.entries.has(id))
            )
              continue
            // The declaration roots come from what the JS graph emitted, so it
            // must already have run. createMergedRollupJobs builds JS graphs
            // before DTS graphs, one at a time, and unbundle disables workers;
            // fail loudly if that ordering ever changes rather than silently
            // dropping declarations for implementation modules.
            if (!group.built)
              throw new Error(
                'bunchee: unbundle declaration graph ran before its JavaScript graph',
              )
            for (const file of group.files)
              if (!entrySources.has(file)) roots.add(file)
          }
          let index = 0
          for (const id of roots)
            if (!publicInputs.includes(id)) input[`__unbundle_${index++}`] = id
          return { ...options, input }
        },
      }
    }
    const group: ModuleGroup = {
      entries: new Set(Object.values(inputs)),
      suffix,
      files: new Set(),
      built: false,
    }
    groups.push(group)
    return {
      name: 'unbundle-source-modules',
      generateBundle(_options, bundle) {
        group.built = true
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== 'chunk' || !chunk.facadeModuleId) continue
          const id = chunk.facadeModuleId
          if (
            !id.startsWith('\0') &&
            !id.split(/[\\/]/).includes('node_modules') &&
            (/\.[cm]?tsx?$/.test(id) || (allowJs && /\.[cm]?jsx?$/.test(id)))
          )
            group.files.add(id)
        }
      },
    }
  }
}
