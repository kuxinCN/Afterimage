import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_CODES, SOURCE_TYPES, STORES } from "@/lib/constants";
import { sceneSchema } from "@/schemas/sceneSchema";
import { analyzeMemory, confirmAnalysis, generateScene } from "@/services/ai/aiService";
import { mockProvider } from "@/services/ai/providers/mockProvider";
import {
  generateSceneForMemory,
  markHotspotVisited,
  readScene,
  visitHotspot,
} from "@/services/scene/sceneService";
import { AssetRepository } from "@/services/storage/assetRepository";
import { closeDB, getDB } from "@/services/storage/db";
import { ExplorationRepository } from "@/services/storage/explorationRepository";
import { MemoryRepository } from "@/services/storage/memoryRepository";
import { SceneRepository } from "@/services/storage/sceneRepository";
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

afterEach(() => {
  vi.restoreAllMocks();
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

describe("generateSceneForMemory", () => {
  it("creates a scene that satisfies the scene schema", async () => {
    const memory = await confirmedMemory();
    const scene = await generateSceneForMemory(memory.id);

    expect(() => sceneSchema.parse(scene)).not.toThrow();
    expect(scene.memoryId).toBe(memory.id);
    expect(scene.version).toBe(1);
    expect(scene.hotspots.length).toBeGreaterThan(0);
    expect(await SceneRepository.getByMemoryId(memory.id)).toEqual(scene);
    expect((await MemoryRepository.getById(memory.id)).sceneId).toBe(scene.id);
  });

  it("keeps every hotspot coordinate normalized between 0 and 1", async () => {
    const memory = await confirmedMemory();
    const scene = await generateSceneForMemory(memory.id);

    for (const hotspot of scene.hotspots) {
      expect(hotspot.position.x).toBeGreaterThanOrEqual(0);
      expect(hotspot.position.x).toBeLessThanOrEqual(1);
      expect(hotspot.position.y).toBeGreaterThanOrEqual(0);
      expect(hotspot.position.y).toBeLessThanOrEqual(1);
    }

    expect(new Set(scene.hotspots.map((hotspot) => hotspot.id)).size).toBe(
      scene.hotspots.length,
    );
  });

  it("labels hotspots as simulated, never as seen in a photo", async () => {
    const memory = await confirmedMemory();
    const scene = await generateSceneForMemory(memory.id);

    for (const hotspot of scene.hotspots) {
      expect(hotspot.sourceType).toBe(SOURCE_TYPES.AI_INFERRED);
      expect(hotspot.sourceIds).toEqual([]);
    }

    expect(scene.background.assetId).toBeNull();
    expect(JSON.stringify(scene)).not.toContain(SOURCE_TYPES.IMAGE_OBSERVED);
  });

  it("returns the existing scene instead of generating a second one", async () => {
    const memory = await confirmedMemory();
    const first = await generateSceneForMemory(memory.id);
    const spy = vi.spyOn(mockProvider, "buildScene");

    const second = await generateSceneForMemory(memory.id);

    expect(second).toEqual(first);
    expect(second.version).toBe(1);
    expect(spy).not.toHaveBeenCalled();

    const db = await getDB();

    expect(await db.getAll(STORES.scenes)).toHaveLength(1);
  });

  it("leaves a scene written by another path alone", async () => {
    const memory = await confirmedMemory();
    const seeded = await SceneRepository.create({
      memoryId: memory.id,
      template: "generic",
      title: "已有场景",
      background: { type: "template", assetId: null },
      hotspots: [],
    });
    const spy = vi.spyOn(mockProvider, "buildScene");

    const result = await generateSceneForMemory(memory.id);

    expect(result).toEqual(seeded);
    expect(spy).not.toHaveBeenCalled();
  });

  it("keeps the exploration history when the scene already exists", async () => {
    const memory = await confirmedMemory();
    const first = await generateSceneForMemory(memory.id);

    await markHotspotVisited(memory.id, first.hotspots[0].id);

    const second = await generateSceneForMemory(memory.id);

    expect(second.hotspots).toEqual(first.hotspots);
    expect((await ExplorationRepository.getByMemoryId(memory.id)).visitedHotspots).toEqual([
      first.hotspots[0].id,
    ]);
  });

  it("refuses a memory that was never confirmed", async () => {
    const memory = await MemoryRepository.create(memoryFixture({ description: DESCRIPTION }));

    await AssetRepository.create(assetFixture(memory.id));

    await expect(generateSceneForMemory(memory.id)).rejects.toMatchObject({
      code: ERROR_CODES.SCENE_NOT_CONFIRMED,
    });
    expect(await SceneRepository.getByMemoryId(memory.id)).toBeNull();
    expect((await MemoryRepository.getById(memory.id)).status).toBe("draft");
  });

  it("reports a memory that is not there", async () => {
    await expect(generateSceneForMemory("missing")).rejects.toMatchObject({
      code: ERROR_CODES.MEMORY_NOT_FOUND,
    });
  });
});

describe("markHotspotVisited", () => {
  it("returns the latest exploration record", async () => {
    const { memory, scene } = await memoryWithScene();
    const hotspotId = scene.hotspots[0].id;

    const exploration = await markHotspotVisited(memory.id, hotspotId);

    expect(exploration).toEqual({
      memoryId: memory.id,
      visitedHotspots: [hotspotId],
      lastVisitedAt: expect.any(Number),
    });
    expect(exploration.lastVisitedAt).toBeGreaterThan(0);
    expect(await ExplorationRepository.getByMemoryId(memory.id)).toEqual(exploration);
  });

  it("accumulates hotspots without duplicating a repeat visit", async () => {
    const { memory, scene } = await memoryWithScene();
    const [first, second] = scene.hotspots;

    await markHotspotVisited(memory.id, first.id);
    await markHotspotVisited(memory.id, second.id);

    const exploration = await markHotspotVisited(memory.id, first.id);

    expect(exploration.visitedHotspots).toEqual([first.id, second.id]);
  });

  it("refuses a hotspot that is not in the scene", async () => {
    const { memory } = await memoryWithScene();

    await expect(markHotspotVisited(memory.id, "hs-deadbeef")).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
    expect(await ExplorationRepository.getByMemoryId(memory.id)).toBeNull();
  });

  it("refuses to record a visit before there is a scene", async () => {
    const memory = await confirmedMemory();

    await expect(markHotspotVisited(memory.id, "hs-00000001")).rejects.toMatchObject({
      code: ERROR_CODES.SCENE_NOT_FOUND,
    });
    expect(await ExplorationRepository.getByMemoryId(memory.id)).toBeNull();
  });

  it("keeps the record across a page reload", async () => {
    const { memory, scene } = await memoryWithScene();
    const hotspotId = scene.hotspots[0].id;

    await markHotspotVisited(memory.id, hotspotId);
    await closeDB();
    vi.resetModules();

    const reloaded = await import("@/services/scene/sceneService");
    const { visitedHotspots } = await reloaded.readScene(memory.id);

    expect(visitedHotspots).toEqual([hotspotId]);

    await closeDB();
  });

  it("agrees with the ui-facing visitHotspot wrapper", async () => {
    const { memory, scene } = await memoryWithScene();
    const [first, second] = scene.hotspots;

    const viaWrapper = await visitHotspot(memory.id, first.id);
    const viaService = await markHotspotVisited(memory.id, second.id);

    expect(viaWrapper.visitedHotspots).toEqual([first.id]);
    expect(viaService.visitedHotspots).toEqual([first.id, second.id]);
  });
});