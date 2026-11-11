import type { BundleConfig } from '../types'
import type { BuildMode } from './types'
import { bundledMode } from './bundled'
import { createUnbundleMode } from './unbundle'

/** The only place that selects a mode from user options. */
export function createBuildMode(options: BundleConfig): BuildMode {
  return options.unbundle ? createUnbundleMode(options) : bundledMode
}
