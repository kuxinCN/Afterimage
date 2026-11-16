import { describe, expect, it } from "vitest";

import { ERROR_CODES, IMAGE_IMPORT_LIMITS } from "@/lib/constants";
import {
  IMAGE_IMPORT_MESSAGES,
  fileFingerprint,
  inspectImageFile,
  inspectImageFiles,
} from "@/services/image/imageValidator";

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x49, 0x48];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00];

function makeFile({ name = "photo.jpg", bytes = JPEG, type = "image/jpeg" } = {}) {
  return new File([new Uint8Array([...bytes, 0x00, 0x00])], name, {
    type,
    lastModified: 1700000000000,
  });
}

function oversizedFile() {
  const file = makeFile({ name: "huge.jpg" });

  Object.defineProperty(file, "size", { value: IMAGE_IMPORT_LIMITS.MAX_FILE_BYTES + 1 });

  return file;
}

describe("inspectImageFile", () => {
  it("accepts the supported formats and reports the real mime type", async () => {
    const jpeg = await inspectImageFile(makeFile({ bytes: JPEG, type: "image/jpeg" }));
    const png = await inspectImageFile(makeFile({ name: "a.png", bytes: PNG, type: "image/png" }));
    const webp = await inspectImageFile(
      makeFile({ name: "a.webp", bytes: WEBP, type: "image/webp" }),
    );

    expect([jpeg.mimeType, png.mimeType, webp.mimeType]).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    expect([jpeg.ok, png.ok, webp.ok]).toEqual([true, true, true]);
  });

  it("trusts the bytes over a lying extension", async () => {
    const result = await inspectImageFile(makeFile({ name: "notes.jpg", bytes: GIF }));

    expect(result).toMatchObject({
      ok: false,
      reasonCode: ERROR_CODES.UNSUPPORTED_FILE_TYPE,
    });
  });

  it("rejects a declared type that is not supported even when bytes match", async () => {
    const result = await inspectImageFile(makeFile({ name: "a.jpg", bytes: JPEG, type: "image/gif" }));

    expect(result.reasonCode).toBe(ERROR_CODES.UNSUPPORTED_FILE_TYPE);
  });

  it("stores the sniffed mime type when a file is renamed", async () => {
    const result = await inspectImageFile(makeFile({ name: "a.png", bytes: JPEG, type: "image/png" }));

    expect(result).toMatchObject({ ok: true, mimeType: "image/jpeg", mimeTypeAdjusted: true });
  });

  it("accepts a file whose browser-reported type is empty", async () => {
    const result = await inspectImageFile(makeFile({ name: "camera.jpg", bytes: JPEG, type: "" }));

    expect(result).toMatchObject({ ok: true, mimeType: "image/jpeg", mimeTypeAdjusted: false });
  });

  it("rejects empty and oversized files", async () => {
    const empty = await inspectImageFile(new File([], "empty.jpg", { type: "image/jpeg" }));
    const huge = await inspectImageFile(oversizedFile());

    expect(empty.reasonCode).toBe(ERROR_CODES.FILE_EMPTY);
    expect(huge.reasonCode).toBe(ERROR_CODES.FILE_TOO_LARGE);
  });

  it("refuses to add the same file twice", async () => {
    const file = makeFile();
    const existing = [fileFingerprint(file)];

    const result = await inspectImageFile(file, { existingFingerprints: existing });

    expect(result.reasonCode).toBe(ERROR_CODES.DUPLICATE_IMAGE);
  });

  it("has a user-facing message for every rejection reason", async () => {
    const results = await Promise.all([
      inspectImageFile(new File([], "empty.jpg")),
      inspectImageFile(oversizedFile()),
      inspectImageFile(makeFile({ bytes: GIF, type: "image/gif" })),
      inspectImageFile(makeFile(), { remainingSlots: 0 }),
      inspectImageFile(makeFile(), { existingFingerprints: [fileFingerprint(makeFile())] }),
    ]);

    for (const result of results) {
      expect(result.ok).toBe(false);
      expect(result.message).toBeTruthy();
      expect(IMAGE_IMPORT_MESSAGES[result.reasonCode]).toBe(result.message);
    }
  });
});

describe("inspectImageFiles", () => {
  it("keeps the valid files in a mixed batch", async () => {
    const outcome = await inspectImageFiles([
      makeFile({ name: "good-1.jpg", bytes: JPEG }),
      makeFile({ name: "bad.gif", bytes: GIF, type: "image/gif" }),
      oversizedFile(),
      makeFile({ name: "good-2.png", bytes: PNG, type: "image/png" }),
      new File([], "empty.webp", { type: "image/webp" }),
    ]);

    expect(outcome.accepted.map((entry) => entry.file.name)).toEqual([
      "good-1.jpg",
      "good-2.png",
    ]);
    expect(outcome.rejected.map((entry) => entry.reasonCode)).toEqual([
      ERROR_CODES.UNSUPPORTED_FILE_TYPE,
      ERROR_CODES.FILE_TOO_LARGE,
      ERROR_CODES.FILE_EMPTY,
    ]);
    expect(outcome.remainingSlots).toBe(IMAGE_IMPORT_LIMITS.MAX_FILES_PER_IMPORT - 2);
  });

  it("enforces the nine image budget across batches", async () => {
    const files = Array.from({ length: IMAGE_IMPORT_LIMITS.MAX_FILES_PER_IMPORT }, (unused, i) =>
      makeFile({ name: `first-${i}.jpg` }),
    );
    const firstBatch = await inspectImageFiles(files);

    expect(firstBatch.accepted).toHaveLength(IMAGE_IMPORT_LIMITS.MAX_FILES_PER_IMPORT);
    expect(firstBatch.remainingSlots).toBe(0);

    const secondBatch = await inspectImageFiles([makeFile({ name: "late.jpg" })], {
      existingFingerprints: firstBatch.accepted.map((entry) => entry.fingerprint),
    });

    expect(secondBatch.accepted).toHaveLength(0);
    expect(secondBatch.rejected[0].reasonCode).toBe(ERROR_CODES.TOO_MANY_IMAGES);
  });

  it("drops a file repeated inside the same selection", async () => {
    const file = makeFile({ name: "same.jpg" });
    const outcome = await inspectImageFiles([file, file]);

    expect(outcome.accepted).toHaveLength(1);
    expect(outcome.rejected[0].reasonCode).toBe(ERROR_CODES.DUPLICATE_IMAGE);
  });

  it("returns empty results for an empty selection", async () => {
    const outcome = await inspectImageFiles([]);

    expect(outcome).toMatchObject({ accepted: [], rejected: [], remainingSlots: 9 });
  });
});
