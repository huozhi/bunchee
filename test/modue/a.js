import b from './b';

function a(name = '') {
  console.log('a:', name);
  b('a' + name);
}

export default a;
