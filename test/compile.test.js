const { spawn } = require('child_process');
const fs = require('fs');
const { resolve } = require('path');
const { bundle } = require('..');

const baseUnitTestDir = resolve(__dirname, 'unit');
const unitTestDirs = fs.readdirSync(baseUnitTestDir);

for (const folderName of unitTestDirs) {
  it(`should compile ${folderName} case correctly`, async () => {
    const dirPath = resolve(baseUnitTestDir, folderName);
    const inputeName = resolve(dirPath, 'input');
    const inputFileName = inputeName + [
      '.js',
      '.jsx',
      '.ts',
      '.tsx'
    ].find(ext => fs.existsSync(`${inputeName}${ext}`));

    const distFile = resolve(dirPath, 'dist/bundle.js');
    const pkgJson = fs.existsSync(`${dirPath}/package.json`) ? require(`${dirPath}/package.json`) : {}

    await bundle(inputFileName, {file: distFile, format: pkgJson.main ? 'cjs' : 'es', cwd: dirPath});

    const bundledAssetContent = fs.readFileSync(distFile, {encoding: 'utf-8'}).replace(/\r\n/g, '\n');
    const outputFilePath = resolve(dirPath, `output-${folderName}.snapshot.js`);

    let currentOutputSnapshot
    if (fs.existsSync(outputFilePath)) {
      currentOutputSnapshot = fs.readFileSync(outputFilePath, { encoding: 'utf-8' }).replace(/\r\n/g, '\n');
    }

    if (bundledAssetContent !== currentOutputSnapshot) {
      console.log(`Snapshot ${folderName} is not matched, use TEST_UPDATE_SNAPSHOT=1 yarn test to update it`);

      if (process.env.TEST_UPDATE_SNAPSHOT) {
        fs.writeFileSync(outputFilePath, bundledAssetContent);
        currentOutputSnapshot = bundledAssetContent
      }
    }

    expect(bundledAssetContent).toEqual(currentOutputSnapshot);
  })
}
