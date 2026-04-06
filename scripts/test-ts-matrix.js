#!/usr/bin/env node

const { spawnSync } = require('child_process')

const lanes = {
  ts6: {
    typescript: '6.0.2',
    reactTypes: '19.2.14',
    reactDomTypes: '19.2.3',
  },
  ts5: {
    typescript: '5.9.3',
    reactTypes: '18.3.28',
    reactDomTypes: '18.3.7',
  },
}

const laneArg = process.argv[2] || 'all'
const selected =
  laneArg === 'all' ? ['ts6', 'ts5'] : laneArg in lanes ? [laneArg] : null

if (!selected) {
  console.error(
    `Unknown lane "${laneArg}". Use one of: ${Object.keys(lanes).join(', ')}, all`,
  )
  process.exit(1)
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

function runLane(laneName) {
  const lane = lanes[laneName]
  console.log(`\n===> Running ${laneName} lane`)
  run('pnpm', [
    'add',
    '--save-dev',
    `typescript@${lane.typescript}`,
    `@types/react@${lane.reactTypes}`,
    `@types/react-dom@${lane.reactDomTypes}`,
    '--prefer-offline',
  ])
  run('pnpm', ['typecheck'])
  run('pnpm', ['test'])
  run('pnpm', ['test:post'])
}

try {
  for (const lane of selected) {
    runLane(lane)
  }
} finally {
  // Always restore default dev versions after running matrix checks.
  const defaultLane = lanes.ts6
  console.log('\n===> Restoring default dev toolchain (ts6)')
  run('pnpm', [
    'add',
    '--save-dev',
    `typescript@${defaultLane.typescript}`,
    `@types/react@${defaultLane.reactTypes}`,
    `@types/react-dom@${defaultLane.reactDomTypes}`,
    '--prefer-offline',
  ])
}
