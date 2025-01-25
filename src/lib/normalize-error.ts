export function normalizeError(error: any) {
  // Remove the noise from rollup plugin error
  if (error.code === 'PLUGIN_ERROR') {
    const normalizedError = new Error(error.message)
    normalizedError.stack = error.stack
    error = normalizedError
  }
  return error
}
