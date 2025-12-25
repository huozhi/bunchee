'use client'

import { sharedUtil, SHARED_CONSTANT } from './shared'
import { clientOnlyUtil } from './client-only-shared'

export function ClientComponent() {
  return (
    <div>
      {sharedUtil()} - {SHARED_CONSTANT} - {clientOnlyUtil()}
    </div>
  )
}
