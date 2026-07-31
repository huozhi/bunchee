import React from 'react'
import { TerminalAnimation } from './terminal-animation'
import { SlotMachineText } from './slot-machine-text'

export default function Page() {
  return (
    <div>
      <div className="mx-auto max-w-[600px] px-4 pt-6">
        <TerminalBody />
        <div className=""></div>
        <footer className="mx-auto max-w-4xl px-4 py-2 text-xs text-black/40">
          <p>
            <a href="https://github.com/huozhi/bunchee">github</a>
            {` · `}
            <a href="https://x.com/huozhi">x.com</a>
            {` · `}
            <a href="https://github.com/huozhi">huozhi</a>
          </p>
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
      <TerminalAnimation
        text="cat package.json"
        logs={`{
  "name": "coffee",
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "build": "bunchee"
  }
}`}
      />
      <BlockSpacer />
      <TerminalAnimation
        text="npm run build"
        logs={`Exports  File             Size\n.        dist/index.js    5.6 kB`}
        spinnerText="Building"
        lineByLine
        delay={600}
      />
      <BlockSpacer />
      <MarkdownTitle title="# Why bunchee?" />
      <Comment> - Zero config - package.json as config</Comment>
      <Comment> - Auto-generates TypeScript declarations</Comment>
      <Comment> - Supports ESM, CJS, or dual packages</Comment>
      <Comment> - Tree-shakeable and monorepo friendly</Comment>
      <BlockSpacer />
      <MarkdownTitle title="# Perfect for" />
      <Comment> - npm packages and component libraries</Comment>
      <Comment> - Node.js tools, CLI apps, and utilities</Comment>
      <Comment> - Monorepo workspaces with shared packages</Comment>
      <BlockSpacer />
      <div className="my-2 h-px bg-white/10" />
      <BlockSpacer />
      <TerminalLearn />
      <BlockSpacer />
      <div className="my-2 h-px bg-white/10" />
      <BlockSpacer />
      <LatestRelease />
      <BlockSpacer />
    </div>
  )
}

function LatestRelease() {
  return (
    <section
      id="latest-release"
      data-release="v7.0.0"
      aria-labelledby="latest-release-title"
    >
      <MarkdownTitle
        id="latest-release-title"
        title="# Latest release — bunchee v7.0.0"
        href="https://github.com/huozhi/bunchee/releases/tag/v7.0.0"
      />
      <Comment>
        - Up to 5.3× faster on a 57-entry build with declarations
      </Comment>
      <Comment>- New package lint checks catch publishing mistakes</Comment>
      <Comment>- ESM-first package preparation with standard exports</Comment>

      <details className="mt-3 pl-2 text-sm text-black/80">
        <summary className="cursor-pointer">
          <span className="ml-1 font-bold">Migrating from bunchee 6</span>
        </summary>
        <div className="pt-2 pl-4 text-black/70">
          <ul className="space-y-1 pl-4">
            <li>Use Node.js 22.12 or newer.</li>
            <li>
              Expect ES2022 output by default; set <code>--target</code> when an
              older target is required.
            </li>
            <li>
              Import bunchee&apos;s Node.js API with ESM <code>import</code>{' '}
              instead of <code>require()</code>.
            </li>
            <li>
              <code>bunchee prepare</code> now generates ESM-only packages; pass{' '}
              <code>--cjs</code> for dual ESM and CommonJS output.
            </li>
            <li>
              Replace the removed <code>--prepare</code> build flag with the{' '}
              <code>bunchee prepare</code> command.
            </li>
            <li>
              TypeScript 7 projects need <code>@typescript/typescript6</code>{' '}
              for declaration generation.
            </li>
          </ul>
          <p className="mt-3 mb-0 text-xs">
            <a href="https://github.com/huozhi/bunchee/blob/main/docs/MIGRATION.md">
              Complete migration guide
            </a>
            {` · `}
            <a href="/llms.txt">Plain-text docs for agents</a>
          </p>
        </div>
      </details>
    </section>
  )
}

function Intro() {
  return (
    <div className="text-sm leading-relaxed px-4">
      <div className="mb-1 text-[#000]">
        <h1 className="font-bold">
          <SlotMachineText text="bunchee" />
        </h1>
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
  return <div className="pl-2 text-sm text-black/80">{children}</div>
}

function MarkdownTitle({
  title,
  id,
  href,
}: {
  title: string
  id?: string
  href?: string
}) {
  const match = title.match(/^(#+)\s+(.+)$/)
  if (match) {
    const [, hashes, titleText] = match
    return (
      <div
        id={id}
        role="heading"
        aria-level={hashes.length}
        className="pl-2 text-sm"
      >
        <span className="text-black/40">{hashes} </span>
        <span className="text-black/90 font-bold">
          {href ? (
            <a className="markdown-title-link" href={href}>
              {titleText}
            </a>
          ) : (
            titleText
          )}
        </span>
      </div>
    )
  }
  return (
    <div className="pl-2 text-sm">
      <span className="text-black/40"># </span>
      <span className="text-black/90 font-bold">{title}</span>
    </div>
  )
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-2 w-full block rounded-md bg-[#f5e6d4] text-[12px] leading-relaxed text-black/80">
      <code className="px-3 py-2 block w-full">{children}</code>
    </pre>
  )
}

function TerminalLearn() {
  return (
    <div>
      <MarkdownTitle title="# Learn" />
      <MarkdownTitle title="## Entry & Convention" />
      <Output>Files in src/ folder match export names in package.json:</Output>
      <CodeBlock>
        {`+--------------------------+---------------------+\n| File                     | Export Name         |\n+--------------------------+---------------------+\n| src/index.ts             | "." (default)       |\n| src/lite.ts              | "./lite"            |\n| src/react/index.ts       | "./react"           |\n+--------------------------+---------------------+`}
      </CodeBlock>
      <BlockSpacer />
      <MarkdownTitle title="## Directives" />
      <Output>
        {`Bunchee can manage multiple directives such as "use client", "use server", or "use cache" and automatically split your code into different chunks and preserve the directives properly.`}
      </Output>
      <BlockSpacer />
      <MarkdownTitle title="## Wildcard Exports" />
      <Output>
        Use wildcard patterns in exports to dynamically export subpaths:
      </Output>
      <CodeBlock>
        {`// package.json
{
  "exports": {
    "./features/*": "./dist/features/*.js"
  }
}

// Output:
// "./features/auth" -> "./dist/features/auth.js"
// "./features/user" -> "./dist/features/user.js"`}
      </CodeBlock>
      <BlockSpacer />
      <MarkdownTitle title="## Native Addon (.node) Support" />
      <Output>
        supports bundling native Node.js addon files (`.node` binaries).
      </Output>
      <CodeBlock>
        {`// src/index.js
import addon from './native-addon.node'

// The .node file is copied to dist/ and
// the import is rewritten to load it at runtime`}
      </CodeBlock>
    </div>
  )
}
