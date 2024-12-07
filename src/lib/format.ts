export function posixRelativify(path: string) {
  return path.startsWith('.') ? path : `./${path}`
}
