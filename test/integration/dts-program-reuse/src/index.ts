import { shared } from './_shared'
import type { Shared } from './_shared'

export const value = shared
export type Public = Shared & { public: true }
