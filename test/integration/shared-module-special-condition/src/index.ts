import { sharedValue } from './_util'

export function index() {
  return process.env.NODE_ENV + sharedValue
}
