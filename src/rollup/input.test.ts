import { createOutputCleaner } from '../lib/output-cleaner'
import { bundledMode } from '../build-modes/bundled'
import { expect, test } from 'vitest'
import { resolve } from 'path'
import type { BuildContext } from '../types'
import { createOutputState } from '../plugins/output-state-plugin'
import { buildInputConfig } from './input'

test('JS graphs leave declaration plugin initialization to the DTS graph', async () => {
  const entry = {
    name: '.',
    source: resolve('src/index.ts'),
    targets: [{ path: './dist/index.js', conditions: ['import'] }],
  }
  const entries = { '.': entry }
  const context: BuildContext = {
    mode: bundledMode,
    cleanOutputDir: createOutputCleaner(process.cwd()),
    cwd: process.cwd(),
    pkg: { name: 'test', type: 'module' },
    entries,
    useTypeScript: true,
    tsOptions: { tsConfigPath: undefined, tsCompilerOptions: {} },
    browserslistConfig: undefined,
    pluginContext: {
      outputState: createOutputState({ entries }),
      moduleDirectiveLayerMap: new Map(),
    },
  }

  await buildInputConfig(entry.source, { dts: false }, entry, context, false)
  expect(context.pluginContext.dtsPlugin).toBeUndefined()

  const config = await buildInputConfig(entry.source, {}, entry, context, true)
  expect(context.pluginContext.dtsPlugin).toBeDefined()
  expect(config.plugins).toContain(await context.pluginContext.dtsPlugin)
})
