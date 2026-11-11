import type { BundleConfig } from '../types'
import type { BuildMode } from './types'
import { bundledMode } from './bundled'

/** Select build policy once; currently all builds use the bundled policy. */
export function createBuildMode(_options: BundleConfig): BuildMode {
  return bundledMode
}
