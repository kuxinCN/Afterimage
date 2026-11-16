import { describe, expect, it } from "vitest";

import { ERROR_CODES, SCENE_TYPES, SOURCE_TYPES } from "@/lib/constants";
import { analysisDraftSchema } from "@/schemas/analysisSchema";
import { mockProvider } from "@/services/ai/providers/mockProvider";

function input(overrides = {}) {
  return {
    memoryId: "memory-1",
    title: "教室最后一排",
    description: "昨天和同学在学校食堂吃饭，桌上有一个餐盘。",
    date: "2026-11-15",
    location: "老校区",
    imageCount: 2,
    images: [
      { mimeType: "image/jpeg", width: 4000, height: 3000 },
      { mimeType: "image/png", width: 800, height: 600 },
    ],
    ...overrides,
  };
}

function everyItem(draft) {
  return [
    ...(draft.summary ? [draft.summary] : []),
    ...draft.elements,
    ...draft.tags,
    ...draft.times,
    ...draft.places,
  ];
}

describe("mockProvider", () => {
  it("always returns a draft that satisfies the schema", async () => {
    const draft = await mockProvider.analyze(input());

    expect(() => analysisDraftSchema.parse(draft)).not.toThrow();
    expect(draft).toMatchObject({ provider: "mock", simulated: true, revision: 1 });
  });

  it("case A: turns a described memory with photos into a full draft", async () => {
    const draft = await mockProvider.analyze(input());

    expect(draft.quality).toBe("A");
    expect(draft.scene.type).toBe(SCENE_TYPES.CAFETERIA);
    expect(draft.summary).toMatchObject({
      sourceType: SOURCE_TYPES.USER_CONFIRMED,
      confirmed: true,
      adopted: true,
    });
    expect(draft.elements.map((item) => item.value)).toContain("餐盘");
    expect(draft.times.map((item) => item.value)).toEqual(
      expect.arrayContaining(["2026-11-15", "昨天"]),
    );
    expect(draft.places.map((item) => item.value)).toContain("学校");
  });

  it("case B: refuses to invent anything from photos alone", async () => {
    const draft = await mockProvider.analyze(
      input({ title: "", description: "", imageCount: 3, date: null, location: null }),
    );

    expect(draft.quality).toBe("C");
    expect(draft.summary).toBeNull();
    expect(draft.scene).toBeNull();
    expect(draft.elements).toEqual([]);
    expect(draft.times).toEqual([]);
    expect(draft.places).toEqual([]);
    expect(draft.missing.join()).toContain("标题和描述都是空的");
    expect(draft.basedOn).toMatchObject({ imageCount: 3, descriptionLength: 0 });
  });

  it("case C: analyses text but flags the missing photos", async () => {
    const draft = await mockProvider.analyze(input({ imageCount: 0, images: [] }));

    expect(draft.quality).toBe("B");
    expect(draft.tags.map((item) => item.value)).toContain("纯文字");
    expect(draft.missing.join()).toContain("还没有照片");
  });

  it("case D: returns a simplified draft when there is almost nothing", async () => {
    const draft = await mockProvider.analyze(
      input({ title: "", description: "", imageCount: 0, images: [], date: null, location: null }),
    );

    expect(draft.quality).toBe("C");
    expect(draft.summary).toBeNull();
    expect(draft.scene).toBeNull();
    expect(draft.elements).toEqual([]);
    // The only tag left is the record-level fact that there are no photos.
    expect(draft.tags.map((item) => item.value)).toEqual(["纯文字"]);
    expect(draft.tags[0].adopted).toBe(false);
    expect(draft.missing.length).toBeGreaterThan(1);
  });

  it("never marks mock guesses as image_observed or fictional", async () => {
    const draft = await mockProvider.analyze(input());

    for (const item of everyItem(draft)) {
      expect(item.sourceType).not.toBe(SOURCE_TYPES.IMAGE_OBSERVED);
      expect(item.sourceType).not.toBe(SOURCE_TYPES.FICTIONAL);
    }

    const providerGuesses = [
      ...draft.elements,
      ...draft.tags,
      ...draft.times.filter((entry) => entry.value !== "2026-11-15"),
      ...draft.places.filter((entry) => entry.value !== "老校区"),
    ];

    for (const item of providerGuesses) {
      expect(item).toMatchObject({ sourceType: SOURCE_TYPES.AI_INFERRED, confirmed: false });
    }
  });

  it("only proposes words the user actually supplied", async () => {
    const source = input();
    const draft = await mockProvider.analyze(source);
    const haystack = [source.title, source.description, source.date, source.location].join("\n");

    for (const item of [...draft.elements, ...draft.times, ...draft.places]) {
      expect(haystack).toContain(item.value);
    }
  });

  it("does not infer people, relationships or feelings", async () => {
    const draft = await mockProvider.analyze(
      input({
        title: "那天",
        description: "昨天和妈妈在食堂吃饭，我很难过，也很想念她。",
        date: null,
        location: null,
        imageCount: 1,
      }),
    );

    const values = everyItem(draft).map((item) => item.value);

    for (const forbidden of ["妈妈", "同学", "难过", "想念", "她"]) {
      expect(values).not.toContain(forbidden);
    }
    expect(draft.missing.join()).toContain("人物或情绪");
    expect(draft.scene.type).toBe(SCENE_TYPES.CAFETERIA);
  });

  it("keeps nothing adopted unless it came from the user", async () => {
    const draft = await mockProvider.analyze(input());

    expect(draft.summary.adopted).toBe(true);
    expect(draft.elements.every((item) => !item.adopted)).toBe(true);
    expect(draft.tags.every((item) => !item.adopted)).toBe(true);

    const dateItem = draft.times.find((item) => item.value === "2026-11-15");
    const locationItem = draft.places.find((item) => item.value === "老校区");

    expect(dateItem).toMatchObject({ sourceType: SOURCE_TYPES.USER_CONFIRMED, adopted: true });
    expect(locationItem).toMatchObject({ sourceType: SOURCE_TYPES.USER_CONFIRMED, adopted: true });
  });

  it("is deterministic apart from the generation timestamp", async () => {
    const first = await mockProvider.analyze(input());
    const second = await mockProvider.analyze(input());

    expect({ ...first, generatedAt: 0 }).toEqual({ ...second, generatedAt: 0 });
  });

  it("changes its result when the input changes", async () => {
    const cafeteria = await mockProvider.analyze(input());
    const classroom = await mockProvider.analyze(
      input({ description: "下午在教室自习，黑板上写着考试安排。" }),
    );

    expect(classroom.scene.type).toBe(SCENE_TYPES.CLASSROOM);
    expect(classroom.scene.type).not.toBe(cafeteria.scene.type);
    expect(classroom.elements.map((item) => item.value)).toContain("黑板");
    expect(cafeteria.elements.map((item) => item.value)).not.toContain("黑板");
  });

  it("rejects an incomplete request instead of guessing", async () => {
    const { memoryId: omitted, ...withoutMemoryId } = input();

    await expect(mockProvider.analyze(withoutMemoryId)).rejects.toMatchObject({
      code: ERROR_CODES.AI_INVALID_INPUT,
    });
    await expect(mockProvider.analyze({ ...input(), imageCount: "2" })).rejects.toMatchObject({
      code: ERROR_CODES.AI_INVALID_INPUT,
    });
  });

  it("says in the draft that it never read the photos", async () => {
    const draft = await mockProvider.analyze(input());

    expect(draft.missing[0]).toMatch(/Mock Provider/);
    expect(draft.missing.join()).toContain("没有读取任何照片像素");
  });
});
