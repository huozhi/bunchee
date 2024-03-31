import { createIntegrationTest, stripANSIColor } from '../utils'

const getOutputSizeColumnIndex = (line: string): number => {
  let match
  if ((match = /\d+\sK?B/g.exec(line)) !== null) {
    return match.index
  }
  return -1
}

describe('integration output', () => {
  it('should match output with exports', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ stdout }) => {
        /*
        output:
  
        Exports          File                        Size
        cli (bin)        dist/cli.js                 103 B
        .                dist/index.js               42 B
        . (react-server) dist/index.react-server.js  55 B
        ./foo            dist/foo.js                 103 B
        */

        const lines = stripANSIColor(stdout).split('\n')
        const [tableHeads, ...restLines] = lines
        const cliLine = restLines.find((line) => line.includes('cli'))!
        const indexLine = restLines.find(
          (line) => line.includes('. ') && !line.includes('react-server'),
        )!
        const indexReactServerLine = restLines.find((line) =>
          line.includes('. (react-server)'),
        )!
        const fooLine = restLines.find((line) => line.includes('./foo'))!

        expect(tableHeads).toContain('Exports')
        expect(tableHeads).toContain('File')
        expect(tableHeads).toContain('Size')

        expect(cliLine).toContain('cli (bin)')
        expect(cliLine).toContain('dist/cli.js')

        expect(indexLine).toContain('.')
        expect(indexLine).toContain('dist/index.js')

        expect(indexReactServerLine).toContain('. (react-server)')
        expect(indexReactServerLine).toContain('dist/index.react-server.js')

        expect(fooLine).toContain('./foo')
        expect(fooLine).toContain('dist/foo.js')

        const [exportsIndex, fileIndex, sizeIndex] = [
          tableHeads.indexOf('Exports'),
          tableHeads.indexOf('File'),
          tableHeads.indexOf('Size'),
        ]

        expect(cliLine.indexOf('cli (bin)')).toEqual(exportsIndex)
        expect(cliLine.indexOf('dist/cli.js')).toEqual(fileIndex)
        expect(getOutputSizeColumnIndex(cliLine)).toEqual(sizeIndex)

        expect(indexLine.indexOf('.')).toEqual(exportsIndex)
        expect(indexLine.indexOf('dist/index.js')).toEqual(fileIndex)
        expect(getOutputSizeColumnIndex(indexLine)).toEqual(sizeIndex)

        expect(indexReactServerLine.indexOf('. (react-server)')).toEqual(
          exportsIndex,
        )
        expect(
          indexReactServerLine.indexOf('dist/index.react-server.js'),
        ).toEqual(fileIndex)
        expect(getOutputSizeColumnIndex(indexReactServerLine)).toEqual(
          sizeIndex,
        )

        expect(fooLine.indexOf('./foo')).toEqual(exportsIndex)
        expect(fooLine.indexOf('dist/foo.js')).toEqual(fileIndex)
        expect(getOutputSizeColumnIndex(fooLine)).toEqual(sizeIndex)
      },
    )
  })
})
