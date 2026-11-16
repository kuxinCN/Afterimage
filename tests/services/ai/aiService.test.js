import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DB_VERSION,
  ERROR_CODES,
  MEMORY_STATUS,
  SOURCE_TYPES,
  STORES,
} from "@/lib/constants";
import {
  analyzeMemory,
  confirmAnalysis,
  listAiProviders,
  readAnalysis,
  saveAnalysisDraft,
} from "@/services/ai/aiService";
import { mockProvider } from "@/services/ai/providers/mockProvider";
import { AssetRepository } from "@/services/storage/assetRepository";
import { closeDB, getDB } from "@/services/storage/db";
import { MemoryRepository } from "@/services/storage/memoryRepository";
import { assetFixture, memoryFixture, resetDatabase } from "../../helpers/data.js";

const DESCRIPTION = "昨天和同学在学校食堂吃饭，桌上有一个餐盘。";

async function seededMemory({ images = 1, overrides = {} } = {}) {
  const memory = await MemoryRepository.create(
    memoryFixture({ description: DESCRIPTION, ...overrides }),
  );

  for (let index = 0; index < images; index += 1) {
    await AssetRepository.create(
      assetFixture(memory.id, { originalName: `private-photo-${index}.jpg` }),
    );
  }

  return MemoryRepository.getById(memory.id);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("provider registry", () => {
  it("only exposes the mock provider", () => {
    expect(listAiProviders()).toEqual(["mock"]);
  });

  it("fails clearly for a provider that is not registered", async () => {
    const memory = await seededMemory();

    await expect(
      analyzeMemory(memory.id, { providerName: "some-real-model" }),
    ).rejects.toMatchObject({ code: ERROR_CODES.AI_PROVIDER_UNAVAILABLE });

    const after = await MemoryRepository.getById(memory.id);

    expect(after.analysis).toBeNull();
    expect(after.status).toBe(MEMORY_STATUS.DRAFT);
  });
});

describe("analyzeMemory", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("persists a reviewable draft and moves the memory to reviewing", async () => {
    const memory = await seededMemory({ images: 2 });

    const { draft } = await analyzeMemory(memory.id);
    const { memory: stored, draft: reloaded } = await readAnalysis(memory.id);

    expect(stored.status).toBe(MEMORY_STATUS.REVIEWING);
    expect(draft.basedOn.imageCount).toBe(2);
    expect(reloaded.generatedAt).toBe(draft.generatedAt);
    expect(reloaded.scene.type).toBe("cafeteria");
  });

  it("reports a memory that is not there", async () => {
    await expect(analyzeMemory("missing")).rejects.toMatchObject({
      code: ERROR_CODES.MEMORY_NOT_FOUND,
    });
  });

  it("refuses to run twice at the same time", async () => {
    const memory = await seededMemory();
    const [first, second] = await Promise.allSettled([
      analyzeMemory(memory.id),
      analyzeMemory(memory.id),
    ]);

    expect(first.status).toBe("fulfilled");
    expect(second.reason).toMatchObject({ code: ERROR_CODES.AI_ANALYSIS_IN_PROGRESS });
    expect((await MemoryRepository.getById(memory.id)).status).toBe(MEMORY_STATUS.REVIEWING);
  });

  it("keeps a malformed provider result out of the database", async () => {
    const memory = await seededMemory();

    vi.spyOn(mockProvider, "analyze").mockResolvedValue({ provider: "mock", quality: "A" });

    await expect(analyzeMemory(memory.id)).rejects.toMatchObject({
      code: ERROR_CODES.AI_INVALID_RESULT,
    });

    const after = await MemoryRepository.getById(memory.id);

    expect(after.analysis).toBeNull();
    expect(after.status).toBe(MEMORY_STATUS.DRAFT);
  });

  it("restores the previous status when the provider fails", async () => {
    const memory = await seededMemory();

    await analyzeMemory(memory.id);
    vi.spyOn(mockProvider, "analyze").mockRejectedValue(new Error("provider exploded"));

    await expect(analyzeMemory(memory.id)).rejects.toMatchObject({
      code: ERROR_CODES.AI_ANALYSIS_FAILED,
    });

    const after = await MemoryRepository.getById(memory.id);

    expect(after.status).toBe(MEMORY_STATUS.REVIEWING);
    expect(after.analysis.scene.type).toBe("cafeteria");
    expect(after.analysis.revision).toBe(1);
  });

  it("never stores preview urls or private file names in the draft", async () => {
    const memory = await seededMemory();

    await analyzeMemory(memory.id);

    const db = await getDB();
    const stored = await db.get(STORES.memories, memory.id);
    const serialized = JSON.stringify(stored);

    expect(serialized).not.toContain("blob:");
    expect(serialized).not.toContain("private-photo-0");
    expect(stored.assetIds).toHaveLength(1);
  });
});

