'use server'

import { sharedUtil, SHARED_CONSTANT } from './shared'

export async function serverAction() {
  return `${sharedUtil()} - ${SHARED_CONSTANT}`
}
