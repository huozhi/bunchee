import React from 'react'
import './globals.css'

export default function Layout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  )
}

export const metadata = {
  title: 'Bunchee',
  description: 'Zero-config bundler for npm packages',
}
