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

    await bunchee(inputFileName, {file: distFile});

    const bundledAssest = fs.readFileSync(distFile, {encoding: 'utf-8'});
    expect(bundledAssest).toMatchSnapshot();
  })
}
