import { ERROR_CODES, INDEXES, STORES } from "@/lib/constants";
import { createId, definedOnly, now } from "@/lib/utils";
import { memoryPatchSchema, memorySchema } from "@/schemas/memorySchema";
import { StorageError, deleteByIndex, readFrom, validate, withTransaction } from "./db";

const CASCADE_STORES = [
  STORES.memories,
  STORES.assets,
  STORES.scenes,
  STORES.explorations,
];

function memoryNotFound(memoryId) {
  return new StorageError(
    ERROR_CODES.MEMORY_NOT_FOUND,
    `Memory ${memoryId} does not exist`,
  );
}

export const MemoryRepository = {
  async create(input) {
    const timestamp = now();
    const record = validate(memorySchema, {
      ...input,
      id: createId(),
      createdAt: input?.createdAt ?? timestamp,
      updatedAt: input?.updatedAt ?? timestamp,
    });

    await withTransaction(
      STORES.memories,
      "readwrite",
      (tx) => tx.objectStore(STORES.memories).put(record),
      "Failed to create memory",
    );

    return record;
  },

  async getById(memoryId) {
    const record = await readFrom(
      STORES.memories,
      (tx) => tx.objectStore(STORES.memories).get(memoryId),
      "Failed to read memory",
    );
    return record ?? null;
  },

  async getAll() {
    const records = await readFrom(
      STORES.memories,
      (tx) => tx.objectStore(STORES.memories).getAll(),
      "Failed to list memories",
    );
    return records.sort((a, b) => b.createdAt - a.createdAt);
  },

  async update(memoryId, patch) {
    const cleanPatch = definedOnly(validate(memoryPatchSchema, patch));

    return withTransaction(
      STORES.memories,
      "readwrite",
      async (tx) => {
        const store = tx.objectStore(STORES.memories);
        const existing = await store.get(memoryId);
        if (!existing) {
          throw memoryNotFound(memoryId);
        }

        const next = validate(memorySchema, {
          ...existing,
          ...cleanPatch,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: now(),
        });
        await store.put(next);
        return next;
      },
      "Failed to update memory",
    );
  },

  // One transaction covers every store so a memory never outlives its assets,
  // scene or exploration record.
  async delete(memoryId) {
    return withTransaction(
      CASCADE_STORES,
      "readwrite",
      async (tx) => {
        const memories = tx.objectStore(STORES.memories);
        const existing = await memories.get(memoryId);
        if (!existing) {
          throw memoryNotFound(memoryId);
        }

        await memories.delete(memoryId);
        await deleteByIndex(tx, STORES.assets, INDEXES.assets.byMemoryId, memoryId);
        await deleteByIndex(tx, STORES.scenes, INDEXES.scenes.byMemoryId, memoryId);
        await tx.objectStore(STORES.explorations).delete(memoryId);

        return memoryId;
      },
      `Failed to delete memory ${memoryId}`,
    );
  },
};
