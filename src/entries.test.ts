import { describe, expect, it } from 'vitest'
import { normalizeExportPath } from './entries'

describe('normalizeExportPath', () => {
  it('should strip export condition suffixes', () => {
    expect(normalizeExportPath('./index')).toBe('.')
    expect(normalizeExportPath('./index.development')).toBe('.')
    expect(normalizeExportPath('./index.react-server')).toBe('.')
    expect(normalizeExportPath('./shared')).toBe('./shared')
    expect(normalizeExportPath('./shared.development')).toBe('./shared')
  })

  it('should strip stacked condition suffixes', () => {
    expect(normalizeExportPath('./index.development.react-server')).toBe('.')
    expect(normalizeExportPath('./shared.production.node')).toBe('./shared')
  })

  it('should keep dots that are part of the subpath', () => {
    // Regression: these used to be truncated to `./v1` and `./charts`, because
    // everything after the first dot was assumed to be a condition.
    expect(normalizeExportPath('./v1.2/thing')).toBe('./v1.2/thing')
    expect(normalizeExportPath('./charts.min')).toBe('./charts.min')
    expect(normalizeExportPath('./foo.bar')).toBe('./foo.bar')
  })

  it('should leave binary paths alone', () => {
    expect(normalizeExportPath('$binary')).toBe('$binary')
    expect(normalizeExportPath('$binary/index')).toBe('$binary')
    expect(normalizeExportPath('$binary/foo')).toBe('$binary/foo')
  })
})
