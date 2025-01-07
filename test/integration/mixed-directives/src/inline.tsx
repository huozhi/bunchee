// @ts-ignore externals
import ClientComponent from 'client-component'

export default function Page() {
  async function inlineAction() {
    'use server'
    return 'inline-action'
  }

  return <ClientComponent action={inlineAction} />
}
