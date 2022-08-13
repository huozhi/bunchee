import regeneratorRuntime from 'regenerator-runtime';

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
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _checkPrivateRedeclaration(obj, privateCollection) {
    if (privateCollection.has(obj)) {
        throw new TypeError("Cannot initialize the same private elements twice on an object");
    }
}
function _classApplyDescriptorGet(receiver, descriptor) {
    if (descriptor.get) {
        return descriptor.get.call(receiver);
    }
    return descriptor.value;
}
function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}
function _classExtractFieldDescriptor(receiver, privateMap, action) {
    if (!privateMap.has(receiver)) {
        throw new TypeError("attempted to " + action + " private field on non-instance");
    }
    return privateMap.get(receiver);
}
function _classPrivateFieldGet(receiver, privateMap) {
    var descriptor = _classExtractFieldDescriptor(receiver, privateMap, "get");
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
        if ("value" in descriptor) descriptor.writable = true;
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
    }
    return obj;
}
var _marked = /*#__PURE__*/ regeneratorRuntime.mark(generator);
function generator() {
    return regeneratorRuntime.wrap(function generator$(_ctx) {
        while(1)switch(_ctx.prev = _ctx.next){
            case 0:
                _ctx.next = 2;
                return 1;
            case 2:
            case "end":
                return _ctx.stop();
        }
    }, _marked);
}
function asyncFunc() {
    return _asyncFunc.apply(this, arguments);
}
function _asyncFunc() {
    _asyncFunc = _asyncToGenerator(/*#__PURE__*/ regeneratorRuntime.mark(function _callee() {
        return regeneratorRuntime.wrap(function _callee$(_ctx) {
            while(1)switch(_ctx.prev = _ctx.next){
                case 0:
                    _ctx.next = 2;
                    return new Promise(function(r) {
                        return r(1);
                    });
                case 2:
                case "end":
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
        _defineProperty(this, "getX", function() {
            return _classPrivateFieldGet(_this, _x);
        });
    }
    _createClass(A, [
        {
            key: "f1",
            value: /*#__PURE__*/ regeneratorRuntime.mark(function f1() {
                return regeneratorRuntime.wrap(function f1$(_ctx) {
                    while(1)switch(_ctx.prev = _ctx.next){
                        case 0:
                            _ctx.next = 2;
                            return 1;
                        case 2:
                        case "end":
                            return _ctx.stop();
                    }
                }, f1);
            })
        }
    ]);
    return A;
}();
var _v = 123;
var x = function() {
    return "value:".concat(_v);
};

export { A, asyncFunc, generator, x };
//# sourceMappingURL=bundle.js.map
