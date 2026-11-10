import type { BuildMode } from './types'
import { createOutputState } from '../plugins/output-state-plugin'
import { nativeAddon } from '../plugins/native-addon-plugin'
import { getDefinedInlineVariables } from '../env'
import { getSpecialExportTypeFromConditionNames } from '../entries'

/** Existing bundled behavior; mode-specific state stays out of BuildContext. */
export const bundledMode: BuildMode = {
  forceMerged: false,
  allowWorkers: true,
  resolveInput: (cwd, entry) => ({ cwd, entry }),
  validatePackage() {},
  prepareEntries: () => () => {},
  prepareTypes() {},
  createOutputState: (entries) => createOutputState({ entries }),
  graphShape: (env, entry, target) => [
    JSON.stringify(getDefinedInlineVariables(env, entry)),
    getSpecialExportTypeFromConditionNames(new Set(target.conditions)),
  ],
  canGroup: () => true,
  declarationTarget: (_target, path) => ({ path, conditions: ['types'] }),
  declarationOptions: () => undefined,
  inputPlugins: () => [],
  nativeAddonPlugin: nativeAddon,
  configureOutput: (options) => options,
  finish() {},
}
