import {
  assertFilesContent,
  createJob,
  stripANSIColor,
} from '../../testing-utils'

describe('integration entry-index-index', () => {
  const { distDir, job } = createJob({
    directory: __dirname,
  })
  it('should work with index file inside index directory', async () => {
    await assertFilesContent(distDir, {
      'default.js': /'index'/,
      'react-server.js': /\'react-server\'/,
    })

    const stdout = stripANSIColor(job.stdout)
    expect(stdout).toContain('.                 dist/default.js')
    expect(stdout).toContain('. (react-server)  dist/react-server.js')
  })
})
