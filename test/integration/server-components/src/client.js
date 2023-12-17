'use client'

import React, { useState } from 'react'

export function Client() {
  const [count] = useState(0)
  return React.createElement('div', `count: ${count}`)
}
