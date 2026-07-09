import { resolve } from 'path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    // The docs app resolves next and other dependencies from the repo root.
    root: resolve(import.meta.dirname, '..'),
  },
}

export default nextConfig
