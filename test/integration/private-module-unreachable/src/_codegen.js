// A build-time script: nothing in the package imports it, and it is only ever
// run by hand. Its own imports must not reach the package's module graph, and
// the import statement it emits as text is not one of its imports.
import { readFileSync } from 'fs'

export const template = `export { shared } from './_shared'`

export function generate(from) {
  return readFileSync(from, 'utf8') + template
}
