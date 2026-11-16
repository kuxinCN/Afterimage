import { beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_CODES } from "@/lib/constants";
import { AssetRepository } from "@/services/storage/assetRepository";
import { closeDB, getDB, isStorageAvailable } from "@/services/storage/db";
import { ExplorationRepository } from "@/services/storage/explorationRepository";
import { MemoryRepository } from "@/services/storage/memoryRepository";
import { SceneRepository } from "@/services/storage/sceneRepository";
import {
  assetFixture,
  memoryFixture,
  resetDatabase,
  sceneFixture,
} from "../../helpers/data.js";

async function seedMemory({ assets = 1, withScene = false, withExploration = false } = {}) {
  const memory = await MemoryRepository.create(memoryFixture());
  const createdAssets = [];

  for (let index = 0; index < assets; index += 1) {
    createdAssets.push(
      await AssetRepository.create(assetFixture(memory.id, { originalName: `${index}.jpg` })),
    );
  }

  let scene = null;
  if (withScene) {
    scene = await SceneRepository.create(sceneFixture(memory.id));
  }
  if (withExploration) {
    await ExplorationRepository.markHotspotVisited(memory.id, "h1");
  }

  return { memory, assets: createdAssets, scene };
}

describe("data integrity", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("deletes every related record with the memory", async () => {
    const target = await seedMemory({ assets: 2, withScene: true, withExploration: true });
    const other = await seedMemory({ assets: 1, withScene: true, withExploration: true });

    await MemoryRepository.delete(target.memory.id);

    await expect(MemoryRepository.getById(target.memory.id)).resolves.toBeNull();
    for (const asset of target.assets) {
      await expect(AssetRepository.getById(asset.id)).resolves.toBeNull();
    }
    await expect(SceneRepository.getById(target.scene.id)).resolves.toBeNull();
    await expect(ExplorationRepository.getByMemoryId(target.memory.id)).resolves.toBeNull();

    await expect(MemoryRepository.getById(other.memory.id)).resolves.toMatchObject({
      assetIds: [other.assets[0].id],
      sceneId: other.scene.id,
    });
    await expect(AssetRepository.getById(other.assets[0].id)).resolves.toMatchObject({
      id: other.assets[0].id,
    });
    await expect(ExplorationRepository.getByMemoryId(other.memory.id)).resolves.toMatchObject({
      visitedHotspots: ["h1"],
    });
  });

  it("keeps two memories independent while editing both", async () => {
    const first = await seedMemory({ assets: 3 });
    const second = await seedMemory({ assets: 1 });

    await MemoryRepository.update(first.memory.id, { title: "第一段" });
    await AssetRepository.delete(first.assets[0].id);

    expect((await MemoryRepository.getById(first.memory.id)).assetIds).toHaveLength(2);
    expect((await MemoryRepository.getById(second.memory.id)).assetIds).toHaveLength(1);
    await expect(MemoryRepository.getAll()).resolves.toHaveLength(2);
  });

  it("restores memories, image bytes, layout and progress after a reload", async () => {
    const { memory, assets, scene } = await seedMemory({ assets: 1, withScene: true });
    await SceneRepository.update(scene.id, {
      hotspots: [{ id: "h1", name: "餐盘", position: { x: 0.5, y: 0.5 }, sourceType: "image_observed" }],
    });
    await ExplorationRepository.markHotspotVisited(memory.id, "h1");
    await closeDB();

    vi.resetModules();
    const reloadedMemoryRepository = (await import("@/services/storage/memoryRepository"))
      .MemoryRepository;
    const reloadedAssetRepository = (await import("@/services/storage/assetRepository"))
      .AssetRepository;
    const reloadedSceneRepository = (await import("@/services/storage/sceneRepository"))
      .SceneRepository;
    const reloadedExplorationRepository = (await import("@/services/storage/explorationRepository"))
      .ExplorationRepository;

    const storedMemory = await reloadedMemoryRepository.getById(memory.id);
    const storedAsset = await reloadedAssetRepository.getById(assets[0].id);
    const storedScene = await reloadedSceneRepository.getByMemoryId(memory.id);
    const storedExploration = await reloadedExplorationRepository.getByMemoryId(memory.id);

    expect(storedMemory).toMatchObject({ id: memory.id, assetIds: [assets[0].id] });
    expect(new Uint8Array(await storedAsset.blob.arrayBuffer())).toEqual(
      new Uint8Array([255, 216, 255, 219]),
    );
    expect(storedAsset.blob.size).toBe(assets[0].blob.size);
    expect(storedScene.hotspots[0].position).toEqual({ x: 0.5, y: 0.5 });
    expect(storedExploration.visitedHotspots).toEqual(["h1"]);

    await closeDB();
  });

  it("reuses one connection until it is closed", async () => {
    const first = await getDB();

    await expect(getDB()).resolves.toBe(first);

    await closeDB();
    const second = await getDB();

    expect(second).not.toBe(first);
    await closeDB();
  });

  it("loads safely without IndexedDB and rejects with a typed error", async () => {
    const original = globalThis.indexedDB;
    globalThis.indexedDB = undefined;

    expect(isStorageAvailable()).toBe(false);
    vi.resetModules();
    const serverSideRepository = (await import("@/services/storage/memoryRepository"))
      .MemoryRepository;

    await expect(serverSideRepository.getAll()).rejects.toMatchObject({
      code: ERROR_CODES.STORAGE_UNAVAILABLE,
    });
    await expect(getDB()).rejects.toBeInstanceOf(Error);

    globalThis.indexedDB = original;
    expect(isStorageAvailable()).toBe(true);
  });

  it("rejects a second write to the same key instead of silently overwriting", async () => {
    const { memory } = await seedMemory();

    await expect(
      MemoryRepository.update(memory.id, { status: "reviewing" }),
    ).resolves.toMatchObject({ status: "reviewing" });
    await expect(MemoryRepository.update(memory.id, { status: "invalid" })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
    expect((await MemoryRepository.getById(memory.id)).status).toBe("reviewing");
  });
});
