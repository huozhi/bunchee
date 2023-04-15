import { sizeCollector } from './build-config'
import { logger } from './utils'

export function logSizeStats() {
  const stats = sizeCollector.getSizeStats()
  const maxLength = Math.max(...stats.map(([filename]) => filename.length))
  stats.forEach(([filename, prettiedSize]) => {
    const padding = ' '.repeat(maxLength - filename.length)
    const action = filename.endsWith('.d.ts') ? 'Typed' : 'Built'
    logger.log(` ✓  ${action} ${filename}${padding} - ${prettiedSize}`)
  })
}