import fs, { promises as fsp } from 'fs'
import { resolve, dirname, extname } from 'path'
import { existsFile, fullExtension } from './testing-utils'

const assetPath = process.env.POST_BUILD ? '../dist' : '../src/bundle'
const bundle = require(assetPath).default

jest.setTimeout(10 * 60 * 1000)

const baseUnitTestDir = resolve(__dirname, 'unit')
const unitTestDirs = fs.readdirSync(baseUnitTestDir)

type CompareFn = (a: string, b: string | undefined) => void

async function ensureDir(dir: string) {
  if (!(await existsFile(dir))) {
    await fsp.mkdir(dir, { recursive: true })
  }
}

async function compareOrUpdateSnapshot(
  filename: string,
  unitName: string,
  onCompare: CompareFn,
) {
  const dirPath = resolve(baseUnitTestDir, unitName)
  const bundledAssetContent = (
    await fsp.readFile(filename, { encoding: 'utf-8' })
  ).replace(/\r\n/g, '\n')
  const outputFilePath = resolve(
    dirPath,
    '__snapshot__',
    `${unitName}${fullExtension(filename)}.snapshot`,
  )

  await ensureDir(dirname(outputFilePath))

  let currentOutputSnapshot
  if (await existsFile(outputFilePath)) {
    currentOutputSnapshot = (
      await fsp.readFile(outputFilePath, { encoding: 'utf-8' })
    ).replace(/\r\n/g, '\n')
  }

  if (bundledAssetContent !== currentOutputSnapshot) {
    console.log(
      `Snapshot ${unitName} is not matched, use TEST_UPDATE_SNAPSHOT=1 pnpm test to update it`,
    )

    if (process.env.TEST_UPDATE_SNAPSHOT) {
      await fsp.writeFile(outputFilePath, bundledAssetContent)
      currentOutputSnapshot = bundledAssetContent
    }
  }
  onCompare(bundledAssetContent, currentOutputSnapshot)
}

for (const unitName of unitTestDirs) {
  it(`should compile ${unitName} case correctly`, async () => {
    const dir = resolve(baseUnitTestDir, unitName)
    const inputFile = resolve(dir, 'input')
    const inputFileName =
      inputFile +
      ['.js', '.jsx', '.ts', '.tsx'].find((ext) =>
        fs.existsSync(`${inputFile}${ext}`),
      )

    const distFile = resolve(dir, 'dist/bundle.js')
    const minifiedDistFile = distFile.replace('.js', '.min.js')
    const distTypesFile = resolve(dir, 'dist/bundle.d.ts')
    const minifiedDistTypesFile = distTypesFile.replace('.d.ts', '.min.d.ts')

    const pkgJson = (await existsFile(resolve(dir, 'package.json')))
      ? JSON.parse(
          await fsp.readFile(resolve(dir, `package.json`), {
            encoding: 'utf-8',
          }),
        )
      : {}

    const baseOptions = {
      cwd: dir,
      format: (pkgJson.main ? 'cjs' : 'esm') as 'cjs' | 'esm',
    }

    // build dist file and minified file
    await bundle(inputFileName, { ...baseOptions, file: distFile })
    await bundle(inputFileName, {
      ...baseOptions,
      file: minifiedDistFile,
      minify: true,
    })

    const compareSnapshot: CompareFn = (
      bundledAssetContent,
      currentOutputSnapshot,
    ) => {
      expect(bundledAssetContent).toEqual(currentOutputSnapshot)
    }

    await compareOrUpdateSnapshot(distFile, unitName, compareSnapshot)
    await compareOrUpdateSnapshot(minifiedDistFile, unitName, compareSnapshot)

    if (['.ts', '.tsx'].includes(extname(inputFileName))) {
      await compareOrUpdateSnapshot(distTypesFile, unitName, compareSnapshot)
      await compareOrUpdateSnapshot(
        minifiedDistTypesFile,
        unitName,
        compareSnapshot,
      )
    }
  })
}
