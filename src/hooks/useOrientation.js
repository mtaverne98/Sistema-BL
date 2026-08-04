import { useState, useEffect } from 'react'

export function useOrientation() {
  const [isPortrait, setIsPortrait] = useState(() =>
    window.matchMedia('(orientation: portrait)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const handler = e => setIsPortrait(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isPortrait
}
