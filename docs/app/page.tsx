import React from 'react'

export default function Page() {
  return (
    <div className="root">
      <nav className="nav">
        <h2>Bunchee</h2>
        <div className="link">
          <a href="https://github.com/huozhi/bunchee">{`docs ↗`}</a>
        </div>
      </nav>
      <p>{`Build JS package with ease, package.json as configuration`}</p>
      <h3>Installation</h3>
      <pre className="code-block">
        <code>{`npm install --save-dev bunchee typescript`}</code>
      </pre>

      <h3>Configuration</h3>
      <p>
        Create entry files of your library and{' '}
        <code className="code--inline">package.json</code>.
      </p>

      <pre className="code-block">
        <code>
          {`$ cd ./coffee
$ mkdir src && touch ./src/index.ts`}
        </code>
      </pre>

      <p>
        Add the exports in <code className="code--inline">package.json</code>.
      </p>

      <pre className="code-block">
        <code>
          {`{
  "name": "coffee",
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "build": "bunchee"
  }
}`}
        </code>
      </pre>

      <h4>Build</h4>
      <pre className="code-block">
        <code>{`$ npm run build`}</code>
      </pre>

      <h4>Output</h4>
      <pre className="code-block">
        <code>
          {`$ Exports  File             Size
$ .        dist/index.js    5.6 kB`}
        </code>
      </pre>

      <footer>
        <p>huozhi © {new Date().getFullYear()}</p>
      </footer>
    </div>
  )
}
