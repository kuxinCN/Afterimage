import { IMAGE_IMPORT_LIMITS } from "@/lib/constants";

const { THUMBNAIL_MAX_EDGE, THUMBNAIL_QUALITY } = IMAGE_IMPORT_LIMITS;

function canvasToBlob(canvas, mimeType) {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== "function") {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob ?? null), mimeType, THUMBNAIL_QUALITY);
  });
}

async function drawThumbnail(bitmap, mimeType) {
  if (typeof document === "undefined" || !bitmap.width || !bitmap.height) {
    return null;
  }

  const scale = Math.min(1, THUMBNAIL_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await canvasToBlob(canvas, mimeType);

  return blob && blob.size > 0 ? blob : null;
}

// The original file bytes are never rewritten: this only reads dimensions and
// renders a downscale copy for the preview grid.
export async function readImageMetadata(file) {
  const metadata = {
    width: null,
    height: null,
    thumbnailBlob: null,
    decodeSupported: true,
    decodeFailed: false,
  };

  if (typeof globalThis.createImageBitmap !== "function") {
    return { ...metadata, decodeSupported: false };
  }

  let bitmap;

  try {
    bitmap = await globalThis.createImageBitmap(file);
  } catch (error) {
    return { ...metadata, decodeFailed: true, error };
  }

  try {
    metadata.width = Number.isFinite(bitmap.width) ? bitmap.width : null;
    metadata.height = Number.isFinite(bitmap.height) ? bitmap.height : null;
    metadata.thumbnailBlob = await drawThumbnail(bitmap, file.type);
  } catch (error) {
    // A missing thumbnail must not block saving the untouched original.
    metadata.thumbnailBlob = null;
    metadata.error = error;
  } finally {
    bitmap.close?.();
  }

  return metadata;
}
