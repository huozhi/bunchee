export function relativify(path: string) {
  return path.startsWith('.') ? path : `./${path}`
}