import pc from 'picocolors'

const defaultColorFn = (text: string) => text
function color(prefixColor: any) {
  return pc.isColorSupported ? (pc as any)[prefixColor] : defaultColorFn
}

// Spinner context for coordinating spinner and logging
type SpinnerLike = {
  isSpinning: boolean | (() => boolean)
  clear: () => void
  start: () => void
}

let activeSpinner: SpinnerLike | null = null

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
}

function isSpinnerActive(): boolean {
  if (!activeSpinner) return false
  const isSpinning = activeSpinner.isSpinning
  return typeof isSpinning === 'function' ? isSpinning() : isSpinning
}

/**
 * Wrap a console method to pause spinner before logging
 */
function wrapConsoleMethod<T extends (...args: any[]) => void>(original: T): T {
  return ((...args: any[]) => {
    if (isSpinnerActive() && activeSpinner) {
      activeSpinner.clear()
      original(...args)
      activeSpinner.start()
    } else {
      original(...args)
    }
  }) as T
}

/**
 * Register a spinner so that ALL console output automatically pauses it.
 * This intercepts console.log/warn/error/info globally.
 * Call with `null` to unregister and restore original console methods.
 */
export function setActiveSpinner(spinner: SpinnerLike | null) {
  activeSpinner = spinner

  if (spinner) {
    // Patch global console methods to pause spinner
    console.log = wrapConsoleMethod(originalConsole.log)
    console.warn = wrapConsoleMethod(originalConsole.warn)
    console.error = wrapConsoleMethod(originalConsole.error)
    console.info = wrapConsoleMethod(originalConsole.info)
  } else {
    // Restore original console methods
    console.log = originalConsole.log
    console.warn = originalConsole.warn
    console.error = originalConsole.error
    console.info = originalConsole.info
  }
}

export const logger = {
  log(...arg: any[]) {
    console.log(...arg)
  },
  warn(...arg: any[]) {
    console.warn(color('yellow')('!'), ...arg)
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
