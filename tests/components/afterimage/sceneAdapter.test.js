import { describe, expect, it } from "vitest";

// A's adapter is a zero-dependency IIFE that attaches to globalThis in node.
import "@/components/afterimage/src/scene-adapter.js";

const adapter = globalThis.Afterimage.SceneAdapter;
const ISSUE = adapter.ISSUE;

function hotspot(overrides = {}) {
  return {
    id: "hs-00000001",
    name: "旧车票",
    type: "object",
    position: { x: 0.5, y: 0.4 },
    description: "一张褪色的车票。",
    sourceType: "ai_inferred",
    sourceIds: ["src-1"],
    ...overrides,
  };
}

function codes(issues) {
  return issues.map((issue) => issue.code);
}

describe("SceneAdapter · id 与坐标", () => {
  it("沿用外部 hotspot.id（不重新生成）", () => {
    const { fragment } = adapter.adaptHotspot(hotspot({ id: "hs-abcd1234" }));
    expect(fragment.id).toBe("hs-abcd1234");
  });

  it("数字 id 规范化为字符串但值不变", () => {
    const { fragment } = adapter.adaptHotspot(hotspot({ id: 42 }));
    expect(fragment.id).toBe("42");
  });

  it("缺 id 的热点被跳过并记 MISSING_ID，不编造 id", () => {
    const { fragment, issues } = adapter.adaptHotspot(hotspot({ id: undefined }));
    expect(fragment).toBeNull();
    expect(codes(issues)).toContain(ISSUE.MISSING_ID);
  });

  it("0~1 坐标转换为百分比（×100）", () => {
    const { fragment } = adapter.adaptHotspot(hotspot({ position: { x: 0.25, y: 0.8 } }));
    expect(fragment.position).toEqual({ x: 25, y: 80 });
  });

  it("越界坐标夹取到 [0,1] 并记 POSITION_CLAMPED", () => {
    const { fragment, issues } = adapter.adaptHotspot(hotspot({ position: { x: 1.4, y: -0.2 } }));
    expect(fragment.position).toEqual({ x: 100, y: 0 });
    expect(codes(issues)).toContain(ISSUE.POSITION_CLAMPED);
  });

  it("缺坐标置 null 并记 POSITION_MISSING（交由组件布点）", () => {
    const { fragment, issues } = adapter.adaptHotspot(hotspot({ position: undefined }));
    expect(fragment.position).toBeNull();
    expect(codes(issues)).toContain(ISSUE.POSITION_MISSING);
  });
});

describe("SceneAdapter · 来源字段保留与 confirmed 约束", () => {
  it.each(["user_confirmed", "image_observed", "ai_inferred", "fictional"])(
    "原样保留 sourceType=%s",
    (sourceType) => {
      const { fragment } = adapter.adaptHotspot(hotspot({ sourceType }));
      expect(fragment.sourceType).toBe(sourceType);
      expect(fragment.raw.sourceType).toBe(sourceType);
    },
  );

  it("缺 sourceType 标为 null 并记 SOURCE_TYPE_MISSING（不编造）", () => {
    const { fragment, issues } = adapter.adaptHotspot(hotspot({ sourceType: undefined }));
    expect(fragment.sourceType).toBeNull();
    expect(codes(issues)).toContain(ISSUE.SOURCE_TYPE_MISSING);
  });

  it("未知 sourceType 原样保留并记 SOURCE_TYPE_UNKNOWN", () => {
    const { fragment, issues } = adapter.adaptHotspot(hotspot({ sourceType: "mystery" }));
    expect(fragment.sourceType).toBe("mystery");
    expect(codes(issues)).toContain(ISSUE.SOURCE_TYPE_UNKNOWN);
  });

  it("sourceIds 过滤非字符串项", () => {
    const { fragment } = adapter.adaptHotspot(hotspot({ sourceIds: ["a", 3, "", "b"] }));
    expect(fragment.sourceIds).toEqual(["a", "b"]);
  });

  it("sourceIds 非数组按空数组处理并记 issue", () => {
    const { fragment, issues } = adapter.adaptHotspot(hotspot({ sourceIds: "a" }));
    expect(fragment.sourceIds).toEqual([]);
    expect(codes(issues)).toContain(ISSUE.SOURCE_IDS_INVALID);
  });

  it("confidence 夹取到 [0,1]", () => {
    const { fragment } = adapter.adaptHotspot(hotspot({ confidence: 0.7 }));
    expect(fragment.confidence).toBe(0.7);
    const clamped = adapter.adaptHotspot(hotspot({ confidence: 2 }));
    expect(clamped.fragment.confidence).toBe(1);
    expect(codes(clamped.issues)).toContain(ISSUE.CONFIDENCE_INVALID);
  });

  it("confidence 非法置 null", () => {
    const { fragment, issues } = adapter.adaptHotspot(hotspot({ confidence: "high" }));
    expect(fragment.confidence).toBeNull();
    expect(codes(issues)).toContain(ISSUE.CONFIDENCE_INVALID);
  });

  it("user_confirmed + confirmed:true 才保留 confirmed=true", () => {
    const { fragment, issues } = adapter.adaptHotspot(
      hotspot({ sourceType: "user_confirmed", confirmed: true }),
    );
    expect(fragment.confirmed).toBe(true);
    expect(codes(issues)).not.toContain(ISSUE.CONFIRMED_DOWNGRADED);
  });

  it("非 user_confirmed 即使声称 confirmed 也降级为 false", () => {
    for (const sourceType of ["ai_inferred", "image_observed", "fictional"]) {
      const { fragment, issues } = adapter.adaptHotspot(hotspot({ sourceType, confirmed: true }));
      expect(fragment.confirmed).toBe(false);
      expect(fragment.raw.confirmed).toBe(false);
      expect(codes(issues)).toContain(ISSUE.CONFIRMED_DOWNGRADED);
    }
  });

  it("user_confirmed 但未声称 confirmed 时保持 false（不升级）", () => {
    const { fragment } = adapter.adaptHotspot(hotspot({ sourceType: "user_confirmed" }));
    expect(fragment.confirmed).toBe(false);
  });
});

