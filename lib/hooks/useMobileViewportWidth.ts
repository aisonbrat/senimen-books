'use client'

import { useEffect, useState } from 'react'

/**
 * Tracks `window.innerWidth` only while `active` — avoids reading `window` during SSR
 * or in render. Subscribe on open (e.g. mobile preview overlay), unsubscribe on close.
 */
export function useMobileViewportWidth(active: boolean): number | null {
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    if (!active) {
      setWidth(null)
      return
    }
    const read = () => setWidth(window.innerWidth)
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [active])

  return width
}
