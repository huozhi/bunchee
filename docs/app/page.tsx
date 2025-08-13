import React from 'react'

export default function Page() {
  return (
    <div>
      <div className="mx-auto max-w-[600px] px-4 pt-6">
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-2">
          <div className="text-xs text-black/60">{'📦'}</div>
          <a
            href="https://github.com/huozhi/bunchee#bunchee"
            className="text-xs text-teal-300 hover:underline"
          >
            README.md ↗
          </a>
        </div>
        <TerminalBody />
        <div className=""></div>
        <footer className="mx-auto max-w-4xl px-6 py-2 text-xs text-black/40">
          <p>huozhi © {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  )
}

function TerminalBody() {
  return (
    <div className="terminal-grid-bg py-4 flex flex-col items-stretch">
      <Intro />
      <BlockSpacer />
      <Prompt>npm install --save-dev bunchee typescript</Prompt>
      <BlockSpacer />
      <Prompt>cat package.json</Prompt>
      <CodeBlock>
        {`{
  "name": "coffee",
  "type": "module",
  "main": "./dist/index.js",
  "scripts": { "build": "bunchee" }
}`}
      </CodeBlock>
      <BlockSpacer />
      <Prompt caret>npm run build</Prompt>
      <CodeBlock>{`Exports  File             Size
.        dist/index.js    5.6 kB`}</CodeBlock>
      <BlockSpacer />
      <Comment># Features</Comment>
      <Comment> - Zero config, smart externals, and TS declarations</Comment>
      <Comment> - Works great for monorepos</Comment>
      <BlockSpacer />
      <div className="my-2 h-px bg-white/10" />
      <BlockSpacer />
      <TerminalLearn />
      <BlockSpacer />
    </div>
  )
}

function Intro() {
  return (
    <div className="text-sm leading-relaxed px-4">
      <div className="mb-1 text-[#000]">
        <h1 className="font-bold">bunchee</h1>
      </div>
      <div className="text-black/80">
        Zero-config bundler for JS/TS packages — use your package.json as the
        config.
      </div>
    </div>
  )
}

function BlockSpacer() {
  return <div className="h-4" />
}

function Prompt({
  children,
  className = '',
  caret = false,
}: {
  children: React.ReactNode
  className?: string
  caret?: boolean
}) {
  return (
    <div className={`flex text-sm ${className}`}>
      <span className="text-black/40 mr-2">{`➜`}</span>
      <span className="text-[#000]">~/project</span>
      <span className="ml-2 text-black">$</span>
      <span className="ml-2 inline-flex items-center">
        <span className="text-black/60">{children}</span>
        {caret && (
          <span className="ml-1 inline-block h-4 w-2 translate-y-[1px] bg-[#000]/70 align-middle caret" />
        )}
      </span>
    </div>
  )
}

function Output({ children }: { children: React.ReactNode }) {
  return <div className="pl-6 text-sm text-black/70">{children}</div>
}

function Comment({ children }: { children: React.ReactNode }) {
  return <div className="pl-6 text-sm text-black/90">{children}</div>
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="ml-4 mt-2 rounded-md bg-[#f5e6d4] text-[12px] leading-relaxed text-black/80">
      <code className="px-3 py-2 block">{children}</code>
    </pre>
  )
}

function TerminalLearn() {
  return (
    <div>
      <Comment># Learn</Comment>
      <Comment>## Entry & Convention</Comment>
      <Output>Files in src/ folder match export names in package.json:</Output>
      <CodeBlock>
        {`+--------------------------+---------------------+\n| File                     | Export Name         |\n+--------------------------+---------------------+\n| src/index.ts             | "." (default)       |\n| src/lite.ts              | "./lite"            |\n| src/react/index.ts       | "./react"           |\n+--------------------------+---------------------+`}
      </CodeBlock>
      <BlockSpacer />
      <Comment>## Directives</Comment>
      <Output>
        {`Bunchee can manage multiple directives such as "use client", "use server", or "use cache" and automatically split your code into different chunks and preserve the directives properly.`}
      </Output>
    </div>
  )
}
