import { beforeEach, describe, expect, it } from "vitest";

import { ERROR_CODES, STORES } from "@/lib/constants";
import { AssetRepository } from "@/services/storage/assetRepository";
import { getDB, withTransaction } from "@/services/storage/db";
import { MemoryRepository } from "@/services/storage/memoryRepository";
import { SceneRepository } from "@/services/storage/sceneRepository";
import {
  assetFixture,
  memoryFixture,
  resetDatabase,
  sceneFixture,
} from "../../helpers/data.js";

describe("transaction atomicity", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("rolls back every store when a write fails halfway through", async () => {
    await expect(
      withTransaction(
        [STORES.memories, STORES.scenes],
        "readwrite",
        async (tx) => {
          await tx
            .objectStore(STORES.memories)
            .put({ id: "half-written", title: "半成品", createdAt: 1, updatedAt: 1 });
          await tx
            .objectStore(STORES.scenes)
            .put({ id: "half-written-scene", memoryId: "half-written", createdAt: 1, updatedAt: 1 });
          throw new Error("simulated failure after two writes");
        },
        "Failed to write",
      ),
    ).rejects.toMatchObject({
      code: ERROR_CODES.STORAGE_FAILED,
      cause: { message: "simulated failure after two writes" },
    });

    const db = await getDB();

    await expect(MemoryRepository.getById("half-written")).resolves.toBeNull();
    expect(await db.get(STORES.scenes, "half-written-scene")).toBeUndefined();
  });

  it("leaves no orphan scene when a second create is rejected", async () => {
    const memory = await MemoryRepository.create(memoryFixture());
    const first = await SceneRepository.create(sceneFixture(memory.id));

    await expect(SceneRepository.create(sceneFixture(memory.id))).rejects.toMatchObject({
      code: ERROR_CODES.SCENE_ALREADY_EXISTS,
    });

    const db = await getDB();
    expect(await db.getAll(STORES.scenes)).toHaveLength(1);
    expect((await MemoryRepository.getById(memory.id)).sceneId).toBe(first.id);
  });

  it("keeps the cascade whole when the memory is already gone", async () => {
    const memory = await MemoryRepository.create(memoryFixture());
    const asset = await AssetRepository.create(assetFixture(memory.id));

    await expect(MemoryRepository.delete(memory.id)).resolves.toBe(memory.id);
    await expect(MemoryRepository.delete(memory.id)).rejects.toMatchObject({
      code: ERROR_CODES.MEMORY_NOT_FOUND,
    });
    await expect(AssetRepository.getById(asset.id)).resolves.toBeNull();
  });

  it("still removes an asset whose memory row is missing", async () => {
    const memory = await MemoryRepository.create(memoryFixture());
    const asset = await AssetRepository.create(assetFixture(memory.id));

    const db = await getDB();
    await db.delete(STORES.memories, memory.id);

    await expect(AssetRepository.delete(asset.id)).resolves.toBe(asset.id);
    await expect(AssetRepository.getById(asset.id)).resolves.toBeNull();
  });
});
