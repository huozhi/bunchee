// Import from generated files instead of using tsconfig alias
import { bundle, type BundleConfig } from '..'

describe('types', () => {
  it('should be able to import the node API and use correct typings', async () => {
    const options: BundleConfig = {
      dts: false,
      watch: false,
      minify: false,
      sourcemap: false,
      external: [],
      format: 'esm',
      target: 'es2015',
      runtime: 'nodejs',
    }

    return () => bundle('./tmp/index.ts', options)
  })
})
