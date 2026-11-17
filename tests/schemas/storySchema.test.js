import { describe, expect, it } from "vitest";

import {
  IMAGE_IMPORT_LIMITS,
  SOURCE_TYPES,
  STORY_LIMITS,
  STORY_STORAGE_VERSION,
} from "@/lib/constants";
import {
  persistedStoryStateSchema,
  storyActionInputSchema,
  storyActionSchema,
  storyDraftSchema,
  storyGenerateInputSchema,
  storySchema,
} from "@/schemas/storySchema";
import { buildMockOpeningStory } from "@/services/api/mockStoryData";

const INPUT = { title: "校园午餐", text: "昨天在食堂吃饭。" };

function storyFixture(overrides = {}) {
  return { ...buildMockOpeningStory({ title: INPUT.title }), ...overrides };
}

describe("storyGenerateInputSchema", () => {
  it("accepts a title and text with no images", () => {
    expect(storyGenerateInputSchema.parse(INPUT)).toEqual({ ...INPUT, images: [] });
  });

  it("trims the title and text", () => {
    const parsed = storyGenerateInputSchema.parse({ title: "  校园午餐  ", text: "  吃饭  " });

    expect(parsed.title).toBe("校园午餐");
    expect(parsed.text).toBe("吃饭");
  });

  it("refuses an empty title or text", () => {
    expect(storyGenerateInputSchema.safeParse({ ...INPUT, title: " " }).success).toBe(false);
    expect(storyGenerateInputSchema.safeParse({ ...INPUT, text: "" }).success).toBe(false);
  });

  it("enforces the length limits", () => {
    expect(
      storyGenerateInputSchema.safeParse({
        ...INPUT,
        title: "题".repeat(STORY_LIMITS.MAX_TITLE_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      storyGenerateInputSchema.safeParse({
        ...INPUT,
        text: "记".repeat(STORY_LIMITS.MAX_TEXT_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("accepts image metadata and allows null dimensions", () => {
    const parsed = storyGenerateInputSchema.parse({
      ...INPUT,
      images: [{ mimeType: "image/png", size: 0 }],
    });

    expect(parsed.images[0]).toEqual({
      mimeType: "image/png",
      width: null,
      height: null,
      size: 0,
    });
  });

  it("refuses image bytes or a file name", () => {
    for (const extra of [
      { data: "data:image/jpeg;base64,AAAA" },
      { blob: "blob:http://localhost/x" },
      { originalName: "photo.jpg" },
    ]) {
      expect(
        storyGenerateInputSchema.safeParse({
          ...INPUT,
          images: [{ mimeType: "image/jpeg", size: 1, ...extra }],
        }).success,
      ).toBe(false);
    }
  });

  it("caps the image count at the import limit", () => {
    const image = { mimeType: "image/jpeg", size: 1 };

    expect(
      storyGenerateInputSchema.safeParse({
        ...INPUT,
        images: Array.from({ length: IMAGE_IMPORT_LIMITS.MAX_FILES_PER_IMPORT + 1 }, () => image),
      }).success,
    ).toBe(false);
  });

  it("refuses an unexpected top-level field", () => {
    expect(storyGenerateInputSchema.safeParse({ ...INPUT, apiKey: "sk-x" }).success).toBe(false);
  });
});

describe("storyActionSchema", () => {
  it("accepts a choice action", () => {
    expect(storyActionSchema.parse({ type: "choice", choiceId: "mock-look" })).toEqual({
      type: "choice",
      choiceId: "mock-look",
    });
  });

  it("accepts a free-text action and trims it", () => {
    expect(storyActionSchema.parse({ type: "free", text: "  看看窗外  " })).toEqual({
      type: "free",
      text: "看看窗外",
    });
  });

  it("refuses an unknown type", () => {
    expect(storyActionSchema.safeParse({ type: "jump", choiceId: "x" }).success).toBe(false);
  });

  it("refuses a choice without an id and a free action without text", () => {
    expect(storyActionSchema.safeParse({ type: "choice" }).success).toBe(false);
    expect(storyActionSchema.safeParse({ type: "free", text: "   " }).success).toBe(false);
  });

  it("enforces the free-text limit", () => {
    expect(
      storyActionSchema.safeParse({
        type: "free",
        text: "写".repeat(STORY_LIMITS.MAX_FREE_ACTION_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("refuses fields from the other branch", () => {
    expect(
      storyActionSchema.safeParse({ type: "choice", choiceId: "x", text: "y" }).success,
    ).toBe(false);
  });
});

describe("storyActionInputSchema", () => {
  it("defaults the history to empty", () => {
    const parsed = storyActionInputSchema.parse({
      storyId: "s1",
      title: INPUT.title,
      action: { type: "choice", choiceId: "mock-look" },
    });

    expect(parsed.history).toEqual([]);
  });

  it("requires a storyId and a title", () => {
    const action = { type: "choice", choiceId: "mock-look" };

    expect(storyActionInputSchema.safeParse({ title: INPUT.title, action }).success).toBe(false);
    expect(storyActionInputSchema.safeParse({ storyId: "s1", action }).success).toBe(false);
  });

  it("caps the history", () => {
    const action = { type: "choice", choiceId: "mock-look" };

    expect(
      storyActionInputSchema.safeParse({
        storyId: "s1",
        title: INPUT.title,
        action,
        history: Array.from({ length: STORY_LIMITS.MAX_HISTORY + 1 }, () => action),
      }).success,
    ).toBe(false);
  });
});

describe("storySchema", () => {
  it("accepts the mock story", () => {
    expect(() => storySchema.parse(storyFixture())).not.toThrow();
  });

  it("defaults choices and isEnding", () => {
    const { choices, isEnding, ...rest } = storyFixture();
    const parsed = storySchema.parse(rest);

    expect(parsed.choices).toEqual([]);
    expect(parsed.isEnding).toBe(false);
  });

  it("refuses a paragraph that is not labelled fictional", () => {
    for (const sourceType of [
      SOURCE_TYPES.USER_CONFIRMED,
      SOURCE_TYPES.IMAGE_OBSERVED,
      SOURCE_TYPES.AI_INFERRED,
    ]) {
      const story = storyFixture();

      story.paragraphs[0] = { ...story.paragraphs[0], sourceType };

      expect(storySchema.safeParse(story).success).toBe(false);
    }
  });

  it("refuses a story that is not labelled fictional at the top level", () => {
    expect(
      storySchema.safeParse(storyFixture({ sourceType: SOURCE_TYPES.USER_CONFIRMED })).success,
    ).toBe(false);
  });

  it("refuses an empty paragraph list", () => {
    expect(storySchema.safeParse(storyFixture({ paragraphs: [] })).success).toBe(false);
  });

  it("caps the paragraph count and length", () => {
    const paragraph = { text: "占位", sourceType: SOURCE_TYPES.FICTIONAL };

    expect(
      storySchema.safeParse(
        storyFixture({
          paragraphs: Array.from({ length: STORY_LIMITS.MAX_PARAGRAPHS + 1 }, () => paragraph),
        }),
      ).success,
    ).toBe(false);
    expect(
      storySchema.safeParse(
        storyFixture({
          paragraphs: [
            {
              text: "字".repeat(STORY_LIMITS.MAX_PARAGRAPH_LENGTH + 1),
              sourceType: SOURCE_TYPES.FICTIONAL,
            },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it("refuses an ending that still offers choices", () => {
    expect(storySchema.safeParse(storyFixture({ isEnding: true })).success).toBe(false);
    expect(
      storySchema.safeParse(storyFixture({ isEnding: true, choices: [] })).success,
    ).toBe(true);
  });

  it("refuses duplicate choice ids", () => {
    expect(
      storySchema.safeParse(
        storyFixture({
          choices: [
            { id: "same", label: "甲" },
            { id: "same", label: "乙" },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it("caps the choice count and label length", () => {
    expect(
      storySchema.safeParse(
        storyFixture({
          choices: Array.from({ length: STORY_LIMITS.MAX_CHOICES + 1 }, (unused, index) => ({
            id: `c${index}`,
            label: "选项",
          })),
        }),
      ).success,
    ).toBe(false);
    expect(
      storySchema.safeParse(
        storyFixture({
          choices: [
            { id: "c1", label: "选".repeat(STORY_LIMITS.MAX_CHOICE_LABEL_LENGTH + 1) },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it("refuses an unexpected field", () => {
    expect(storySchema.safeParse(storyFixture({ apiKey: "sk-x" })).success).toBe(false);
  });
});

describe("storyDraftSchema", () => {
  it("allows a half-written draft", () => {
    expect(storyDraftSchema.parse({})).toEqual({ title: "", text: "", images: [] });
  });

  it("still enforces the length limits", () => {
    expect(
      storyDraftSchema.safeParse({ title: "题".repeat(STORY_LIMITS.MAX_TITLE_LENGTH + 1) }).success,
    ).toBe(false);
  });
});

describe("persistedStoryStateSchema", () => {
  const valid = {
    version: STORY_STORAGE_VERSION,
    draft: { title: INPUT.title, text: INPUT.text },
    story: storyFixture(),
    history: [],
  };

  it("accepts a matching version", () => {
    expect(persistedStoryStateSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a null story", () => {
    expect(persistedStoryStateSchema.safeParse({ ...valid, story: null }).success).toBe(true);
  });

  it("refuses any other version", () => {
    expect(persistedStoryStateSchema.safeParse({ ...valid, version: 0 }).success).toBe(false);
    expect(persistedStoryStateSchema.safeParse({ ...valid, version: "1" }).success).toBe(false);
  });

  it("refuses images inside the persisted draft", () => {
    expect(
      persistedStoryStateSchema.safeParse({
        ...valid,
        draft: { ...valid.draft, images: [{ mimeType: "image/jpeg", size: 1 }] },
      }).success,
    ).toBe(false);
  });

  it("refuses a blob url anywhere in the payload", () => {
    expect(
      persistedStoryStateSchema.safeParse({
        ...valid,
        previewUrl: "blob:http://localhost:3000/abc",
      }).success,
    ).toBe(false);
  });
});