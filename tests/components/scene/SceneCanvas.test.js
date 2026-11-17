import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SceneCanvas } from "@/components/scene/SceneCanvas";
import { sceneSchema } from "@/schemas/sceneSchema";

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
  return renderToStaticMarkup(createElement(SceneCanvas, props));
}

function count(html, token) {
  return html.split(token).length - 1;
}

describe("SceneCanvas selection (additive, backward compatible)", () => {
  it("uses a scene fixture that satisfies the existing sceneSchema", () => {
    expect(() => sceneSchema.parse(SCENE)).not.toThrow();
  });

  it("renders no selected marker when selectedHotspotId is omitted", () => {
    const html = render({ scene: SCENE, visitedHotspots: ["h1"] });

    expect(count(html, "scale-125")).toBe(0);
    expect(html).toContain("教室最后一排");
  });

  it("highlights exactly the selected hotspot", () => {
    const html = render({ scene: SCENE, selectedHotspotId: "h2" });

    expect(count(html, "scale-125")).toBe(1);
    expect(count(html, "ring-2")).toBe(1);
  });

  it("keeps visited aria-pressed independent of selection", () => {
    const html = render({ scene: SCENE, visitedHotspots: ["h1"], selectedHotspotId: "h2" });

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(count(html, "scale-125")).toBe(1);
  });

  it("returns null without a scene", () => {
    expect(render({ scene: null })).toBe("");
  });
});