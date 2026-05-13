import imageCompression from 'browser-image-compression'

const storageOpts = {
  maxSizeMB: 1.5,
  maxWidthOrHeight: 2400,
} as const

/**
 * Worker failures (Safari / strict CSP / worker startup) sometimes reject with a
 * DOM Event — not an Error — which breaks Next's dev overlay. Fallback: no worker, then raw file.
 */
export async function compressForStorage(file: File): Promise<File> {
  try {
    return await imageCompression(file, { ...storageOpts, useWebWorker: true })
  } catch {
    try {
      return await imageCompression(file, { ...storageOpts, useWebWorker: false })
    } catch {
      return file
    }
  }
}

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
