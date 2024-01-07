import pc from 'picocolors'

const defaultColorFn = (text: string) => text
function color(prefixColor: any) {
  return pc.isColorSupported ? (pc as any)[prefixColor] : defaultColorFn
}

export const logger = {
  log(...arg: any[]) {
    console.log(...arg)
  },
  warn(...arg: any[]) {
    console.warn(color('yellow')('⚠️'), ...arg)
  },
  error(...arg: any) {
    console.error(color('red')('⨯'), ...arg)
  },
  info(...arg: any) {
    console.log(color('green')('✓'), ...arg)
  },
}

export function paint(prefix: string, prefixColor: any, ...arg: any[]) {
  if (pc.isColorSupported) {
    console.log((pc as any)[prefixColor](prefix), ...arg)
  } else {
    console.log(prefix, ...arg)
  }
}