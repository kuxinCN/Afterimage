import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { SOURCE_TYPES } from "@/lib/constants";
import { assetSchema } from "@/schemas/assetSchema";
import { explorationSchema } from "@/schemas/explorationSchema";
import {
  memoryPatchSchema,
  memorySchema,
  sourcedValueSchema,
  userConfirmedValue,
} from "@/schemas/memorySchema";
import { sceneSchema } from "@/schemas/sceneSchema";
import { imageBlob } from "../helpers/data.js";

function baseMemory(overrides = {}) {
  return {
    id: "memory-1",
    title: "校园午餐",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function baseScene(overrides = {}) {
  return {
    id: "scene-1",
    memoryId: "memory-1",
    template: "cafeteria",
    title: "校园食堂",
    background: { type: "template", assetId: null },
    hotspots: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("memorySchema", () => {
  it("fills MVP defaults instead of guessing values", () => {
    const parsed = memorySchema.parse(baseMemory());

    expect(parsed).toMatchObject({
      status: "draft",
      description: "",
      date: null,
      location: null,
      assetIds: [],
      sceneId: null,
      facts: { events: [], objects: [], locations: [], uncertainties: [] },
    });
  });

  it("rejects a bare string location instead of guessing where it came from", () => {
    expect(() => memorySchema.parse(baseMemory({ location: "食堂" }))).toThrow(ZodError);
  });

  it("only marks a location confirmed through the explicit helper", () => {
    const parsed = memorySchema.parse(
      baseMemory({ location: userConfirmedValue("学校二食堂", ["asset-1"]) }),
    );

    expect(parsed.location).toEqual({
      value: "学校二食堂",
      sourceType: SOURCE_TYPES.USER_CONFIRMED,
      sourceIds: ["asset-1"],
      confidence: 1,
      confirmed: true,
    });
  });

  it("applies the same provenance rule to review patches", () => {
    expect(() => memoryPatchSchema.parse({ location: "食堂" })).toThrow(ZodError);
    expect(memoryPatchSchema.parse({ location: userConfirmedValue("食堂") }).location).toMatchObject(
      { confirmed: true },
    );
  });

  it("keeps an AI inferred location unconfirmed", () => {
    const parsed = memorySchema.parse(
      baseMemory({
        location: {
          value: "食堂",
          sourceType: SOURCE_TYPES.AI_INFERRED,
          sourceIds: ["asset-1"],
          confidence: 0.6,
        },
      }),
    );

    expect(parsed.location).toMatchObject({
      sourceType: SOURCE_TYPES.AI_INFERRED,
      confirmed: false,
    });
  });

  it("rejects an item marked confirmed without user confirmation", () => {
    expect(() =>
      sourcedValueSchema.parse({
        value: "同桌是我的姐姐",
        sourceType: SOURCE_TYPES.AI_INFERRED,
        confirmed: true,
      }),
    ).toThrow(ZodError);
  });

  it("rejects unknown status, malformed dates and extra fields", () => {
    expect(() => memorySchema.parse(baseMemory({ status: "done" }))).toThrow(ZodError);
    expect(() => memorySchema.parse(baseMemory({ date: "15/11/2026" }))).toThrow(ZodError);
    expect(() => memorySchema.parse(baseMemory({ legacyField: 1 }))).toThrow(ZodError);
  });
});

describe("assetSchema", () => {
  const validAsset = {
    id: "asset-1",
    memoryId: "memory-1",
    type: "image",
    blob: imageBlob(),
    mimeType: "image/jpeg",
    originalName: "photo.jpg",
    width: 1920,
    height: 1080,
    createdAt: 1,
  };

  it("accepts a real blob and defaults analysis to null", () => {
    expect(assetSchema.parse(validAsset).analysis).toBeNull();
  });

  it("rejects a serialised preview URL instead of a blob", () => {
    expect(() => assetSchema.parse({ ...validAsset, blob: "blob:http://x/1" })).toThrow(ZodError);
  });

  it("rejects non-positive dimensions", () => {
    expect(() => assetSchema.parse({ ...validAsset, width: 0 })).toThrow(ZodError);
  });
});

describe("sceneSchema", () => {
  it("rejects hotspot coordinates outside the normalized range", () => {
    expect(() =>
      sceneSchema.parse(
        baseScene({
          hotspots: [
            {
              id: "h1",
              name: "餐盘",
              position: { x: 1.5, y: 0.7 },
              sourceType: SOURCE_TYPES.IMAGE_OBSERVED,
            },
          ],
        }),
      ),
    ).toThrow(ZodError);
  });

  it("rejects duplicate hotspot ids", () => {
    const hotspot = {
      id: "h1",
      name: "餐盘",
      position: { x: 0.4, y: 0.7 },
      sourceType: SOURCE_TYPES.IMAGE_OBSERVED,
    };

    expect(() => sceneSchema.parse(baseScene({ hotspots: [hotspot, hotspot] }))).toThrow(ZodError);
  });

  it("requires an asset reference for an asset background", () => {
    expect(() =>
      sceneSchema.parse(baseScene({ background: { type: "asset", assetId: null } })),
    ).toThrow(ZodError);
  });

  it("defaults the scene version and hotspot presentation fields", () => {
    const parsed = sceneSchema.parse(
      baseScene({
        hotspots: [
          {
            id: "h1",
            name: "餐盘",
            position: { x: 0.4, y: 0.7 },
            sourceType: SOURCE_TYPES.FICTIONAL,
          },
        ],
      }),
    );

    expect(parsed.version).toBe(1);
    expect(parsed.hotspots[0]).toMatchObject({ type: "object", description: "", sourceIds: [] });
  });
});

describe("explorationSchema", () => {
  it("rejects duplicate visited hotspots", () => {
    expect(() =>
      explorationSchema.parse({
        memoryId: "memory-1",
        visitedHotspots: ["h1", "h1"],
        lastVisitedAt: 1,
      }),
    ).toThrow(ZodError);
  });
});
