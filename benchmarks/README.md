# Bunchee benchmarks

The benchmark harness generates temporary TypeScript packages and invokes
`dist/bin/cli.js` directly. It does not use `npx`, access the network, or include
package-manager startup in Bunchee's measurements.

```sh
# Build Bunchee, then benchmark 1, 8, and 57-entry packages.
pnpm benchmark

# A quick smoke run.
pnpm benchmark -- --entries 1 --iterations 1 --warmup 0

# Include the larger worker-threshold fixture.
pnpm benchmark -- --entries 57,256 --iterations 10

# Preserve a JSON report without the preceding build command's output.
pnpm build
node ./scripts/benchmark.js --entries 57,256 --iterations 10 --json > benchmark.json
```

By default, each scenario keeps its output between runs so the measurement
focuses on build work. Pass `--clean` to include removal of the previous output.
Every scenario validates the expected files and records a SHA-256 digest of the
complete output.

The report includes median and p95 wall time, CPU time, maximum resident memory,
JS and declaration graph time, TypeScript Program setup, and output writes.
Program setup is part of declaration graph time, not an additional duration.
Timings are informational and should not be used as hard CI assertions.

## Profiling a real package

Set `PROFILE=1` when invoking a locally installed Bunchee:

```sh
PROFILE=1 pnpm exec bunchee
```

Bunchee writes newline-delimited records to stdout. Each record begins with
`BUNCHEE_PROFILE ` followed by JSON. The format is intended for development
tooling and is versioned by its `schemaVersion`; it is not part of Bunchee's
public API. Profiling performs no clock reads or JSON serialization when the
environment variable is disabled.
