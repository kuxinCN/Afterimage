import { beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_CODES, MEMORY_STATUS, SOURCE_TYPES, STORES } from "@/lib/constants";
import { createMemoryWithImages, readMemoryWithAssets, removeMemoryAsset } from "@/services/memory/memoryService";
import { AssetRepository } from "@/services/storage/assetRepository";
import { closeDB, getDB } from "@/services/storage/db";
import { MemoryRepository } from "@/services/storage/memoryRepository";
import { userConfirmedValue } from "@/schemas/memorySchema";
import { resetDatabase } from "../../helpers/data.js";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];

function pendingImage(name = "photo.jpg", overrides = {}) {
  const file = new File([new Uint8Array(JPEG_BYTES)], name, { type: "image/jpeg" });

  return {
    file,
    blob: file,
    mimeType: "image/jpeg",
    originalName: name,
    width: 4032,
    height: 3024,
    ...overrides,
  };
}

function formInput(overrides = {}) {
  return {
    title: "教室最后一排",
    description: "下午第三节课之后的那顿饭",
    date: "2026-11-15",
    location: null,
    images: [pendingImage()],
    ...overrides,
  };
}

describe("createMemoryWithImages", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("stores the memory and the original image bytes", async () => {
    const { memory, assets } = await createMemoryWithImages(formInput());

    expect(memory.status).toBe(MEMORY_STATUS.DRAFT);
    expect(memory.title).toBe("教室最后一排");
    expect(assets).toHaveLength(1);

    const stored = await AssetRepository.getById(assets[0].id);

    expect(stored).toMatchObject({
      memoryId: memory.id,
      type: "image",
      mimeType: "image/jpeg",
      originalName: "photo.jpg",
      width: 4032,
      height: 3024,
      analysis: null,
    });
    expect(new Uint8Array(await stored.blob.arrayBuffer())).toEqual(new Uint8Array(JPEG_BYTES));
    expect(memory.assetIds).toEqual([assets[0].id]);
  });

  it("keeps memory.assetIds consistent with the asset rows for many images", async () => {
    const { memory, assets } = await createMemoryWithImages(
      formInput({
        images: [pendingImage("a.jpg"), pendingImage("b.png"), pendingImage("c.webp")],
      }),
    );

    expect(assets).toHaveLength(3);
    expect([...memory.assetIds].sort()).toEqual(assets.map((asset) => asset.id).sort());

    const { assets: reread } = await readMemoryWithAssets(memory.id);

    expect(reread.map((asset) => asset.id).sort()).toEqual(memory.assetIds.slice().sort());
  });

  it("records a user-typed location with its provenance", async () => {
    const { memory } = await createMemoryWithImages(
      formInput({ location: userConfirmedValue("老校区食堂二楼") }),
    );

    expect(memory.location).toMatchObject({
      value: "老校区食堂二楼",
      sourceType: SOURCE_TYPES.USER_CONFIRMED,
      confirmed: true,
    });
  });

  it("requires at least one image", async () => {
    await expect(createMemoryWithImages(formInput({ images: [] }))).rejects.toMatchObject({
      code: ERROR_CODES.IMAGES_REQUIRED,
    });
    await expect(MemoryRepository.getAll()).resolves.toHaveLength(0);
  });

  it("rolls the whole import back when one image fails to save", async () => {
    const db = await getDB();

    await expect(
      createMemoryWithImages(
        formInput({
          images: [
            pendingImage("good.jpg"),
            pendingImage("lost.jpg", { blob: null, file: null }),
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });

    await expect(MemoryRepository.getAll()).resolves.toHaveLength(0);
    expect(await db.getAll(STORES.assets)).toHaveLength(0);
  });

  it("rolls back when the form itself is invalid", async () => {
    const db = await getDB();

    await expect(createMemoryWithImages(formInput({ title: "" }))).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });

    await expect(MemoryRepository.getAll()).resolves.toHaveLength(0);
    expect(await db.getAll(STORES.assets)).toHaveLength(0);
  });

  it("never stores a preview url alongside the blob", async () => {
    const { assets } = await createMemoryWithImages(formInput());
    const db = await getDB();
    const stored = await db.get(STORES.assets, assets[0].id);

    expect(Object.keys(stored).sort()).toEqual([
      "analysis",
      "blob",
      "createdAt",
      "height",
      "id",
      "memoryId",
      "mimeType",
      "originalName",
      "type",
      "width",
    ]);
    expect(stored.blob).toBeInstanceOf(Blob);
  });
});

describe("reading and removing saved images", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("reloads images from IndexedDB after a page reload", async () => {
    const { memory, assets } = await createMemoryWithImages(formInput());

    await closeDB();
    vi.resetModules();

    const reloadedService = await import("@/services/memory/memoryService");
    const { memory: reloadedMemory, assets: reloadedAssets } =
      await reloadedService.readMemoryWithAssets(memory.id);

    expect(reloadedMemory.id).toBe(memory.id);
    expect(reloadedAssets).toHaveLength(1);
    expect(new Uint8Array(await reloadedAssets[0].blob.arrayBuffer())).toEqual(
      new Uint8Array(JPEG_BYTES),
    );
    expect(reloadedAssets[0].id).toBe(assets[0].id);

    await closeDB();
  });

  it("syncs memory.assetIds when one image is removed", async () => {
    const { memory } = await createMemoryWithImages(
      formInput({ images: [pendingImage("a.jpg"), pendingImage("b.jpg")] }),
    );
    const kept = memory.assetIds[1];

    const result = await removeMemoryAsset(memory.id, memory.assetIds[0]);

    expect(result.assets.map((asset) => asset.id)).toEqual([kept]);
    expect((await MemoryRepository.getById(memory.id)).assetIds).toEqual([kept]);
    await expect(AssetRepository.getById(memory.assetIds[0])).resolves.toBeNull();
  });

  it("cascades every image when the memory is deleted", async () => {
    const { memory } = await createMemoryWithImages(
      formInput({ images: [pendingImage("a.jpg"), pendingImage("b.jpg"), pendingImage("c.jpg")] }),
    );
    const assetIds = memory.assetIds;

    await MemoryRepository.delete(memory.id);

    const db = await getDB();

    await expect(MemoryRepository.getById(memory.id)).resolves.toBeNull();
    expect(await db.getAll(STORES.assets)).toHaveLength(0);

    for (const assetId of assetIds) {
      await expect(AssetRepository.getById(assetId)).resolves.toBeNull();
    }
  });

  it("reports a memory that is not there", async () => {
    await expect(readMemoryWithAssets("missing")).rejects.toMatchObject({
      code: ERROR_CODES.MEMORY_NOT_FOUND,
    });
  });
});
