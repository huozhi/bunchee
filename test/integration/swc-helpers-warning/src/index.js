function dec() {
  return function () {}
}

export class Foo {
  @dec()
  method() {}
}