describe("SceneAdapter · 名称/描述/kind 映射", () => {
  it("name→title 并 trim", () => {
    const { fragment } = adapter.adaptHotspot(hotspot({ name: "  旧车票  " }));
    expect(fragment.title).toBe("旧车票");
  });

  it("空名称回退「未命名碎片」并记 EMPTY_NAME", () => {
    const { fragment, issues } = adapter.adaptHotspot(hotspot({ name: "   " }));
    expect(fragment.title).toBe("未命名碎片");
    expect(codes(issues)).toContain(ISSUE.EMPTY_NAME);
  });

  it("超长名称按 maxNameLength 截断并记 NAME_TRUNCATED", () => {
    const { fragment, issues } = adapter.adaptHotspot(hotspot({ name: "x".repeat(200) }), {
      maxNameLength: 120,
    });
    expect(fragment.title).toHaveLength(120);
    expect(codes(issues)).toContain(ISSUE.NAME_TRUNCATED);
  });

  it("description→content；非字符串按空内容并记 issue", () => {
    expect(adapter.adaptHotspot(hotspot({ description: "文本" })).fragment.content).toBe("文本");
    const bad = adapter.adaptHotspot(hotspot({ description: 5 }));
    expect(bad.fragment.content).toBe("");
    expect(codes(bad.issues)).toContain(ISSUE.INVALID_DESCRIPTION);
  });

  it("无 kindMap 时 type 不猜视觉，用 defaultKind 并记 TYPE_FALLBACK", () => {
    const { fragment, issues } = adapter.adaptHotspot(hotspot({ type: "ticket" }));
    expect(fragment.kind).toBe("keepsake");
    expect(codes(issues)).toContain(ISSUE.TYPE_FALLBACK);
  });

  it("仅显式 kindMap 才映射 type→kind", () => {
    const { fragment } = adapter.adaptHotspot(hotspot({ type: "ticket" }), {
      kindMap: { ticket: "ticket" },
    });
    expect(fragment.kind).toBe("ticket");
  });
});

describe("SceneAdapter · scene 聚合与 visited 回灌", () => {
  const scene = {
    id: "scene-1",
    memoryId: "memory-1",
    template: "generic",
    title: "示例",
    version: 1,
    hotspots: [hotspot({ id: "hs-1" }), hotspot({ id: "hs-2" })],
  };

  it("保留 scene meta 并转换全部热点", () => {
    const result = adapter.adaptScene(scene);
    expect(result.meta.id).toBe("scene-1");
    expect(result.meta.memoryId).toBe("memory-1");
    expect(result.fragments.map((f) => f.id)).toEqual(["hs-1", "hs-2"]);
  });

  it("重复 id 保留首条并记 DUPLICATE_ID", () => {
    const result = adapter.adaptScene({
      ...scene,
      hotspots: [hotspot({ id: "hs-1", name: "首" }), hotspot({ id: "hs-1", name: "次" })],
    });
    expect(result.fragments).toHaveLength(1);
    expect(result.fragments[0].title).toBe("首");
    expect(codes(result.issues)).toContain(ISSUE.DUPLICATE_ID);
  });

  it("visitedHotspots 正确回灌为 exploredIds", () => {
    const result = adapter.adaptScene(scene, { visitedHotspots: ["hs-2"] });
    expect(result.exploredIds).toEqual(["hs-2"]);
  });

  it("孤儿 visited id 被丢弃，不写入 exploredIds", () => {
    const result = adapter.adaptScene(scene, { visitedHotspots: ["hs-2", "ghost"] });
    expect(result.exploredIds).toEqual(["hs-2"]);
  });

  it("pickExploredIds 去重", () => {
    expect(adapter.pickExploredIds(["hs-1", "hs-1", "hs-2"], ["hs-1", "hs-2"])).toEqual([
      "hs-1",
      "hs-2",
    ]);
  });

  it("scene 非对象返回空碎片并记 SCENE_INVALID", () => {
    const result = adapter.adaptScene(null);
    expect(result.fragments).toEqual([]);
    expect(codes(result.issues)).toContain(ISSUE.SCENE_INVALID);
  });
});