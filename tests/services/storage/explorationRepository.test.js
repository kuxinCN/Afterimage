import { beforeEach, describe, expect, it } from "vitest";

import { ERROR_CODES } from "@/lib/constants";
import { ExplorationRepository } from "@/services/storage/explorationRepository";
import { MemoryRepository } from "@/services/storage/memoryRepository";
import { memoryFixture, resetDatabase } from "../../helpers/data.js";

describe("ExplorationRepository", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("has no exploration record until the memory is entered", async () => {
    const memory = await MemoryRepository.create(memoryFixture());

    await expect(ExplorationRepository.getByMemoryId(memory.id)).resolves.toBeNull();
  });

  it("creates one record per memory", async () => {
    const memory = await MemoryRepository.create(memoryFixture());

    const created = await ExplorationRepository.create({
      memoryId: memory.id,
      visitedHotspots: ["h1"],
    });

    expect(created).toMatchObject({ memoryId: memory.id, visitedHotspots: ["h1"] });
    await expect(
      ExplorationRepository.create({ memoryId: memory.id, visitedHotspots: [] }),
    ).rejects.toMatchObject({ code: ERROR_CODES.EXPLORATION_ALREADY_EXISTS });
  });

  it("refuses an exploration without a real memory", async () => {
    await expect(ExplorationRepository.create({ memoryId: "missing" })).rejects.toMatchObject({
      code: ERROR_CODES.MEMORY_NOT_FOUND,
    });
  });

  it("replaces the visited list on update", async () => {
    const memory = await MemoryRepository.create(memoryFixture());
    await ExplorationRepository.create({ memoryId: memory.id, visitedHotspots: ["h1"] });

    const updated = await ExplorationRepository.update(memory.id, {
      visitedHotspots: ["h1", "h2"],
    });

    expect(updated.visitedHotspots).toEqual(["h1", "h2"]);
    expect(updated.lastVisitedAt).toBeGreaterThan(0);
    await expect(
      ExplorationRepository.update(memory.id, { visitedHotspots: ["h1", "h1"] }),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });
  });

  it("records a hotspot visit and never stores duplicates", async () => {
    const memory = await MemoryRepository.create(memoryFixture());

    await ExplorationRepository.markHotspotVisited(memory.id, "h1");
    const second = await ExplorationRepository.markHotspotVisited(memory.id, "h2");
    const repeat = await ExplorationRepository.markHotspotVisited(memory.id, "h1");

    expect(second.visitedHotspots).toEqual(["h1", "h2"]);
    expect(repeat.visitedHotspots).toEqual(["h1", "h2"]);
    expect(repeat.lastVisitedAt).toBeGreaterThanOrEqual(second.lastVisitedAt);
  });

  it("reports useful errors for a missing record", async () => {
    const memory = await MemoryRepository.create(memoryFixture());

    await expect(ExplorationRepository.update(memory.id, { visitedHotspots: [] })).rejects.toMatchObject({
      code: ERROR_CODES.EXPLORATION_NOT_FOUND,
    });
    await expect(ExplorationRepository.deleteByMemoryId(memory.id)).rejects.toMatchObject({
      code: ERROR_CODES.EXPLORATION_NOT_FOUND,
    });
  });

  it("deletes a record", async () => {
    const memory = await MemoryRepository.create(memoryFixture());
    await ExplorationRepository.create({ memoryId: memory.id });

    await ExplorationRepository.deleteByMemoryId(memory.id);

    await expect(ExplorationRepository.getByMemoryId(memory.id)).resolves.toBeNull();
  });
});
