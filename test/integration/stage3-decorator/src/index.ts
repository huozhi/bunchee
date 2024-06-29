export function logged(value, { kind, name }: ClassMethodDecoratorContext) {
  if (kind === 'method') {
    return function (...args) {
      console.log(`starting fn with arguments ${args.join(', ')}`)
      const ret = value.call(this, ...args)
      console.log(`ending fn`)
      return ret
    }
  }
}

export class C {
  @logged
  m() {}
}
