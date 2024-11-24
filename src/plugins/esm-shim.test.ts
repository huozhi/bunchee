import { GLOBAL_REQUIRE_REGEX } from './esm-shim'

describe('require regex', () => {
  const match = (code: string) => GLOBAL_REQUIRE_REGEX.test(code)
  it('should match require', () => {
    expect(match('require("foo")')).toBe(true)
    expect(match('require(\n"foo"\n)')).toBe(true)
    expect(match(`require(\`mod\`)`)).toBe(true)
    expect(match(`require.resolve('mod')`)).toBe(true)
    expect(match(`\nrequire.resolve(value)`)).toBe(true)

    expect(match('foo.require("foo")')).toBe(false)
    expect(match(`"require('module')"`)).toBe(false)
    expect(match(`\`require('module')\``)).toBe(false)
  })
})
