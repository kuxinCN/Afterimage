import { describe, expect, it } from "vitest";

import {
  fragmentScale,
  gridSlots,
  isDenseLayout,
  projectScene,
} from "@/components/afterimage/fragmentLayout";

function key(slot) {
  return `${slot.x},${slot.y}`;
}

describe("gridSlots · 不重复布点", () => {
  it.each([0, 1, 3, 8, 9, 12, 24])("count=%i 生成对应数量的互不相同槽位", (count) => {
    const slots = gridSlots(count);
    expect(slots).toHaveLength(count);
    expect(new Set(slots.map(key)).size).toBe(count);
  });

  it("所有槽位落在归一化 [0,1] 区间（A 适配器再 ×100）", () => {
    for (const slot of gridSlots(24)) {
      expect(slot.x).toBeGreaterThanOrEqual(0);
      expect(slot.x).toBeLessThanOrEqual(1);
      expect(slot.y).toBeGreaterThanOrEqual(0);
      expect(slot.y).toBeLessThanOrEqual(1);
    }
  });

  it("24 热点用满 3 列 × 8 行，绝不复用 8 个 scatter 槽位", () => {
    const slots = gridSlots(24);
    const columns = new Set(slots.map((s) => s.x));
    const rows = new Set(slots.map((s) => s.y));
    expect(columns.size).toBe(3);
    expect(rows.size).toBe(8);
  });

  it("同一行内相邻槽位保持水平间距（无水平重叠基础）", () => {
    const slots = gridSlots(24);
    const firstRow = slots.slice(0, 3).sort((a, b) => a.x - b.x);
    const gap = firstRow[1].x - firstRow[0].x;
    expect(gap).toBeGreaterThan(0.3);
  });
});

describe("fragmentScale · 随数量收缩", () => {
  it("数量越大缩放越小，且夹在 [0.4,0.9]", () => {
    const scales = [3, 8, 9, 24].map(fragmentScale);
    for (const scale of scales) {
      expect(scale).toBeGreaterThanOrEqual(0.4);
      expect(scale).toBeLessThanOrEqual(0.9);
    }
    expect(scales[0]).toBeGreaterThan(scales[1]);
    expect(scales[1]).toBeGreaterThan(scales[3]);
  });

  it("24 热点缩到约 0.43，保证窄屏 3 列仍有间隙", () => {
    expect(fragmentScale(24)).toBeCloseTo(0.433, 2);
  });
});

describe("isDenseLayout", () => {
  it("8 及以下不算密集，9 起进入密集（加高舞台）", () => {
    expect(isDenseLayout(8)).toBe(false);
    expect(isDenseLayout(9)).toBe(true);
    expect(isDenseLayout(24)).toBe(true);
  });
});

describe("projectScene · 仅改坐标，保留来源与业务字段", () => {
  const scene = {
    id: "scene-1",
    memoryId: "memory-1",
    template: "generic",
    title: "示例",
    version: 2,
    hotspots: [
      {
        id: "hs-1",
        name: "旧车票",
        type: "object",
        position: { x: 0.5, y: 0.24 },
        description: "褪色车票",
        sourceType: "ai_inferred",
        sourceIds: ["src-1", "src-2"],
      },
      {
        id: "hs-2",
        name: "杯子",
        type: "object",
        position: { x: 0.54, y: 0.24 },
        description: "半杯冷茶",
        sourceType: "user_confirmed",
        sourceIds: [],
      },
    ],
  };

  it("替换 position 为网格槽位，其余字段逐一保留", () => {
    const projected = projectScene(scene);
    const slots = gridSlots(2);
    expect(projected.hotspots[0].position).toEqual(slots[0]);
    expect(projected.hotspots[1].position).toEqual(slots[1]);
    expect(projected.hotspots[0].id).toBe("hs-1");
    expect(projected.hotspots[0].name).toBe("旧车票");
    expect(projected.hotspots[0].description).toBe("褪色车票");
    expect(projected.hotspots[0].sourceType).toBe("ai_inferred");
    expect(projected.hotspots[0].sourceIds).toEqual(["src-1", "src-2"]);
    expect(projected.hotspots[1].sourceType).toBe("user_confirmed");
  });

  it("保留 scene 顶层 meta，不修改原 scene（纯函数）", () => {
    const projected = projectScene(scene);
    expect(projected.id).toBe("scene-1");
    expect(projected.version).toBe(2);
    expect(scene.hotspots[0].position).toEqual({ x: 0.5, y: 0.24 });
  });

  it("空 scene / 非数组 hotspots 安全返回", () => {
    expect(projectScene(null)).toBeNull();
    const noHotspots = { id: "s", hotspots: undefined };
    expect(projectScene(noHotspots)).toBe(noHotspots);
  });
});