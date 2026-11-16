import { describe, expect, it } from "vitest";

import { IMAGE_IMPORT_LIMITS } from "@/lib/constants";
import {
  mimeTypeForFormat,
  readImageFormat,
  sniffImageFormat,
} from "@/services/image/imageSignature";

function ascii(text) {
  return Array.from(text, (char) => char.charCodeAt(0));
}

function pad(bytes) {
  return new Uint8Array([...bytes, ...new Array(24 - bytes.length).fill(0)]);
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0, ...ascii("JFIF"), 0x00, 0x01];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...ascii("IHDR")];
const WEBP = [...ascii("RIFF"), 0x20, 0x00, 0x00, 0x00, ...ascii("WEBP"), 0x56, 0x50];
const GIF = [...ascii("GIF89a"), 0x01, 0x00, 0x01, 0x00, 0x00, 0x00];
const HEIC = [0x00, 0x00, 0x00, 0x18, ...ascii("ftyp"), ...ascii("heic"), 0x00];
const SVG = [...ascii("<svg xmlns="), 0x00];
const ZIP = [...ascii("PK"), 0x03, 0x04, 0x14, 0x00, 0x00, 0x00];

describe("imageSignature", () => {
  it("recognises the three supported containers", () => {
    expect(readImageFormat(pad(JPEG))).toBe("jpeg");
    expect(readImageFormat(pad(PNG))).toBe("png");
    expect(readImageFormat(pad(WEBP))).toBe("webp");
  });

  it("rejects formats this release does not support", () => {
    expect(readImageFormat(pad(GIF))).toBeNull();
    expect(readImageFormat(pad(HEIC))).toBeNull();
    expect(readImageFormat(pad(SVG))).toBeNull();
    expect(readImageFormat(pad(ZIP))).toBeNull();
  });

  it("returns null for a header that is too short to identify", () => {
    expect(readImageFormat(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(readImageFormat(null)).toBeNull();
  });

  it("maps a format to its real mime type", () => {
    expect(mimeTypeForFormat("jpeg")).toBe("image/jpeg");
    expect(mimeTypeForFormat("png")).toBe("image/png");
    expect(mimeTypeForFormat("webp")).toBe("image/webp");
    expect(mimeTypeForFormat("gif")).toBeNull();
  });

  it("reads only the header bytes from the blob", async () => {
    const blob = new Blob([pad(WEBP)], { type: "image/png" });

    await expect(sniffImageFormat(blob, IMAGE_IMPORT_LIMITS.HEADER_BYTES_TO_READ)).resolves.toBe(
      "webp",
    );
  });

  it("returns null for an empty blob instead of throwing", async () => {
    await expect(sniffImageFormat(new Blob([]), 16)).resolves.toBeNull();
    await expect(sniffImageFormat(null, 16)).resolves.toBeNull();
  });
});
