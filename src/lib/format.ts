import { sep } from 'path'

export function posixRelativify(path: string) {
  return path.startsWith('.') ? path : `./${path}`
}

export function platformRelativify(path: string) {
  return path.startsWith('.') ? path : `.${sep}${path}`
}
