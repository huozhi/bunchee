<<<<<<< HEAD
var _foo$bar;

var foo = {
  bar: 'hello'
};
console.log('bar', foo == null ? void 0 : foo.bar);
var prop = (_foo$bar = foo.bar) != null ? _foo$bar : 'default';
console.log('name', prop);
=======
var foo = {
    bar: "hello"
};
console.log("bar", foo === null || foo === void 0 ? void 0 : foo.bar);
var _bar;
var prop = (_bar = foo.bar) !== null && _bar !== void 0 ? _bar : "default";
console.log("name", prop);
>>>>>>> 6bf6570 (Use manual snapshot)
//# sourceMappingURL=bundle.js.map
