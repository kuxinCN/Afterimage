import { beforeEach, describe, expect, it } from "vitest";

import { ERROR_CODES, SCENE_INITIAL_VERSION, SOURCE_TYPES, STORES } from "@/lib/constants";
import { getDB } from "@/services/storage/db";
import { MemoryRepository } from "@/services/storage/memoryRepository";
import { SceneRepository } from "@/services/storage/sceneRepository";
import {
  hotspotFixture,
  memoryFixture,
  resetDatabase,
  sceneFixture,
} from "../../helpers/data.js";

describe("SceneRepository", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("saves a scene and links it back to the memory", async () => {
    const memory = await MemoryRepository.create(memoryFixture());

    const scene = await SceneRepository.create(sceneFixture(memory.id));
    const reloadedMemory = await MemoryRepository.getById(memory.id);

    expect(scene.version).toBe(SCENE_INITIAL_VERSION);
    expect(reloadedMemory.sceneId).toBe(scene.id);
    await expect(SceneRepository.getByMemoryId(memory.id)).resolves.toMatchObject({ id: scene.id });
  });

  it("reads back the identical layout every time", async () => {
    const memory = await MemoryRepository.create(memoryFixture());
    const scene = await SceneRepository.create(
      sceneFixture(memory.id, {
        hotspots: [
          hotspotFixture("h1", { position: { x: 0.1, y: 0.2 } }),
          hotspotFixture("h2", { position: { x: 0.9, y: 0.8 }, name: "窗户" }),
        ],
      }),
    );

    const first = await SceneRepository.getById(scene.id);
    const second = await SceneRepository.getById(scene.id);

    expect(second.hotspots).toEqual(first.hotspots);
    expect(second).toEqual(scene);
  });

  it("keeps one scene per memory", async () => {
    const memory = await MemoryRepository.create(memoryFixture());
    await SceneRepository.create(sceneFixture(memory.id));

    await expect(SceneRepository.create(sceneFixture(memory.id))).rejects.toMatchObject({
      code: ERROR_CODES.SCENE_ALREADY_EXISTS,
    });
  });

  it("refuses a scene without a real memory", async () => {
    await expect(SceneRepository.create(sceneFixture("missing"))).rejects.toMatchObject({
      code: ERROR_CODES.MEMORY_NOT_FOUND,
    });
  });

  it("rejects broken hotspot data before writing it", async () => {
    const memory = await MemoryRepository.create(memoryFixture());

    await expect(
      SceneRepository.create(
        sceneFixture(memory.id, {
          hotspots: [
            {
              id: "h1",
              name: "餐盘",
              position: { x: -0.2, y: 0.5 },
              sourceType: SOURCE_TYPES.AI_INFERRED,
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });

    await expect(SceneRepository.getByMemoryId(memory.id)).resolves.toBeNull();
    expect((await MemoryRepository.getById(memory.id)).sceneId).toBeNull();
  });

  it("updates the layout while preserving ownership and creation time", async () => {
    const memory = await MemoryRepository.create(memoryFixture());
    const scene = await SceneRepository.create(
      sceneFixture(memory.id, { updatedAt: 1, createdAt: 1 }),
    );

    const updated = await SceneRepository.update(scene.id, {
      hotspots: [hotspotFixture("h1", { name: "托盘" })],
      version: 2,
    });

    expect(updated).toMatchObject({
      id: scene.id,
      memoryId: memory.id,
      createdAt: 1,
      version: 2,
    });
    expect(updated.hotspots[0].name).toBe("托盘");
    expect(updated.updatedAt).toBeGreaterThan(1);
    await expect(SceneRepository.update(scene.id, { memoryId: "other" })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
  });

  it("reports useful errors for missing scenes", async () => {
    const memory = await MemoryRepository.create(memoryFixture());

    await expect(SceneRepository.getById("missing")).resolves.toBeNull();
    await expect(SceneRepository.getByMemoryId(memory.id)).resolves.toBeNull();
    await expect(SceneRepository.update("missing", { title: "x" })).rejects.toMatchObject({
      code: ERROR_CODES.SCENE_NOT_FOUND,
    });
    await expect(SceneRepository.deleteByMemoryId(memory.id)).rejects.toMatchObject({
      code: ERROR_CODES.SCENE_NOT_FOUND,
    });
  });

  it("deletes a scene and clears the memory back-reference", async () => {
    const memory = await MemoryRepository.create(memoryFixture());
    const scene = await SceneRepository.create(sceneFixture(memory.id));

    await SceneRepository.deleteByMemoryId(memory.id);

    const reloadedMemory = await MemoryRepository.getById(memory.id);
    expect(reloadedMemory.sceneId).toBeNull();
    await expect(SceneRepository.getById(scene.id)).resolves.toBeNull();
  });

  it("does not clear a back-reference that points at another scene", async () => {
    const memory = await MemoryRepository.create(memoryFixture());
    const scene = await SceneRepository.create(sceneFixture(memory.id));
    const db = await getDB();
    const stored = await db.get(STORES.memories, memory.id);
    await db.put(STORES.memories, { ...stored, sceneId: "another-scene" });

    await SceneRepository.deleteByMemoryId(memory.id);

    expect((await MemoryRepository.getById(memory.id)).sceneId).toBe("another-scene");
    await expect(SceneRepository.getById(scene.id)).resolves.toBeNull();
  });
});
