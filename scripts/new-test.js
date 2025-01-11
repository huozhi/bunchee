// @ts-check

const fs = require('fs')
const path = require('path')

// Helper to copy and rename a file
const copyAndRenameFile = (srcPath, destPath, testName) => {
  const content = fs.readFileSync(srcPath, 'utf8')
  const updatedContent = content.replace(/<name>/g, testName) // Replace placeholder
  fs.writeFileSync(destPath, updatedContent, 'utf8')
  console.log(`Created file: ${destPath}`)
}

// Helper to copy folder contents recursively
const copyFolder = (srcFolder, destFolder, testName) => {
  if (!fs.existsSync(destFolder)) {
    fs.mkdirSync(destFolder, { recursive: true })
  }

  const items = fs.readdirSync(srcFolder, { withFileTypes: true })
  for (const item of items) {
    const srcPath = path.join(srcFolder, item.name)
    const destPath = path.join(
      destFolder,
      item.name.replace(/test\.js/, `${testName}.test.js`),
    )

    if (item.isDirectory()) {
      copyFolder(srcPath, destPath, testName)
    } else {
      copyAndRenameFile(srcPath, destPath, testName)
    }
  }
}

const createProjectFromFixtures = (testName) => {
  const fixturesDir = path.resolve(
    __dirname,
    '..',
    'test',
    'fixtures',
    'integration-test-template',
  )
  const testIntegrationFolder = path.resolve(
    __dirname,
    '..',
    'test',
    'integration',
  )
  const outputDir = path.join(testIntegrationFolder, testName)

  if (!fs.existsSync(fixturesDir)) {
    console.error('Fixtures folder not found!')
    process.exit(1)
  }

  copyFolder(fixturesDir, outputDir, testName)
  console.log(`Project structure created for: ${testName}`)
}

// Run the script
const testName = process.argv[2]
if (!testName) {
  console.error('Please provide a test name. pnpm new-test <test-name>')
  process.exit(1)
}

createProjectFromFixtures(testName)
