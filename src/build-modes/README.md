# Build modes

`index.ts` selects a policy once per build. This preparatory refactor always
returns `bundledMode`, which preserves the existing build behavior.

The shared entry planner and Rollup pipeline consume the internal `BuildMode`
contract. Input/output policies, declaration configuration, plugin creation,
and reporting can be supplied by a mode without adding feature flags to the
shared pipeline. Future mode factories can keep their mutable state per build.

`prepareEntries` runs before discovery and returns the callback applied after
discovery. This allows a mode to distinguish declared exports from synthetic
entries while the bundled policy retains all existing entries.
