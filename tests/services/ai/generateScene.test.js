import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DB_VERSION,
  ERROR_CODES,
  MEMORY_STATUS,
  SCENE_LIMITS,
  STORES,
} from "@/lib/constants";
import { userConfirmedValue } from "@/schemas/sourceSchema";
import {
  analyzeMemory,
  confirmAnalysis,
  generateScene,
  readAnalysis,
  saveAnalysisDraft,
} from "@/services/ai/aiService";
import { mockProvider } from "@/services/ai/providers/mockProvider";
import { AssetRepository } from "@/services/storage/assetRepository";
import { getDB } from "@/services/storage/db";
import { ExplorationRepository } from "@/services/storage/explorationRepository";
import { MemoryRepository } from "@/services/storage/memoryRepository";
import { SceneRepository } from "@/services/storage/sceneRepository";
import { assetFixture, memoryFixture, resetDatabase } from "../../helpers/data.js";

const DESCRIPTION = "昨天和同学在学校食堂吃饭，桌上有一个餐盘，旁边放着筷子和杯子。";

async function seededMemory() {
  const memory = await MemoryRepository.create(memoryFixture({ description: DESCRIPTION }));

  await AssetRepository.create(
    assetFixture(memory.id, { originalName: "private-photo-0.jpg" }),
  );

  return MemoryRepository.getById(memory.id);
}

async function confirmedMemory() {
  const memory = await seededMemory();
  const { draft } = await analyzeMemory(memory.id);

  await confirmAnalysis(memory.id, {
    ...draft,
    elements: draft.elements.map((item) => ({ ...item, adopted: true })),
  });

  return MemoryRepository.getById(memory.id);
}

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  await resetDatabase();
});

