export const logger = {
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
  }
}
