import { ParsedExportCondition } from './types'

/**
 * @return {Record<string, string>} env { 'process.env.<key>': '<value>' }
 */
export function getDefinedInlineVariables(
  envs: string[],
  parsedExportCondition: ParsedExportCondition,
): Record<string, string> {
  const envVars = envs.reduce((acc: Record<string, string>, key) => {
    const value = process.env[key]
    if (typeof value !== 'undefined') {
      acc['process.env.' + key] = JSON.stringify(value)
    }
    return acc
  }, {})

  const exportConditionNames = new Set(
    parsedExportCondition.targets.flatMap((target) => target.conditions),
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
