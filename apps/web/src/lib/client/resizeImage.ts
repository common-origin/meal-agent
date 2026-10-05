/**
 * Client-side photo resizing before upload (#82).
 *
 * Vercel rejects function request bodies over 4.5 MB, and phone photos are
 * often 2–6 MB. Gemini gains nothing from full resolution here, so photos
 * are scaled to a 1600 px long edge and re-encoded as JPEG before upload.
 */

export const MAX_UPLOAD_EDGE_PX = 1600;
export const UPLOAD_JPEG_QUALITY = 0.8;
/** Largest original we'll send when the browser can't decode it (e.g. HEIC in Chrome). */
export const MAX_ORIGINAL_UPLOAD_BYTES = 4 * 1024 * 1024;

export const PHOTO_TOO_LARGE_MESSAGE = 'That photo is too large. Try a screenshot or a smaller photo.';

export class PhotoTooLargeError extends Error {
  constructor() {
    super(PHOTO_TOO_LARGE_MESSAGE);
    this.name = 'PhotoTooLargeError';
  }
}

/** Scales (width, height) so the long edge is at most `maxEdge`, never upscaling. */
export function computeTargetSize(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Returns a JPEG of `file` with its long edge at most 1600 px. If the browser
 * can't decode or re-encode it, returns the original when it's small enough
 * to send, otherwise throws PhotoTooLargeError.
 */
export async function resizeImageForUpload(file: File): Promise<File> {
  try {
    // Canvas re-encoding drops EXIF, so apply the orientation tag while decoding.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      const { width, height } = computeTargetSize(bitmap.width, bitmap.height, MAX_UPLOAD_EDGE_PX);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D context unavailable');
      // JPEG has no alpha: paint transparent areas (e.g. PNG screenshots) white, not black.
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', UPLOAD_JPEG_QUALITY)
      );
      if (!blob) throw new Error('Canvas JPEG export failed');
      return new File([blob], `${baseName(file.name)}.jpg`, { type: 'image/jpeg' });
    } finally {
      bitmap.close();
    }
  } catch (error) {
    console.warn('Could not resize photo before upload, considering the original:', error);
    if (file.size <= MAX_ORIGINAL_UPLOAD_BYTES) return withImageType(file);
    throw new PhotoTooLargeError();
  }
}

/** Resizes `file` and wraps it as the `image` field our photo routes expect. */
export async function imageUploadFormData(file: File): Promise<FormData> {
  const formData = new FormData();
  formData.append('image', await resizeImageForUpload(file));
  return formData;
}

// Browsers report an empty type for formats they don't know (e.g. HEIC on
// Windows Chrome), and the routes only accept image/*. Gemini accepts these.
const TYPE_BY_EXTENSION: Record<string, string> = {
  heic: 'image/heic',
  heif: 'image/heif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function withImageType(file: File): File {
  if (file.type) return file;
  const type = TYPE_BY_EXTENSION[file.name.split('.').pop()?.toLowerCase() ?? ''];
  return type ? new File([file], file.name, { type }) : file;
}

function baseName(name: string): string {
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name) || 'photo';
}
