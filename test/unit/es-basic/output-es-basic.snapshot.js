<<<<<<< HEAD:test/unit/es-basic/output-es-basic.snapshot.js
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
  try {
    var info = gen[key](arg);
    var value = info.value;
  } catch (error) {
    reject(error);
    return;
  }

  if (info.done) {
    resolve(value);
  } else {
    Promise.resolve(value).then(_next, _throw);
  }
}

function _asyncToGenerator(fn) {
  return function () {
    var self = this,
        args = arguments;
    return new Promise(function (resolve, reject) {
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

var id = 0;

function _classPrivateFieldLooseKey(name) {
  return "__private_" + id++ + "_" + name;
}

function _classPrivateFieldLooseBase(receiver, privateKey) {
  if (!Object.prototype.hasOwnProperty.call(receiver, privateKey)) {
    throw new TypeError("attempted to use private field on non-instance");
  }

  return receiver;
}

var runtime = {exports: {}};

/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

(function (module) {
var runtime = (function (exports) {

  var Op = Object.prototype;
  var hasOwn = Op.hasOwnProperty;
  var undefined$1; // More compressible than void 0.
  var $Symbol = typeof Symbol === "function" ? Symbol : {};
  var iteratorSymbol = $Symbol.iterator || "@@iterator";
  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  function define(obj, key, value) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
    return obj[key];
  }
  try {
    // IE 8 has a broken Object.defineProperty that only works on DOM objects.
    define({}, "");
  } catch (err) {
    define = function(obj, key, value) {
      return obj[key] = value;
    };
  }

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
    var generator = Object.create(protoGenerator.prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    generator._invoke = makeInvokeMethod(innerFn, self, context);

    return generator;
  }
  exports.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  // This is a polyfill for %IteratorPrototype% for environments that
  // don't natively support it.
  var IteratorPrototype = {};
  define(IteratorPrototype, iteratorSymbol, function () {
    return this;
  });

  var getProto = Object.getPrototypeOf;
  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
  if (NativeIteratorPrototype &&
      NativeIteratorPrototype !== Op &&
      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
    // This environment has a native %IteratorPrototype%; use it instead
    // of the polyfill.
    IteratorPrototype = NativeIteratorPrototype;
  }

  var Gp = GeneratorFunctionPrototype.prototype =
    Generator.prototype = Object.create(IteratorPrototype);
  GeneratorFunction.prototype = GeneratorFunctionPrototype;
  define(Gp, "constructor", GeneratorFunctionPrototype);
  define(GeneratorFunctionPrototype, "constructor", GeneratorFunction);
  GeneratorFunction.displayName = define(
    GeneratorFunctionPrototype,
    toStringTagSymbol,
    "GeneratorFunction"
  );

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      define(prototype, method, function(arg) {
        return this._invoke(method, arg);
      });
    });
  }

  exports.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  exports.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
      define(genFun, toStringTagSymbol, "GeneratorFunction");
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `hasOwn.call(value, "__await")` to determine if the yielded value is
  // meant to be awaited.
  exports.awrap = function(arg) {
    return { __await: arg };
  };

  function AsyncIterator(generator, PromiseImpl) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);
      if (record.type === "throw") {
        reject(record.arg);
      } else {
        var result = record.arg;
        var value = result.value;
        if (value &&
            typeof value === "object" &&
            hasOwn.call(value, "__await")) {
          return PromiseImpl.resolve(value.__await).then(function(value) {
            invoke("next", value, resolve, reject);
          }, function(err) {
            invoke("throw", err, resolve, reject);
          });
        }

        return PromiseImpl.resolve(value).then(function(unwrapped) {
          // When a yielded Promise is resolved, its final value becomes
          // the .value of the Promise<{value,done}> result for the
          // current iteration.
          result.value = unwrapped;
          resolve(result);
        }, function(error) {
          // If a rejected Promise was yielded, throw the rejection back
          // into the async generator function so it can be handled there.
          return invoke("throw", error, resolve, reject);
        });
      }
    }

    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return new PromiseImpl(function(resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : callInvokeWithMethodAndArg();
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);
  define(AsyncIterator.prototype, asyncIteratorSymbol, function () {
    return this;
  });
  exports.AsyncIterator = AsyncIterator;

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  exports.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
    if (PromiseImpl === void 0) PromiseImpl = Promise;

    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList),
      PromiseImpl
    );

    return exports.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      context.method = method;
      context.arg = arg;

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          var delegateResult = maybeInvokeDelegate(delegate, context);
          if (delegateResult) {
            if (delegateResult === ContinueSentinel) continue;
            return delegateResult;
          }
        }

        if (context.method === "next") {
          // Setting context._sent for legacy support of Babel's
          // function.sent implementation.
          context.sent = context._sent = context.arg;

        } else if (context.method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw context.arg;
          }

          context.dispatchException(context.arg);

        } else if (context.method === "return") {
          context.abrupt("return", context.arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          if (record.arg === ContinueSentinel) {
            continue;
          }

          return {
            value: record.arg,
            done: context.done
          };

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(context.arg) call above.
          context.method = "throw";
          context.arg = record.arg;
        }
      }
    };
  }

  // Call delegate.iterator[context.method](context.arg) and handle the
  // result, either by returning a { value, done } result from the
  // delegate iterator, or by modifying context.method and context.arg,
  // setting context.delegate to null, and returning the ContinueSentinel.
  function maybeInvokeDelegate(delegate, context) {
    var method = delegate.iterator[context.method];
    if (method === undefined$1) {
      // A .throw or .return when the delegate iterator has no .throw
      // method always terminates the yield* loop.
      context.delegate = null;

      if (context.method === "throw") {
        // Note: ["return"] must be used for ES3 parsing compatibility.
        if (delegate.iterator["return"]) {
          // If the delegate iterator has a return method, give it a
          // chance to clean up.
          context.method = "return";
          context.arg = undefined$1;
          maybeInvokeDelegate(delegate, context);

          if (context.method === "throw") {
            // If maybeInvokeDelegate(context) changed context.method from
            // "return" to "throw", let that override the TypeError below.
=======
// Jest Snapshot v1, https://goo.gl/fbAQLP

exports[`should compile es-advance case correctly 1`] = `
"var foo = {
    bar: \\"hello\\"
};
console.log(\\"bar\\", foo === null || foo === void 0 ? void 0 : foo.bar);
var _bar;
var prop = (_bar = foo.bar) !== null && _bar !== void 0 ? _bar : \\"default\\";
console.log(\\"name\\", prop);
//# sourceMappingURL=bundle.js.map
"
`;

exports[`should compile es-basic case correctly 1`] = `
"var runtime = {exports: {}};

function _instanceof(left, right) {
    if (right != null && typeof Symbol !== \\"undefined\\" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else {
        return left instanceof right;
    }
}
(function(module) {
    var runtime = function(exports) {
        var define = function define(obj, key, value) {
            Object.defineProperty(obj, key, {
                value: value,
                enumerable: true,
                configurable: true,
                writable: true
            });
            return obj[key];
        };
        var wrap = function wrap(innerFn, outerFn, self, tryLocsList) {
            // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
            var protoGenerator = outerFn && _instanceof(outerFn.prototype, Generator) ? outerFn : Generator;
            var generator = Object.create(protoGenerator.prototype);
            var context = new Context(tryLocsList || []);
            // The ._invoke method unifies the implementations of the .next,
            // .throw, and .return methods.
            generator._invoke = makeInvokeMethod(innerFn, self, context);
            return generator;
        };
        var tryCatch = // Try/catch helper to minimize deoptimizations. Returns a completion
        // record like context.tryEntries[i].completion. This interface could
        // have been (and was previously) designed to take a closure to be
        // invoked without arguments, but in all the cases we care about we
        // already have an existing method we want to call, so there's no need
        // to create a new function object. We can even get away with assuming
        // the method takes exactly one argument, since that happens to be true
        // in every case, so we don't have to touch the arguments object. The
        // only additional allocation required is the completion record, which
        // has a stable shape and so hopefully should be cheap to allocate.
        function tryCatch(fn, obj, arg) {
            try {
                return {
                    type: \\"normal\\",
                    arg: fn.call(obj, arg)
                };
            } catch (err) {
                return {
                    type: \\"throw\\",
                    arg: err
                };
            }
        };
        var Generator = // Dummy constructor functions that we use as the .constructor and
        // .constructor.prototype properties for functions that return Generator
        // objects. For full spec compliance, you may wish to configure your
        // minifier not to mangle the names of these two functions.
        function Generator() {};
        var GeneratorFunction = function GeneratorFunction() {};
        var GeneratorFunctionPrototype = function GeneratorFunctionPrototype() {};
        var defineIteratorMethods = // Helper for defining the .next, .throw, and .return methods of the
        // Iterator interface in terms of a single ._invoke method.
        function defineIteratorMethods(prototype) {
            [
                \\"next\\",
                \\"throw\\",
                \\"return\\"
            ].forEach(function(method) {
                define(prototype, method, function(arg) {
                    return this._invoke(method, arg);
                });
            });
        };
        var AsyncIterator = function AsyncIterator(generator, PromiseImpl) {
            function invoke(method, arg, resolve, reject) {
                var record = tryCatch(generator[method], generator, arg);
                if (record.type === \\"throw\\") {
                    reject(record.arg);
                } else {
                    var result = record.arg;
                    var value1 = result.value;
                    if (value1 && typeof value1 === \\"object\\" && hasOwn.call(value1, \\"__await\\")) {
                        return PromiseImpl.resolve(value1.__await).then(function(value) {
                            invoke(\\"next\\", value, resolve, reject);
                        }, function(err) {
                            invoke(\\"throw\\", err, resolve, reject);
                        });
                    }
                    return PromiseImpl.resolve(value1).then(function(unwrapped) {
                        // When a yielded Promise is resolved, its final value becomes
                        // the .value of the Promise<{value,done}> result for the
                        // current iteration.
                        result.value = unwrapped;
                        resolve(result);
                    }, function(error) {
                        // If a rejected Promise was yielded, throw the rejection back
                        // into the async generator function so it can be handled there.
                        return invoke(\\"throw\\", error, resolve, reject);
                    });
                }
            }
            var previousPromise;
            function enqueue(method, arg) {
                function callInvokeWithMethodAndArg() {
                    return new PromiseImpl(function(resolve, reject) {
                        invoke(method, arg, resolve, reject);
                    });
                }
                return previousPromise = // If enqueue has been called before, then we want to wait until
                // all previous Promises have been resolved before calling invoke,
                // so that results are always delivered in the correct order. If
                // enqueue has not been called before, then it is important to
                // call invoke immediately, without waiting on a callback to fire,
                // so that the async generator function has the opportunity to do
                // any necessary setup in a predictable way. This predictability
                // is why the Promise constructor synchronously invokes its
                // executor callback, and why async functions synchronously
                // execute code before the first await. Since we implement simple
                // async functions in terms of async generators, it is especially
                // important to get this right, even though it requires care.
                previousPromise ? previousPromise.then(callInvokeWithMethodAndArg, // Avoid propagating failures to Promises returned by later
                // invocations of the iterator.
                callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg();
            }
            // Define the unified helper method that is used to implement .next,
            // .throw, and .return (see defineIteratorMethods).
            this._invoke = enqueue;
        };
        var makeInvokeMethod = function makeInvokeMethod(innerFn, self, context) {
            var state = GenStateSuspendedStart;
            return function invoke(method, arg) {
                if (state === GenStateExecuting) {
                    throw new Error(\\"Generator is already running\\");
                }
                if (state === GenStateCompleted) {
                    if (method === \\"throw\\") {
                        throw arg;
                    }
                    // Be forgiving, per 25.3.3.3.3 of the spec:
                    // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
                    return doneResult();
                }
                context.method = method;
                context.arg = arg;
                while(true){
                    var delegate = context.delegate;
                    if (delegate) {
                        var delegateResult = maybeInvokeDelegate(delegate, context);
                        if (delegateResult) {
                            if (delegateResult === ContinueSentinel) continue;
                            return delegateResult;
                        }
                    }
                    if (context.method === \\"next\\") {
                        // Setting context._sent for legacy support of Babel's
                        // function.sent implementation.
                        context.sent = context._sent = context.arg;
                    } else if (context.method === \\"throw\\") {
                        if (state === GenStateSuspendedStart) {
                            state = GenStateCompleted;
                            throw context.arg;
                        }
                        context.dispatchException(context.arg);
                    } else if (context.method === \\"return\\") {
                        context.abrupt(\\"return\\", context.arg);
                    }
                    state = GenStateExecuting;
                    var record = tryCatch(innerFn, self, context);
                    if (record.type === \\"normal\\") {
                        // If an exception is thrown from innerFn, we leave state ===
                        // GenStateExecuting and loop back for another invocation.
                        state = context.done ? GenStateCompleted : GenStateSuspendedYield;
                        if (record.arg === ContinueSentinel) {
                            continue;
                        }
                        return {
                            value: record.arg,
                            done: context.done
                        };
                    } else if (record.type === \\"throw\\") {
                        state = GenStateCompleted;
                        // Dispatch the exception by looping back around to the
                        // context.dispatchException(context.arg) call above.
                        context.method = \\"throw\\";
                        context.arg = record.arg;
                    }
                }
            };
        };
        var pushTryEntry = function pushTryEntry(locs) {
            var entry = {
                tryLoc: locs[0]
            };
            if (1 in locs) {
                entry.catchLoc = locs[1];
            }
            if (2 in locs) {
                entry.finallyLoc = locs[2];
                entry.afterLoc = locs[3];
            }
            this.tryEntries.push(entry);
        };
        var resetTryEntry = function resetTryEntry(entry) {
            var record = entry.completion || {};
            record.type = \\"normal\\";
            delete record.arg;
            entry.completion = record;
        };
        var Context = function Context(tryLocsList) {
            // The root entry object (effectively a try statement without a catch
            // or a finally block) gives us a place to store values thrown from
            // locations where there is no enclosing try statement.
            this.tryEntries = [
                {
                    tryLoc: \\"root\\"
                }
            ];
            tryLocsList.forEach(pushTryEntry, this);
            this.reset(true);
        };
        var values = function values(iterable) {
            if (iterable) {
                var iteratorMethod = iterable[iteratorSymbol];
                if (iteratorMethod) {
                    return iteratorMethod.call(iterable);
                }
                if (typeof iterable.next === \\"function\\") {
                    return iterable;
                }
                if (!isNaN(iterable.length)) {
                    var i = -1, next1 = function next() {
                        while(++i < iterable.length){
                            if (hasOwn.call(iterable, i)) {
                                next.value = iterable[i];
                                next.done = false;
                                return next;
                            }
                        }
                        next.value = undefined$1;
                        next.done = true;
                        return next;
                    };
                    return next1.next = next1;
                }
            }
            // Return an iterator with no values.
            return {
                next: doneResult
            };
        };
        var doneResult = function doneResult() {
            return {
                value: undefined$1,
                done: true
            };
        };
        var Op = Object.prototype;
        var hasOwn = Op.hasOwnProperty;
        var undefined$1; // More compressible than void 0.
        var $Symbol = typeof Symbol === \\"function\\" ? Symbol : {};
        var iteratorSymbol = $Symbol.iterator || \\"@@iterator\\";
        var asyncIteratorSymbol = $Symbol.asyncIterator || \\"@@asyncIterator\\";
        var toStringTagSymbol = $Symbol.toStringTag || \\"@@toStringTag\\";
        try {
            // IE 8 has a broken Object.defineProperty that only works on DOM objects.
            define({}, \\"\\");
        } catch (err) {
            define = function define(obj, key, value) {
                return obj[key] = value;
            };
        }
        exports.wrap = wrap;
        var GenStateSuspendedStart = \\"suspendedStart\\";
        var GenStateSuspendedYield = \\"suspendedYield\\";
        var GenStateExecuting = \\"executing\\";
        var GenStateCompleted = \\"completed\\";
        // Returning this object from the innerFn has the same effect as
        // breaking out of the dispatch switch statement.
        var ContinueSentinel = {};
        // This is a polyfill for %IteratorPrototype% for environments that
        // don't natively support it.
        var IteratorPrototype = {};
        define(IteratorPrototype, iteratorSymbol, function() {
            return this;
        });
        var getProto = Object.getPrototypeOf;
        var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
        if (NativeIteratorPrototype && NativeIteratorPrototype !== Op && hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
            // This environment has a native %IteratorPrototype%; use it instead
            // of the polyfill.
            IteratorPrototype = NativeIteratorPrototype;
        }
        var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(IteratorPrototype);
        GeneratorFunction.prototype = GeneratorFunctionPrototype;
        define(Gp, \\"constructor\\", GeneratorFunctionPrototype);
        define(GeneratorFunctionPrototype, \\"constructor\\", GeneratorFunction);
        GeneratorFunction.displayName = define(GeneratorFunctionPrototype, toStringTagSymbol, \\"GeneratorFunction\\");
        exports.isGeneratorFunction = function(genFun) {
            var ctor = typeof genFun === \\"function\\" && genFun.constructor;
            return ctor ? ctor === GeneratorFunction || // For the native GeneratorFunction constructor, the best we can
            // do is to check its .name property.
            (ctor.displayName || ctor.name) === \\"GeneratorFunction\\" : false;
        };
        exports.mark = function(genFun) {
            if (Object.setPrototypeOf) {
                Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
            } else {
                genFun.__proto__ = GeneratorFunctionPrototype;
                define(genFun, toStringTagSymbol, \\"GeneratorFunction\\");
            }
            genFun.prototype = Object.create(Gp);
            return genFun;
        };
        // Within the body of any async function, \`await x\` is transformed to
        // \`yield regeneratorRuntime.awrap(x)\`, so that the runtime can test
        // \`hasOwn.call(value, \\"__await\\")\` to determine if the yielded value is
        // meant to be awaited.
        exports.awrap = function(arg) {
            return {
                __await: arg
            };
        };
        defineIteratorMethods(AsyncIterator.prototype);
        define(AsyncIterator.prototype, asyncIteratorSymbol, function() {
            return this;
        });
        exports.AsyncIterator = AsyncIterator;
        // Note that simple async functions are implemented on top of
        // AsyncIterator objects; they just return a Promise for the value of
        // the final result produced by the iterator.
        exports.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
            if (PromiseImpl === void 0) PromiseImpl = Promise;
            var iter = new AsyncIterator(wrap(innerFn, outerFn, self, tryLocsList), PromiseImpl);
            return exports.isGeneratorFunction(outerFn) ? iter // If outerFn is a generator, return the full iterator.
             : iter.next().then(function(result) {
                return result.done ? result.value : iter.next();
            });
        };
        // Call delegate.iterator[context.method](context.arg) and handle the
        // result, either by returning a { value, done } result from the
        // delegate iterator, or by modifying context.method and context.arg,
        // setting context.delegate to null, and returning the ContinueSentinel.
        function maybeInvokeDelegate(delegate, context) {
            var method = delegate.iterator[context.method];
            if (method === undefined$1) {
                // A .throw or .return when the delegate iterator has no .throw
                // method always terminates the yield* loop.
                context.delegate = null;
                if (context.method === \\"throw\\") {
                    // Note: [\\"return\\"] must be used for ES3 parsing compatibility.
                    if (delegate.iterator[\\"return\\"]) {
                        // If the delegate iterator has a return method, give it a
                        // chance to clean up.
                        context.method = \\"return\\";
                        context.arg = undefined$1;
                        maybeInvokeDelegate(delegate, context);
                        if (context.method === \\"throw\\") {
                            // If maybeInvokeDelegate(context) changed context.method from
                            // \\"return\\" to \\"throw\\", let that override the TypeError below.
                            return ContinueSentinel;
                        }
                    }
                    context.method = \\"throw\\";
                    context.arg = new TypeError(\\"The iterator does not provide a 'throw' method\\");
                }
                return ContinueSentinel;
            }
            var record = tryCatch(method, delegate.iterator, context.arg);
            if (record.type === \\"throw\\") {
                context.method = \\"throw\\";
                context.arg = record.arg;
                context.delegate = null;
                return ContinueSentinel;
            }
            var info = record.arg;
            if (!info) {
                context.method = \\"throw\\";
                context.arg = new TypeError(\\"iterator result is not an object\\");
                context.delegate = null;
                return ContinueSentinel;
            }
            if (info.done) {
                // Assign the result of the finished delegate to the temporary
                // variable specified by delegate.resultName (see delegateYield).
                context[delegate.resultName] = info.value;
                // Resume execution at the desired location (see delegateYield).
                context.next = delegate.nextLoc;
                // If context.method was \\"throw\\" but the delegate handled the
                // exception, let the outer generator proceed normally. If
                // context.method was \\"next\\", forget context.arg since it has been
                // \\"consumed\\" by the delegate iterator. If context.method was
                // \\"return\\", allow the original .return call to continue in the
                // outer generator.
                if (context.method !== \\"return\\") {
                    context.method = \\"next\\";
                    context.arg = undefined$1;
                }
            } else {
                // Re-yield the result returned by the delegate method.
                return info;
            }
            // The delegate iterator is finished, so forget it and continue with
            // the outer generator.
            context.delegate = null;
>>>>>>> 487595a (use ts type):test/__snapshots__/compile.test.js.snap
            return ContinueSentinel;
        }
<<<<<<< HEAD:test/unit/es-basic/output-es-basic.snapshot.js

        context.method = "throw";
        context.arg = new TypeError(
          "The iterator does not provide a 'throw' method");
      }

      return ContinueSentinel;
    }

    var record = tryCatch(method, delegate.iterator, context.arg);

    if (record.type === "throw") {
      context.method = "throw";
      context.arg = record.arg;
      context.delegate = null;
      return ContinueSentinel;
=======
        // Define Generator.prototype.{next,throw,return} in terms of the
        // unified ._invoke helper method.
        defineIteratorMethods(Gp);
        define(Gp, toStringTagSymbol, \\"Generator\\");
        // A Generator should always return itself as the iterator object when the
        // @@iterator function is called on it. Some browsers' implementations of the
        // iterator prototype chain incorrectly implement this, causing the Generator
        // object to not be returned from this call. This ensures that doesn't happen.
        // See https://github.com/facebook/regenerator/issues/274 for more details.
        define(Gp, iteratorSymbol, function() {
            return this;
        });
        define(Gp, \\"toString\\", function() {
            return \\"[object Generator]\\";
        });
        exports.keys = function(object) {
            var keys = [];
            for(var key1 in object){
                keys.push(key1);
            }
            keys.reverse();
            // Rather than returning an object with a next method, we keep
            // things simple and return the next function itself.
            return function next() {
                while(keys.length){
                    var key = keys.pop();
                    if (key in object) {
                        next.value = key;
                        next.done = false;
                        return next;
                    }
                }
                // To avoid creating an additional object, we just hang the .value
                // and .done properties off the next function object itself. This
                // also ensures that the minifier will not anonymize the function.
                next.done = true;
                return next;
            };
        };
        exports.values = values;
        Context.prototype = {
            constructor: Context,
            reset: function reset(skipTempReset) {
                this.prev = 0;
                this.next = 0;
                // Resetting context._sent for legacy support of Babel's
                // function.sent implementation.
                this.sent = this._sent = undefined$1;
                this.done = false;
                this.delegate = null;
                this.method = \\"next\\";
                this.arg = undefined$1;
                this.tryEntries.forEach(resetTryEntry);
                if (!skipTempReset) {
                    for(var name in this){
                        // Not sure about the optimal order of these conditions:
                        if (name.charAt(0) === \\"t\\" && hasOwn.call(this, name) && !isNaN(+name.slice(1))) {
                            this[name] = undefined$1;
                        }
                    }
                }
            },
            stop: function stop() {
                this.done = true;
                var rootEntry = this.tryEntries[0];
                var rootRecord = rootEntry.completion;
                if (rootRecord.type === \\"throw\\") {
                    throw rootRecord.arg;
                }
                return this.rval;
            },
            dispatchException: function dispatchException(exception) {
                var handle = function handle(loc, caught) {
                    record.type = \\"throw\\";
                    record.arg = exception;
                    context.next = loc;
                    if (caught) {
                        // If the dispatched exception was caught by a catch block,
                        // then let that catch block handle the exception normally.
                        context.method = \\"next\\";
                        context.arg = undefined$1;
                    }
                    return !!caught;
                };
                if (this.done) {
                    throw exception;
                }
                var context = this;
                for(var i = this.tryEntries.length - 1; i >= 0; --i){
                    var entry = this.tryEntries[i];
                    var record = entry.completion;
                    if (entry.tryLoc === \\"root\\") {
                        // Exception thrown outside of any try block that could handle
                        // it, so set the completion value of the entire function to
                        // throw the exception.
                        return handle(\\"end\\");
                    }
                    if (entry.tryLoc <= this.prev) {
                        var hasCatch = hasOwn.call(entry, \\"catchLoc\\");
                        var hasFinally = hasOwn.call(entry, \\"finallyLoc\\");
                        if (hasCatch && hasFinally) {
                            if (this.prev < entry.catchLoc) {
                                return handle(entry.catchLoc, true);
                            } else if (this.prev < entry.finallyLoc) {
                                return handle(entry.finallyLoc);
                            }
                        } else if (hasCatch) {
                            if (this.prev < entry.catchLoc) {
                                return handle(entry.catchLoc, true);
                            }
                        } else if (hasFinally) {
                            if (this.prev < entry.finallyLoc) {
                                return handle(entry.finallyLoc);
                            }
                        } else {
                            throw new Error(\\"try statement without catch or finally\\");
                        }
                    }
                }
            },
            abrupt: function abrupt(type, arg) {
                for(var i = this.tryEntries.length - 1; i >= 0; --i){
                    var entry = this.tryEntries[i];
                    if (entry.tryLoc <= this.prev && hasOwn.call(entry, \\"finallyLoc\\") && this.prev < entry.finallyLoc) {
                        var finallyEntry = entry;
                        break;
                    }
                }
                if (finallyEntry && (type === \\"break\\" || type === \\"continue\\") && finallyEntry.tryLoc <= arg && arg <= finallyEntry.finallyLoc) {
                    // Ignore the finally entry if control is not jumping to a
                    // location outside the try/catch block.
                    finallyEntry = null;
                }
                var record = finallyEntry ? finallyEntry.completion : {};
                record.type = type;
                record.arg = arg;
                if (finallyEntry) {
                    this.method = \\"next\\";
                    this.next = finallyEntry.finallyLoc;
                    return ContinueSentinel;
                }
                return this.complete(record);
            },
            complete: function complete(record, afterLoc) {
                if (record.type === \\"throw\\") {
                    throw record.arg;
                }
                if (record.type === \\"break\\" || record.type === \\"continue\\") {
                    this.next = record.arg;
                } else if (record.type === \\"return\\") {
                    this.rval = this.arg = record.arg;
                    this.method = \\"return\\";
                    this.next = \\"end\\";
                } else if (record.type === \\"normal\\" && afterLoc) {
                    this.next = afterLoc;
                }
                return ContinueSentinel;
            },
            finish: function finish(finallyLoc) {
                for(var i = this.tryEntries.length - 1; i >= 0; --i){
                    var entry = this.tryEntries[i];
                    if (entry.finallyLoc === finallyLoc) {
                        this.complete(entry.completion, entry.afterLoc);
                        resetTryEntry(entry);
                        return ContinueSentinel;
                    }
                }
            },
            \\"catch\\": function(tryLoc) {
                for(var i = this.tryEntries.length - 1; i >= 0; --i){
                    var entry = this.tryEntries[i];
                    if (entry.tryLoc === tryLoc) {
                        var record = entry.completion;
                        if (record.type === \\"throw\\") {
                            var thrown = record.arg;
                            resetTryEntry(entry);
                        }
                        return thrown;
                    }
                }
                // The context.catch method must only be called with a location
                // argument that corresponds to a known catch block.
                throw new Error(\\"illegal catch attempt\\");
            },
            delegateYield: function delegateYield(iterable, resultName, nextLoc) {
                this.delegate = {
                    iterator: values(iterable),
                    resultName: resultName,
                    nextLoc: nextLoc
                };
                if (this.method === \\"next\\") {
                    // Deliberately forget the last sent value so that we don't
                    // accidentally pass it on to the delegate.
                    this.arg = undefined$1;
                }
                return ContinueSentinel;
            }
        };
        // Regardless of whether this script is executing as a CommonJS module
        // or not, return the runtime object so that we can declare the variable
        // regeneratorRuntime in the outer scope, which allows this module to be
        // injected easily by \`bin/regenerator --include-runtime script.js\`.
        return exports;
    }(// If this script is executing as a CommonJS module, use module.exports
    // as the regeneratorRuntime namespace. Otherwise create a new empty
    // object. Either way, the resulting object will be used to initialize
    // the regeneratorRuntime variable at the top of this file.
    module.exports );
    try {
        regeneratorRuntime = runtime;
    } catch (accidentalStrictMode) {
        // This module should not be running in strict mode, so the above
        // assignment should always work unless something is misconfigured. Just
        // in case runtime.js accidentally runs in strict mode, in modern engines
        // we can explicitly access globalThis. In older engines we can escape
        // strict mode using a global Function call. This could conceivably fail
        // if a Content Security Policy forbids using Function, but in that case
        // the proper solution is to fix the accidental strict mode problem. If
        // you've misconfigured your bundler to force strict mode and applied a
        // CSP to forbid Function, and you're not willing to fix either of those
        // problems, please detail your unique predicament in a GitHub issue.
        if (typeof globalThis === \\"object\\") {
            globalThis.regeneratorRuntime = runtime;
        } else {
            Function(\\"r\\", \\"regeneratorRuntime = r\\")(runtime);
        }
>>>>>>> 487595a (use ts type):test/__snapshots__/compile.test.js.snap
    }
})(runtime);
var regeneratorRuntime$1 = runtime.exports;

<<<<<<< HEAD:test/unit/es-basic/output-es-basic.snapshot.js
    var info = record.arg;

    if (! info) {
      context.method = "throw";
      context.arg = new TypeError("iterator result is not an object");
      context.delegate = null;
      return ContinueSentinel;
=======
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
>>>>>>> 487595a (use ts type):test/__snapshots__/compile.test.js.snap
    }
    if (info.done) {
<<<<<<< HEAD:test/unit/es-basic/output-es-basic.snapshot.js
      // Assign the result of the finished delegate to the temporary
      // variable specified by delegate.resultName (see delegateYield).
      context[delegate.resultName] = info.value;

      // Resume execution at the desired location (see delegateYield).
      context.next = delegate.nextLoc;

      // If context.method was "throw" but the delegate handled the
      // exception, let the outer generator proceed normally. If
      // context.method was "next", forget context.arg since it has been
      // "consumed" by the delegate iterator. If context.method was
      // "return", allow the original .return call to continue in the
      // outer generator.
      if (context.method !== "return") {
        context.method = "next";
        context.arg = undefined$1;
      }

=======
        resolve(value);
>>>>>>> 487595a (use ts type):test/__snapshots__/compile.test.js.snap
    } else {
        Promise.resolve(value).then(_next, _throw);
    }
<<<<<<< HEAD:test/unit/es-basic/output-es-basic.snapshot.js

    // The delegate iterator is finished, so forget it and continue with
    // the outer generator.
    context.delegate = null;
    return ContinueSentinel;
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  define(Gp, toStringTagSymbol, "Generator");

  // A Generator should always return itself as the iterator object when the
  // @@iterator function is called on it. Some browsers' implementations of the
  // iterator prototype chain incorrectly implement this, causing the Generator
  // object to not be returned from this call. This ensures that doesn't happen.
  // See https://github.com/facebook/regenerator/issues/274 for more details.
  define(Gp, iteratorSymbol, function() {
    return this;
  });

  define(Gp, "toString", function() {
    return "[object Generator]";
  });

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
=======
}
function _asyncToGenerator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, \\"next\\", value);
            }
            function _throw(err) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, \\"throw\\", err);
            }
            _next(undefined);
        });
    };
}
function _checkPrivateRedeclaration(obj, privateCollection) {
    if (privateCollection.has(obj)) {
        throw new TypeError(\\"Cannot initialize the same private elements twice on an object\\");
>>>>>>> 487595a (use ts type):test/__snapshots__/compile.test.js.snap
    }
}
function _classApplyDescriptorGet(receiver, descriptor) {
    if (descriptor.get) {
        return descriptor.get.call(receiver);
    }
<<<<<<< HEAD:test/unit/es-basic/output-es-basic.snapshot.js

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  exports.keys = function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined$1;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  exports.values = values;

  function doneResult() {
    return { value: undefined$1, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      // Resetting context._sent for legacy support of Babel's
      // function.sent implementation.
      this.sent = this._sent = undefined$1;
      this.done = false;
      this.delegate = null;

      this.method = "next";
      this.arg = undefined$1;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined$1;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;

        if (caught) {
          // If the dispatched exception was caught by a catch block,
          // then let that catch block handle the exception normally.
          context.method = "next";
          context.arg = undefined$1;
        }

        return !! caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.method = "next";
        this.next = finallyEntry.finallyLoc;
        return ContinueSentinel;
      }

      return this.complete(record);
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = this.arg = record.arg;
        this.method = "return";
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }

      return ContinueSentinel;
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      if (this.method === "next") {
        // Deliberately forget the last sent value so that we don't
        // accidentally pass it on to the delegate.
        this.arg = undefined$1;
      }

      return ContinueSentinel;
    }
  };

  // Regardless of whether this script is executing as a CommonJS module
  // or not, return the runtime object so that we can declare the variable
  // regeneratorRuntime in the outer scope, which allows this module to be
  // injected easily by `bin/regenerator --include-runtime script.js`.
  return exports;

}(
  // If this script is executing as a CommonJS module, use module.exports
  // as the regeneratorRuntime namespace. Otherwise create a new empty
  // object. Either way, the resulting object will be used to initialize
  // the regeneratorRuntime variable at the top of this file.
  module.exports 
));

try {
  regeneratorRuntime = runtime;
} catch (accidentalStrictMode) {
  // This module should not be running in strict mode, so the above
  // assignment should always work unless something is misconfigured. Just
  // in case runtime.js accidentally runs in strict mode, in modern engines
  // we can explicitly access globalThis. In older engines we can escape
  // strict mode using a global Function call. This could conceivably fail
  // if a Content Security Policy forbids using Function, but in that case
  // the proper solution is to fix the accidental strict mode problem. If
  // you've misconfigured your bundler to force strict mode and applied a
  // CSP to forbid Function, and you're not willing to fix either of those
  // problems, please detail your unique predicament in a GitHub issue.
  if (typeof globalThis === "object") {
    globalThis.regeneratorRuntime = runtime;
  } else {
    Function("r", "regeneratorRuntime = r")(runtime);
  }
}
}(runtime));

var regenerator = runtime.exports;

var _marked = /*#__PURE__*/regenerator.mark(generator);

function generator() {
  return regenerator.wrap(function generator$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.next = 2;
          return 1;

        case 2:
        case "end":
          return _context.stop();
      }
=======
    return descriptor.value;
}
function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError(\\"Cannot call a class as a function\\");
    }
}
function _classExtractFieldDescriptor(receiver, privateMap, action) {
    if (!privateMap.has(receiver)) {
        throw new TypeError(\\"attempted to \\" + action + \\" private field on non-instance\\");
    }
    return privateMap.get(receiver);
}
function _classPrivateFieldGet(receiver, privateMap) {
    var descriptor = _classExtractFieldDescriptor(receiver, privateMap, \\"get\\");
    return _classApplyDescriptorGet(receiver, descriptor);
}
function _classPrivateFieldInit(obj, privateMap, value) {
    _checkPrivateRedeclaration(obj, privateMap);
    privateMap.set(obj, value);
}
function _defineProperties(target, props) {
    for(var i = 0; i < props.length; i++){
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if (\\"value\\" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
    }
}
function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
}
function _defineProperty(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
>>>>>>> 487595a (use ts type):test/__snapshots__/compile.test.js.snap
    }
    return obj;
}
var _marked = regeneratorRuntime$1.mark(generator);
function generator() {
    return regeneratorRuntime$1.wrap(function generator$(_ctx) {
        while(1)switch(_ctx.prev = _ctx.next){
            case 0:
                _ctx.next = 2;
                return 1;
            case 2:
            case \\"end\\":
                return _ctx.stop();
        }
    }, _marked);
}
function asyncFunc() {
    return _asyncFunc.apply(this, arguments);
}
function _asyncFunc() {
<<<<<<< HEAD:test/unit/es-basic/output-es-basic.snapshot.js
  _asyncFunc = _asyncToGenerator( /*#__PURE__*/regenerator.mark(function _callee() {
    return regenerator.wrap(function _callee$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return new Promise(function (r) {
              return r(1);
            });

          case 2:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee);
  }));
  return _asyncFunc.apply(this, arguments);
}

var _x = /*#__PURE__*/_classPrivateFieldLooseKey("x");

var A = /*#__PURE__*/function () {
  function A() {
    var _this = this;

    Object.defineProperty(this, _x, {
      writable: true,
      value: 1
    });

    this.getX = function () {
      return _classPrivateFieldLooseBase(_this, _x)[_x];
    };
  }

  var _proto = A.prototype;
  _proto.f1 = /*#__PURE__*/regenerator.mark(function f1() {
    return regenerator.wrap(function f1$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return 1;

          case 2:
          case "end":
            return _context2.stop();
=======
    _asyncFunc = _asyncToGenerator(regeneratorRuntime$1.mark(function _callee() {
        return regeneratorRuntime$1.wrap(function _callee$(_ctx) {
            while(1)switch(_ctx.prev = _ctx.next){
                case 0:
                    _ctx.next = 2;
                    return new Promise(function(r) {
                        return r(1);
                    });
                case 2:
                case \\"end\\":
                    return _ctx.stop();
            }
        }, _callee);
    }));
    return _asyncFunc.apply(this, arguments);
}
var _x = /*#__PURE__*/ new WeakMap();
var A = /*#__PURE__*/ function() {
    function A() {
        var _this = this;
        _classCallCheck(this, A);
        _classPrivateFieldInit(this, _x, {
            writable: true,
            value: 1
        });
        _defineProperty(this, \\"getX\\", function() {
            return _classPrivateFieldGet(_this, _x);
        });
    }
    _createClass(A, [
        {
            key: \\"f1\\",
            value: regeneratorRuntime$1.mark(function f1() {
                return regeneratorRuntime$1.wrap(function f1$(_ctx) {
                    while(1)switch(_ctx.prev = _ctx.next){
                        case 0:
                            _ctx.next = 2;
                            return 1;
                        case 2:
                        case \\"end\\":
                            return _ctx.stop();
                    }
                }, f1);
            })
>>>>>>> 487595a (use ts type):test/__snapshots__/compile.test.js.snap
        }
    ]);
    return A;
}();
var _v = 123;
<<<<<<< HEAD:test/unit/es-basic/output-es-basic.snapshot.js
var x = function x() {
  return "value:" + _v;
=======
var x = function() {
    return \\"value:\\".concat(_v);
>>>>>>> 487595a (use ts type):test/__snapshots__/compile.test.js.snap
};

export { A, asyncFunc, generator, x };
//# sourceMappingURL=bundle.js.map
<<<<<<< HEAD:test/unit/es-basic/output-es-basic.snapshot.js
=======
"
`;

exports[`should compile jsx case correctly 1`] = `
"function Jsx() {
    return /*#__PURE__*/ React.createElement(React.Fragment, null, /*#__PURE__*/ React.createElement(\\"div\\", null, \\"hello\\"), /*#__PURE__*/ React.createElement(\\"h1\\", null, \\"yep\\"));
}

export { Jsx as default };
//# sourceMappingURL=bundle.js.map
"
`;

exports[`should compile module case correctly 1`] = `
"function _classCallCheck$1(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError(\\"Cannot call a class as a function\\");
    }
}
function _defineProperties$1(target, props) {
    for(var i = 0; i < props.length; i++){
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if (\\"value\\" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
    }
}
function _createClass$1(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties$1(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties$1(Constructor, staticProps);
    return Constructor;
}
var Parent = /*#__PURE__*/ function() {
    function Parent() {
        _classCallCheck$1(this, Parent);
    }
    _createClass$1(Parent, [
        {
            key: \\"f\\",
            value: function f() {
                return 1;
            }
        }
    ]);
    return Parent;
}();

function _assertThisInitialized(self) {
    if (self === void 0) {
        throw new ReferenceError(\\"this hasn't been initialised - super() hasn't been called\\");
    }
    return self;
}
function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError(\\"Cannot call a class as a function\\");
    }
}
function _defineProperties(target, props) {
    for(var i = 0; i < props.length; i++){
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if (\\"value\\" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
    }
}
function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
}
function _get(target1, property1, receiver1) {
    if (typeof Reflect !== \\"undefined\\" && Reflect.get) {
        _get = Reflect.get;
    } else {
        _get = function _get(target, property, receiver) {
            var base = _superPropBase(target, property);
            if (!base) return;
            var desc = Object.getOwnPropertyDescriptor(base, property);
            if (desc.get) {
                return desc.get.call(receiver);
            }
            return desc.value;
        };
    }
    return _get(target1, property1, receiver1 || target1);
}
function _getPrototypeOf(o1) {
    _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
        return o.__proto__ || Object.getPrototypeOf(o);
    };
    return _getPrototypeOf(o1);
}
function _inherits(subClass, superClass) {
    if (typeof superClass !== \\"function\\" && superClass !== null) {
        throw new TypeError(\\"Super expression must either be null or a function\\");
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, {
        constructor: {
            value: subClass,
            writable: true,
            configurable: true
        }
    });
    if (superClass) _setPrototypeOf(subClass, superClass);
}
function _possibleConstructorReturn(self, call) {
    if (call && (_typeof(call) === \\"object\\" || typeof call === \\"function\\")) {
        return call;
    }
    return _assertThisInitialized(self);
}
function _setPrototypeOf(o2, p1) {
    _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
        o.__proto__ = p;
        return o;
    };
    return _setPrototypeOf(o2, p1);
}
function _superPropBase(object, property) {
    while(!Object.prototype.hasOwnProperty.call(object, property)){
        object = _getPrototypeOf(object);
        if (object === null) break;
    }
    return object;
}
var _typeof = function(obj) {
    \\"@swc/helpers - typeof\\";
    return obj && typeof Symbol !== \\"undefined\\" && obj.constructor === Symbol ? \\"symbol\\" : typeof obj;
};
function _isNativeReflectConstruct() {
    if (typeof Reflect === \\"undefined\\" || !Reflect.construct) return false;
    if (Reflect.construct.sham) return false;
    if (typeof Proxy === \\"function\\") return true;
    try {
        Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
        return true;
    } catch (e) {
        return false;
    }
}
function _createSuper(Derived) {
    var hasNativeReflectConstruct = _isNativeReflectConstruct();
    return function _createSuperInternal() {
        var Super = _getPrototypeOf(Derived), result;
        if (hasNativeReflectConstruct) {
            var NewTarget = _getPrototypeOf(this).constructor;
            result = Reflect.construct(Super, arguments, NewTarget);
        } else {
            result = Super.apply(this, arguments);
        }
        return _possibleConstructorReturn(this, result);
    };
}
var A = /*#__PURE__*/ function(Parent1) {
    _inherits(A, Parent1);
    var _super = _createSuper(A);
    function A() {
        _classCallCheck(this, A);
        return _super.call(this);
    }
    _createClass(A, [
        {
            key: \\"x\\",
            get: function get() {
                return _get(_getPrototypeOf(A.prototype), \\"f\\", this).call(this);
            }
        }
    ]);
    return A;
}(Parent);
var a = new A();

console.log(\\"main\\", a.x);
//# sourceMappingURL=bundle.js.map
"
`;

exports[`should compile shebang case correctly 1`] = `
"#!/usr/bin/env node
console.log(\\"shebang\\");
//# sourceMappingURL=bundle.js.map
"
`;

exports[`should compile sub-folder-import case correctly 1`] = `
"import ms from 'ms/index';

function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _arrayWithoutHoles(arr) {
    if (Array.isArray(arr)) return _arrayLikeToArray(arr);
}
function _iterableToArray(iter) {
    if (typeof Symbol !== \\"undefined\\" && iter[Symbol.iterator] != null || iter[\\"@@iterator\\"] != null) return Array.from(iter);
}
function _nonIterableSpread() {
    throw new TypeError(\\"Invalid attempt to spread non-iterable instance.\\\\\\\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.\\");
}
function _toConsumableArray(arr) {
    return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
}
function _unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === \\"string\\") return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === \\"Object\\" && o.constructor) n = o.constructor.name;
    if (n === \\"Map\\" || n === \\"Set\\") return Array.from(n);
    if (n === \\"Arguments\\" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
}
function input() {
    for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
        args[_key] = arguments[_key];
    }
    return ms.apply(void 0, _toConsumableArray(args));
}

export { input as default };
//# sourceMappingURL=bundle.js.map
"
`;

exports[`should compile ts-basic case correctly 1`] = `
"var runtime = {exports: {}};

function _instanceof(left, right) {
    if (right != null && typeof Symbol !== \\"undefined\\" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else {
        return left instanceof right;
    }
}
(function(module) {
    var runtime = function(exports) {
        var define = function define(obj, key, value) {
            Object.defineProperty(obj, key, {
                value: value,
                enumerable: true,
                configurable: true,
                writable: true
            });
            return obj[key];
        };
        var wrap = function wrap(innerFn, outerFn, self, tryLocsList) {
            // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
            var protoGenerator = outerFn && _instanceof(outerFn.prototype, Generator) ? outerFn : Generator;
            var generator = Object.create(protoGenerator.prototype);
            var context = new Context(tryLocsList || []);
            // The ._invoke method unifies the implementations of the .next,
            // .throw, and .return methods.
            generator._invoke = makeInvokeMethod(innerFn, self, context);
            return generator;
        };
        var tryCatch = // Try/catch helper to minimize deoptimizations. Returns a completion
        // record like context.tryEntries[i].completion. This interface could
        // have been (and was previously) designed to take a closure to be
        // invoked without arguments, but in all the cases we care about we
        // already have an existing method we want to call, so there's no need
        // to create a new function object. We can even get away with assuming
        // the method takes exactly one argument, since that happens to be true
        // in every case, so we don't have to touch the arguments object. The
        // only additional allocation required is the completion record, which
        // has a stable shape and so hopefully should be cheap to allocate.
        function tryCatch(fn, obj, arg) {
            try {
                return {
                    type: \\"normal\\",
                    arg: fn.call(obj, arg)
                };
            } catch (err) {
                return {
                    type: \\"throw\\",
                    arg: err
                };
            }
        };
        var Generator = // Dummy constructor functions that we use as the .constructor and
        // .constructor.prototype properties for functions that return Generator
        // objects. For full spec compliance, you may wish to configure your
        // minifier not to mangle the names of these two functions.
        function Generator() {};
        var GeneratorFunction = function GeneratorFunction() {};
        var GeneratorFunctionPrototype = function GeneratorFunctionPrototype() {};
        var defineIteratorMethods = // Helper for defining the .next, .throw, and .return methods of the
        // Iterator interface in terms of a single ._invoke method.
        function defineIteratorMethods(prototype) {
            [
                \\"next\\",
                \\"throw\\",
                \\"return\\"
            ].forEach(function(method) {
                define(prototype, method, function(arg) {
                    return this._invoke(method, arg);
                });
            });
        };
        var AsyncIterator = function AsyncIterator(generator, PromiseImpl) {
            function invoke(method, arg, resolve, reject) {
                var record = tryCatch(generator[method], generator, arg);
                if (record.type === \\"throw\\") {
                    reject(record.arg);
                } else {
                    var result = record.arg;
                    var value1 = result.value;
                    if (value1 && typeof value1 === \\"object\\" && hasOwn.call(value1, \\"__await\\")) {
                        return PromiseImpl.resolve(value1.__await).then(function(value) {
                            invoke(\\"next\\", value, resolve, reject);
                        }, function(err) {
                            invoke(\\"throw\\", err, resolve, reject);
                        });
                    }
                    return PromiseImpl.resolve(value1).then(function(unwrapped) {
                        // When a yielded Promise is resolved, its final value becomes
                        // the .value of the Promise<{value,done}> result for the
                        // current iteration.
                        result.value = unwrapped;
                        resolve(result);
                    }, function(error) {
                        // If a rejected Promise was yielded, throw the rejection back
                        // into the async generator function so it can be handled there.
                        return invoke(\\"throw\\", error, resolve, reject);
                    });
                }
            }
            var previousPromise;
            function enqueue(method, arg) {
                function callInvokeWithMethodAndArg() {
                    return new PromiseImpl(function(resolve, reject) {
                        invoke(method, arg, resolve, reject);
                    });
                }
                return previousPromise = // If enqueue has been called before, then we want to wait until
                // all previous Promises have been resolved before calling invoke,
                // so that results are always delivered in the correct order. If
                // enqueue has not been called before, then it is important to
                // call invoke immediately, without waiting on a callback to fire,
                // so that the async generator function has the opportunity to do
                // any necessary setup in a predictable way. This predictability
                // is why the Promise constructor synchronously invokes its
                // executor callback, and why async functions synchronously
                // execute code before the first await. Since we implement simple
                // async functions in terms of async generators, it is especially
                // important to get this right, even though it requires care.
                previousPromise ? previousPromise.then(callInvokeWithMethodAndArg, // Avoid propagating failures to Promises returned by later
                // invocations of the iterator.
                callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg();
            }
            // Define the unified helper method that is used to implement .next,
            // .throw, and .return (see defineIteratorMethods).
            this._invoke = enqueue;
        };
        var makeInvokeMethod = function makeInvokeMethod(innerFn, self, context) {
            var state = GenStateSuspendedStart;
            return function invoke(method, arg) {
                if (state === GenStateExecuting) {
                    throw new Error(\\"Generator is already running\\");
                }
                if (state === GenStateCompleted) {
                    if (method === \\"throw\\") {
                        throw arg;
                    }
                    // Be forgiving, per 25.3.3.3.3 of the spec:
                    // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
                    return doneResult();
                }
                context.method = method;
                context.arg = arg;
                while(true){
                    var delegate = context.delegate;
                    if (delegate) {
                        var delegateResult = maybeInvokeDelegate(delegate, context);
                        if (delegateResult) {
                            if (delegateResult === ContinueSentinel) continue;
                            return delegateResult;
                        }
                    }
                    if (context.method === \\"next\\") {
                        // Setting context._sent for legacy support of Babel's
                        // function.sent implementation.
                        context.sent = context._sent = context.arg;
                    } else if (context.method === \\"throw\\") {
                        if (state === GenStateSuspendedStart) {
                            state = GenStateCompleted;
                            throw context.arg;
                        }
                        context.dispatchException(context.arg);
                    } else if (context.method === \\"return\\") {
                        context.abrupt(\\"return\\", context.arg);
                    }
                    state = GenStateExecuting;
                    var record = tryCatch(innerFn, self, context);
                    if (record.type === \\"normal\\") {
                        // If an exception is thrown from innerFn, we leave state ===
                        // GenStateExecuting and loop back for another invocation.
                        state = context.done ? GenStateCompleted : GenStateSuspendedYield;
                        if (record.arg === ContinueSentinel) {
                            continue;
                        }
                        return {
                            value: record.arg,
                            done: context.done
                        };
                    } else if (record.type === \\"throw\\") {
                        state = GenStateCompleted;
                        // Dispatch the exception by looping back around to the
                        // context.dispatchException(context.arg) call above.
                        context.method = \\"throw\\";
                        context.arg = record.arg;
                    }
                }
            };
        };
        var pushTryEntry = function pushTryEntry(locs) {
            var entry = {
                tryLoc: locs[0]
            };
            if (1 in locs) {
                entry.catchLoc = locs[1];
            }
            if (2 in locs) {
                entry.finallyLoc = locs[2];
                entry.afterLoc = locs[3];
            }
            this.tryEntries.push(entry);
        };
        var resetTryEntry = function resetTryEntry(entry) {
            var record = entry.completion || {};
            record.type = \\"normal\\";
            delete record.arg;
            entry.completion = record;
        };
        var Context = function Context(tryLocsList) {
            // The root entry object (effectively a try statement without a catch
            // or a finally block) gives us a place to store values thrown from
            // locations where there is no enclosing try statement.
            this.tryEntries = [
                {
                    tryLoc: \\"root\\"
                }
            ];
            tryLocsList.forEach(pushTryEntry, this);
            this.reset(true);
        };
        var values = function values(iterable) {
            if (iterable) {
                var iteratorMethod = iterable[iteratorSymbol];
                if (iteratorMethod) {
                    return iteratorMethod.call(iterable);
                }
                if (typeof iterable.next === \\"function\\") {
                    return iterable;
                }
                if (!isNaN(iterable.length)) {
                    var i = -1, next1 = function next() {
                        while(++i < iterable.length){
                            if (hasOwn.call(iterable, i)) {
                                next.value = iterable[i];
                                next.done = false;
                                return next;
                            }
                        }
                        next.value = undefined$1;
                        next.done = true;
                        return next;
                    };
                    return next1.next = next1;
                }
            }
            // Return an iterator with no values.
            return {
                next: doneResult
            };
        };
        var doneResult = function doneResult() {
            return {
                value: undefined$1,
                done: true
            };
        };
        var Op = Object.prototype;
        var hasOwn = Op.hasOwnProperty;
        var undefined$1; // More compressible than void 0.
        var $Symbol = typeof Symbol === \\"function\\" ? Symbol : {};
        var iteratorSymbol = $Symbol.iterator || \\"@@iterator\\";
        var asyncIteratorSymbol = $Symbol.asyncIterator || \\"@@asyncIterator\\";
        var toStringTagSymbol = $Symbol.toStringTag || \\"@@toStringTag\\";
        try {
            // IE 8 has a broken Object.defineProperty that only works on DOM objects.
            define({}, \\"\\");
        } catch (err) {
            define = function define(obj, key, value) {
                return obj[key] = value;
            };
        }
        exports.wrap = wrap;
        var GenStateSuspendedStart = \\"suspendedStart\\";
        var GenStateSuspendedYield = \\"suspendedYield\\";
        var GenStateExecuting = \\"executing\\";
        var GenStateCompleted = \\"completed\\";
        // Returning this object from the innerFn has the same effect as
        // breaking out of the dispatch switch statement.
        var ContinueSentinel = {};
        // This is a polyfill for %IteratorPrototype% for environments that
        // don't natively support it.
        var IteratorPrototype = {};
        define(IteratorPrototype, iteratorSymbol, function() {
            return this;
        });
        var getProto = Object.getPrototypeOf;
        var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
        if (NativeIteratorPrototype && NativeIteratorPrototype !== Op && hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
            // This environment has a native %IteratorPrototype%; use it instead
            // of the polyfill.
            IteratorPrototype = NativeIteratorPrototype;
        }
        var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(IteratorPrototype);
        GeneratorFunction.prototype = GeneratorFunctionPrototype;
        define(Gp, \\"constructor\\", GeneratorFunctionPrototype);
        define(GeneratorFunctionPrototype, \\"constructor\\", GeneratorFunction);
        GeneratorFunction.displayName = define(GeneratorFunctionPrototype, toStringTagSymbol, \\"GeneratorFunction\\");
        exports.isGeneratorFunction = function(genFun) {
            var ctor = typeof genFun === \\"function\\" && genFun.constructor;
            return ctor ? ctor === GeneratorFunction || // For the native GeneratorFunction constructor, the best we can
            // do is to check its .name property.
            (ctor.displayName || ctor.name) === \\"GeneratorFunction\\" : false;
        };
        exports.mark = function(genFun) {
            if (Object.setPrototypeOf) {
                Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
            } else {
                genFun.__proto__ = GeneratorFunctionPrototype;
                define(genFun, toStringTagSymbol, \\"GeneratorFunction\\");
            }
            genFun.prototype = Object.create(Gp);
            return genFun;
        };
        // Within the body of any async function, \`await x\` is transformed to
        // \`yield regeneratorRuntime.awrap(x)\`, so that the runtime can test
        // \`hasOwn.call(value, \\"__await\\")\` to determine if the yielded value is
        // meant to be awaited.
        exports.awrap = function(arg) {
            return {
                __await: arg
            };
        };
        defineIteratorMethods(AsyncIterator.prototype);
        define(AsyncIterator.prototype, asyncIteratorSymbol, function() {
            return this;
        });
        exports.AsyncIterator = AsyncIterator;
        // Note that simple async functions are implemented on top of
        // AsyncIterator objects; they just return a Promise for the value of
        // the final result produced by the iterator.
        exports.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
            if (PromiseImpl === void 0) PromiseImpl = Promise;
            var iter = new AsyncIterator(wrap(innerFn, outerFn, self, tryLocsList), PromiseImpl);
            return exports.isGeneratorFunction(outerFn) ? iter // If outerFn is a generator, return the full iterator.
             : iter.next().then(function(result) {
                return result.done ? result.value : iter.next();
            });
        };
        // Call delegate.iterator[context.method](context.arg) and handle the
        // result, either by returning a { value, done } result from the
        // delegate iterator, or by modifying context.method and context.arg,
        // setting context.delegate to null, and returning the ContinueSentinel.
        function maybeInvokeDelegate(delegate, context) {
            var method = delegate.iterator[context.method];
            if (method === undefined$1) {
                // A .throw or .return when the delegate iterator has no .throw
                // method always terminates the yield* loop.
                context.delegate = null;
                if (context.method === \\"throw\\") {
                    // Note: [\\"return\\"] must be used for ES3 parsing compatibility.
                    if (delegate.iterator[\\"return\\"]) {
                        // If the delegate iterator has a return method, give it a
                        // chance to clean up.
                        context.method = \\"return\\";
                        context.arg = undefined$1;
                        maybeInvokeDelegate(delegate, context);
                        if (context.method === \\"throw\\") {
                            // If maybeInvokeDelegate(context) changed context.method from
                            // \\"return\\" to \\"throw\\", let that override the TypeError below.
                            return ContinueSentinel;
                        }
                    }
                    context.method = \\"throw\\";
                    context.arg = new TypeError(\\"The iterator does not provide a 'throw' method\\");
                }
                return ContinueSentinel;
            }
            var record = tryCatch(method, delegate.iterator, context.arg);
            if (record.type === \\"throw\\") {
                context.method = \\"throw\\";
                context.arg = record.arg;
                context.delegate = null;
                return ContinueSentinel;
            }
            var info = record.arg;
            if (!info) {
                context.method = \\"throw\\";
                context.arg = new TypeError(\\"iterator result is not an object\\");
                context.delegate = null;
                return ContinueSentinel;
            }
            if (info.done) {
                // Assign the result of the finished delegate to the temporary
                // variable specified by delegate.resultName (see delegateYield).
                context[delegate.resultName] = info.value;
                // Resume execution at the desired location (see delegateYield).
                context.next = delegate.nextLoc;
                // If context.method was \\"throw\\" but the delegate handled the
                // exception, let the outer generator proceed normally. If
                // context.method was \\"next\\", forget context.arg since it has been
                // \\"consumed\\" by the delegate iterator. If context.method was
                // \\"return\\", allow the original .return call to continue in the
                // outer generator.
                if (context.method !== \\"return\\") {
                    context.method = \\"next\\";
                    context.arg = undefined$1;
                }
            } else {
                // Re-yield the result returned by the delegate method.
                return info;
            }
            // The delegate iterator is finished, so forget it and continue with
            // the outer generator.
            context.delegate = null;
            return ContinueSentinel;
        }
        // Define Generator.prototype.{next,throw,return} in terms of the
        // unified ._invoke helper method.
        defineIteratorMethods(Gp);
        define(Gp, toStringTagSymbol, \\"Generator\\");
        // A Generator should always return itself as the iterator object when the
        // @@iterator function is called on it. Some browsers' implementations of the
        // iterator prototype chain incorrectly implement this, causing the Generator
        // object to not be returned from this call. This ensures that doesn't happen.
        // See https://github.com/facebook/regenerator/issues/274 for more details.
        define(Gp, iteratorSymbol, function() {
            return this;
        });
        define(Gp, \\"toString\\", function() {
            return \\"[object Generator]\\";
        });
        exports.keys = function(object) {
            var keys = [];
            for(var key1 in object){
                keys.push(key1);
            }
            keys.reverse();
            // Rather than returning an object with a next method, we keep
            // things simple and return the next function itself.
            return function next() {
                while(keys.length){
                    var key = keys.pop();
                    if (key in object) {
                        next.value = key;
                        next.done = false;
                        return next;
                    }
                }
                // To avoid creating an additional object, we just hang the .value
                // and .done properties off the next function object itself. This
                // also ensures that the minifier will not anonymize the function.
                next.done = true;
                return next;
            };
        };
        exports.values = values;
        Context.prototype = {
            constructor: Context,
            reset: function reset(skipTempReset) {
                this.prev = 0;
                this.next = 0;
                // Resetting context._sent for legacy support of Babel's
                // function.sent implementation.
                this.sent = this._sent = undefined$1;
                this.done = false;
                this.delegate = null;
                this.method = \\"next\\";
                this.arg = undefined$1;
                this.tryEntries.forEach(resetTryEntry);
                if (!skipTempReset) {
                    for(var name in this){
                        // Not sure about the optimal order of these conditions:
                        if (name.charAt(0) === \\"t\\" && hasOwn.call(this, name) && !isNaN(+name.slice(1))) {
                            this[name] = undefined$1;
                        }
                    }
                }
            },
            stop: function stop() {
                this.done = true;
                var rootEntry = this.tryEntries[0];
                var rootRecord = rootEntry.completion;
                if (rootRecord.type === \\"throw\\") {
                    throw rootRecord.arg;
                }
                return this.rval;
            },
            dispatchException: function dispatchException(exception) {
                var handle = function handle(loc, caught) {
                    record.type = \\"throw\\";
                    record.arg = exception;
                    context.next = loc;
                    if (caught) {
                        // If the dispatched exception was caught by a catch block,
                        // then let that catch block handle the exception normally.
                        context.method = \\"next\\";
                        context.arg = undefined$1;
                    }
                    return !!caught;
                };
                if (this.done) {
                    throw exception;
                }
                var context = this;
                for(var i = this.tryEntries.length - 1; i >= 0; --i){
                    var entry = this.tryEntries[i];
                    var record = entry.completion;
                    if (entry.tryLoc === \\"root\\") {
                        // Exception thrown outside of any try block that could handle
                        // it, so set the completion value of the entire function to
                        // throw the exception.
                        return handle(\\"end\\");
                    }
                    if (entry.tryLoc <= this.prev) {
                        var hasCatch = hasOwn.call(entry, \\"catchLoc\\");
                        var hasFinally = hasOwn.call(entry, \\"finallyLoc\\");
                        if (hasCatch && hasFinally) {
                            if (this.prev < entry.catchLoc) {
                                return handle(entry.catchLoc, true);
                            } else if (this.prev < entry.finallyLoc) {
                                return handle(entry.finallyLoc);
                            }
                        } else if (hasCatch) {
                            if (this.prev < entry.catchLoc) {
                                return handle(entry.catchLoc, true);
                            }
                        } else if (hasFinally) {
                            if (this.prev < entry.finallyLoc) {
                                return handle(entry.finallyLoc);
                            }
                        } else {
                            throw new Error(\\"try statement without catch or finally\\");
                        }
                    }
                }
            },
            abrupt: function abrupt(type, arg) {
                for(var i = this.tryEntries.length - 1; i >= 0; --i){
                    var entry = this.tryEntries[i];
                    if (entry.tryLoc <= this.prev && hasOwn.call(entry, \\"finallyLoc\\") && this.prev < entry.finallyLoc) {
                        var finallyEntry = entry;
                        break;
                    }
                }
                if (finallyEntry && (type === \\"break\\" || type === \\"continue\\") && finallyEntry.tryLoc <= arg && arg <= finallyEntry.finallyLoc) {
                    // Ignore the finally entry if control is not jumping to a
                    // location outside the try/catch block.
                    finallyEntry = null;
                }
                var record = finallyEntry ? finallyEntry.completion : {};
                record.type = type;
                record.arg = arg;
                if (finallyEntry) {
                    this.method = \\"next\\";
                    this.next = finallyEntry.finallyLoc;
                    return ContinueSentinel;
                }
                return this.complete(record);
            },
            complete: function complete(record, afterLoc) {
                if (record.type === \\"throw\\") {
                    throw record.arg;
                }
                if (record.type === \\"break\\" || record.type === \\"continue\\") {
                    this.next = record.arg;
                } else if (record.type === \\"return\\") {
                    this.rval = this.arg = record.arg;
                    this.method = \\"return\\";
                    this.next = \\"end\\";
                } else if (record.type === \\"normal\\" && afterLoc) {
                    this.next = afterLoc;
                }
                return ContinueSentinel;
            },
            finish: function finish(finallyLoc) {
                for(var i = this.tryEntries.length - 1; i >= 0; --i){
                    var entry = this.tryEntries[i];
                    if (entry.finallyLoc === finallyLoc) {
                        this.complete(entry.completion, entry.afterLoc);
                        resetTryEntry(entry);
                        return ContinueSentinel;
                    }
                }
            },
            \\"catch\\": function(tryLoc) {
                for(var i = this.tryEntries.length - 1; i >= 0; --i){
                    var entry = this.tryEntries[i];
                    if (entry.tryLoc === tryLoc) {
                        var record = entry.completion;
                        if (record.type === \\"throw\\") {
                            var thrown = record.arg;
                            resetTryEntry(entry);
                        }
                        return thrown;
                    }
                }
                // The context.catch method must only be called with a location
                // argument that corresponds to a known catch block.
                throw new Error(\\"illegal catch attempt\\");
            },
            delegateYield: function delegateYield(iterable, resultName, nextLoc) {
                this.delegate = {
                    iterator: values(iterable),
                    resultName: resultName,
                    nextLoc: nextLoc
                };
                if (this.method === \\"next\\") {
                    // Deliberately forget the last sent value so that we don't
                    // accidentally pass it on to the delegate.
                    this.arg = undefined$1;
                }
                return ContinueSentinel;
            }
        };
        // Regardless of whether this script is executing as a CommonJS module
        // or not, return the runtime object so that we can declare the variable
        // regeneratorRuntime in the outer scope, which allows this module to be
        // injected easily by \`bin/regenerator --include-runtime script.js\`.
        return exports;
    }(// If this script is executing as a CommonJS module, use module.exports
    // as the regeneratorRuntime namespace. Otherwise create a new empty
    // object. Either way, the resulting object will be used to initialize
    // the regeneratorRuntime variable at the top of this file.
    module.exports );
    try {
        regeneratorRuntime = runtime;
    } catch (accidentalStrictMode) {
        // This module should not be running in strict mode, so the above
        // assignment should always work unless something is misconfigured. Just
        // in case runtime.js accidentally runs in strict mode, in modern engines
        // we can explicitly access globalThis. In older engines we can escape
        // strict mode using a global Function call. This could conceivably fail
        // if a Content Security Policy forbids using Function, but in that case
        // the proper solution is to fix the accidental strict mode problem. If
        // you've misconfigured your bundler to force strict mode and applied a
        // CSP to forbid Function, and you're not willing to fix either of those
        // problems, please detail your unique predicament in a GitHub issue.
        if (typeof globalThis === \\"object\\") {
            globalThis.regeneratorRuntime = runtime;
        } else {
            Function(\\"r\\", \\"regeneratorRuntime = r\\")(runtime);
        }
    }
})(runtime);
var regeneratorRuntime$1 = runtime.exports;

var add = function(a, b) {
    return a + b;
};

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) {
        resolve(value);
    } else {
        Promise.resolve(value).then(_next, _throw);
    }
}
function _asyncToGenerator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, \\"next\\", value);
            }
            function _throw(err) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, \\"throw\\", err);
            }
            _next(undefined);
        });
    };
}
function _defineProperty(obj1, key, value) {
    if (key in obj1) {
        Object.defineProperty(obj1, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj1[key] = value;
    }
    return obj1;
}
function _objectSpread(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === \\"function\\") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _defineProperty(target, key, source[key]);
        });
    }
    return target;
}
var sum = add(1, 2);
var obj = {
    a: 1,
    b: 2
};
var clone = _objectSpread({}, obj);
function asyncFunc() {
    return _asyncFunc.apply(this, arguments);
}
function _asyncFunc() {
    _asyncFunc = _asyncToGenerator(regeneratorRuntime$1.mark(function _callee() {
        return regeneratorRuntime$1.wrap(function _callee$(_ctx) {
            while(1)switch(_ctx.prev = _ctx.next){
                case 0:
                    _ctx.next = 2;
                    return new Promise(function(r) {
                        return r(1);
                    });
                case 2:
                case \\"end\\":
                    return _ctx.stop();
            }
        }, _callee);
    }));
    return _asyncFunc.apply(this, arguments);
}

export { asyncFunc, clone, sum as default };
//# sourceMappingURL=bundle.js.map
"
`;

exports[`should compile ts-interop case correctly 1`] = `
"Object.defineProperty(exports, '__esModule', { value: true });

var a = {
    x: 1
};
var b = \\"hello\\";

exports.b = b;
exports[\\"default\\"] = a;
//# sourceMappingURL=bundle.js.map
"
`;

exports[`should compile tsx case correctly 1`] = `
"import React from 'react';

function Tsx() {
    return /*#__PURE__*/ React.createElement(\\"div\\", null, \\"hello\\");
}

export { Tsx as default };
//# sourceMappingURL=bundle.js.map
"
`;
>>>>>>> 487595a (use ts type):test/__snapshots__/compile.test.js.snap
