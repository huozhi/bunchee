var foo = {
    bar: "hello"
};
console.log("bar", foo === null || foo === void 0 ? void 0 : foo.bar);
var _bar;
var prop = (_bar = foo.bar) !== null && _bar !== void 0 ? _bar : "default";
console.log("name", prop);
//# sourceMappingURL=bundle.js.map
