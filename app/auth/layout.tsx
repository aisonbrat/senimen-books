import type { ReactNode } from 'react'
import type { Viewport } from 'next'

/**
 * When the software keyboard opens on Android Chrome / compatible browsers,
 * `interactiveWidget: 'resizes-content'` shrinks the visual viewport so fixed
 * `100vh` layouts don't hide the focused field. Works together with
 * `AuthFormShell`'s `visualViewport` padding on iOS Safari.
 */
export const viewport: Viewport = {
  interactiveWidget: 'resizes-content',
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children
}
