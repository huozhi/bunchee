export type BaseShape = { id: string; tag: 'base' }

export const makeBase = (): BaseShape => ({ id: 'b', tag: 'base' })
