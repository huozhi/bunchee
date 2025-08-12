import { Geist, Geist_Mono } from 'next/font/google'
import './reset.css'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

import React from 'react'
import './globals.css'

export default function Layout({ children }) {
  return (
    <html
      className={`bg-[#f2ece5] text-[#000] font-mono ${geistSans.variable} ${geistMono.variable}`}
    >
      <body className={`h-[full] min-h-screen`}>{children}</body>
    </html>
  )
}

export const metadata = {
  title: 'Bunchee',
  description: 'Zero-config bundler for npm packages',
}
