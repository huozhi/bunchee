const fs = require('fs');
const { resolve, dirname } = require('path');
const { bundle } = require('..');

const baseUnitTestDir = resolve(__dirname, 'unit');
const unitTestDirs = fs.readdirSync(baseUnitTestDir);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function compareOrUpdateSnapshot(filename, unitName, onCompare) {
  const dirPath = resolve(baseUnitTestDir, unitName);
  const bundledAssetContent = fs.readFileSync(filename, {encoding: 'utf-8'}).replace(/\r\n/g, '\n');
  const outputFilePath = resolve(
    dirPath,
    '__snapshot__',
    `${unitName}${filename.endsWith('.min.js') ? '.min' : ''}.js.snap`
  );


  ensureDir(dirname(outputFilePath))

  let currentOutputSnapshot
  if (fs.existsSync(outputFilePath)) {
    currentOutputSnapshot = fs.readFileSync(outputFilePath, { encoding: 'utf-8' }).replace(/\r\n/g, '\n');
  }

  if (bundledAssetContent !== currentOutputSnapshot) {
    console.log(`Snapshot ${unitName} is not matched, use TEST_UPDATE_SNAPSHOT=1 yarn test to update it`);

    if (process.env.TEST_UPDATE_SNAPSHOT) {
      fs.writeFileSync(outputFilePath, bundledAssetContent);
      currentOutputSnapshot = bundledAssetContent
    }
  }
  onCompare(bundledAssetContent, currentOutputSnapshot);
}

for (const unitName of unitTestDirs) {
  it(`should compile ${unitName} case correctly`, async () => {
    const dirPath = resolve(baseUnitTestDir, unitName);
    const inputeName = resolve(dirPath, 'input');
    const inputFileName = inputeName + [
      '.js',
      '.jsx',
      '.ts',
      '.tsx'
    ].find(ext => fs.existsSync(`${inputeName}${ext}`));

    const distFile = resolve(dirPath, 'dist/bundle.js');
    const minifiedDistFile = distFile.replace('.js', '.min.js')
    const pkgJson = fs.existsSync(`${dirPath}/package.json`) ? require(`${dirPath}/package.json`) : {}

    // build dist file and minified file
    await bundle(inputFileName, {file: distFile, format: pkgJson.main ? 'cjs' : 'es', cwd: dirPath});
    await bundle(inputFileName, {file: minifiedDistFile, minify: true, format: pkgJson.main ? 'cjs' : 'es', cwd: dirPath});

    const compareSnapshot = (bundledAssetContent, currentOutputSnapshot) => {
      expect(bundledAssetContent).toEqual(currentOutputSnapshot);
    }

    compareOrUpdateSnapshot(distFile, unitName, compareSnapshot);
    compareOrUpdateSnapshot(minifiedDistFile, unitName, compareSnapshot);
  })
}
