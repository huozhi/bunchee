export class Index {
  async method() {
    const x = { a: 1 }
    const y = { b: 2 }
    const z = { ...x, ...y }
    console.log(z, Object.assign({}, x, y))
  }
}
