import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActionTimeline } from "@/components/flow/ActionTimeline";

const steps = [
  { index: 1, kind: "choice", label: "看看四周", input: null, intent: "observe" },
  { index: 2, kind: "free", label: "自由输入", input: "我想先离开", intent: "withdraw" },
];

function render(props) {
  return renderToStaticMarkup(createElement(ActionTimeline, props));
}

describe("ActionTimeline", () => {
  it("renders nothing without steps", () => {
    expect(render({ steps: [] })).toBe("");
    expect(render({ steps: null })).toBe("");
  });

  it("renders choice and free steps with intent labels", () => {
    const html = render({ steps });

    expect(html).toContain("选择「看看四周」");
    expect(html).toContain("自由输入：我想先离开");
    expect(html).toContain("观察");
    expect(html).toContain("退开");
    expect(html).toContain("01");
    expect(html).toContain("02");
  });

  it("shows aligned outcomes when provided", () => {
    const html = render({ steps, outcomes: ["你环顾了四周。", "你向门口走去。"] });

    expect(html).toContain("你环顾了四周。");
    expect(html).toContain("你向门口走去。");
  });

  it("omits outcome lines when absent", () => {
    expect(render({ steps })).not.toContain("你环顾了四周。");
  });
});