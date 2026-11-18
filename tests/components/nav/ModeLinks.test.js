import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ModeLinks } from "@/components/nav/ModeLinks";

function render(props) {
  return renderToStaticMarkup(createElement(ModeLinks, props));
}

describe("ModeLinks", () => {
  it("marks the memory line as current and links the story line", () => {
    const html = render({ current: "memory", storyHref: "/create" });

    expect(html).toContain('aria-current="page"');
    expect(html).toMatch(/<span[^>]*aria-current="page"[^>]*>记忆空间<\/span>/);
    expect(html).toMatch(/<a[^>]*href="\/create"[^>]*>平行故事<\/a>/);
    expect(html).not.toMatch(/<a[^>]*>记忆空间<\/a>/);
  });

  it("marks the story line as current and links the memory line", () => {
    const html = render({ current: "story", storyHref: "/story" });

    expect(html).toMatch(/<span[^>]*aria-current="page"[^>]*>平行故事<\/span>/);
    expect(html).toMatch(/<a[^>]*href="\/memory"[^>]*>记忆空间<\/a>/);
    expect(html).not.toMatch(/<a[^>]*>平行故事<\/a>/);
  });

  it("passes the story entry href through unchanged", () => {
    expect(render({ current: "memory", storyHref: "/story" })).toContain('href="/story"');
    expect(render({ current: "memory", storyHref: "/create" })).toContain('href="/create"');
  });

  it("always shows both line labels", () => {
    for (const current of ["memory", "story"]) {
      const html = render({ current, storyHref: "/create" });
      expect(html).toContain("记忆空间");
      expect(html).toContain("平行故事");
    }
  });
});