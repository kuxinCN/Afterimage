import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActionChoices } from "@/components/flow/ActionChoices";
import { classifyActionIntent, INTENT_META } from "@/services/api/storyService";

const choices = [
  { id: "mock-look", label: "看看四周" },
  { id: "mock-stay", label: "留在原地" },
];

function render(props) {
  return renderToStaticMarkup(createElement(ActionChoices, props));
}

describe("ActionChoices", () => {
  it("renders nothing without choices", () => {
    expect(render({ choices: [], onChoose: () => {} })).toBe("");
    expect(render({ choices: null, onChoose: () => {} })).toBe("");
  });

  it("shows every label with its intent tag and glyph", () => {
    const html = render({ choices, onChoose: () => {} });

    for (const choice of choices) {
      const meta = INTENT_META[classifyActionIntent({ type: "choice", choiceId: choice.id })];

      expect(html).toContain(choice.label);
      expect(html).toContain(meta.label);
      expect(html).toContain(meta.glyph);
    }
    expect(html).toContain("01");
    expect(html).toContain("02");
    expect(html).toContain("每个行动都会改变故事的走向");
  });

  it("disables every button while a request is running", () => {
    const html = render({ choices, onChoose: () => {}, disabled: true });

    expect(html.match(/disabled=""/g)?.length).toBe(choices.length);
  });
});