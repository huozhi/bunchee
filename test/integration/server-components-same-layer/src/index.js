'use client'

import React, { useState } from 'react'

export function Button() {
  const [count] = useState(0)
  return React.createElement('button', `count: ${count}`)
}

export { Client } from './_client'
