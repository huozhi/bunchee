import { describe, expect, it } from 'vitest'
import {
  createJob,
  getFileContents,
  getFileNamesFromDirectory,
} from '../../testing-utils'

describe('integration - split-common-chunks', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should work', async () => {
    const files = await getFileNamesFromDirectory(distDir)
    const fileContents = await getFileContents(distDir)
    expect(files).toMatchInlineSnapshot(`
      [
        "bar.cjs",
        "bar.js",
        "cc-BU0zEyYq.js",
        "cc-CJkp5Pfh.js",
        "cc-CL7GPi9B.js",
        "cc-CTtQaxE0.cjs",
        "cc-CjnJhNSE.cjs",
        "foo.js",
        "index.cjs",
        "index.js",
      ]
    `)
    expect(fileContents).toMatchInlineSnapshot(`
      {
        "bar.cjs": "var cc = require('./cc-CTtQaxE0.cjs');

      class Bar {
          method() {
              const env = {
                  stack: [],
                  error: void 0,
                  hasError: false
              };
              try {
                  const getResource = ()=>{
                      return {
                          [Symbol.dispose]: ()=>{
                              console.log('Hooray!');
                          }
                      };
                  };
                  const resource = cc.__addDisposableResource(env, getResource(), false);
                  console.log('using resource', resource);
              } catch (e) {
                  env.error = e;
                  env.hasError = true;
              } finally{
                  cc.__disposeResources(env);
              }
          }
      }

      exports.Bar = Bar;
      ",
        "bar.js": "import { _ as __addDisposableResource, a as __disposeResources } from './cc-CL7GPi9B.js';

      class Bar {
          method() {
              const env = {
                  stack: [],
                  error: void 0,
                  hasError: false
              };
              try {
                  const getResource = ()=>{
                      return {
                          [Symbol.dispose]: ()=>{
                              console.log('Hooray!');
                          }
                      };
                  };
                  const resource = __addDisposableResource(env, getResource(), false);
                  console.log('using resource', resource);
              } catch (e) {
                  env.error = e;
                  env.hasError = true;
              } finally{
                  __disposeResources(env);
              }
          }
      }

      export { Bar };
      ",
        "cc-BU0zEyYq.js": "function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
          try {
              var info = gen[key](arg);
              var value = info.value;
          } catch (error) {
              reject(error);
              return;
          }
          if (info.done) resolve(value);
          else Promise.resolve(value).then(_next, _throw);
      }
      function _async_to_generator(fn) {
          return function() {
              var self = this, args = arguments;
              return new Promise(function(resolve, reject) {
                  var gen = fn.apply(self, args);
                  function _next(value) {
                      asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
                  }
                  function _throw(err) {
                      asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
                  }
                  _next(undefined);
              });
          };
      }

      export { _async_to_generator as _ };
      ",
        "cc-CJkp5Pfh.js": "function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
          try {
              var info = gen[key](arg);
              var value = info.value;
          } catch (error) {
              reject(error);
              return;
          }
          if (info.done) resolve(value);
          else Promise.resolve(value).then(_next, _throw);
      }
      function _async_to_generator(fn) {
          return function() {
              var self = this, args = arguments;
              return new Promise(function(resolve, reject) {
                  var gen = fn.apply(self, args);
                  function _next(value) {
                      asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
                  }
                  function _throw(err) {
                      asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
                  }
                  _next(undefined);
              });
          };
      }

      function _extends() {
          _extends = Object.assign || function assign(target) {
              for(var i = 1; i < arguments.length; i++){
                  var source = arguments[i];
                  for(var key in source)if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
              }
              return target;
          };
          return _extends.apply(this, arguments);
      }

      export { _async_to_generator as _, _extends as a };
      ",
        "cc-CL7GPi9B.js": "function __addDisposableResource(env, value, async) {
          if (value !== null && value !== void 0) {
              if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
              var dispose, inner;
              if (async) {
                  if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
                  dispose = value[Symbol.asyncDispose];
              }
              if (dispose === void 0) {
                  if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
                  dispose = value[Symbol.dispose];
                  if (async) inner = dispose;
              }
              if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
              if (inner) dispose = function() {
                  try {
                      inner.call(this);
                  } catch (e) {
                      return Promise.reject(e);
                  }
              };
              env.stack.push({
                  value: value,
                  dispose: dispose,
                  async: async
              });
          } else if (async) {
              env.stack.push({
                  async: true
              });
          }
          return value;
      }
      var _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
          var e = new Error(message);
          return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
      };
      function __disposeResources(env) {
          function fail(e) {
              env.error = env.hasError ? new _SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
              env.hasError = true;
          }
          var r, s = 0;
          function next() {
              while(r = env.stack.pop()){
                  try {
                      if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                      if (r.dispose) {
                          var result = r.dispose.call(r.value);
                          if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
                              fail(e);
                              return next();
                          });
                      } else s |= 1;
                  } catch (e) {
                      fail(e);
                  }
              }
              if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
              if (env.hasError) throw env.error;
          }
          return next();
      }

      export { __addDisposableResource as _, __disposeResources as a };
      ",
        "cc-CTtQaxE0.cjs": "function __addDisposableResource(env, value, async) {
          if (value !== null && value !== void 0) {
              if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
              var dispose, inner;
              if (async) {
                  if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
                  dispose = value[Symbol.asyncDispose];
              }
              if (dispose === void 0) {
                  if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
                  dispose = value[Symbol.dispose];
                  if (async) inner = dispose;
              }
              if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
              if (inner) dispose = function() {
                  try {
                      inner.call(this);
                  } catch (e) {
                      return Promise.reject(e);
                  }
              };
              env.stack.push({
                  value: value,
                  dispose: dispose,
                  async: async
              });
          } else if (async) {
              env.stack.push({
                  async: true
              });
          }
          return value;
      }
      var _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
          var e = new Error(message);
          return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
      };
      function __disposeResources(env) {
          function fail(e) {
              env.error = env.hasError ? new _SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
              env.hasError = true;
          }
          var r, s = 0;
          function next() {
              while(r = env.stack.pop()){
                  try {
                      if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                      if (r.dispose) {
                          var result = r.dispose.call(r.value);
                          if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
                              fail(e);
                              return next();
                          });
                      } else s |= 1;
                  } catch (e) {
                      fail(e);
                  }
              }
              if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
              if (env.hasError) throw env.error;
          }
          return next();
      }

      exports.__addDisposableResource = __addDisposableResource;
      exports.__disposeResources = __disposeResources;
      ",
        "cc-CjnJhNSE.cjs": "function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
          try {
              var info = gen[key](arg);
              var value = info.value;
          } catch (error) {
              reject(error);
              return;
          }
          if (info.done) resolve(value);
          else Promise.resolve(value).then(_next, _throw);
      }
      function _async_to_generator(fn) {
          return function() {
              var self = this, args = arguments;
              return new Promise(function(resolve, reject) {
                  var gen = fn.apply(self, args);
                  function _next(value) {
                      asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
                  }
                  function _throw(err) {
                      asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
                  }
                  _next(undefined);
              });
          };
      }

      function _extends() {
          _extends = Object.assign || function assign(target) {
              for(var i = 1; i < arguments.length; i++){
                  var source = arguments[i];
                  for(var key in source)if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
              }
              return target;
          };
          return _extends.apply(this, arguments);
      }

      exports._async_to_generator = _async_to_generator;
      exports._extends = _extends;
      ",
        "foo.js": "import { _ as _async_to_generator } from './cc-BU0zEyYq.js';

      class Foo {
          foo() {
              return _async_to_generator(function*() {
                  return 'async-foo';
              })();
          }
      }

      export { Foo };
      ",
        "index.cjs": "var cc = require('./cc-CjnJhNSE.cjs');

      class Index {
          method() {
              return cc._async_to_generator(function*() {
                  const x = {
                      a: 1
                  };
                  const y = {
                      b: 2
                  };
                  const z = cc._extends({}, x, y);
                  console.log(z, Object.assign({}, x, y));
              })();
          }
      }

      exports.Index = Index;
      ",
        "index.js": "import { _ as _async_to_generator, a as _extends } from './cc-CJkp5Pfh.js';

      class Index {
          method() {
              return _async_to_generator(function*() {
                  const x = {
                      a: 1
                  };
                  const y = {
                      b: 2
                  };
                  const z = _extends({}, x, y);
                  console.log(z, Object.assign({}, x, y));
              })();
          }
      }

      export { Index };
      ",
      }
    `)
  })
})
