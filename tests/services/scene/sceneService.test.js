import { beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_CODES, STORES } from "@/lib/constants";
import { analyzeMemory, confirmAnalysis, generateScene } from "@/services/ai/aiService";
import { readScene, visitHotspot } from "@/services/scene/sceneService";
import { AssetRepository } from "@/services/storage/assetRepository";
import { closeDB, getDB } from "@/services/storage/db";
import { ExplorationRepository } from "@/services/storage/explorationRepository";
import { MemoryRepository } from "@/services/storage/memoryRepository";
import { assetFixture, memoryFixture, resetDatabase } from "../../helpers/data.js";

const DESCRIPTION = "昨天和同学在学校食堂吃饭，桌上有一个餐盘，旁边放着筷子和杯子。";

async function confirmedMemory() {
  const memory = await MemoryRepository.create(memoryFixture({ description: DESCRIPTION }));

  await AssetRepository.create(assetFixture(memory.id));

  const { draft } = await analyzeMemory(memory.id);

  await confirmAnalysis(memory.id, {
    ...draft,
    elements: draft.elements.map((item) => ({ ...item, adopted: true })),
  });

  return MemoryRepository.getById(memory.id);
}

async function memoryWithScene() {
  const memory = await confirmedMemory();
  const { scene } = await generateScene(memory.id);

  return { memory, scene };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("readScene", () => {
  it("returns an empty scene slot for a memory that has none", async () => {
    const memory = await confirmedMemory();
    const result = await readScene(memory.id);

    expect(result.memory.id).toBe(memory.id);
    expect(result.scene).toBeNull();
    expect(result.visitedHotspots).toEqual([]);
  });

  it("reports a memory that is not there", async () => {
    await expect(readScene("missing")).rejects.toMatchObject({
      code: ERROR_CODES.MEMORY_NOT_FOUND,
    });
  });

  it("returns the generated scene together with the visit history", async () => {
    const { memory, scene } = await memoryWithScene();

    await ExplorationRepository.markHotspotVisited(memory.id, scene.hotspots[1].id);

    const result = await readScene(memory.id);

    expect(result.scene).toEqual(scene);
    expect(result.visitedHotspots).toEqual([scene.hotspots[1].id]);
  });
});

describe("visitHotspot", () => {
  it("records the click and hands back the new list", async () => {
    const { memory, scene } = await memoryWithScene();
    const hotspotId = scene.hotspots[0].id;

    const result = await visitHotspot(memory.id, hotspotId);

    expect(result.visitedHotspots).toEqual([hotspotId]);
    expect(result.scene).toEqual(scene);
    expect((await ExplorationRepository.getByMemoryId(memory.id)).visitedHotspots).toEqual([
      hotspotId,
    ]);
  });

  it("does not duplicate a hotspot the user clicked twice", async () => {
    const { memory, scene } = await memoryWithScene();
    const hotspotId = scene.hotspots[0].id;

    await visitHotspot(memory.id, hotspotId);
    const result = await visitHotspot(memory.id, hotspotId);

    expect(result.visitedHotspots).toEqual([hotspotId]);
  });

  it("keeps several hotspots in click order", async () => {
    const { memory, scene } = await memoryWithScene();
    const [first, second] = scene.hotspots;

    await visitHotspot(memory.id, second.id);
    const result = await visitHotspot(memory.id, first.id);

    expect(result.visitedHotspots).toEqual([second.id, first.id]);
  });

  it("refuses a hotspot that is not part of the scene", async () => {
    const { memory } = await memoryWithScene();

    await expect(visitHotspot(memory.id, "hs-deadbeef")).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });

    const db = await getDB();

    expect(await db.getAll(STORES.explorations)).toHaveLength(0);
  });

  it("refuses to record a visit before there is a scene", async () => {
    const memory = await confirmedMemory();

    await expect(visitHotspot(memory.id, "hs-00000001")).rejects.toMatchObject({
      code: ERROR_CODES.SCENE_NOT_FOUND,
    });
    expect(await ExplorationRepository.getByMemoryId(memory.id)).toBeNull();
  });

  it("keeps the visit history across a page reload", async () => {
    const { memory, scene } = await memoryWithScene();
    const hotspotId = scene.hotspots[0].id;

    await visitHotspot(memory.id, hotspotId);
    await closeDB();
    vi.resetModules();

    const reloaded = await import("@/services/scene/sceneService");
    const result = await reloaded.readScene(memory.id);

    expect(result.visitedHotspots).toEqual([hotspotId]);
    expect(result.scene.hotspots[0].id).toBe(hotspotId);

    await closeDB();
  });

  it("survives a regeneration of the scene", async () => {
    const { memory, scene } = await memoryWithScene();
    const hotspotId = scene.hotspots[0].id;

    await visitHotspot(memory.id, hotspotId);
    await generateScene(memory.id);

    expect((await readScene(memory.id)).visitedHotspots).toEqual([hotspotId]);
  });
});