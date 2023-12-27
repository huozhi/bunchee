import pc from 'picocolors'

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
  },
}

export function paint(prefix: string, prefixColor: any, ...arg: any[]) {
  if (pc.isColorSupported) {
    console.log(' ' + (pc as any)[prefixColor](prefix), ...arg)
  } else {
    console.log(' ' + prefix, ...arg)
  }
}