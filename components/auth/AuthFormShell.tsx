'use client'

import { useEffect, useState, type ReactNode } from 'react'

/**
 * Auth pages on mobile: the virtual keyboard covers the bottom of the
 * viewport. We combine `100dvh` (dynamic viewport — avoids the iOS 100vh bug)
 * with `visualViewport` inset padding so the scrollable area grows when the
 * keyboard opens and the primary button / error messages stay reachable.
 */
export function AuthFormShell({ children }: { children: ReactNode }) {
  const [keyboardPad, setKeyboardPad] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const overlap = window.innerHeight - vv.height - vv.offsetTop
      setKeyboardPad(Math.max(0, Math.round(overlap)))
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  const safeBottom = 'max(1.5rem, env(safe-area-inset-bottom, 0px))'
  const safeTop = 'max(1.5rem, env(safe-area-inset-top, 0px))'

  return (
    <div
      className="flex flex-col bg-[color:var(--bg-page)]"
      style={{
        minHeight: '100dvh',
        paddingTop: safeTop,
        paddingBottom: `calc(${safeBottom} + ${keyboardPad}px)`,
      }}
    >
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain px-6 py-4 [-webkit-overflow-scrolling:touch]">
        {children}
      </div>
    </div>
  )
}
