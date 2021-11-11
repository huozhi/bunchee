function *generator() { yield 1 }

async function asyncFunc() { await new Promise(r => r(1)) }

class A {
  #x = 1
  getX = () => { return this.#x }

  *f1() {
    yield 1
  }
}

const _v = 123
export const x = () => `value:${_v}`

export {
  generator,
  asyncFunc,
  A,
}
