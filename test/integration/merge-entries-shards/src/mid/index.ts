import type { BaseShape } from '../base'

export type MidShape = { base: BaseShape; level: number }

export const makeMid = (base: BaseShape): MidShape => ({ base, level: 1 })
