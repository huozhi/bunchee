import { createIntegrationTest, stripANSIColor } from '../utils'

const getOutputSizeColumnIndex = (line: string): number => {
  let match
  if ((match = /\d+\sK?B/g.exec(line)) !== null) {
    return match.index
  }
  return -1
}

describe('integration output-short', () => {
  it('should match output with exports', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ stdout }) => {
        /*
        output:
  
        Exports File          Size
        .       dist/index.js 30 B
        */
        const [tableHeads, indexLine] = stripANSIColor(stdout).split('\n')
        expect(tableHeads).toContain('Exports')
        expect(tableHeads).toContain('File')
        expect(tableHeads).toContain('Size')

        expect(indexLine).toContain('.')
        expect(indexLine).toContain('dist/index.js')

        const [exportsIndex, fileIndex, sizeIndex] = [
          tableHeads.indexOf('Exports'),
          tableHeads.indexOf('File'),
          tableHeads.indexOf('Size'),
        ]

        expect(indexLine.indexOf('.')).toEqual(exportsIndex)
        expect(indexLine.indexOf('dist/index.js')).toEqual(fileIndex)
        expect(getOutputSizeColumnIndex(indexLine)).toEqual(sizeIndex)
      },
    )
  })
})
