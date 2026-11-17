import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HotspotDetailPanel, SourceBadge } from "@/components/scene/HotspotDetailPanel";
import { hotspotSchema } from "@/schemas/sceneSchema";

function baseHotspot(overrides = {}) {
  return {
    id: "h1",
    name: "窗边的书桌",
    type: "object",
    position: { x: 0.3, y: 0.5 },
    sourceIds: [],
    description: "一张靠窗的旧书桌",
    sourceType: "ai_inferred",
    ...overrides,
  };
}

function render(props) {
  return renderToStaticMarkup(createElement(HotspotDetailPanel, props));
}

describe("HotspotDetailPanel", () => {
  it("uses a hotspot fixture that satisfies the existing hotspotSchema", () => {
    expect(() => hotspotSchema.parse(baseHotspot())).not.toThrow();
  });

  it("renders nothing when no hotspot is supplied", () => {
    expect(render({ hotspot: null })).toBe("");
  });

  it("shows the name and description of the given hotspot", () => {
    const html = render({ hotspot: baseHotspot() });

    expect(html).toContain("窗边的书桌");
    expect(html).toContain("一张靠窗的旧书桌");
  });

  it("renders a different description for a different hotspot", () => {
    const html = render({
      hotspot: baseHotspot({ id: "h2", name: "墙上的挂钟", description: "停摆的挂钟" }),
    });

    expect(html).toContain("墙上的挂钟");
    expect(html).toContain("停摆的挂钟");
    expect(html).not.toContain("一张靠窗的旧书桌");
  });

  it("falls back honestly when the description is empty", () => {
    const html = render({ hotspot: baseHotspot({ description: "" }) });

    expect(html).toContain("这个热点还没有更多描述。");
  });

  it("labels ai_inferred as a guess, never as confirmed fact", () => {
    const html = render({ hotspot: baseHotspot({ sourceType: "ai_inferred" }) });

    expect(html).toContain("AI 推测");
    expect(html).toContain("尚未被你确认");
    expect(html).not.toContain("你确认过的内容");
  });

  it("labels user_confirmed distinctly from ai_inferred", () => {
    const confirmed = render({ hotspot: baseHotspot({ sourceType: "user_confirmed" }) });
    const inferred = render({ hotspot: baseHotspot({ sourceType: "ai_inferred" }) });

    expect(confirmed).toContain("用户确认");
    expect(confirmed).toContain("你确认过的内容");
    // Green/trust tone for confirmed, amber/uncertain tone for inference.
    expect(confirmed).toContain("text-[#bfe3a8]");
    expect(inferred).toContain("text-[#f3d9a8]");
    expect(confirmed).not.toBe(inferred);
  });

  it("supports image_observed and fictional badges when the data carries them", () => {
    expect(render({ hotspot: baseHotspot({ sourceType: "image_observed" }) })).toContain("图片可见");

    const fictional = render({ hotspot: baseHotspot({ sourceType: "fictional" }) });
    expect(fictional).toContain("想象内容");
    expect(fictional).toContain("不是真实记忆");
  });

  it("reflects the persisted visited flag", () => {
    expect(render({ hotspot: baseHotspot(), visited: false })).toContain("未探索");
    expect(render({ hotspot: baseHotspot(), visited: true })).toContain("已探索");
  });

  it("reports the sourceIds count without dropping the field", () => {
    const html = render({ hotspot: baseHotspot({ sourceIds: ["a1", "a2"] }) });

    expect(html).toContain("关联 2 条来源记录");
  });

  it("renders a close control only when onClose is provided", () => {
    expect(render({ hotspot: baseHotspot(), onClose: () => {} })).toContain("关闭详情");
    expect(render({ hotspot: baseHotspot() })).not.toContain("关闭详情");
  });

  it("shows confidence defensively when a richer fragment supplies it", () => {
    const html = render({ hotspot: baseHotspot({ confidence: 0.4 }) });

    expect(html).toContain("置信度 40%");
  });

  it("never asserts confirmed for a non user_confirmed source", () => {
    const inferred = render({
      hotspot: baseHotspot({ sourceType: "ai_inferred", confirmed: true }),
    });
    const confirmed = render({
      hotspot: baseHotspot({ sourceType: "user_confirmed", confirmed: true }),
    });

    expect(inferred).not.toContain("已确认");
    expect(confirmed).toContain("已确认");
  });
});

describe("SourceBadge", () => {
  it("maps each canonical source type to its label", () => {
    expect(renderToStaticMarkup(createElement(SourceBadge, { sourceType: "user_confirmed" }))).toContain(
      "用户确认",
    );
    expect(renderToStaticMarkup(createElement(SourceBadge, { sourceType: "ai_inferred" }))).toContain(
      "AI 推测",
    );
  });

  it("falls back to the raw value for an unknown source type", () => {
    expect(renderToStaticMarkup(createElement(SourceBadge, { sourceType: "mystery" }))).toContain(
      "mystery",
    );
  });
});