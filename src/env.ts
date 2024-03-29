import { ParsedExportCondition } from './types'

/**
 * @return {Record<string, string>} env { 'process.env.<key>': '<value>' }
 */
export function getDefinedInlineVariables(
  envs: string[],
  parsedExportCondition: ParsedExportCondition,
): Record<string, string> {
  if (!envs.includes('NODE_ENV')) {
    envs.push('NODE_ENV')
  }
  const envVars = envs.reduce((acc: Record<string, string>, key) => {
    const value = process.env[key]
    if (typeof value !== 'undefined') {
      acc['process.env.' + key] = JSON.stringify(value)
    }
    return acc
  }, {})

  const exportConditionNames = Object.keys(parsedExportCondition.export).reduce(
    (acc, key) => {
      // key could be 'require' or 'import.development' etc.
      const exportTypes = key.split('.')
      for (const exportType of exportTypes) {
        acc.add(exportType)
      }
      return acc
    },
    new Set() as Set<string>,
  )

  // For development and production convention, we override the NODE_ENV value
  if (exportConditionNames.has('development')) {
    envVars['process.env.NODE_ENV'] = JSON.stringify('development')
  } else if (exportConditionNames.has('production')) {
    envVars['process.env.NODE_ENV'] = JSON.stringify('production')
  }

  if (exportConditionNames.has('edge-light')) {
    envVars['EdgeRuntime'] = JSON.stringify('edge-runtime')
  }

  return envVars
}
