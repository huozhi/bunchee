'use client'

import { sharedUtil, SHARED_CONSTANT } from './shared'
import { clientOnlyUtil } from './client-only-shared'

export function ClientComponent2() {
  return (
    <span>
      {sharedUtil()} | {SHARED_CONSTANT} | {clientOnlyUtil()}
    </span>
  )
}
