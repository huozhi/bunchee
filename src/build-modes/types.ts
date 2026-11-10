import type { CompilerOptions } from '@typescript/typescript6'
import type { OutputOptions, Plugin } from 'rollup'
import type {
  BuildContext,
  Entries,
  ParsedExportCondition,
  PackageMetadata,
} from '../types'
import type { OutputTarget, ParsedExportsInfo } from '../exports'
import type { OutputState } from '../plugins/output-state-plugin'

/** Build policies consumed by the shared entry planner and Rollup pipeline. */
export type BuildMode = {
  forceMerged: boolean
  allowWorkers: boolean
  resolveInput(cwd: string, entry: string): { cwd: string; entry: string }
  validatePackage(pkg: PackageMetadata): void
  prepareEntries(exports: ParsedExportsInfo): (entries: Entries) => void
  prepareTypes(entries: Entries, generateTypes: boolean): void
  createOutputState(entries: Entries): OutputState
  graphShape(
    env: string[],
    entry: ParsedExportCondition,
    target: OutputTarget,
  ): string[]
  canGroup(claimed: Map<string, string>, source: string, file: string): boolean
  declarationTarget(target: OutputTarget, file: string): OutputTarget
  declarationOptions(
    options: CompilerOptions | undefined,
  ): CompilerOptions | undefined
  inputPlugins(
    context: BuildContext,
    dts: boolean,
    inputs: Record<string, string>,
    target: OutputTarget,
  ): Plugin[]
  nativeAddonPlugin(): Plugin
  configureOutput(
    options: OutputOptions,
    sources: string[],
    files: Map<string, string>,
    target: OutputTarget,
  ): OutputOptions
  finish(context: BuildContext): void
}
