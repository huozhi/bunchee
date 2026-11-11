import type { BuildMode } from './types'
import { createOutputState } from '../plugins/output-state-plugin'
import { nativeAddon } from '../plugins/native-addon-plugin'
import { getDefinedInlineVariables } from '../env'
import { getSpecialExportTypeFromConditionNames } from '../entries'

/** Existing bundled behavior; mode-specific state stays out of BuildContext. */
export const bundledMode: BuildMode = {
  allowWorkers: true,
  resolveInput: (cwd, entry) => ({ cwd, entry }),
  validatePackage() {},
  selectEntries: (entries) => entries,
  createOutputState: (entries) => createOutputState({ entries }),
  graphShape: (env, entry, target) => [
    JSON.stringify(getDefinedInlineVariables(env, entry)),
    getSpecialExportTypeFromConditionNames(new Set(target.conditions)),
  ],
  oneOutputPerSource: false,
  declarationOptions: () => undefined,
  inputPlugins: () => [],
  nativeAddonPlugin: nativeAddon,
  configureOutput: (options) => options,
  finish() {},
}
