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
      <h3>Installation</h3>
      <pre>
        <code>{`npm install --save-dev bunchee typescript`}</code>
      </pre>

      <h3>Configuration</h3>
      <p>
        Create entry files of your library and <code>package.json</code>.
      </p>

      <pre>
        <code>
          {`$ cd ./coffee
$ mkdir src && touch ./src/index.ts && touch package.json`}
        </code>
      </pre>

      <p>
        Add the exports in <code>package.json</code>.
      </p>

      <pre>
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
      <p>
        Run the npm <code>build</code> script.
      </p>

      <pre>
        <code>{`$ npm run build`}</code>
      </pre>

      <h4>Output</h4>
      <pre>
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
