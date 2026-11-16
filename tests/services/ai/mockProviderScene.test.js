import { describe, expect, it } from "vitest";

import {
  ERROR_CODES,
  SCENE_BACKGROUND_TYPES,
  SCENE_HOTSPOT_TYPE,
  SCENE_LIMITS,
  SCENE_TYPES,
  SOURCE_TYPES,
} from "@/lib/constants";
import { sceneDraftSchema } from "@/schemas/sceneSchema";
import { mockProvider } from "@/services/ai/providers/mockProvider";
import { hotspotIdFor, templateSlots } from "@/services/scene/sceneTemplates";

const INPUT = {
  memoryId: "memory-1",
  title: "校园午餐",
  sceneType: SCENE_TYPES.CAFETERIA,
  objects: ["餐盘", "筷子", "桌子"],
  imageCount: 1,
};

describe("mockProvider.buildScene", () => {
  it("returns a draft the scene schema accepts", async () => {
    const draft = await mockProvider.buildScene(INPUT);

    expect(() => sceneDraftSchema.parse(draft)).not.toThrow();
    expect(draft.memoryId).toBe(INPUT.memoryId);
    expect(draft.template).toBe(SCENE_TYPES.CAFETERIA);
    expect(draft.title).toBe(INPUT.title);
  });

  it("paints a template background instead of using a photo", async () => {
    const draft = await mockProvider.buildScene(INPUT);

    expect(draft.background).toEqual({
      type: SCENE_BACKGROUND_TYPES.TEMPLATE,
      assetId: null,
    });
  });

  it("never claims to have seen the position in a photo", async () => {
    const draft = await mockProvider.buildScene(INPUT);

    expect(draft.hotspots).toHaveLength(3);

    for (const hotspot of draft.hotspots) {
      expect(hotspot.sourceType).toBe(SOURCE_TYPES.AI_INFERRED);
      expect(hotspot.sourceType).not.toBe(SOURCE_TYPES.IMAGE_OBSERVED);
      expect(hotspot.sourceIds).toEqual([]);
      expect(hotspot.type).toBe(SCENE_HOTSPOT_TYPE);
      expect(hotspot.description).toContain("模拟");
    }

    expect(JSON.stringify(draft)).not.toContain(SOURCE_TYPES.IMAGE_OBSERVED);
  });

  it("places the objects on the template slots in order", async () => {
    const draft = await mockProvider.buildScene(INPUT);
    const slots = templateSlots(SCENE_TYPES.CAFETERIA);

    expect(draft.hotspots.map((hotspot) => hotspot.position)).toEqual(slots.slice(0, 3));
    expect(draft.hotspots.map((hotspot) => hotspot.name)).toEqual(INPUT.objects);
  });

  it("gives the same wording the same id every time", async () => {
    const first = await mockProvider.buildScene(INPUT);
    const second = await mockProvider.buildScene(INPUT);

    expect(first.hotspots.map((hotspot) => hotspot.id)).toEqual(
      INPUT.objects.map((value) => hotspotIdFor(value)),
    );
    expect(second.hotspots).toEqual(first.hotspots);
  });

  it("falls back to the generic template when nothing was classified", async () => {
    const draft = await mockProvider.buildScene({ ...INPUT, sceneType: null });

    expect(draft.template).toBe(SCENE_TYPES.GENERIC);
    expect(draft.hotspots[0].position).toEqual(templateSlots(SCENE_TYPES.GENERIC)[0]);
  });

  it("drops repeated objects instead of stacking two hotspots on one slot", async () => {
    const draft = await mockProvider.buildScene({
      ...INPUT,
      objects: ["餐盘", "餐盘", "筷子"],
    });

    expect(draft.hotspots.map((hotspot) => hotspot.name)).toEqual(["餐盘", "筷子"]);
    expect(new Set(draft.hotspots.map((hotspot) => hotspot.id)).size).toBe(2);
  });

  it("builds an empty scene when nothing was confirmed", async () => {
    const draft = await mockProvider.buildScene({ ...INPUT, objects: [] });

    expect(draft.hotspots).toEqual([]);
    expect(() => sceneDraftSchema.parse(draft)).not.toThrow();
  });

  it("stops at the hotspot limit", async () => {
    const objects = Array.from({ length: SCENE_LIMITS.MAX_HOTSPOTS }, (_, i) => `物件${i}`);
    const draft = await mockProvider.buildScene({ ...INPUT, objects });

    expect(draft.hotspots).toHaveLength(SCENE_LIMITS.MAX_HOTSPOTS);
    expect(new Set(draft.hotspots.map((hotspot) => hotspot.id)).size).toBe(
      SCENE_LIMITS.MAX_HOTSPOTS,
    );
  });

  it("refuses an input that is missing required fields", async () => {
    await expect(mockProvider.buildScene({ title: "校园午餐" })).rejects.toMatchObject({
      code: ERROR_CODES.AI_INVALID_INPUT,
    });
  });

  it("refuses to accept image bytes or file names", async () => {
    await expect(
      mockProvider.buildScene({ ...INPUT, originalName: "private-photo.jpg" }),
    ).rejects.toMatchObject({ code: ERROR_CODES.AI_INVALID_INPUT });

    await expect(
      mockProvider.buildScene({ ...INPUT, images: [{ mimeType: "image/jpeg" }] }),
    ).rejects.toMatchObject({ code: ERROR_CODES.AI_INVALID_INPUT });
  });

  it("refuses more objects than the scene can hold", async () => {
    const objects = Array.from(
      { length: SCENE_LIMITS.MAX_HOTSPOTS + 1 },
      (_, i) => `物件${i}`,
    );

    await expect(mockProvider.buildScene({ ...INPUT, objects })).rejects.toMatchObject({
      code: ERROR_CODES.AI_INVALID_INPUT,
    });
  });
});