import type { PackageMetadata } from 'src/types'
import path from 'path'
import { getExportPaths, getExportConditionDist } from '../../src/exports'

describe('lib exports', () => {
  describe('getExportPaths', () => {
    it('should handle the basic main fields paths (cjs)', () => {
      const pkg = {
        main: './dist/index.cjs',
        module: './dist/index.esm.js',
      }
      const result = getExportPaths(pkg)
      expect(result).toEqual({
        '.': {
          require: './dist/index.cjs',
          module: './dist/index.esm.js',
        },
      })
    })

    it('should handle the basic main fields paths (esm)', () => {
      const pkg: PackageMetadata = {
        type: 'module',
        main: './dist/index.mjs',
        module: './dist/index.esm.js',
      }
      const result = getExportPaths(pkg)
      expect(result).toEqual({
        '.': {
          import: './dist/index.mjs',
          module: './dist/index.esm.js',
        },
      })
    })

    it('should handle the exports conditions', () => {
      expect(
        getExportPaths({
          exports: {
            '.': {
              require: './dist/index.cjs',
              module: './dist/index.esm.js',
              default: './dist/index.esm.js',
            },
          },
        })
      ).toEqual({
        '.': {
          require: './dist/index.cjs',
          module: './dist/index.esm.js',
          default: './dist/index.esm.js',
        },
      })

      expect(
        getExportPaths({
          exports: {
            '.': {
              import: './dist/index.mjs',
              require: './dist/index.cjs',
            },
          },
        })
      ).toEqual({
        '.': {
          import: './dist/index.mjs',
          require: './dist/index.cjs',
        },
      })
    })

    it('should handle the mixed exports conditions', () => {
      const pkg = {
        main: './dist/index.cjs',
        exports: {
          '.': {
            sub: {
              require: './dist/index.cjs',
            },
          },
        },
      }
      const result = getExportPaths(pkg)
      expect(result).toEqual({
        '.': {
          require: './dist/index.cjs',
        },
        './sub': {
          require: './dist/index.cjs',
        },
      })
    })
  })

  describe('getExportConditionDist', () => {
    function getExportConditionDistHelper(
      pkg: PackageMetadata,
      exportName: string = '.'
    ) {
      const parsedExportCondition = getExportPaths(pkg)
      const parsedExport = {
        source: `./src/${exportName === '.' ? 'index' : exportName}.ts`,
        name: exportName,
        export: parsedExportCondition[exportName],
      }
      // Get only basename to skip path.resolve result for `file` property
      return getExportConditionDist(pkg, parsedExport, '')
        .map((item) => ({ ...item, file: path.basename(item.file) }))
    }

    it('should dedupe the same path import and module if they are the same path', () => {
      const pkg: PackageMetadata = {
        type: 'module',
        main: './dist/index.mjs',
        module: './dist/index.mjs',
      }

      expect(getExportConditionDistHelper(pkg)).toEqual([
        { file: 'index.mjs', format: 'esm' },
      ])
    })
  })
})
