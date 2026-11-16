import { IMAGE_FORMAT_MIME_TYPES } from "@/lib/constants";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function ascii(bytes, from, to) {
  let text = "";
  for (let index = from; index < to; index += 1) {
    text += String.fromCharCode(bytes[index]);
  }
  return text;
}

// Extension and File.type are both attacker-controllable and frequently wrong,
// so the container signature decides what we actually accept and store.
export function readImageFormat(header) {
  if (!header || header.length < 12) {
    return null;
  }
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return "jpeg";
  }
  if (PNG_MAGIC.every((byte, index) => header[index] === byte)) {
    return "png";
  }
  if (ascii(header, 0, 4) === "RIFF" && ascii(header, 8, 12) === "WEBP") {
    return "webp";
  }
  return null;
}

export async function sniffImageFormat(blob, headerBytes) {
  if (!blob || typeof blob.slice !== "function" || blob.size === 0) {
    return null;
  }

  const buffer = await blob.slice(0, headerBytes).arrayBuffer();

  return readImageFormat(new Uint8Array(buffer));
}

export function mimeTypeForFormat(format) {
  return IMAGE_FORMAT_MIME_TYPES[format] ?? null;
}
