(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (factory());
}(this, (function () { 'use strict';

  function b(it) {
    console.log('b:', it);
  }

  function a(name = '') {
    console.log('a:', name);
    b('a' + name);
  }

  a('main');

})));
