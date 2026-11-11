# Build modes

`index.ts` selects a mode once per build. `bundled.ts` describes the existing
bundled behavior; `unbundle/` owns the experimental mode, including its path
registry, plugins, validation, and compact reporter.

The shared pipeline discovers entries, plans graphs, and runs Rollup. It calls
`BuildMode` policies instead of checking feature flags. `prepareEntries` captures
the declared exports before discovery adds private entries, and returns the
callback that applies the mode's entry policy afterwards.

Mode factories own per-build state; no registry is stored
in shared plugin context. To unplug unbundle, remove its factory selection and
its directory. The bundled policy and the shared pipeline remain intact.
