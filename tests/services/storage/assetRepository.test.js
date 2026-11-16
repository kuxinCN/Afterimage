import { beforeEach, describe, expect, it } from "vitest";

import { ERROR_CODES } from "@/lib/constants";
import { AssetRepository } from "@/services/storage/assetRepository";
import { MemoryRepository } from "@/services/storage/memoryRepository";
import { assetFixture, imageBlob, memoryFixture, resetDatabase } from "../../helpers/data.js";

describe("AssetRepository", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function createMemory() {
    return MemoryRepository.create(memoryFixture());
  }

  it("persists the image as a blob and links it to the memory", async () => {
    const memory = await createMemory();
    const asset = await AssetRepository.create(assetFixture(memory.id));

    const stored = await AssetRepository.getById(asset.id);
    const reloadedMemory = await MemoryRepository.getById(memory.id);

    expect(stored.blob).toBeInstanceOf(Blob);
    expect(stored.blob.type).toBe("image/jpeg");
    expect(reloadedMemory.assetIds).toEqual([asset.id]);
  });

  it("returns the original bytes after a read", async () => {
    const memory = await createMemory();
    const blob = imageBlob([1, 2, 3, 4, 5]);
    const asset = await AssetRepository.create(assetFixture(memory.id, { blob }));

    const stored = await AssetRepository.getById(asset.id);

    expect(new Uint8Array(await stored.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it("never accepts a preview url as stored image data", async () => {
    const memory = await createMemory();

    await expect(
      AssetRepository.create({
        memoryId: memory.id,
        type: "image",
        blob: "blob:http://localhost/abc",
        mimeType: "image/jpeg",
        originalName: "photo.jpg",
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });
  });

  it("lists assets of one memory in upload order and keeps memories separate", async () => {
    const first = await createMemory();
    const second = await createMemory();
    const a = await AssetRepository.create({
      ...assetFixture(first.id),
      createdAt: 1000,
      originalName: "a.jpg",
    });
    const b = await AssetRepository.create({
      ...assetFixture(first.id),
      createdAt: 2000,
      originalName: "b.jpg",
    });
    await AssetRepository.create(assetFixture(second.id));

    const ownedByFirst = await AssetRepository.getByMemoryId(first.id);

    expect(ownedByFirst.map((asset) => asset.id)).toEqual([a.id, b.id]);
    await expect(AssetRepository.getByMemoryId(second.id)).resolves.toHaveLength(1);
  });

  it("stores an analysis result without touching the blob", async () => {
    const memory = await createMemory();
    const asset = await AssetRepository.create(assetFixture(memory.id));
    const analysis = {
      objects: [{ value: "餐盘", sourceType: "image_observed", confidence: 0.9, confirmed: false }],
    };

    const updated = await AssetRepository.update(asset.id, { analysis });

    expect(updated.analysis).toEqual(analysis);
    expect(updated.blob.size).toBe(asset.blob.size);
    await expect(AssetRepository.update("missing", { analysis })).rejects.toMatchObject({
      code: ERROR_CODES.ASSET_NOT_FOUND,
    });
  });

  it("deletes one asset and unlinks it from the memory", async () => {
    const memory = await createMemory();
    const kept = await AssetRepository.create(assetFixture(memory.id));
    const removed = await AssetRepository.create(assetFixture(memory.id));

    await AssetRepository.delete(removed.id);

    const reloadedMemory = await MemoryRepository.getById(memory.id);
    expect(await AssetRepository.getById(removed.id)).toBeNull();
    expect(reloadedMemory.assetIds).toEqual([kept.id]);
    await expect(AssetRepository.delete("missing")).rejects.toMatchObject({
      code: ERROR_CODES.ASSET_NOT_FOUND,
    });
  });

  it("deletes every asset of one memory", async () => {
    const target = await createMemory();
    const other = await createMemory();
    await AssetRepository.create(assetFixture(target.id));
    await AssetRepository.create(assetFixture(target.id));
    const survivor = await AssetRepository.create(assetFixture(other.id));

    await AssetRepository.deleteByMemoryId(target.id);

    await expect(AssetRepository.getByMemoryId(target.id)).resolves.toHaveLength(0);
    expect((await MemoryRepository.getById(target.id)).assetIds).toEqual([]);
    await expect(AssetRepository.getById(survivor.id)).resolves.toMatchObject({ id: survivor.id });
  });

  it("refuses an asset whose memory does not exist", async () => {
    await expect(AssetRepository.create(assetFixture("missing"))).rejects.toMatchObject({
      code: ERROR_CODES.MEMORY_NOT_FOUND,
    });
    await expect(AssetRepository.getByMemoryId("missing")).resolves.toEqual([]);
  });
});
