class Foo {
  getFoo() {
    return 'foo'
  }
}

// This will be removed by treeshaking
class Bar {
  getBar() {
    return 'bar'
  }
}

export { Foo }
