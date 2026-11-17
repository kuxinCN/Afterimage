import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StoryScenePanel, appendVisitedHotspot } from "@/components/flow/StoryScenePanel";
import { sceneSchema } from "@/schemas/sceneSchema";

// A test fixture only — not production data. Hotspots are ai_inferred, never
// image_observed, matching the project's provenance rules.
const SCENE = {
  id: "scene-1",
  memoryId: "memory-1",
  template: "classroom",
  title: "教室最后一排",
  background: { type: "template", assetId: null },
  hotspots: [
    {
      id: "h1",
      name: "窗边的书桌",
      type: "object",
      position: { x: 0.3, y: 0.5 },
      sourceIds: [],
      description: "一张靠窗的旧书桌",
      sourceType: "ai_inferred",
    },
    {
      id: "h2",
      name: "墙上的挂钟",
      type: "object",
      position: { x: 0.7, y: 0.3 },
      sourceIds: [],
      description: "停摆的挂钟",
      sourceType: "ai_inferred",
    },
  ],
  version: 1,
  createdAt: 1,
  updatedAt: 1,
};

function render(props) {
  return renderToStaticMarkup(createElement(StoryScenePanel, props));
}

describe("StoryScenePanel", () => {
  it("uses a scene fixture that satisfies the existing sceneSchema", () => {
    expect(() => sceneSchema.parse(SCENE)).not.toThrow();
  });

  it("renders the honest placeholder when no scene is available", () => {
    const html = render({ scene: null });

    expect(html).toContain("组件占位");
    expect(html).toContain("等待 A 的视觉组件接入");
    expect(html).not.toContain("窗边的书桌");
  });

  it("mounts A's SceneCanvas when a scene is provided, without reimplementing it", () => {
    const html = render({ scene: SCENE });

    expect(html).toContain("教室最后一排");
    expect(html).toContain("窗边的书桌");
    expect(html).toContain("墙上的挂钟");
    // SceneCanvas's own footer proves the real component rendered.
    expect(html).toContain("模拟场景");
    expect(html).not.toContain("组件占位");
  });

  it("reflects visitedHotspots through A's component", () => {
    const html = render({ scene: SCENE, visitedHotspots: ["h1"] });

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("热点 窗边的书桌，已探索");
  });

  it("passes a custom label through to the placeholder", () => {
    const html = render({ scene: null, label: "故事场景" });

    expect(html).toContain("故事场景组件占位");
  });

  it("renders outside any StoryProvider, proving it is decoupled from StoryContext", () => {
    expect(() => render({ scene: null })).not.toThrow();
    expect(() => render({ scene: SCENE, visitedHotspots: ["h1"] })).not.toThrow();
  });
});

describe("appendVisitedHotspot", () => {
  it("appends a new hotspot id", () => {
    expect(appendVisitedHotspot([], "h1")).toEqual(["h1"]);
    expect(appendVisitedHotspot(["h1"], "h2")).toEqual(["h1", "h2"]);
  });

  it("does not duplicate an already visited id", () => {
    const visited = ["h1"];

    expect(appendVisitedHotspot(visited, "h1")).toBe(visited);
  });

  it("ignores a falsy id and never mutates the input", () => {
    const visited = ["h1"];

    expect(appendVisitedHotspot(visited, "")).toBe(visited);
    expect(appendVisitedHotspot(visited, undefined)).toBe(visited);
    expect(visited).toEqual(["h1"]);
  });
});