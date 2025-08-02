import { describe, expect, it } from 'vitest'
import { createJob, getFileContents } from '../../testing-utils'

describe('integration - raw-data', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should generate proper assets', async () => {
    const contents = await getFileContents(distDir)
    expect(contents['index.js']).toMatchInlineSnapshot(`
      "const data$2 = "thisismydata";

      const data$1 = "# Test File\\n\\nThis is a test markdown file for the \`?raw\` query parameter feature. ";

      const data = data$2;
      const rawMarkdown = data$1;

      export { data, rawMarkdown };
      "
    `)
  })
})