describe("generateScene", () => {
  it("builds a scene from the confirmed objects and links it to the memory", async () => {
    expect(DB_VERSION).toBe(1);

    const memory = await confirmedMemory();
    const { memory: updated, scene } = await generateScene(memory.id);

    expect(updated.status).toBe(MEMORY_STATUS.COMPLETED);
    expect(updated.sceneId).toBe(scene.id);
    expect(scene.memoryId).toBe(memory.id);
    expect(scene.version).toBe(1);
    expect(scene.template).toBe("cafeteria");
    expect(scene.hotspots.map((hotspot) => hotspot.name)).toEqual(
      memory.facts.objects.map((item) => item.value),
    );
    expect(await SceneRepository.getByMemoryId(memory.id)).toEqual(scene);
  });

  it("refuses to build on a memory that was never confirmed", async () => {
    const memory = await seededMemory();

    await expect(generateScene(memory.id)).rejects.toMatchObject({
      code: ERROR_CODES.SCENE_NOT_CONFIRMED,
    });

    const after = await MemoryRepository.getById(memory.id);

    expect(after.status).toBe(MEMORY_STATUS.DRAFT);
    expect(after.sceneId).toBeNull();
    expect(await SceneRepository.getByMemoryId(memory.id)).toBeNull();
  });

  it("refuses while the review is still open", async () => {
    const memory = await seededMemory();

    await analyzeMemory(memory.id);

    await expect(generateScene(memory.id)).rejects.toMatchObject({
      code: ERROR_CODES.SCENE_NOT_CONFIRMED,
    });
    expect((await MemoryRepository.getById(memory.id)).status).toBe(MEMORY_STATUS.REVIEWING);
  });

  it("reports a memory that is not there", async () => {
    await expect(generateScene("missing")).rejects.toMatchObject({
      code: ERROR_CODES.MEMORY_NOT_FOUND,
    });
  });

  it("refuses to run twice at the same time", async () => {
    const memory = await confirmedMemory();
    const [first, second] = await Promise.allSettled([
      generateScene(memory.id),
      generateScene(memory.id),
    ]);

    expect(first.status).toBe("fulfilled");
    expect(second.reason).toMatchObject({
      code: ERROR_CODES.SCENE_GENERATION_IN_PROGRESS,
    });

    const db = await getDB();

    expect(await db.getAll(STORES.scenes)).toHaveLength(1);
  });

  it("keeps a malformed provider result out of the database", async () => {
    const memory = await confirmedMemory();

    vi.spyOn(mockProvider, "buildScene").mockResolvedValue({ template: "cafeteria", title: "x" });

    await expect(generateScene(memory.id)).rejects.toMatchObject({
      code: ERROR_CODES.SCENE_INVALID_RESULT,
    });

    const after = await MemoryRepository.getById(memory.id);

    expect(after.status).toBe(MEMORY_STATUS.READY);
    expect(after.sceneId).toBeNull();
    expect(await SceneRepository.getByMemoryId(memory.id)).toBeNull();
  });

  it("restores the previous status and scene when the provider fails", async () => {
    const memory = await confirmedMemory();
    const { scene: first } = await generateScene(memory.id);

    vi.spyOn(mockProvider, "buildScene").mockRejectedValue(new Error("provider exploded"));

    await expect(generateScene(memory.id)).rejects.toMatchObject({
      code: ERROR_CODES.SCENE_GENERATION_FAILED,
    });

    const after = await MemoryRepository.getById(memory.id);

    expect(after.status).toBe(MEMORY_STATUS.COMPLETED);
    expect(await SceneRepository.getByMemoryId(memory.id)).toEqual(first);
  });

  it("reports a provider that cannot build scenes", async () => {
    const memory = await confirmedMemory();
    const original = mockProvider.buildScene;

    mockProvider.buildScene = undefined;

    try {
      await expect(generateScene(memory.id)).rejects.toMatchObject({
        code: ERROR_CODES.AI_PROVIDER_UNAVAILABLE,
      });
    } finally {
      mockProvider.buildScene = original;
    }

    expect((await MemoryRepository.getById(memory.id)).status).toBe(MEMORY_STATUS.READY);
  });

  it("regenerates in place and keeps the exploration history", async () => {
    const memory = await confirmedMemory();
    const { scene: first } = await generateScene(memory.id);

    await ExplorationRepository.markHotspotVisited(memory.id, first.hotspots[0].id);

    const { scene: second } = await generateScene(memory.id);

    expect(second.id).toBe(first.id);
    expect(second.version).toBe(2);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.hotspots).toEqual(first.hotspots);
    expect((await MemoryRepository.getById(memory.id)).sceneId).toBe(first.id);
    expect((await ExplorationRepository.getByMemoryId(memory.id)).visitedHotspots).toEqual([
      first.hotspots[0].id,
    ]);

    const db = await getDB();

    expect(await db.getAll(STORES.scenes)).toHaveLength(1);
  });

  it("leaves the confirmed content untouched", async () => {
    const memory = await confirmedMemory();

    await generateScene(memory.id);

    const after = await MemoryRepository.getById(memory.id);

    expect(after.facts).toEqual(memory.facts);
    expect(after.analysis).toEqual(memory.analysis);
    expect(after.title).toBe(memory.title);
    expect(after.description).toBe(memory.description);
    expect(after.assetIds).toEqual(memory.assetIds);
  });

  it("never stores preview urls, private file names or an image_observed claim", async () => {
    const memory = await confirmedMemory();
    const { scene } = await generateScene(memory.id);

    const db = await getDB();
    const serialized = JSON.stringify({
      scene: await db.get(STORES.scenes, scene.id),
      memory: await db.get(STORES.memories, memory.id),
    });

    expect(serialized).not.toContain("blob:");
    expect(serialized).not.toContain("private-photo-0");
    expect(serialized).not.toContain("image_observed");
  });

  it("caps the hotspots when a stored memory holds more objects than a scene can show", async () => {
    const memory = await confirmedMemory();
    const objects = Array.from({ length: SCENE_LIMITS.MAX_HOTSPOTS + 6 }, (_, index) =>
      userConfirmedValue(`物件${index}`),
    );

    await MemoryRepository.update(memory.id, { facts: { ...memory.facts, objects } });

    const { scene } = await generateScene(memory.id);

    expect(scene.hotspots).toHaveLength(SCENE_LIMITS.MAX_HOTSPOTS);
    expect(scene.hotspots.map((hotspot) => hotspot.name)).toEqual(
      objects.slice(0, SCENE_LIMITS.MAX_HOTSPOTS).map((item) => item.value),
    );
  });

  it("picks up a newly confirmed object without moving the old hotspots", async () => {
    const memory = await confirmedMemory();
    const { scene: first } = await generateScene(memory.id);
    const { draft } = await readAnalysis(memory.id);

    await saveAnalysisDraft(memory.id, {
      ...draft,
      elements: [
        ...draft.elements,
        { ...userConfirmedValue("窗边的绿植"), baseline: "窗边的绿植", adopted: true },
      ],
    });
    await confirmAnalysis(memory.id);

    const { scene: second } = await generateScene(memory.id);

    expect(second.version).toBe(2);
    expect(second.hotspots.map((hotspot) => hotspot.name)).toContain("窗边的绿植");

    for (const hotspot of first.hotspots) {
      expect(second.hotspots.find((item) => item.id === hotspot.id)).toMatchObject({
        name: hotspot.name,
        position: hotspot.position,
      });
    }
  });
});