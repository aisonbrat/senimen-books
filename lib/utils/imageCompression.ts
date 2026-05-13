import imageCompression from 'browser-image-compression'

/**
 * Book `book-photos` uploads must preserve the user’s original pixels.
 * PDF/print read from Storage; any client-side resize here caused permanent blur.
 */
export async function prepareBookPhotoForUpload(file: File): Promise<File> {
  return file
}

/**
 * @deprecated Alias of {@link prepareBookPhotoForUpload}. Historically this applied
 * `maxWidthOrHeight: 2400` / `maxSizeMB: 1.5`, which degraded every stored image.
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
