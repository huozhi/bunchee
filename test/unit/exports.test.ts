import type { PackageMetadata } from 'src/types'
import path from 'path'
import {
  getExportPaths,
  getExportsDistFilesOfCondition,
} from '../../src/exports'

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
        }),
      ).toEqual({
        '.': {
          import: './dist/index.mjs',
          types: './dist/index.d.ts',
        },
      })
    })

    describe('type:module', () => {
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
        }),
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
        }),
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
              './sub': {
                require: './dist/index.cjs',
              },
              import: './dist/index.mjs',
            },
          },
        }),
      ).toEqual({
        '.': {
          import: './dist/index.mjs',
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
        }),
      ).toEqual({
        '.': {
          types: './dist/index.d.ts',
          import: './dist/index.mjs',
          module: './dist/index.esm.js',
          require: './dist/index.js',
        },
      })
    })

    it('should warn the duplicated export conditions', () => {
      expect(
        getExportPaths({
          main: './dist/index.js',
          exports: {
            import: './dist/index.mjs',
            require: './dist/index.cjs',
          },
        }),
      ).toEqual({
        '.': {
          import: './dist/index.mjs',
          require: './dist/index.cjs',
        },
      })
    })

    it('should handle nested exports conditions', () => {
      expect(
        getExportPaths({
          exports: {
            '.': {
              import: {
                types: './dist/index.d.ts',
                default: './dist/index.mjs',
              },
              require: {
                types: './dist/index.d.ts',
                default: './dist/index.js',
              },
            },
          },
        }),
      ).toEqual({
        '.': {
          import: './dist/index.mjs',
          require: './dist/index.js',
        },
      })
    })

    it('should dedupe main and module with nested exports', () => {
      expect(
        getExportPaths({
          main: './dist/index.js',
          module: './dist/index.mjs',
          exports: {
            '.': {
              import: {
                types: './dist/index.d.ts',
                default: './dist/index.mjs',
              },
              require: {
                types: './dist/index.d.ts',
                default: './dist/index.js',
              },
            },
          },
        }),
      ).toEqual({
        '.': {
          import: './dist/index.mjs',
          module: './dist/index.mjs',
          require: './dist/index.js',
        },
      })
    })

    it('should skip types condition', () => {
      expect(
        getExportPaths({
          exports: {
            './sub': './dist/index.mjs',
            types: './dist/index.d.ts',
          },
        }),
      ).toEqual({
        './sub': {
          import: './dist/index.mjs',
        },
      })
    })
  })

  describe('getExportsDistFilesOfCondition', () => {
    function getExportConditionDistHelper(
      pkg: PackageMetadata,
      exportName: string = '.',
    ) {
      const parsedExportCondition = getExportPaths(pkg)
      const parsedExport = {
        source: `./src/${exportName === '.' ? 'index' : exportName}.ts`,
        name: exportName,
        export: parsedExportCondition[exportName],
      }
      // Get only basename to skip path.resolve result for `file` property
      const apiResult = getExportsDistFilesOfCondition(pkg, parsedExport, '')

      return apiResult.map((item) => ({
        ...item,
        file: path.basename(item.file),
      }))

      // return exportsDist
      //   .map((item) => ({
      //     ...item,
      //     file: path.basename(item.file),
      //   }))
      //   .sort((a, b) => {
      //     if (a.file.length === b.file.length) {
      //       a.file.localeCompare(b.file)
      //     }
      //     return a.file.length - b.file.length
      //   })

    }

    it('should dedupe the same path import and module if they are the same path', () => {
      // dedupe import and module are they have the same path
      expect(
        getExportConditionDistHelper({
          type: 'module',
          main: './dist/index.mjs',
          module: './dist/index.mjs',
        }),
      ).toEqual([{ file: 'index.mjs', format: 'esm' }])

      // Do not dedupe import and module are they're different paths
      expect(
        getExportConditionDistHelper({
          module: './dist/index.esm.js',
          exports: {
            import: './dist/index.mjs',
          },
        }),
      ).toEqual([
        { file: 'index.mjs', format: 'esm' },
        { file: 'index.esm.js', format: 'esm' },
      ])
    })

    it('should handle basic special exports', () => {
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

    it('should handle dev and prod special exports', () => {
      const pkg = {
        exports: {
          '.': {
            import: {
              development: './dist/index.development.mjs',
              production: './dist/index.production.mjs',
              default: './dist/index.mjs',
            },
            require: {
              production: './dist/index.production.js',
              development: './dist/index.development.js',
              default: './dist/index.js',
            },
            default: './dist/index.js',
          },
        },
      }

      expect(getExportConditionDistHelper(pkg, '.')).toEqual([
        { file: 'index.js', format: 'cjs' },
        { file: 'index.mjs', format: 'esm' },
        { file: 'index.production.js', format: 'cjs' },
        { file: 'index.production.mjs', format: 'esm' },
        { file: 'index.development.js', format: 'cjs' },
        { file: 'index.development.mjs', format: 'esm' },
      ])
    })

    it('should handle nested dev and prod special exports', () => {
      const pkg = {
        "exports": {
          ".": {
            "import": {
              "types": "./dist/index.d.mts",
              "development": "./dist/index.development.mjs",
              "production": "./dist/index.production.mjs",
              "default": "./dist/index.mjs"
            },
            "require": {
              "types": "./dist/index.d.ts",
              "production": "./dist/index.production.js",
              "development": "./dist/index.development.js",
              "default": "./dist/index.js"
            },
          },
          "./react": {
            "import": {
              "types": "./dist/react.d.mts",
              "development": "./dist/react.development.mjs",
              "production": "./dist/react.production.mjs",
              "default": "./dist/react.mjs"
            },
            "require": {
              "types": "./dist/react.d.ts",
              "production": "./dist/react.production.js",
              "development": "./dist/react.development.js",
              "default": "./dist/react.js"
            },
          }
        },
      }
      const parsedExportCondition = getExportPaths(pkg)
      expect(parsedExportCondition['.']).toMatchObject({
        import: './dist/index.mjs',
        'import.development': './dist/index.development.mjs',
        'import.production': './dist/index.production.mjs',
        require: './dist/index.js',
        'require.production': './dist/index.production.js',
        'require.development': './dist/index.development.js'
      })
      expect(parsedExportCondition['./react']).toMatchObject({
        import: './dist/react.mjs', 
        'import.development': './dist/react.development.mjs',
        'import.production': './dist/react.production.mjs',
        require: './dist/react.js',
        'require.production': './dist/react.production.js',
        'require.development': './dist/react.development.js'
      })
    })
  })
})
