export function log(...args: any[]) {
  if (process.env.TEST_DEBUG || process.env.DEBUG) console.log(...args)
}

export function error(...args: any[]) {
  if (process.env.TEST_DEBUG || process.env.DEBUG) console.error(...args)
}
