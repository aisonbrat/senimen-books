const TOAST_ID = 'editor-save-network-error-toast'
let hideTimer: ReturnType<typeof setTimeout> | undefined

function extractMessage(err: unknown): string {
  if (err == null) return ''
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message: unknown }).message
    return m != null ? String(m) : ''
  }
  if (err instanceof Error) return err.message
  return String(err)
}

/** True when failure is likely transient (offline, DNS, CORS, dropped connection). */
export function isLikelyNetworkOrFetchFailure(err: unknown): boolean {
  if (typeof window === 'undefined') return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (err instanceof TypeError) return true
  const name =
    err && typeof err === 'object' && err !== null && 'name' in err
      ? String((err as { name: unknown }).name)
      : ''
  if (name === 'AuthRetryableFetchError') return true
  const msg = extractMessage(err).toLowerCase()
  if (!msg) return false
  const hints = [
    'failed to fetch',
    'networkerror',
    'load failed',
    'network request failed',
    'fetch failed',
    'connection refused',
    'econnreset',
    'etimedout',
    'socket hang up',
  ]
  return hints.some((h) => msg.includes(h))
}

/**
 * Non-blocking toast for editor autosave / manual save network failures.
 * Uses a single fixed node (no extra npm deps).
 */
export function showEditorSaveNetworkErrorToast(detail?: string): void {
  if (typeof document === 'undefined') return

  const root = document.body
  let el = document.getElementById(TOAST_ID) as HTMLDivElement | null
  if (!el) {
    el = document.createElement('div')
    el.id = TOAST_ID
    el.setAttribute('role', 'alert')
    el.setAttribute('aria-live', 'assertive')
    el.style.cssText =
      'position:fixed;left:0;right:0;bottom:max(20px,env(safe-area-inset-bottom));z-index:99999;padding:0 12px;pointer-events:none;display:flex;justify-content:center;'
    root.appendChild(el)
  }

  const safe = (detail ?? '').trim().slice(0, 280)
  el.innerHTML = `
    <div style="pointer-events:auto;max-width:min(100vw - 24px, 400px);margin:0 auto;border-radius:12px;border:1px solid rgba(185,28,28,0.35);background:linear-gradient(180deg,#fff1f2 0%,#ffe4e6 100%);box-shadow:0 12px 40px rgba(15,23,42,0.12),0 4px 12px rgba(185,28,28,0.08);padding:14px 16px;font-family:var(--font-ui-sans, system-ui, sans-serif);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div style="min-width:0;">
          <div style="font-size:13px;font-weight:700;color:#881337;letter-spacing:-0.02em;">Сақтау сәтсіз · Save failed</div>
          <div style="margin-top:6px;font-size:12px;line-height:1.45;color:#9f1239;font-weight:500;">
            Желі қатесі — интернетті тексеріңіз және қайта көріңіз.<br/>
            <span style="color:#64748b;font-weight:500;">Network error — check your connection and try again.</span>
          </div>
          ${
            safe
              ? `<pre style="margin:10px 0 0;font-size:11px;white-space:pre-wrap;word-break:break-word;color:#475569;font-family:ui-monospace,monospace;background:rgba(255,255,255,0.65);padding:8px 10px;border-radius:8px;border:1px solid rgba(15,23,42,0.06);">${escapeHtml(
                  safe,
                )}</pre>`
              : ''
          }
        </div>
        <button type="button" data-dismiss style="flex-shrink:0;border:none;background:rgba(255,255,255,0.7);color:#881337;font-size:12px;font-weight:700;cursor:pointer;padding:6px 10px;border-radius:8px;">OK</button>
      </div>
    </div>
  `

  const dismiss = () => {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = undefined
    el?.remove()
  }

  el.querySelector('[data-dismiss]')?.addEventListener('click', dismiss, { once: true })

  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(dismiss, 12000)

  requestAnimationFrame(() => {
    el?.scrollIntoView({ block: 'nearest' })
  })
}

