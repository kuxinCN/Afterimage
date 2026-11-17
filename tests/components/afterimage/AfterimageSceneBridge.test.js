import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AfterimageSceneBridge } from "@/components/afterimage/AfterimageSceneBridge";
import { fragmentScale } from "@/components/afterimage/fragmentLayout";

function sceneWith(count) {
  return {
    id: "scene-1",
    memoryId: "memory-1",
    template: "generic",
    title: "示例",
    version: 1,
    hotspots: Array.from({ length: count }, (_, index) => ({
      id: `hs-${index}`,
      name: `碎片${index + 1}`,
      type: "object",
      position: { x: 0.5, y: 0.3 },
      description: "示例描述",
      sourceType: "ai_inferred",
      sourceIds: [],
    })),
  };
}

describe("AfterimageSceneBridge · SSR 安全", () => {
  it("服务端渲染只输出宿主 div，不触碰 window/document", () => {
    const html = renderToStaticMarkup(
      createElement(AfterimageSceneBridge, {
        scene: sceneWith(8),
        visitedHotspots: [],
        onHotspotClick: () => {},
      }),
    );
    expect(html).toContain("a-bridge");
    expect(html).toContain("--a-frag-scale");
    // A 核心脚本仅在 useEffect 内 dynamic import，SSR 不应已挂载碎片
    expect(html).not.toContain("mf-visual");
  });

  it("把缩放变量传给宿主，供 A 的 --ms-scale 使用", () => {
    const html = renderToStaticMarkup(
      createElement(AfterimageSceneBridge, { scene: sceneWith(24), visitedHotspots: [] }),
    );
    expect(html).toContain(`--a-frag-scale:${fragmentScale(24)}`);
  });

  it("超过 8 热点进入密集布局类", () => {
    const dense = renderToStaticMarkup(
      createElement(AfterimageSceneBridge, { scene: sceneWith(24), visitedHotspots: [] }),
    );
    const sparse = renderToStaticMarkup(
      createElement(AfterimageSceneBridge, { scene: sceneWith(8), visitedHotspots: [] }),
    );
    expect(dense).toContain("a-bridge--dense");
    expect(sparse).not.toContain("a-bridge--dense");
  });

  it("空 scene 也不崩溃", () => {
    const html = renderToStaticMarkup(
      createElement(AfterimageSceneBridge, { scene: null, visitedHotspots: [] }),
    );
    expect(html).toContain("a-bridge");
  });

  it("默认抑制 A 自带面板（正式页面由 C 面板承担详情）", () => {
    const html = renderToStaticMarkup(
      createElement(AfterimageSceneBridge, { scene: sceneWith(8), visitedHotspots: [] }),
    );
    expect(html).not.toContain("a-bridge--panel");
  });

  it("showPanel 时保留 A 自带面板类（实验沙箱对照用）", () => {
    const html = renderToStaticMarkup(
      createElement(AfterimageSceneBridge, { scene: sceneWith(8), visitedHotspots: [], showPanel: true }),
    );
    expect(html).toContain("a-bridge--panel");
  });
});