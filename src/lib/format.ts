const { sep } = require('path')

export function relativify(path: string) {
  return path.startsWith('.') ? path : `.${sep}${path}`
}
