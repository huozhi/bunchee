import { spawn, spawnSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import http from 'http'
import type { AddressInfo } from 'net'
import path from 'path'
import { expect, test } from 'vitest'
import { createJob } from '../../testing-utils'

// Builds a package that imports CSS, serves it under a Content Security
// Policy without 'unsafe-inline' in style-src, and loads it in headless
// Chrome. GitHub's Ubuntu runners ship Chrome, so on Linux CI a missing
// browser fails the test; elsewhere it is skipped when none is found.
const CSP = "default-src 'self'; style-src 'self'; script-src 'self'"

function findChrome(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const known: Partial<Record<NodeJS.Platform, string>> = {
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  }
  const knownPath = known[process.platform]
  if (knownPath) return existsSync(knownPath) ? knownPath : undefined
  for (const name of [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ]) {
    const found = spawnSync('which', [name], { encoding: 'utf8' })
    if (found.status === 0) return found.stdout.trim()
  }
  return undefined
}

const chrome = findChrome()
const { job } = createJob({ directory: __dirname })

function serve(): Promise<http.Server> {
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
  }
  const server = http.createServer((req, res) => {
    const file = path.join(__dirname, new URL(req.url!, 'http://x').pathname)
    if (!file.startsWith(__dirname) || !existsSync(file)) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] ?? 'text/plain',
      'Content-Security-Policy': CSP,
    })
    res.end(readFileSync(file))
  })
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve(server)),
  )
}

function dumpDom(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(chrome!, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      // The page is local; keep the browser from calling Google services.
      '--disable-background-networking',
      '--disable-component-update',
      '--no-first-run',
      '--virtual-time-budget=5000',
      '--dump-dom',
      url,
    ])
    // Never let a stuck browser hang the suite.
    const timer = setTimeout(() => child.kill('SIGKILL'), 50_000)
    let stdout = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.on('error', reject)
    child.on('close', () => {
      clearTimeout(timer)
      resolve(stdout)
    })
  })
}

test.skipIf(!chrome && !(process.env.CI && process.platform === 'linux'))(
  'imported CSS applies under a CSP that blocks inline styles',
  async () => {
    expect(chrome, 'Chrome is required for this test on CI').toBeDefined()
    expect(job.code).toBe(0)
    const server = await serve()
    try {
      const { port } = server.address() as AddressInfo
      const dom = await dumpDom(`http://127.0.0.1:${port}/index.html`)
      const result = /<pre id="result">([^<]*)<\/pre>/.exec(dom)?.[1]
      expect(JSON.parse(result!)).toEqual({
        // The bundle's stylesheet is adopted, so CSP does not block it.
        styled: 'rgb(1, 2, 3)',
        // A plain <style> element is blocked: the policy is enforced.
        probe: 'rgb(0, 0, 0)',
        adopted: 1,
      })
    } finally {
      server.close()
    }
  },
  60_000,
)
