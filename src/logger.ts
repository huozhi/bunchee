export const logger = {
  prefixedLog(prefix: string, ...arg: any[]) {
    console.log(' ' + prefix, ...arg)
  },
  log(...arg: any[]) {
    console.log('  ', ...arg)
  },
  warn(...arg: any[]) {
    console.warn(' ⚠️', ...arg)
  },
  error(...arg: any) {
    console.error(' ⨯', ...arg)
  },
  info(...arg: any) {
    console.log(' ✓', ...arg)
  },
}
