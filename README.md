# bunchee
> zero config bundler for js library

## Installation

```sh
npm install --save-dev bunchee
```

## Usage

```sh
# assume your file entry is ./src/index.js
# make sure there is a package.json file in your project root directory
# make sure there are `main` and `name` fields in package.json for description

cd <project-root-dir>
bun ./src/index.js
```

or

```json
{
  "scripts": {
    "build": "bun ./src/index.js"
  }
}
```
