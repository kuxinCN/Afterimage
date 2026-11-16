import { beforeEach, describe, expect, it } from "vitest";

import { ERROR_CODES, MEMORY_STATUS, SOURCE_TYPES } from "@/lib/constants";
import { userConfirmedValue } from "@/schemas/memorySchema";
import { MemoryRepository } from "@/services/storage/memoryRepository";
import { memoryFixture, resetDatabase } from "../../helpers/data.js";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("MemoryRepository", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates a memory with a generated uuid and timestamps", async () => {
    const memory = await MemoryRepository.create(memoryFixture());

    expect(memory.id).toMatch(UUID_V4);
    expect(memory.title).toBe("校园午餐");
    expect(memory.status).toBe(MEMORY_STATUS.DRAFT);
    expect(memory.updatedAt).toBeGreaterThanOrEqual(memory.createdAt);
  });

  it("reads a memory back by id", async () => {
    const created = await MemoryRepository.create(memoryFixture());
    const loaded = await MemoryRepository.getById(created.id);

    expect(loaded).toEqual(created);
  });

  it("returns null for a memory that does not exist", async () => {
    await expect(MemoryRepository.getById("missing")).resolves.toBeNull();
  });

  it("lists the newest memory first and keeps memories independent", async () => {
    const older = await MemoryRepository.create({
      ...memoryFixture({ title: "旧记忆" }),
      createdAt: 1000,
      updatedAt: 1000,
    });
    const newer = await MemoryRepository.create({
      ...memoryFixture({ title: "新记忆" }),
      createdAt: 2000,
      updatedAt: 2000,
    });

    const all = await MemoryRepository.getAll();

    expect(all.map((memory) => memory.id)).toEqual([newer.id, older.id]);
    expect(older.id).not.toBe(newer.id);
  });

  it("updates fields, keeps the creation timestamp and bumps updatedAt", async () => {
    const created = await MemoryRepository.create(memoryFixture({ updatedAt: 1 }));
    const updated = await MemoryRepository.update(created.id, {
      title: "中午的食堂",
      location: userConfirmedValue("学校二食堂"),
    });

    expect(updated).toMatchObject({
      id: created.id,
      title: "中午的食堂",
      createdAt: created.createdAt,
      status: MEMORY_STATUS.DRAFT,
    });
    expect(updated.updatedAt).toBeGreaterThanOrEqual(1);
    expect(updated.location).toMatchObject({ value: "学校二食堂", confirmed: true });
  });

  it("updates the same memory twice without creating duplicates", async () => {
    const created = await MemoryRepository.create(memoryFixture());
    await MemoryRepository.update(created.id, { description: "第一次修改" });
    const second = await MemoryRepository.update(created.id, { description: "第二次修改" });

    expect(second.description).toBe("第二次修改");
    await expect(MemoryRepository.getAll()).resolves.toHaveLength(1);
  });

  it("ignores explicit undefined instead of erasing stored values", async () => {
    const created = await MemoryRepository.create(memoryFixture());
    const updated = await MemoryRepository.update(created.id, { description: undefined });

    expect(updated.description).toBe(created.description);
  });

  it("clears an optional field when the patch sends null", async () => {
    const created = await MemoryRepository.create(memoryFixture({ date: "2026-11-15" }));
    const updated = await MemoryRepository.update(created.id, { date: null });

    expect(updated.date).toBeNull();
  });

  it("will not let an untouched AI suggestion become a confirmed fact", async () => {
    const created = await MemoryRepository.create(
      memoryFixture({
        location: {
          value: "食堂",
          sourceType: SOURCE_TYPES.AI_INFERRED,
          sourceIds: ["asset-1"],
          confidence: 0.6,
        },
      }),
    );

    // A review form that re-posts the prefilled suggestion as a plain string.
    await expect(MemoryRepository.update(created.id, { location: "食堂" })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
    expect(await MemoryRepository.getById(created.id)).toMatchObject({
      location: { sourceType: SOURCE_TYPES.AI_INFERRED, confirmed: false },
    });

    // Confirming it stays a deliberate act that keeps the photo reference.
    const confirmed = await MemoryRepository.update(created.id, {
      location: userConfirmedValue("食堂", ["asset-1"]),
    });

    expect(confirmed.location).toMatchObject({
      sourceType: SOURCE_TYPES.USER_CONFIRMED,
      sourceIds: ["asset-1"],
      confirmed: true,
    });
  });

  it("refuses to patch ownership fields", async () => {
    const created = await MemoryRepository.create(memoryFixture());

    await expect(MemoryRepository.update(created.id, { sceneId: "scene-1" })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
  });

  it("rejects invalid data before writing it", async () => {
    await expect(
      MemoryRepository.create(memoryFixture({ status: "done" })),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });
    await expect(MemoryRepository.create({ title: "" })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
    await expect(MemoryRepository.getAll()).resolves.toHaveLength(0);
  });

  it("reports a useful error for unknown memories", async () => {
    await expect(MemoryRepository.update("missing", { title: "x" })).rejects.toMatchObject({
      code: ERROR_CODES.MEMORY_NOT_FOUND,
    });
    await expect(MemoryRepository.delete("missing")).rejects.toMatchObject({
      code: ERROR_CODES.MEMORY_NOT_FOUND,
    });
  });

  it("deletes a memory", async () => {
    const created = await MemoryRepository.create(memoryFixture());

    await expect(MemoryRepository.delete(created.id)).resolves.toBe(created.id);
    await expect(MemoryRepository.getById(created.id)).resolves.toBeNull();
  });
});
