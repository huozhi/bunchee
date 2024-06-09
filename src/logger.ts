import pc from 'picocolors'
import { consola } from 'consola'

export const logger = {
  log(...arg: any[]) {
    console.log(...arg)
  },
  warn(...arg: any[]) {
    consola.warn.raw(...arg)
  },
  error(...arg: any) {
    consola.error.raw(...arg)
  },
  info(...arg: any) {
    consola.info.raw(...arg)
  },
  start(...arg: any) {
    consola.start.raw(...arg)
  },
  success(...arg: any) {
    consola.success.raw(...arg)
  },
}

export function paint(prefix: string, prefixColor: any, ...arg: any[]) {
  if (pc.isColorSupported) {
    console.log((pc as any)[prefixColor](prefix), ...arg)
  } else {
    console.log(prefix, ...arg)
  }
}
