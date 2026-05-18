import imageCompression from 'browser-image-compression'

/** Max longest side for stored book photos — print-safe, avoids 12MB+ phone originals freezing the UI. */
const MAX_BOOK_PHOTO_UPLOAD_SIDE_PX = 2500
const BOOK_PHOTO_JPEG_QUALITY = 0.92

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 80 })
    } else {
      setTimeout(resolve, 0)
    }
  })
}

function canvasToJpegFile(canvas: HTMLCanvasElement, fileName: string, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('jpeg encode failed'))
          return
        }
        resolve(new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() }))
      },
      'image/jpeg',
      quality,
    )
  })
}

async function compressViaCanvas(file: File): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('image decode failed'))
      el.src = url
    })

    const nw = img.naturalWidth
    const nh = img.naturalHeight
    if (nw < 1 || nh < 1) return file

    const maxSide = Math.max(nw, nh)
    const scale = maxSide > MAX_BOOK_PHOTO_UPLOAD_SIDE_PX ? MAX_BOOK_PHOTO_UPLOAD_SIDE_PX / maxSide : 1
    const cw = Math.max(1, Math.round(nw * scale))
    const ch = Math.max(1, Math.round(nh * scale))

    await yieldToMain()

    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, cw, ch)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, nw, nh, 0, 0, cw, ch)

    const base = file.name.replace(/\.[^.]+$/i, '') || 'photo'
    return await canvasToJpegFile(canvas, `${base}.jpg`, BOOK_PHOTO_JPEG_QUALITY)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Resize huge phone photos before Storage upload (max 2500px, JPEG @ 0.92).
 * Uses a Web Worker when available so the editor UI stays responsive.
 */
export async function prepareBookPhotoForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  await yieldToMain()

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 8,
      maxWidthOrHeight: MAX_BOOK_PHOTO_UPLOAD_SIDE_PX,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: BOOK_PHOTO_JPEG_QUALITY,
      alwaysKeepResolution: false,
    })
    const base = file.name.replace(/\.[^.]+$/i, '') || 'photo'
    const name = compressed.name.endsWith('.jpg') || compressed.name.endsWith('.jpeg') ? compressed.name : `${base}.jpg`
    return new File([compressed], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    try {
      return await compressViaCanvas(file)
    } catch {
      return file
    }
  }
}

/**
 * @deprecated Alias of {@link prepareBookPhotoForUpload}.
 */
export async function compressForStorage(file: File): Promise<File> {
  return prepareBookPhotoForUpload(file)
}

/** Optional tiny previews (e.g. local UI); not used for Storage uploads. */
export async function compressForPreview(file: File): Promise<File> {
  try {
    return await imageCompression(file, {
      maxSizeMB: 0.3,
      maxWidthOrHeight: 800,
      useWebWorker: true,
    })
  } catch {
    try {
      return await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 800,
        useWebWorker: false,
      })
    } catch {
      return file
    }
  }
}
