export function normalizeError(error: any) {
  // Remove the noise from rollup plugin error
  if (error.code === 'PLUGIN_ERROR') {
    const normalizedError = new Error(error.message)
    normalizedError.name = error.name ?? 'Error'
    normalizedError.stack = error.stack
    // Kept for `--stats`, but not enumerable so the printed error stays as is.
    for (const key of ['id', 'loc', 'plugin'] as const) {
      if (error[key] !== undefined) {
        Object.defineProperty(normalizedError, key, {
          value: error[key],
          enumerable: false,
        })
      }
    }
    error = normalizedError
  }
  return error
}
