import { memoizeByKey } from './memoize'

describe('memoize', () => {
  it('should memoize the function by default based on arg', () => {
    const fn = jest.fn((a: number, b: number) => a + b)
    const memoized = memoizeByKey(fn)()
    expect(memoized(1, 2)).toBe(3)
    expect(memoized(1, 2)).toBe(3)
    expect(fn).toBeCalledTimes(1)
    expect(memoized(1, 5)).toBe(6)
    expect(fn).toBeCalledTimes(2)
  })

  it('should memoize based on the string key resolver', () => {
    const fn = jest.fn((a: number, b: number) => a + b)
    const memoized = memoizeByKey(fn)('key')
    expect(memoized(1, 2)).toBe(3)
    expect(memoized(1, 2)).toBe(3)
    expect(memoized(1, 5)).toBe(3) // still cache since the key is the same
    expect(fn).toBeCalledTimes(1)
  })
})
