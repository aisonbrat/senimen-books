'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadBookPhotoBlobUrlOnly, loadBookPhotoForDisplay } from '@/lib/storage/bookPhotos'

type Props = {
  /** Stored path or full Supabase object URL from `getPublicUrl`. */
  storageRef: string
  alt?: string
  className?: string
  style?: CSSProperties
}

/**
 * Renders book-photos via authenticated download → blob URL or signed URL.
 * Waits for `getSession()` / `onAuthStateChange` so the first fetch is not fired
 * while the browser client JWT is still missing (fixes empty/broken loads after refresh).
 */
export function SignedBookPhotoImg({ storageRef, alt = '', className, style }: Props) {
  const supabase = useMemo(() => createClient(), [])
  /** `undefined` = auth not resolved yet — keep placeholder; `null` = no user */
  const [sessionUserId, setSessionUserId] = useState<string | null | undefined>(undefined)
  const [src, setSrc] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const loadGenRef = useRef(0)
  const blobFallbackForGenRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSessionUserId(data.session?.user?.id ?? null)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user?.id ?? null)
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    blobFallbackForGenRef.current = 0
    const raw = storageRef.trim()
    if (!raw) {
      setSrc(null)
      setReady(true)
      return
    }
    if (sessionUserId === undefined) {
      setReady(false)
      return
    }
    if (sessionUserId === null) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[SignedBookPhotoImg] no Supabase session; cannot load book-photos object')
      }
      setSrc(null)
      setReady(true)
      return
    }

    setReady(false)
    const myGen = ++loadGenRef.current
    void loadBookPhotoForDisplay(supabase, raw)
      .then((loaded) => {
        if (myGen !== loadGenRef.current) return
        setSrc(loaded.src.trim() || null)
        setReady(true)
      })
      .catch((err: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('[SignedBookPhotoImg] loadBookPhotoForDisplay rejected', err)
        }
        if (myGen !== loadGenRef.current) return
        setSrc(null)
        setReady(true)
      })
  }, [storageRef, supabase, sessionUserId])

  if (!storageRef.trim()) return null

  if (!ready || !src) {
    return (
      <div
        className={className}
        style={{ ...style, background: '#E8E6E3' }}
        aria-hidden
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      referrerPolicy="no-referrer"
      onError={() => {
        const g = loadGenRef.current
        if (blobFallbackForGenRef.current === g) return
        blobFallbackForGenRef.current = g
        void loadBookPhotoBlobUrlOnly(supabase, storageRef).then((blobSrc) => {
          if (blobSrc && g === loadGenRef.current) setSrc(blobSrc)
        })
      }}
    />
  )
}
