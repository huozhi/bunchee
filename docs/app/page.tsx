import React from 'react'

export default function Page() {
  return (
    <div className="root">
      <nav className="flex items-center justify-between sticky top-0 z-1 bg-[#f9f9f9]">
        <h1 className="title">Bunchee</h1>
        <div className="link">
          <a href="https://github.com/huozhi/bunchee#bunchee">{`README.md ↗`}</a>
        </div>
      </nav>
      <BlurMirror />

      <main>
        <div className="mt-2">
          <p>
            {`Zero-config bundler for JS/TS packages, package.json as configuration.`}
          </p>
        </div>

        <h2 className="text-2xl font-semibold mb-4 sticky">Installation</h2>
        <pre className="code-block">
          <code>{`npm install --save-dev bunchee typescript`}</code>
        </pre>

        <h2 className="text-2xl font-semibold mb-4 sticky">Features</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">🚀 Zero Configuration</h3>
            <p className="text-sm text-gray-600">
              You already have package.json exports, why need another config?
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">📦 Multiple Formats</h3>
            <p className="text-sm text-gray-600">
              Supports ESM, CommonJS, and TypeScript declarations
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">⚡ Fast Builds</h3>
            <p className="text-sm text-gray-600">
              Powered by Rollup and SWC for optimal performance
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">🎯 Simple & Smart</h3>
            <p className="text-sm text-gray-600">
              Automatically externalization dependencies, lint package.json.
              Works with monorepos.
            </p>
          </div>
        </div>

        <h2 className="text-2xl font-semibold mb-4">Configuration</h2>
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

        <h3 className="font-semibold mb-4">Build</h3>
        <pre className="code-block">
          <code>{`$ npm run build`}</code>
        </pre>

        <h3 className="font-semibold mb-4">Output</h3>
        <pre className="code-block">
          <code>
            {`$ Exports  File             Size
$ .        dist/index.js    5.6 kB`}
          </code>
        </pre>

        <div className="mt-8 mb-8">
          <h1 className="text-2xl font-semibold mb-4">Learn</h1>
          <h2 className="font-semibold mb-2">Entry & Convention</h2>
          <p className="mb-4">
            Files in <code className="bg-gray-100 px-1 rounded">src/</code>{' '}
            folder match export names in package.json:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    File
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    Export Name
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">
                    <code>src/index.ts</code>
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    <code>"."</code> (default)
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">
                    <code>src/lite.ts</code>
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    <code>"./lite"</code>
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">
                    <code>src/react/index.ts</code>
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    <code>"./react"</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="font-semibold mt-8 mb-2">Directives</h2>
          <p className="mb-4">
            Bunchee can manage multiple directives such as{' '}
            <code>{'"use client"'}</code>, <code>{'"use server"'}</code>, or{' '}
            <code>{'"use cache"'}</code> and automatically split your code into
            different chunks and preserve the directives properly. Release
            yourself from thinking of the bundling mess.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}

function BlurMirror() {
  return (
    <div className="sticky h-[60px] top-[60px] inset-0 blur-mirror">
      {/* blur mirror layer */}
      <div className="absolute w-full h-full bg-white/30 backdrop-blur-3xl opacity-60 pointer-events-none" />
      {/* linear gradient layer */}
      <div className="absolute w-full h-full bg-gradient-to-r opacity-50 pointer-events-none blur-xl rounded-b-4xl blur-mirror-color" />
    </div>
  )
}

function Footer() {
  return (
    <footer>
      <p>huozhi © {new Date().getFullYear()}</p>
    </footer>
  )
}
