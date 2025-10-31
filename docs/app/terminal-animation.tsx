'use client'
import React, { useEffect, useState } from 'react'

export function TerminalAnimation({
  text,
  logs,
  spinner = 'ora',
  lineByLine = false,
  spinnerText,
  delay = 0,
}: {
  text: string
  logs: string
  spinner?: 'ora' | 'line' | 'dots' | 'blocks'
  lineByLine?: boolean
  spinnerText?: string
  delay?: number
}) {
  const command = text

  const [started, setStarted] = useState(delay === 0)
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
    setStarted(delay === 0)
    setTypedLength(0)
    setPhase('typing')
    setReveal(false)
    setRevealedCount(0)
    setSpinIndex(0)
  }

  // Handle delay before starting animation
  useEffect(() => {
    if (delay === 0 || started) return
    const timeoutId = setTimeout(() => setStarted(true), delay)
    return () => clearTimeout(timeoutId)
  }, [delay, started])

  useEffect(() => {
    if (phase !== 'typing' || !started) return
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
  }, [phase, command.length, started])

  useEffect(() => {
    if (phase === 'waitingEnter') {
      const id = setTimeout(() => {
        // Skip spinning phase if no spinnerText is provided
        setPhase(spinnerText ? 'spinning' : 'showingLogs')
      }, 500)
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
      if (!lineByLine) {
        // Show all lines at once
        setRevealedCount(logLines.length)
        setReveal(true)
        return
      }
      // Line-by-line reveal
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
  }, [phase, logs, spinFrames.length, lineByLine, spinnerText])

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
                ? `${spinnerText} ${spinFrames[spinIndex]}`
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

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-2 w-full block rounded-md bg-[#f5e6d4] text-[12px] leading-relaxed text-black/80">
      <code className="px-3 py-2 block w-full select-none">{children}</code>
    </pre>
  )
}