describe("saveAnalysisDraft", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("keeps review edits across a page reload", async () => {
    const memory = await seededMemory();
    const { draft } = await analyzeMemory(memory.id);
    const edited = {
      ...draft,
      elements: draft.elements.map((item) => ({
        ...item,
        value: "不锈钢餐盘",
        sourceType: SOURCE_TYPES.USER_CONFIRMED,
        confidence: 1,
        confirmed: true,
      })),
    };

    await saveAnalysisDraft(memory.id, edited);
    await closeDB();
    vi.resetModules();

    const reloadedService = await import("@/services/ai/aiService");
    const { draft: reloaded } = await reloadedService.readAnalysis(memory.id);

    expect(reloaded.elements[0]).toMatchObject({
      value: "不锈钢餐盘",
      sourceType: SOURCE_TYPES.USER_CONFIRMED,
      confirmed: true,
    });

    await closeDB();
  });

  it("rejects a draft that would claim an AI guess was confirmed", async () => {
    const memory = await seededMemory();
    const { draft } = await analyzeMemory(memory.id);
    const forged = {
      ...draft,
      elements: draft.elements.map((item) => ({ ...item, confirmed: true })),
    };

    await expect(saveAnalysisDraft(memory.id, forged)).rejects.toMatchObject({
      code: ERROR_CODES.AI_INVALID_RESULT,
    });
    expect((await MemoryRepository.getById(memory.id)).analysis.elements[0].confirmed).toBe(false);
  });
});

describe("confirmAnalysis", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("copies only adopted items into the confirmed memory", async () => {
    const memory = await seededMemory();
    const { draft } = await analyzeMemory(memory.id);
    const decided = {
      ...draft,
      elements: draft.elements.map((item, index) => ({ ...item, adopted: index === 0 })),
      tags: [],
      places: draft.places.map((item) => ({ ...item, adopted: true })),
    };

    const { memory: confirmed, facts } = await confirmAnalysis(memory.id, decided);

    expect(confirmed.status).toBe(MEMORY_STATUS.READY);
    expect(facts.objects).toHaveLength(1);
    expect(facts.objects[0]).toMatchObject({
      sourceType: SOURCE_TYPES.USER_CONFIRMED,
      confirmed: true,
    });
    expect(facts.tags).toEqual([]);
    expect(facts.locations.length).toBeGreaterThan(0);
    expect(facts.summary.value).toBe(DESCRIPTION);
    expect(facts.uncertainties.join()).toContain("Mock Provider");
  });

  it("refuses to confirm before there is a draft", async () => {
    const memory = await seededMemory();

    await expect(confirmAnalysis(memory.id)).rejects.toMatchObject({
      code: ERROR_CODES.AI_ANALYSIS_NOT_FOUND,
    });
    expect((await MemoryRepository.getById(memory.id)).status).toBe(MEMORY_STATUS.DRAFT);
  });

  it("does not let a re-analysis overwrite confirmed content", async () => {
    const memory = await seededMemory();
    const first = await analyzeMemory(memory.id);
    const edited = {
      ...first.draft,
      elements: first.draft.elements.map((item) => ({
        ...item,
        adopted: true,
        value: item.value === "餐盘" ? "食堂餐盘" : item.value,
      })),
    };

    await confirmAnalysis(memory.id, edited);
    const before = await MemoryRepository.getById(memory.id);

    const second = await analyzeMemory(memory.id);
    const after = await MemoryRepository.getById(memory.id);

    expect(second.draft.revision).toBe(2);
    expect(after.facts).toEqual(before.facts);
    expect(
      second.draft.elements.find((item) => item.value === "食堂餐盘"),
    ).toMatchObject({ adopted: true });
    expect(after.location?.value ?? null).toBe(before.location?.value ?? null);
    expect(after.title).toBe(before.title);
    expect(after.description).toBe(before.description);
  });

  it("carries a hand-added entry through a re-analysis", async () => {
    const memory = await seededMemory();
    const first = await analyzeMemory(memory.id);
    const added = {
      value: "窗边的绿植",
      baseline: "窗边的绿植",
      sourceType: SOURCE_TYPES.USER_CONFIRMED,
      sourceIds: [],
      confidence: 1,
      confirmed: true,
      adopted: true,
    };

    await saveAnalysisDraft(memory.id, { ...first.draft, elements: [...first.draft.elements, added] });

    const second = await analyzeMemory(memory.id);

    expect(second.draft.elements.map((item) => item.value)).toContain("窗边的绿植");
  });

  it("drops the draft together with the memory", async () => {
    const memory = await seededMemory({ images: 2 });

    await analyzeMemory(memory.id);
    await MemoryRepository.delete(memory.id);

    const db = await getDB();

    expect(await db.getAll(STORES.memories)).toHaveLength(0);
    expect(await db.getAll(STORES.assets)).toHaveLength(0);
  });
});

describe("stage 2 records without an analysis field", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("stays readable and writable on database version 1", async () => {
    expect(DB_VERSION).toBe(1);

    const legacyRecord = {
      id: "legacy-memory",
      title: "旧记忆",
      description: "在教室自习的一个下午",
      date: null,
      location: null,
      facts: { events: [], objects: [], locations: [], uncertainties: [] },
      status: MEMORY_STATUS.DRAFT,
      assetIds: [],
      sceneId: null,
      createdAt: 1,
      updatedAt: 1,
    };

    const db = await getDB();
    await db.put(STORES.memories, legacyRecord);

    const { draft } = await readAnalysis("legacy-memory");

    expect(draft).toBeNull();

    const { memory } = await analyzeMemory("legacy-memory");

    expect(memory.analysis.quality).toBeDefined();
    expect(memory.facts.objects).toEqual([]);
    expect(Object.keys(memory.facts).sort()).toEqual(
      ["events", "locations", "objects", "summary", "tags", "times", "uncertainties"].sort(),
    );
  });
});
