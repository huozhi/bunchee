import { type Shared } from './shared'

export default function client(c: string) {
  return 'client' + c
}

export type Client = string
export { Shared }
