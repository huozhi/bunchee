import { createJob } from '../../../testing-utils'

describe('integration - lint - missing-files-main', () => {
  const { job } = createJob({
    directory: __dirname,
    args: ['lint'],
  })

  it('should warn on missing files', () => {
    const { stderr } = job
    expect(stderr).toContain('Missing files in package.json')
    expect(stderr).toContain('index.js')
  })
})
