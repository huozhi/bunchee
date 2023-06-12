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

    it('should handle types field', () => {
      expect(
        getExportPaths({
          exports: {
            '.': {
              import: './dist/index.mjs',
              types: './dist/index.d.ts',
            },
          },
        })
      ).toEqual({
        '.': {
          import: './dist/index.mjs',
          types: './dist/index.d.ts',
        },
      })

      expect(
        getExportPaths({
          typings: './dist/index.d.ts',
          exports: {
            '.': {
              import: './dist/index.mjs',
            },
          },
        })
      ).toEqual({
        '.': {
          import: './dist/index.mjs',
          types: './dist/index.d.ts',
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
      expect(
        getExportPaths({
          main: './dist/index.cjs',
          exports: {
            '.': {
              sub: {
                require: './dist/index.cjs',
              },
            },
          },
        })
      ).toEqual({
        '.': {
          require: './dist/index.cjs',
        },
        './sub': {
          require: './dist/index.cjs',
        },
      })

      expect(
        getExportPaths({
          main: './dist/index.js',
          module: './dist/index.esm.js',
          types: './dist/index.d.ts',
          exports: {
            types: './dist/index.d.ts',
            import: './dist/index.mjs',
            module: './dist/index.esm.js',
            require: './dist/index.js',
          },
        })
      ).toEqual({
        '.': {
          types: './dist/index.d.ts',
          import: './dist/index.mjs',
          module: './dist/index.esm.js',
          require: './dist/index.js',
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
      return getExportConditionDist(pkg, parsedExport, '').map((item) => ({
        ...item,
        file: path.basename(item.file),
      }))
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

    it('should handle special exports', () => {
      const pkg: PackageMetadata = {
        exports: {
          '.': {
            require: './dist/index.cjs',
            'edge-light': './dist/index.mjs',
            'react-server': './dist/index.mjs',
          },
        },
      }

      expect(getExportConditionDistHelper(pkg)).toEqual([
        { file: 'index.cjs', format: 'cjs' },
        { file: 'index.mjs', format: 'esm' },
      ])
    })
  })
})
