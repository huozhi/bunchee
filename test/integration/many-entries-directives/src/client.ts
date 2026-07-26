'use client'

import { appContext } from './lib/_app-context'
import { sharedApi } from './lib/_util'

export const client = 'client:' + appContext.name + ':' + sharedApi()
