import {Parent} from './b';

class A extends Parent {
  constructor() {
    super()
  }
  get x() {
    return super.f()
  }

  *f1() {
    yield 1
  }
}

const a = new A()

export default a;
