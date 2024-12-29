import { utilA } from './_internal/util-a'
import { utilC } from './private/_nested/util-c'

export const getName = () => {
  return 'export-c' + utilA + utilC
}
