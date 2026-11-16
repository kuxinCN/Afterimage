import { ERROR_CODES, INDEXES, STORES } from "@/lib/constants";
import { createId, definedOnly, now } from "@/lib/utils";
import { scenePatchSchema, sceneSchema } from "@/schemas/sceneSchema";
import { StorageError, readFrom, validate, withTransaction } from "./db";

const LINKED_STORES = [STORES.scenes, STORES.memories];

function sceneNotFound(sceneId) {
  return new StorageError(ERROR_CODES.SCENE_NOT_FOUND, `Scene ${sceneId} does not exist`);
}

function memoryNotFound(memoryId) {
  return new StorageError(ERROR_CODES.MEMORY_NOT_FOUND, `Memory ${memoryId} does not exist`);
}

export const SceneRepository = {
  // One scene per memory: the unique memoryId index enforces it, and the
  // back-reference memory.sceneId is written in the same transaction.
  async create(input) {
    const timestamp = now();
    const record = validate(sceneSchema, {
      ...input,
      id: createId(),
      createdAt: input?.createdAt ?? timestamp,
      updatedAt: input?.updatedAt ?? timestamp,
    });

    return withTransaction(
      LINKED_STORES,
      "readwrite",
      async (tx) => {
        const memories = tx.objectStore(STORES.memories);
        const memory = await memories.get(record.memoryId);
        if (!memory) {
          throw memoryNotFound(record.memoryId);
        }
        if (memory.sceneId) {
          throw new StorageError(
            ERROR_CODES.SCENE_ALREADY_EXISTS,
            `Memory ${record.memoryId} already has scene ${memory.sceneId}`,
          );
        }

        await tx.objectStore(STORES.scenes).put(record);

        memory.sceneId = record.id;
        memory.updatedAt = now();
        await memories.put(memory);

        return record;
      },
      "Failed to save scene",
    );
  },

  async getById(sceneId) {
    const record = await readFrom(
      STORES.scenes,
      (tx) => tx.objectStore(STORES.scenes).get(sceneId),
      "Failed to read scene",
    );
    return record ?? null;
  },

  async getByMemoryId(memoryId) {
    const record = await readFrom(
      STORES.scenes,
      (tx) => tx.objectStore(STORES.scenes).index(INDEXES.scenes.byMemoryId).get(memoryId),
      "Failed to read scene",
    );
    return record ?? null;
  },

  async update(sceneId, patch) {
    const cleanPatch = definedOnly(validate(scenePatchSchema, patch));

    return withTransaction(
      STORES.scenes,
      "readwrite",
      async (tx) => {
        const store = tx.objectStore(STORES.scenes);
        const existing = await store.get(sceneId);
        if (!existing) {
          throw sceneNotFound(sceneId);
        }

        const next = validate(sceneSchema, {
          ...existing,
          ...cleanPatch,
          id: existing.id,
          memoryId: existing.memoryId,
          createdAt: existing.createdAt,
          updatedAt: now(),
        });
        await store.put(next);
        return next;
      },
      "Failed to update scene",
    );
  },

  async deleteByMemoryId(memoryId) {
    return withTransaction(
      LINKED_STORES,
      "readwrite",
      async (tx) => {
        const scenes = tx.objectStore(STORES.scenes);
        const existing = await scenes.index(INDEXES.scenes.byMemoryId).get(memoryId);
        if (!existing) {
          throw new StorageError(
            ERROR_CODES.SCENE_NOT_FOUND,
            `Memory ${memoryId} has no scene`,
          );
        }

        await scenes.delete(existing.id);

        const memories = tx.objectStore(STORES.memories);
        const memory = await memories.get(memoryId);
        if (memory && memory.sceneId === existing.id) {
          memory.sceneId = null;
          memory.updatedAt = now();
          await memories.put(memory);
        }

        return existing.id;
      },
      "Failed to delete scene",
    );
  },
};
