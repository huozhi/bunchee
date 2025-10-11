'use client'
import React, { useEffect, useState } from 'react'

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
  "scripts": {
    "build": "bunchee"
  }
}`}
      </CodeBlock>
      <BlockSpacer />
      <TerminalAnimation
        text="npm run build"
        logs={`Exports  File             Size\n.        dist/index.js    5.6 kB`}
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
  return <div className="pl-2 text-sm text-black/80">{children}</div>
}

function MarkdownTitle({ title }: { title: string }) {
  const match = title.match(/^(#+)\s+(.+)$/)
  if (match) {
    const [, hashes, titleText] = match
    return (
      <div className="pl-2 text-sm">
        <span className="text-black/40">{hashes} </span>
        <span className="text-black/90 font-bold">{titleText}</span>
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
      <code className="px-3 py-2 block w-full select-none">{children}</code>
    </pre>
  )
}

function TerminalAnimation({
  text,
  logs,
  spinner = 'ora',
}: {
  text: string
  logs: string
  spinner?: 'ora' | 'line' | 'dots' | 'blocks'
}) {
  const command = text

  const [typedLength, setTypedLength] = useState(0)
  const [phase, setPhase] = useState<
    'typing' | 'waitingEnter' | 'spinning' | 'showingLogs'
  >('typing')
  const [reveal, setReveal] = useState(false)
  const [revealedCount, setRevealedCount] = useState(0)
  const spinnerFramesMap: Record<string, string[]> = {
    ora: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    line: ['|', '/', '-', '\\'],
    dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    blocks: ['▖', '▘', '▝', '▗'],
  }
  const spinFrames = spinnerFramesMap[spinner] ?? spinnerFramesMap.ora
  const [spinIndex, setSpinIndex] = useState(0)

  const resetAnimation = () => {
    setTypedLength(0)
    setPhase('typing')
    setReveal(false)
    setRevealedCount(0)
    setSpinIndex(0)
  }

  useEffect(() => {
    if (phase !== 'typing') return
    const id = setInterval(() => {
      setTypedLength((n) => {
        const next = n + 1
        if (next >= command.length) {
          clearInterval(id)
          setPhase('waitingEnter')
          return command.length
        }
        return next
      })
    }, 25)
    return () => clearInterval(id)
  }, [phase, command.length])

  useEffect(() => {
    if (phase === 'waitingEnter') {
      const id = setTimeout(() => setPhase('spinning'), 500)
      return () => clearTimeout(id)
    }
    if (phase === 'spinning') {
      setRevealedCount(0)
      const timeoutId = setTimeout(() => setPhase('showingLogs'), 1200)
      const spinId = setInterval(() => {
        setSpinIndex((i) => (i + 1) % spinFrames.length)
      }, 80)
      return () => {
        clearTimeout(timeoutId)
        clearInterval(spinId)
      }
    }
    if (phase === 'showingLogs') {
      const logLines = logs.split('\n')
      const timer = setInterval(() => {
        setRevealedCount((n) => {
          const next = n + 1
          if (next >= logLines.length) {
            clearInterval(timer)
            setReveal(true)
            return logLines.length
          }
          return next
        })
      }, 180)
      return () => clearInterval(timer)
    }
  }, [phase])

  return (
    <div>
      <Prompt caret>
        {command.slice(0, typedLength)}
        {phase === 'waitingEnter' && (
          <span className="ml-2 text-xs text-black/50">⏎</span>
        )}
      </Prompt>
      <div
        className={`transition-all duration-300 ease-out ${
          reveal
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-100 translate-y-0 scale-100'
        }`}
        onDoubleClick={resetAnimation}
      >
        <CodeBlock>
          {logs.split('\n').map((line, idx) => {
            const isVisible =
              phase === 'spinning'
                ? idx === 0
                : idx <
                  (phase === 'showingLogs' ? Math.max(1, revealedCount) : 0)
            const content =
              phase === 'spinning' && idx === 0
                ? `Building ${spinFrames[spinIndex]}`
                : line
            return (
              <div key={idx} className={isVisible ? '' : 'opacity-0'}>
                {content}
              </div>
            )
          })}
        </CodeBlock>
      </div>
    </div>
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
    </div>
  )
}
