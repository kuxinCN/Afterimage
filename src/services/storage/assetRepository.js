import { ERROR_CODES, INDEXES, STORES } from "@/lib/constants";
import { createId, definedOnly, now } from "@/lib/utils";
import { assetPatchSchema, assetSchema } from "@/schemas/assetSchema";
import { StorageError, deleteByIndex, readFrom, validate, withTransaction } from "./db";

const LINKED_STORES = [STORES.assets, STORES.memories];

function assetNotFound(assetId) {
  return new StorageError(ERROR_CODES.ASSET_NOT_FOUND, `Asset ${assetId} does not exist`);
}

function memoryNotFound(memoryId) {
  return new StorageError(ERROR_CODES.MEMORY_NOT_FOUND, `Memory ${memoryId} does not exist`);
}

export const AssetRepository = {
  // The blob is the stored image; preview URLs are never written to disk.
  async create(input) {
    const record = validate(assetSchema, {
      ...input,
      id: createId(),
      createdAt: input?.createdAt ?? now(),
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

        await tx.objectStore(STORES.assets).put(record);

        if (!memory.assetIds.includes(record.id)) {
          memory.assetIds.push(record.id);
          memory.updatedAt = now();
          await memories.put(memory);
        }

        return record;
      },
      "Failed to save asset",
    );
  },

  async getById(assetId) {
    const record = await readFrom(
      STORES.assets,
      (tx) => tx.objectStore(STORES.assets).get(assetId),
      "Failed to read asset",
    );
    return record ?? null;
  },

  async getByMemoryId(memoryId) {
    const records = await readFrom(
      STORES.assets,
      (tx) =>
        tx
          .objectStore(STORES.assets)
          .index(INDEXES.assets.byMemoryId)
          .getAll(memoryId),
      "Failed to list assets",
    );
    return records.sort((a, b) => a.createdAt - b.createdAt);
  },

  async update(assetId, patch) {
    const cleanPatch = definedOnly(validate(assetPatchSchema, patch));

    return withTransaction(
      STORES.assets,
      "readwrite",
      async (tx) => {
        const store = tx.objectStore(STORES.assets);
        const existing = await store.get(assetId);
        if (!existing) {
          throw assetNotFound(assetId);
        }

        const next = validate(assetSchema, {
          ...existing,
          ...cleanPatch,
          id: existing.id,
          memoryId: existing.memoryId,
          blob: existing.blob,
          createdAt: existing.createdAt,
        });
        await store.put(next);
        return next;
      },
      "Failed to update asset",
    );
  },

  async delete(assetId) {
    return withTransaction(
      LINKED_STORES,
      "readwrite",
      async (tx) => {
        const assets = tx.objectStore(STORES.assets);
        const existing = await assets.get(assetId);
        if (!existing) {
          throw assetNotFound(assetId);
        }

        await assets.delete(assetId);

        const memories = tx.objectStore(STORES.memories);
        const memory = await memories.get(existing.memoryId);
        if (memory) {
          memory.assetIds = memory.assetIds.filter((id) => id !== assetId);
          memory.updatedAt = now();
          await memories.put(memory);
        }

        return assetId;
      },
      "Failed to delete asset",
    );
  },

  async deleteByMemoryId(memoryId) {
    return withTransaction(
      LINKED_STORES,
      "readwrite",
      async (tx) => {
        await deleteByIndex(tx, STORES.assets, INDEXES.assets.byMemoryId, memoryId);

        const memories = tx.objectStore(STORES.memories);
        const memory = await memories.get(memoryId);
        if (memory) {
          memory.assetIds = [];
          memory.updatedAt = now();
          await memories.put(memory);
        }

        return memoryId;
      },
      "Failed to delete assets",
    );
  },
};
