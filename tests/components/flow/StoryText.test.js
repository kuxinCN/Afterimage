import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StoryText } from "@/components/flow/StoryText";

const story = {
  id: "story-1",
  title: "教室最后一排",
  sourceType: "fictional",
  isMock: true,
  paragraphs: [
    { text: "第一段想象内容。", sourceType: "fictional" },
    { text: "第二段想象内容。", sourceType: "fictional" },
  ],
};

function render(props) {
  return renderToStaticMarkup(createElement(StoryText, props));
}

describe("StoryText", () => {
  it("renders nothing without a story", () => {
    expect(render({ story: null })).toBe("");
  });

  it("keeps the fiction provenance banner", () => {
    const html = render({ story });

    expect(html).toContain("Mock 占位内容");
    expect(html).toContain("想象内容");
    expect(html).toContain("非真实记忆还原");
    expect(html).toContain("以下 2 段");
  });

  it("renders every paragraph with the staggered entrance", () => {
    const html = render({ story });

    expect(html).toContain("第一段想象内容。");
    expect(html).toContain("第二段想象内容。");
    expect(html.match(/para-in/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("animation-delay:110ms");
  });
});