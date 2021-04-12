function *generator() { yield 1 }

async function asyncFunc() { await new Promise(r => r(1)) }

class A {
  #x = 1
  getX = () => { return this.#x }
}

const _v = 123
export const x = () => `value:${_v}`

export {
  generator,
  asyncFunc,
  A,
}
