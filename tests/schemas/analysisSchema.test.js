import { describe, expect, it } from "vitest";

import { SCENE_TYPES, SOURCE_TYPES } from "@/lib/constants";
import { analysisDraftSchema, analysisInputSchema } from "@/schemas/analysisSchema";

function item(value, overrides = {}) {
  return {
    value,
    baseline: value,
    sourceType: SOURCE_TYPES.AI_INFERRED,
    sourceIds: [],
    confidence: 0.4,
    confirmed: false,
    adopted: false,
    ...overrides,
  };
}

function draft(overrides = {}) {
  return {
    provider: "mock",
    simulated: true,
    generatedAt: 1700000000000,
    revision: 1,
    basedOn: { imageCount: 2, descriptionLength: 40, hasDate: true, hasLocation: false },
    quality: "B",
    summary: item("一次食堂午餐", { sourceType: SOURCE_TYPES.USER_CONFIRMED, confirmed: true, adopted: true }),
    scene: { type: SCENE_TYPES.CAFETERIA, title: "食堂场景", sourceType: SOURCE_TYPES.AI_INFERRED },
    elements: [item("餐盘")],
    tags: [item("食堂")],
    times: [item("昨天")],
    places: [item("学校")],
    missing: ["还没有照片"],
    ...overrides,
  };
}

describe("analysisDraftSchema", () => {
  it("accepts a well formed draft", () => {
    const parsed = analysisDraftSchema.parse(draft());

    expect(parsed.quality).toBe("B");
    expect(parsed.elements[0]).toMatchObject({ value: "餐盘", adopted: false });
  });

  it("accepts a minimal insufficient-data draft", () => {
    const parsed = analysisDraftSchema.parse(
      draft({
        quality: "C",
        summary: null,
        scene: null,
        elements: [],
        tags: [],
        times: [],
        places: [],
      }),
    );

    expect(parsed.scene).toBeNull();
    expect(parsed.elements).toEqual([]);
  });

  it("rejects a missing required field", () => {
    const { basedOn: unused, ...withoutBasedOn } = draft();

    expect(() => analysisDraftSchema.parse(withoutBasedOn)).toThrow();
  });

  it("requires the provider wording that a re-analysis matches on", () => {
    const { baseline: omitted, ...withoutBaseline } = draft().elements[0];

    expect(() => analysisDraftSchema.parse(draft({ elements: [withoutBaseline] }))).toThrow();
  });

  it("rejects an unknown quality or provider", () => {
    expect(() => analysisDraftSchema.parse(draft({ quality: "D" }))).toThrow();
    expect(() => analysisDraftSchema.parse(draft({ provider: "openai" }))).toThrow();
  });

  it("refuses a draft that hides itself as real AI output", () => {
    expect(() => analysisDraftSchema.parse(draft({ simulated: false }))).toThrow();
  });

  it("rejects an unknown field", () => {
    expect(() => analysisDraftSchema.parse(draft({ mood: "开心" }))).toThrow();
    expect(() => analysisDraftSchema.parse(draft({ elements: [{ ...item("餐盘"), secret: 1 }] }))).toThrow();
  });

  it("rejects an invented source type and an unconfirmed confirmation", () => {
    expect(() => analysisDraftSchema.parse(draft({ elements: [item("餐盘", { sourceType: "guessed" })] }))).toThrow();
    expect(() =>
      analysisDraftSchema.parse(
        draft({ elements: [item("餐盘", { sourceType: SOURCE_TYPES.AI_INFERRED, confirmed: true })] }),
      ),
    ).toThrow();
  });

  it("rejects an out-of-range position field such as a confidence above 1", () => {
    expect(() => analysisDraftSchema.parse(draft({ elements: [item("餐盘", { confidence: 1.5 })] }))).toThrow();
  });

  it("rejects duplicate values inside one list", () => {
    expect(() =>
      analysisDraftSchema.parse(draft({ elements: [item("餐盘"), item("餐盘")] })),
    ).toThrow();
  });

  it("rejects an empty scene title and a scene title that is too long", () => {
    expect(() =>
      analysisDraftSchema.parse(draft({ scene: { type: SCENE_TYPES.CAFETERIA, title: "", sourceType: SOURCE_TYPES.AI_INFERRED } })),
    ).toThrow();
    expect(() =>
      analysisDraftSchema.parse(
        draft({ scene: { type: SCENE_TYPES.CAFETERIA, title: "长".repeat(81), sourceType: SOURCE_TYPES.AI_INFERRED } }),
      ),
    ).toThrow();
  });

  it("allows a long summary but caps short list items", () => {
    expect(() => analysisDraftSchema.parse(draft({ summary: item("长".repeat(500)) }))).not.toThrow();
    expect(() => analysisDraftSchema.parse(draft({ tags: [item("长".repeat(81))] }))).toThrow();
  });
});

describe("analysisInputSchema", () => {
  const base = {
    memoryId: "memory-1",
    title: "食堂",
    description: "中午吃饭",
    date: "2026-11-15",
    location: null,
    imageCount: 1,
    images: [{ mimeType: "image/jpeg", width: 100, height: 80 }],
  };

  it("requires a memoryId and a non-negative image count", () => {
    expect(() => analysisInputSchema.parse({ ...base, memoryId: "" })).toThrow();
    expect(() => analysisInputSchema.parse({ ...base, imageCount: -1 })).toThrow();
  });

  it("does not accept a file name or image bytes", () => {
    expect(() => analysisInputSchema.parse({ ...base, originalName: "mum.jpg" })).toThrow();
    expect(() =>
      analysisInputSchema.parse({ ...base, images: [{ mimeType: "image/jpeg", blob: "…" }] }),
    ).toThrow();
  });

  it("defaults optional fields", () => {
    const parsed = analysisInputSchema.parse({
      memoryId: "memory-1",
      title: "空白",
      description: "",
      imageCount: 0,
    });

    expect(parsed).toMatchObject({ date: null, location: null, images: [] });
  });
});
