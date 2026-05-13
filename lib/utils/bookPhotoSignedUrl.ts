/**
 * @deprecated Import from `@/lib/storage/bookPhotos` instead.
 * Re-exports preserved for gradual migration.
 */
export {
  candidateStorageObjectPaths as candidateStoragePaths,
  createSignedBookPhotoUrl,
  downloadBookPhotoBlob,
  getDisplayableUrl,
  loadBookPhotoBlobUrlOnly,
  loadBookPhotoForDisplay,
  normalizeBookPhotoRef,
} from '@/lib/storage/bookPhotos'

export type { GetDisplayableUrlOptions, LoadedBookPhoto, NormalizedBookPhotoRef } from '@/lib/storage/bookPhotos'
