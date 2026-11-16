import { ERROR_CODES, STORES } from "@/lib/constants";
import { definedOnly, now, uniqueValues } from "@/lib/utils";
import { explorationPatchSchema, explorationSchema } from "@/schemas/explorationSchema";
import { StorageError, validate, readFrom, withTransaction } from "./db";

const LINKED_STORES = [STORES.explorations, STORES.memories];

function explorationNotFound(memoryId) {
  return new StorageError(
    ERROR_CODES.EXPLORATION_NOT_FOUND,
    `Memory ${memoryId} has no exploration record`,
  );
}

function memoryNotFound(memoryId) {
  return new StorageError(ERROR_CODES.MEMORY_NOT_FOUND, `Memory ${memoryId} does not exist`);
}

export const ExplorationRepository = {
  async getByMemoryId(memoryId) {
    const record = await readFrom(
      STORES.explorations,
      (tx) => tx.objectStore(STORES.explorations).get(memoryId),
      "Failed to read exploration",
    );
    return record ?? null;
  },

  async create(input) {
    const record = validate(explorationSchema, {
      ...input,
      visitedHotspots: input?.visitedHotspots ?? [],
      lastVisitedAt: input?.lastVisitedAt ?? now(),
    });

    return withTransaction(
      LINKED_STORES,
      "readwrite",
      async (tx) => {
        const explorations = tx.objectStore(STORES.explorations);
        const memories = tx.objectStore(STORES.memories);

        if (!(await memories.get(record.memoryId))) {
          throw memoryNotFound(record.memoryId);
        }
        if (await explorations.get(record.memoryId)) {
          throw new StorageError(
            ERROR_CODES.EXPLORATION_ALREADY_EXISTS,
            `Memory ${record.memoryId} already has an exploration record`,
          );
        }

        await explorations.put(record);
        return record;
      },
      "Failed to create exploration",
    );
  },

  async update(memoryId, patch) {
    const cleanPatch = definedOnly(validate(explorationPatchSchema, patch));

    return withTransaction(
      STORES.explorations,
      "readwrite",
      async (tx) => {
        const store = tx.objectStore(STORES.explorations);
        const existing = await store.get(memoryId);
        if (!existing) {
          throw explorationNotFound(memoryId);
        }

        const next = validate(explorationSchema, {
          ...existing,
          ...cleanPatch,
          memoryId: existing.memoryId,
          lastVisitedAt: cleanPatch.lastVisitedAt ?? now(),
        });
        await store.put(next);
        return next;
      },
      "Failed to update exploration",
    );
  },

  // Keeps the visit bookkeeping inside one transaction so a scene component only
  // has to report a click.
  async markHotspotVisited(memoryId, hotspotId) {
    const timestamp = now();

    return withTransaction(
      STORES.explorations,
      "readwrite",
      async (tx) => {
        const store = tx.objectStore(STORES.explorations);
        const existing = await store.get(memoryId);
        const record = validate(explorationSchema, {
          memoryId,
          visitedHotspots: uniqueValues([
            ...(existing?.visitedHotspots ?? []),
            hotspotId,
          ]),
          lastVisitedAt: timestamp,
        });

        await store.put(record);
        return record;
      },
      "Failed to record hotspot visit",
    );
  },

  async deleteByMemoryId(memoryId) {
    return withTransaction(
      STORES.explorations,
      "readwrite",
      async (tx) => {
        const store = tx.objectStore(STORES.explorations);
        if (!(await store.get(memoryId))) {
          throw explorationNotFound(memoryId);
        }
        await store.delete(memoryId);
        return memoryId;
      },
      "Failed to delete exploration",
    );
  },
};
