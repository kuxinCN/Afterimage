import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LineCards } from "@/components/home/LineCards";

function render(storyHref) {
  return renderToStaticMarkup(createElement(LineCards, { storyHref }));
}

describe("LineCards", () => {
  it("renders both line entries with titles and positioning labels", () => {
    const html = render("/create");

    expect(html).toContain("记忆空间");
    expect(html).toContain("平行故事");
    expect(html).toContain("真实记忆");
    expect(html).toContain("虚构演绎");
    expect(html).toContain("想象");
  });

  it("links the memory card to /memory", () => {
    expect(render("/create")).toMatch(/<a[^>]*href="\/memory"/);
  });

  it("routes the story card to /create when no story is in progress", () => {
    const html = render("/create");
    expect(html).toMatch(/<a[^>]*href="\/create"/);
    expect(html).not.toMatch(/<a[^>]*href="\/story"/);
  });

  it("routes the story card straight to /story when a story is in progress", () => {
    const html = render("/story");
    expect(html).toMatch(/<a[^>]*href="\/story"/);
    expect(html).not.toMatch(/<a[^>]*href="\/create"/);
  });
});