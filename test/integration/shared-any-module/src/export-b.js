import { utilB } from './_internal/util-b'
import { utilC } from './private/_nested/util-c'

export const getName = () => {
  return 'export-b' + utilB + utilC
}
