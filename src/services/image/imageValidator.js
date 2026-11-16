import { ERROR_CODES, IMAGE_IMPORT_LIMITS, SUPPORTED_IMAGE_MIME_TYPES } from "@/lib/constants";
import { formatBytes } from "@/lib/utils";
import { mimeTypeForFormat, sniffImageFormat } from "./imageSignature";

const { MAX_FILE_BYTES, MAX_FILES_PER_IMPORT, HEADER_BYTES_TO_READ } = IMAGE_IMPORT_LIMITS;

export const IMAGE_IMPORT_MESSAGES = {
  [ERROR_CODES.FILE_EMPTY]: "这个文件是空的，无法导入。",
  [ERROR_CODES.FILE_TOO_LARGE]: `单张图片不能超过 ${formatBytes(MAX_FILE_BYTES)}。`,
  [ERROR_CODES.UNSUPPORTED_FILE_TYPE]: "只支持 JPG、PNG、WebP 图片（HEIC、GIF、SVG 暂不支持）。",
  [ERROR_CODES.TOO_MANY_IMAGES]: `一段记忆最多 ${MAX_FILES_PER_IMPORT} 张图片。`,
  [ERROR_CODES.DUPLICATE_IMAGE]: "这张图片已经添加过了。",
  [ERROR_CODES.CORRUPTED_IMAGE]: "读不到图片内容，文件可能已损坏。",
};

function reject(reasonCode, file, detail) {
  return {
    ok: false,
    file,
    reasonCode,
    message: IMAGE_IMPORT_MESSAGES[reasonCode],
    detail,
  };
}

export function fileFingerprint(file) {
  return `${file.name ?? ""}:${file.size ?? 0}:${file.lastModified ?? 0}`;
}

export async function inspectImageFile(file, { existingFingerprints = [], remainingSlots } = {}) {
  const fingerprint = fileFingerprint(file);
  const slots = remainingSlots ?? MAX_FILES_PER_IMPORT;
  const declaredType = typeof file?.type === "string" ? file.type.toLowerCase() : "";

  if (!file || file.size === 0) {
    return reject(ERROR_CODES.FILE_EMPTY, file, "empty file");
  }
  if (file.size > MAX_FILE_BYTES) {
    return reject(ERROR_CODES.FILE_TOO_LARGE, file, `${file.size} bytes`);
  }
  if (slots <= 0) {
    return reject(ERROR_CODES.TOO_MANY_IMAGES, file, `limit ${MAX_FILES_PER_IMPORT}`);
  }
  if (existingFingerprints.includes(fingerprint)) {
    return reject(ERROR_CODES.DUPLICATE_IMAGE, file, fingerprint);
  }
  if (declaredType && !SUPPORTED_IMAGE_MIME_TYPES.includes(declaredType)) {
    return reject(ERROR_CODES.UNSUPPORTED_FILE_TYPE, file, `declared ${declaredType}`);
  }

  const format = await sniffImageFormat(file, HEADER_BYTES_TO_READ);

  if (!format) {
    return reject(ERROR_CODES.UNSUPPORTED_FILE_TYPE, file, "no known image signature");
  }

  const mimeType = mimeTypeForFormat(format);

  return {
    ok: true,
    file,
    fingerprint,
    format,
    mimeType,
    // The signature is the truth: a PNG renamed to .jpg is stored as image/png.
    mimeTypeAdjusted: Boolean(declaredType) && declaredType !== mimeType,
  };
}

// One bad file must not drop the rest of the batch, so every file gets its own
// verdict and the slot budget is consumed only by accepted images.
export async function inspectImageFiles(files, { existingFingerprints = [] } = {}) {
  const accepted = [];
  const rejected = [];
  const seen = [...existingFingerprints];
  let remaining = MAX_FILES_PER_IMPORT - existingFingerprints.length;

  for (const file of files) {
    const result = await inspectImageFile(file, {
      existingFingerprints: seen,
      remainingSlots: remaining,
    });

    if (result.ok) {
      accepted.push(result);
      seen.push(result.fingerprint);
      remaining -= 1;
    } else {
      rejected.push(result);
    }
  }

  return { accepted, rejected, remainingSlots: Math.max(remaining, 0) };
}
