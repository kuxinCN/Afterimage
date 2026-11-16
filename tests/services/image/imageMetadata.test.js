import { afterEach, describe, expect, it, vi } from "vitest";

import { readImageMetadata } from "@/services/image/imageMetadata";

const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01]);

function imageFile() {
  return new File([BYTES], "photo.jpg", { type: "image/jpeg" });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readImageMetadata", () => {
  it("reads the original dimensions and releases the decoded bitmap", async () => {
    const close = vi.fn();
    const createBitmap = vi.fn(async () => ({ width: 4032, height: 3024, close }));

    vi.stubGlobal("createImageBitmap", createBitmap);

    const result = await readImageMetadata(imageFile());

    expect(result).toMatchObject({
      width: 4032,
      height: 3024,
      thumbnailBlob: null,
      decodeSupported: true,
      decodeFailed: false,
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("reports a file that cannot be decoded", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("The source image could not be decoded.");
      }),
    );

    const result = await readImageMetadata(imageFile());

    expect(result.decodeFailed).toBe(true);
    expect(result.width).toBeNull();
  });

  it("degrades instead of failing when the browser has no decoder", async () => {
    vi.stubGlobal("createImageBitmap", undefined);

    const result = await readImageMetadata(imageFile());

    expect(result).toMatchObject({
      decodeSupported: false,
      decodeFailed: false,
      width: null,
      height: null,
    });
  });

  it("keeps the dimensions when only thumbnailing fails", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 160, height: 90, close: () => {} })),
    );
    vi.stubGlobal("document", {
      createElement() {
        throw new Error("canvas unavailable");
      },
    });

    const result = await readImageMetadata(imageFile());

    expect(result).toMatchObject({ width: 160, height: 90, thumbnailBlob: null });
  });

  it("never rewrites the source file while probing it", async () => {
    const file = imageFile();

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 10, height: 10, close: () => {} })),
    );

    await readImageMetadata(file);

    expect(new Uint8Array(await file.arrayBuffer())).toEqual(BYTES);
  });
});
