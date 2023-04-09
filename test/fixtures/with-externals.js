import { __TEST_EXPECTED_STRING__ } from '@huozhi/testing-package'
import bar from 'bar-package'

export function baz() {
  return __TEST_EXPECTED_STRING__
}

export function barFunction() {
  return bar
}
