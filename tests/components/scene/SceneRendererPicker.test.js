import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SceneRendererPicker } from "@/components/scene/SceneRendererPicker";

function render(value) {
  return renderToStaticMarkup(createElement(SceneRendererPicker, { value, onChange: () => {} }));
}

function buttonSegments(html) {
  return html.split("</button>");
}

describe("SceneRendererPicker", () => {
  it("uses the formal names without the experimental suffix", () => {
    const html = render("canvas");

    expect(html).toContain("C 画布");
    expect(html).toContain("A 空间");
    expect(html).not.toContain("实验");
  });

  it("paints an independent preview area for each renderer", () => {
    const html = render("canvas");

    expect(html).toContain('data-preview="canvas"');
    expect(html).toContain('data-preview="afterimage"');
    expect(html).toContain("暖色画布");
    expect(html).toContain("冷色房间");
  });

  it("marks only the C option pressed when the canvas renderer is active", () => {
    const [canvasButton, afterimageButton] = buttonSegments(render("canvas"));

    expect(canvasButton).toContain('aria-pressed="true"');
    expect(canvasButton).toContain("C 画布");
    expect(canvasButton).toContain("使用中");
    expect(afterimageButton).toContain('aria-pressed="false"');
    expect(afterimageButton).toContain("A 空间");
    expect(afterimageButton).not.toContain("使用中");
  });

  it("marks only the A option pressed when the afterimage renderer is active", () => {
    const [canvasButton, afterimageButton] = buttonSegments(render("afterimage"));

    expect(canvasButton).toContain('aria-pressed="false"');
    expect(afterimageButton).toContain('aria-pressed="true"');
    expect(afterimageButton).toContain("使用中");
    expect(canvasButton).not.toContain("使用中");
  });

  it("keeps both options as real buttons inside a labelled group", () => {
    const html = render("canvas");

    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="场景渲染器"');
    expect(html.match(/<button type="button"/g)).toHaveLength(2);
  });
});