const ACTION_TOAST_ID = 'editor-action-error-toast'

/** Short-lived toast for editor actions (e.g. custom page insert) — not necessarily network-related. */
export function showEditorActionErrorToast(titleKk: string, detail?: string): void {
  if (typeof document === 'undefined') return
  const root = document.body
  let el = document.getElementById(ACTION_TOAST_ID) as HTMLDivElement | null
  if (!el) {
    el = document.createElement('div')
    el.id = ACTION_TOAST_ID
    el.setAttribute('role', 'alert')
    el.setAttribute('aria-live', 'assertive')
    el.style.cssText =
      'position:fixed;left:0;right:0;bottom:max(88px,env(safe-area-inset-bottom));z-index:99998;padding:0 12px;pointer-events:none;display:flex;justify-content:center;'
    root.appendChild(el)
  }
  const safe = (detail ?? '').trim().slice(0, 280)
  el.innerHTML = `
    <div style="pointer-events:auto;max-width:min(100vw - 24px, 400px);margin:0 auto;border-radius:12px;border:1px solid rgba(185,28,28,0.35);background:linear-gradient(180deg,#fff1f2 0%,#ffe4e6 100%);box-shadow:0 12px 40px rgba(15,23,42,0.12);padding:14px 16px;font-family:var(--font-ui-sans, system-ui, sans-serif);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div style="min-width:0;">
          <div style="font-size:13px;font-weight:700;color:#881337;">${escapeHtml(titleKk)}</div>
          ${
            safe
              ? `<pre style="margin:10px 0 0;font-size:11px;white-space:pre-wrap;word-break:break-word;color:#475569;font-family:ui-monospace,monospace;background:rgba(255,255,255,0.65);padding:8px 10px;border-radius:8px;border:1px solid rgba(15,23,42,0.06);">${escapeHtml(
                  safe,
                )}</pre>`
              : ''
          }
        </div>
        <button type="button" data-dismiss style="flex-shrink:0;border:none;background:rgba(255,255,255,0.7);color:#881337;font-size:12px;font-weight:700;cursor:pointer;padding:6px 10px;border-radius:8px;">OK</button>
      </div>
    </div>
  `
  const dismiss = () => el?.remove()
  el.querySelector('[data-dismiss]')?.addEventListener('click', dismiss, { once: true })
  setTimeout(dismiss, 10000)
  requestAnimationFrame(() => el?.scrollIntoView({ block: 'nearest' }))
}

const SUCCESS_TOAST_ID = 'editor-save-success-toast'

/** Brief confirmation after manual «Сақтау». */
export function showEditorSaveSuccessToast(): void {
  if (typeof document === 'undefined') return
  const root = document.body
  let el = document.getElementById(SUCCESS_TOAST_ID) as HTMLDivElement | null
  if (!el) {
    el = document.createElement('div')
    el.id = SUCCESS_TOAST_ID
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    el.style.cssText =
      'position:fixed;left:0;right:0;bottom:max(88px,env(safe-area-inset-bottom));z-index:99997;padding:0 12px;pointer-events:none;display:flex;justify-content:center;'
    root.appendChild(el)
  }
  el.innerHTML = `
    <div style="pointer-events:auto;max-width:min(100vw - 24px, 360px);margin:0 auto;border-radius:12px;border:1px solid rgba(5,150,105,0.35);background:linear-gradient(180deg,#ecfdf5 0%,#d1fae5 100%);box-shadow:0 12px 40px rgba(15,23,42,0.1);padding:12px 16px;font-family:var(--font-ui-sans, system-ui, sans-serif);">
      <div style="font-size:13px;font-weight:700;color:#065f46;">Сақталды</div>
      <div style="margin-top:4px;font-size:12px;color:#047857;">Тақырып өлшемі, «Кітаптан жасыру» және тұрақты беттер сақталды.</div>
    </div>
  `
  const dismiss = () => el?.remove()
  setTimeout(dismiss, 3200)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
