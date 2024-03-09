export function getRequireModule() {
  return require('node:fs')
}

export function esmImport() {
  return import.meta.url
}
