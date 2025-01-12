type CacheKeyResolver = string | ((...args: any[]) => string)

const createMemoize = <T extends (...args: any[]) => any>(
  fn: T,
  cacheKey?: CacheKeyResolver, // if you need specify a cache key
  cacheArg?: Map<string, ReturnType<T>>,
) => {
  const cache: Map<string, ReturnType<T>> = cacheArg || new Map()
  return ((...args: Parameters<T>) => {
    const key = cacheKey
      ? typeof cacheKey === 'function'
        ? cacheKey(...args)
        : cacheKey
      : JSON.stringify({ args })
    const existing = cache.get(key)
    if (existing !== undefined) {
      return existing
    }
    const result = fn(...args)
    cache.set(key, result)
    return result
  }) as T
}

export const memoizeByKey = <T extends (...args: any[]) => any>(fn: T) => {
  const cache = new Map<string, ReturnType<T>>()
  return (cacheKey?: CacheKeyResolver) => createMemoize(fn, cacheKey, cache)
}

export const memoize = <T extends (...args: any[]) => any>(fn: T) =>
  createMemoize(fn)
