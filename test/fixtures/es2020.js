export const spread = { ...globalThis }
export const optionalChainFn = get?.apply?.bind
export async function loadList() { return Promise.resolve([1, 2, 3]) }