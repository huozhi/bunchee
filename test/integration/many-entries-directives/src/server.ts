'use server'

import { sharedApi } from './lib/_util'

export const server = 'server:' + sharedApi()
