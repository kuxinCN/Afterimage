import { describe, expect, it, vi } from "vitest";

import { SCENE_TYPES, SCENE_TYPE_LIST } from "@/lib/constants";
import {
  SCENE_DEPTH_BANDS,
  SCENE_DEPTH_THRESHOLDS,
  SCENE_SLOT_COUNT,
  SCENE_TEMPLATE_SLOTS,
  assignHotspotIds,
  depthBandFor,
  hotspotIdFor,
  hotspotLayout,
  resolveTemplate,
  templateSlots,
} from "@/services/scene/sceneTemplates";

describe("template slots", () => {
  it("gives every scene type a full grid", () => {
    expect(SCENE_TYPE_LIST).toHaveLength(Object.keys(SCENE_TEMPLATE_SLOTS).length);

    for (const type of SCENE_TYPE_LIST) {
      expect(SCENE_TEMPLATE_SLOTS[type]).toHaveLength(SCENE_SLOT_COUNT);
    }
  });

  it("keeps every coordinate inside the canvas", () => {
    for (const slots of Object.values(SCENE_TEMPLATE_SLOTS)) {
      for (const { x, y } of slots) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
    }
  });

  it("never repeats a position inside one template", () => {
    for (const slots of Object.values(SCENE_TEMPLATE_SLOTS)) {
      const keys = slots.map(({ x, y }) => `${x}:${y}`);

      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("spreads the near row wider than the far row", () => {
    for (const type of SCENE_TYPE_LIST) {
      const slots = templateSlots(type);
      const farRow = slots.slice(0, 6);
      const nearRow = slots.slice(-6);
      const width = (row) => Math.max(...row.map((p) => p.x)) - Math.min(...row.map((p) => p.x));

      expect(width(nearRow)).toBeGreaterThan(width(farRow));
      expect(nearRow[0].y).toBeGreaterThan(farRow[0].y);
    }
  });

  it("produces a byte-identical layout across a module reload", async () => {
    const before = JSON.stringify(SCENE_TEMPLATE_SLOTS);

    vi.resetModules();

    const reloaded = await import("@/services/scene/sceneTemplates");

    expect(JSON.stringify(reloaded.SCENE_TEMPLATE_SLOTS)).toBe(before);
    expect(reloaded.templateSlots(SCENE_TYPES.CAFETERIA)[0]).toEqual({ x: 0.34, y: 0.3 });
    expect(reloaded.templateSlots(SCENE_TYPES.CAFETERIA)[23]).toEqual({ x: 0.9, y: 0.82 });
  });

  it("falls back to the generic template for anything unrecognised", () => {
    expect(resolveTemplate(SCENE_TYPES.CAFETERIA)).toBe(SCENE_TYPES.CAFETERIA);
    expect(resolveTemplate(null)).toBe(SCENE_TYPES.GENERIC);
    expect(resolveTemplate(undefined)).toBe(SCENE_TYPES.GENERIC);
    expect(resolveTemplate("spaceship")).toBe(SCENE_TYPES.GENERIC);
    expect(templateSlots("spaceship")).toEqual(templateSlots(SCENE_TYPES.GENERIC));
  });
});

describe("depthBandFor", () => {
  it("splits the canvas at the two thresholds", () => {
    expect(depthBandFor(0)).toBe("far");
    expect(depthBandFor(SCENE_DEPTH_THRESHOLDS.far - 0.01)).toBe("far");
    expect(depthBandFor(SCENE_DEPTH_THRESHOLDS.far)).toBe("mid");
    expect(depthBandFor(SCENE_DEPTH_THRESHOLDS.mid)).toBe("mid");
    expect(depthBandFor(SCENE_DEPTH_THRESHOLDS.mid + 0.01)).toBe("near");
    expect(depthBandFor(1)).toBe("near");
  });

  it("orders the bands from back to front", () => {
    expect(SCENE_DEPTH_BANDS.far.zIndex).toBeLessThan(SCENE_DEPTH_BANDS.mid.zIndex);
    expect(SCENE_DEPTH_BANDS.mid.zIndex).toBeLessThan(SCENE_DEPTH_BANDS.near.zIndex);
    expect(SCENE_DEPTH_BANDS.far.scale).toBeLessThan(SCENE_DEPTH_BANDS.near.scale);
  });
});

describe("hotspotLayout", () => {
  it("turns a normalized position into css placement", () => {
    expect(hotspotLayout({ x: 0.45, y: 0.7 })).toEqual({
      left: "45%",
      top: "70%",
      transform: "translate(-50%, -50%) scale(1)",
      zIndex: SCENE_DEPTH_BANDS.mid.zIndex,
      opacity: SCENE_DEPTH_BANDS.mid.opacity,
    });
  });

  it("scales and layers by depth", () => {
    const far = hotspotLayout({ x: 0.5, y: 0.2 });
    const near = hotspotLayout({ x: 0.5, y: 0.9 });

    expect(far.transform).toContain(`scale(${SCENE_DEPTH_BANDS.far.scale})`);
    expect(near.transform).toContain(`scale(${SCENE_DEPTH_BANDS.near.scale})`);
    expect(far.zIndex).toBeLessThan(near.zIndex);
  });

  it("dims a hotspot the user already explored", () => {
    const position = { x: 0.3, y: 0.8 };
    const fresh = hotspotLayout(position);
    const visited = hotspotLayout(position, { visited: true });

    expect(visited.opacity).toBeLessThan(fresh.opacity);
    expect(visited.opacity).toBeCloseTo(fresh.opacity / 2, 4);
    expect(visited.left).toBe(fresh.left);
    expect(visited.transform).toBe(fresh.transform);
    expect(visited.zIndex).toBe(fresh.zIndex);
  });

  it("is stable for the same input", () => {
    const position = { x: 0.123456, y: 0.654321 };

    expect(hotspotLayout(position)).toEqual(hotspotLayout(position));
  });
});

describe("hotspot ids", () => {
  it("derives a short stable id from the wording", () => {
    expect(hotspotIdFor("餐盘")).toMatch(/^hs-[0-9a-f]{8}$/);
    expect(hotspotIdFor("餐盘")).toBe(hotspotIdFor("餐盘"));
    expect(hotspotIdFor("餐盘")).not.toBe(hotspotIdFor("筷子"));
  });

  it("does not depend on call order", () => {
    expect(assignHotspotIds(["餐盘", "筷子"])).toEqual([
      hotspotIdFor("餐盘"),
      hotspotIdFor("筷子"),
    ]);
    expect(assignHotspotIds(["筷子", "餐盘"])).toEqual([
      hotspotIdFor("筷子"),
      hotspotIdFor("餐盘"),
    ]);
  });

  it("keeps ids unique when the same wording appears twice", () => {
    const ids = assignHotspotIds(["餐盘", "餐盘", "餐盘"]);

    expect(new Set(ids).size).toBe(3);
    expect(ids[0]).toBe(hotspotIdFor("餐盘"));
    expect(assignHotspotIds(["餐盘", "餐盘", "餐盘"])).toEqual(ids);
  });

  it("handles an empty list", () => {
    expect(assignHotspotIds([])).toEqual([]);
  });
});