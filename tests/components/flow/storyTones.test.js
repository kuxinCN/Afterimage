import { describe, expect, it } from "vitest";

import { toneStyle, TONE_STYLES } from "@/components/flow/storyTones";
import { ENDING_META, INTENT_META } from "@/services/api/storyService";

describe("storyTones", () => {
  it("covers every intent and ending tone used by the story service", () => {
    const tones = [
      ...Object.values(INTENT_META).map((meta) => meta.tone),
      ...Object.values(ENDING_META).map((meta) => meta.tone),
    ];

    for (const tone of tones) {
      expect(TONE_STYLES[tone], `missing tone: ${tone}`).toBeDefined();
      expect(toneStyle(tone).text).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("degrades unknown tones to the neutral paper style", () => {
    expect(toneStyle("unknown")).toEqual(TONE_STYLES.paper);
    expect(toneStyle(undefined)).toEqual(TONE_STYLES.paper);
  });
});