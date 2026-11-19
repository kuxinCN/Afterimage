import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ErrorBoundary from "@/app/error";
import GlobalError from "@/app/global-error";
import MemoryDetailLoading from "@/app/memory/[id]/loading";
import NotFound from "@/app/not-found";

describe("route boundaries", () => {
  it("not-found offers both line entries and a way home", () => {
    const html = renderToStaticMarkup(createElement(NotFound));

    expect(html).toContain("没有找到这一页");
    expect(html).toContain('href="/memory"');
    expect(html).toContain('href="/create"');
    expect(html).toContain('href="/"');
  });

  it("error boundary offers retry and home without leaking the raw error", () => {
    const html = renderToStaticMarkup(
      createElement(ErrorBoundary, { error: new Error("secret stack"), reset: () => {} }),
    );

    expect(html).toContain("这一页暂时出了问题");
    expect(html).toContain("重试这一页");
    expect(html).toContain('href="/"');
    expect(html).not.toContain("secret stack");
  });

  it("global error ships its own document shell and retry", () => {
    const html = renderToStaticMarkup(
      createElement(GlobalError, { error: new Error("boom"), reset: () => {} }),
    );

    expect(html).toContain("<html");
    expect(html).toContain("<body");
    expect(html).toContain("应用遇到了严重错误");
    expect(html).toContain("重试");
    expect(html).not.toContain("boom");
  });

  it("memory detail loading renders a busy skeleton, not a blank frame", () => {
    const html = renderToStaticMarkup(createElement(MemoryDetailLoading));

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("正在打开这段记忆");
    expect((html.match(/skeleton/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });
});