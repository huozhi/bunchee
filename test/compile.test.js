const fs = require('fs');
const {resolve} = require('path');
const bunchee = require('..');

const baseUnitTestDir = resolve(__dirname, 'unit');
const unitTestDirs = fs.readdirSync(baseUnitTestDir);

for (const folderName of unitTestDirs) {
  it (`should compile ${folderName} case correctly`, async () => {
    const dirPath = `${baseUnitTestDir}/${folderName}`;
    const inputeName = `${dirPath}/input`;
    const inputFileName = inputeName + (fs.existsSync(`${inputeName}.ts`) ? '.ts' : '.js')
    const distFile = `${dirPath}/dist/bundle.js`;
    const pkgJson = fs.existsSync(`${dirPath}/package.json`) ? require(`${dirPath}/package.json`) : {}

    await bunchee(inputFileName, {file: distFile, format: pkgJson.main ? 'cjs' : 'esm'});

    const bundledAssest = fs.readFileSync(distFile, {encoding: 'utf-8'});
    expect(bundledAssest).toMatchSnapshot();
  })
}
