'use client'
import { useState, useEffect } from 'react'

export function SlotMachineText({ text }: { text: string }) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
  const [displayText, setDisplayText] = useState(text.split(''))

  useEffect(() => {
    const finalChars = text.split('')
    const iterations = 10 // How many times to cycle through random chars
    const delayPerChar = 100 // Delay before settling each character
    const cycleSpeed = 30 // Speed of character cycling

    let currentIteration = 0
    let settledCount = 0

    // Cycling interval
    const cycleInterval = setInterval(() => {
      if (settledCount >= finalChars.length) {
        clearInterval(cycleInterval)
        return
      }

      setDisplayText((prev) =>
        prev.map((_char, index) => {
          if (index < settledCount) {
            return finalChars[index] // Keep settled characters
          }
          // Random character for unsettled positions
          return chars[Math.floor(Math.random() * chars.length)]
        }),
      )

      currentIteration++
    }, cycleSpeed)

    // Settling interval - settle one character at a time
    const settleTimers: NodeJS.Timeout[] = []
    finalChars.forEach((_, index) => {
      const timer = setTimeout(
        () => {
          settledCount = index + 1
          setDisplayText((prev) => {
            const newText = [...prev]
            newText[index] = finalChars[index]
            return newText
          })
        },
        iterations * cycleSpeed + index * delayPerChar,
      )
      settleTimers.push(timer)
    })

    return () => {
      clearInterval(cycleInterval)
      settleTimers.forEach((timer) => clearTimeout(timer))
    }
  }, [text])

  return <span>{displayText.join('')}</span>
}
