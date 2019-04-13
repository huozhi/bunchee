import {Parent} from './b';

class A extends Parent {
  constructor() {
    super()
  }
  get x() {
    return super.f()
  }
}

const a = new A()

export default a;
