function dec() {
  return function () {}
}

export class Foo {
  @dec()
  method() {}
}

export class Bar {
  @dec()
  method() {}
}
