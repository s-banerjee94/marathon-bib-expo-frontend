/**
 * Client-side image normalization for the presigned-upload flow.
 *
 * The backend stores the exact bytes we PUT to S3 (no server-side resize), so the
 * frontend normalizes every image before upload to keep quality consistent and
 * payloads small:
 *  - Avatars -> center-cropped to a square and re-encoded as JPEG (photos, no alpha).
 *  - Org / event logos -> downscaled within a bounding box, aspect preserved (never
 *                cropped), kept as PNG to retain transparency.
 *
 * JPEG/PNG are used (never WebP) so the chosen Content-Type is always one S3/the
 * backend accept, regardless of the source file the user picked.
 */

export interface NormalizedImage {
  blob: Blob;
  contentType: string;
}

const SQUARE_JPEG_TYPE = 'image/jpeg';
const SQUARE_JPEG_QUALITY = 0.85;
const AVATAR_SIZE = 512;

const LOGO_MAX_EDGE = 512;
const LOGO_TYPE = 'image/png';

/** Reject absurdly large source files before we try to decode them (~15 MB). */
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

/** Avatar: center-crop to a square and emit a 512×512 JPEG. */
export function normalizeAvatar(file: File): Promise<NormalizedImage> {
  return normalizeSquareJpeg(file, AVATAR_SIZE);
}

/** Center-crop to a square `size`×`size` and encode as JPEG (photos, no alpha). */
async function normalizeSquareJpeg(file: File, size: number): Promise<NormalizedImage> {
  assertImage(file);
  const img = await decode(file);
  try {
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;

    const canvas = createCanvas(size, size);
    const ctx = get2dContext(canvas);
    ctx.drawImage(img.source, sx, sy, side, side, 0, 0, size, size);

    const blob = await toBlob(canvas, SQUARE_JPEG_TYPE, SQUARE_JPEG_QUALITY);
    return { blob, contentType: SQUARE_JPEG_TYPE };
  } finally {
    img.close();
  }
}

/** Logo: preserve aspect ratio, downscale so the longest edge ≤ maxEdge, emit PNG (keeps alpha). */
export async function normalizeLogo(file: File, maxEdge = LOGO_MAX_EDGE): Promise<NormalizedImage> {
  assertImage(file);
  const img = await decode(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = createCanvas(width, height);
    const ctx = get2dContext(canvas);
    ctx.drawImage(img.source, 0, 0, width, height);

    const blob = await toBlob(canvas, LOGO_TYPE);
    return { blob, contentType: LOGO_TYPE };
  } finally {
    img.close();
  }
}

function assertImage(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Image is too large. Please choose a file under 15 MB.');
  }
}

/**
 * Decode a file to a drawable source. Prefers createImageBitmap (fast, honors EXIF
 * orientation), falling back to an <img> element when unavailable.
 */
async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> loader (e.g. unsupported decode options).
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const el = await loadImageElement(url);
    return {
      source: el,
      width: el.naturalWidth,
      height: el.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not read the selected image.'));
    el.src = url;
  });
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Image processing is not supported in this browser.');
  }
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process the image.'))),
      type,
      quality,
    );
  });
}
