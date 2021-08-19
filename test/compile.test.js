const fs = require('fs');
const { resolve } = require('path');
const { bundle } = require('..');

const baseUnitTestDir = resolve(__dirname, 'unit');
const unitTestDirs = fs.readdirSync(baseUnitTestDir);

for (const folderName of unitTestDirs) {
  it (`should compile ${folderName} case correctly`, async () => {
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

    const bundledAssest = fs.readFileSync(distFile, {encoding: 'utf-8'});
    expect(bundledAssest).toMatchSnapshot();
  })
}
