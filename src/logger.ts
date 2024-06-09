import pc from 'picocolors'
import ora from 'ora'

const defaultColorFn = (text: string) => text
function color(prefixColor: any) {
  return pc.isColorSupported ? (pc as any)[prefixColor] : defaultColorFn
}

export const buildingSpinner = ora({
  text: 'bundling...\n\n',
  spinner: 'dots',
  color: 'green',
})

function clearSpinner() {
  if (buildingSpinner.isSpinning) {
    buildingSpinner.stop()
  }
}

export const logger = {
  log(...arg: any[]) {
    clearSpinner()
    console.log(...arg)
  },
  warn(...arg: any[]) {
    clearSpinner()
    console.warn(color('yellow')('⚠️'), ...arg)
  },
  error(...arg: any) {
    clearSpinner()
    console.error(color('red')('⨯'), ...arg)
  },
  info(...arg: any) {
    clearSpinner()
    console.log(color('green')('✓'), ...arg)
  },
}

export function paint(prefix: string, prefixColor: any, ...arg: any[]) {
  clearSpinner()
  if (pc.isColorSupported) {
    console.log((pc as any)[prefixColor](prefix), ...arg)
  } else {
    console.log(prefix, ...arg)
  }
}
