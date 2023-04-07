// Import from generated files instead of using tsconfig alias
import { bundle, type CliArgs } from 'bunchee'

describe('types', () => {
  it('should be able to import the node API and use correct typings', async () => {
    const options: CliArgs = {
      dts: false,
      watch: false,
      minify: false,
      sourcemap: false,
      external: [],
      format: 'esm',
      target: 'es2016',
      runtime: 'nodejs',
    }

    return () => bundle('./tmp/index.ts', options)
  })
})
