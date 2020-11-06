function *generator() { yield 1 }

async function asyncFunc() { await new Promise(r => r(1)) }

class A {
  #x = 1
  getX = () => { return this.#x }
}

export {
  generator,
  asyncFunc,
  A,
}
