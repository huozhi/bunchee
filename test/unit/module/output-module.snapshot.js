var Parent = /*#__PURE__*/ function() {
    function Parent() {}
    var _proto = Parent.prototype;
    _proto.f = function f() {
        return 1;
    };
    return Parent;
}();

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
function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
        throw new TypeError("Super expression must either be null or a function");
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
function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
        o.__proto__ = p;
        return o;
    };
    return _setPrototypeOf(o, p);
}
var A = /*#__PURE__*/ function(Parent) {
    _inherits(A, Parent);
    function A() {
        return Parent.call(this);
    }
    _createClass(A, [
        {
            key: "x",
            get: function get() {
                return Parent.prototype.f.call(this);
            }
        }
    ]);
    return A;
}(Parent);
var a = new A();

console.log("main", a.x);
//# sourceMappingURL=bundle.js.map
