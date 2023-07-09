import type { PackageMetadata } from 'src/types'
import path from 'path'
import { getExportPaths, getExportConditionDist } from '../../src/exports'

const cwd = path.resolve(__dirname)

describe('lib exports', () => {
  describe('getExportPaths', () => {
    it('should handle the basic main fields paths (cjs)', () => {
      const pkg = {
        main: './dist/index.cjs',
        module: './dist/index.esm.js',
      }
      const result = getExportPaths(pkg, cwd)
      expect(result).toEqual({
        '.': {
          require: './dist/index.cjs',
          module: './dist/index.esm.js',
        },
      })
    })

    it('should handle types field', () => {
      expect(
        getExportPaths(
          {
            exports: {
              '.': {
                import: './dist/index.mjs',
                types: './dist/index.d.ts',
              },
            },
          },
          cwd
        )
      ).toEqual({
        '.': {
          import: './dist/index.mjs',
          types: './dist/index.d.ts',
        },
      })
    })

    it('should handle wildcard exports', () => {
      expect(
        getExportPaths(
          {
            exports: {
              '.': {
                types: './dist/index.d.ts',
                import: './dist/index.js',
              },
              './server': {
                types: './dist/server/index.d.ts',
                'react-server': './dist/server/react-server.mjs',
                'edge-light': './dist/server/edge.mjs',
                import: './dist/server/index.mjs',
              },
              './*': {
                types: './dist/*.d.ts',
                import: './dist/*.js',
              },
            },
          },
          path.join(__dirname, '../integration/wildcard-exports')
        )
      ).toEqual({
        '.': {
          types: './dist/index.d.ts',
          import: './dist/index.js',
        },
        './server': {
          types: './dist/server/index.d.ts',
          'react-server': './dist/server/react-server.mjs',
          'edge-light': './dist/server/edge.mjs',
          import: './dist/server/index.mjs',
        },
        './button': {
          types: './dist/button.d.ts',
          import: './dist/button.js',
        },
        './input': {
          types: './dist/input.d.ts',
          import: './dist/input.js',
        },
        './layout': {
          types: './dist/layout/index.d.ts',
          import: './dist/layout/index.js',
        },
        './lite': {
          types: './dist/lite.d.ts',
          import: './dist/lite.js',
        },
      })
    })

    it('should handle the basic main fields paths (esm)', () => {
      const pkg: PackageMetadata = {
        type: 'module',
        main: './dist/index.mjs',
        module: './dist/index.esm.js',
      }
      const result = getExportPaths(pkg, cwd)
      expect(result).toEqual({
        '.': {
          import: './dist/index.mjs',
          module: './dist/index.esm.js',
        },
      })
    })

    it('should handle the exports conditions', () => {
      expect(
        getExportPaths(
          {
            exports: {
              '.': {
                require: './dist/index.cjs',
                module: './dist/index.esm.js',
                default: './dist/index.esm.js',
              },
            },
          },
          cwd
        )
      ).toEqual({
        '.': {
          require: './dist/index.cjs',
          module: './dist/index.esm.js',
          default: './dist/index.esm.js',
        },
      })

      expect(
        getExportPaths(
          {
            exports: {
              '.': {
                import: './dist/index.mjs',
                require: './dist/index.cjs',
              },
            },
          },
          cwd
        )
      ).toEqual({
        '.': {
          import: './dist/index.mjs',
          require: './dist/index.cjs',
        },
      })
    })

    it('should handle the mixed exports conditions', () => {
      expect(
        getExportPaths(
          {
            main: './dist/index.cjs',
            exports: {
              '.': {
                sub: {
                  require: './dist/index.cjs',
                },
              },
            },
          },
          cwd
        )
      ).toEqual({
        '.': {
          require: './dist/index.cjs',
        },
        './sub': {
          require: './dist/index.cjs',
        },
      })

      expect(
        getExportPaths(
          {
            main: './dist/index.js',
            module: './dist/index.esm.js',
            types: './dist/index.d.ts',
            exports: {
              types: './dist/index.d.ts',
              import: './dist/index.mjs',
              module: './dist/index.esm.js',
              require: './dist/index.js',
            },
          },
          cwd
        )
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
      const parsedExportCondition = getExportPaths(pkg, cwd)
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
      // dedupe import and module are they have the same path
      expect(
        getExportConditionDistHelper({
          type: 'module',
          main: './dist/index.mjs',
          module: './dist/index.mjs',
        })
      ).toEqual([{ file: 'index.mjs', format: 'esm' }])

      // Do not dedupe import and module are they're different paths
      expect(
        getExportConditionDistHelper({
          module: './dist/index.esm.js',
          exports: {
            import: './dist/index.mjs',
          },
        })
      ).toEqual([
        { file: 'index.mjs', format: 'esm' },
        { file: 'index.esm.js', format: 'esm' },
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
