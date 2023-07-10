const foo = {
  bar: 'hello',
}

console.log('bar', foo?.bar)

const prop = foo.bar ?? 'default'

console.log('name', prop)
