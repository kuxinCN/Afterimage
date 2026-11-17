import { afterEach, describe, expect, it, vi } from "vitest";

import { ERROR_CODES, SOURCE_TYPES, STORY_LIMITS } from "@/lib/constants";
import { storySchema } from "@/schemas/storySchema";
import { ApiError } from "@/services/api/client";
import { buildMockOpeningStory } from "@/services/api/mockStoryData";
import { generateStory, storyApiConfig, submitAction } from "@/services/api/storyService";

const INPUT = { title: "校园午餐", text: "昨天在食堂吃饭，桌上有一个餐盘。" };

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

async function walkTo(step) {
  const { story } = await generateStory(INPUT);
  let current = story;
  const history = [];

  for (let index = 0; index < step; index += 1) {
    const action = { type: "choice", choiceId: current.choices[0].id };

    history.push(action);
    current = (
      await submitAction({ storyId: story.id, title: story.title, action, history: history.slice(0, -1) })
    ).story;
  }

  return { opening: story, current, history };
}

afterEach(() => {
  storyApiConfig.useMock = true;
  vi.restoreAllMocks();
});

describe("generateStory", () => {
  it("returns a story that satisfies the schema", async () => {
    const { story } = await generateStory(INPUT);

    expect(() => storySchema.parse(story)).not.toThrow();
    expect(story.title).toBe(INPUT.title);
    expect(story.paragraphs.length).toBeGreaterThan(0);
    expect(story.choices.length).toBeGreaterThan(0);
    expect(story.isEnding).toBe(false);
  });

  it("marks itself as mock fiction, never as a recovered memory", async () => {
    const { story } = await generateStory(INPUT);

    expect(story.isMock).toBe(true);
    expect(story.provider).toBe("mock");
    expect(story.sourceType).toBe(SOURCE_TYPES.FICTIONAL);

    for (const paragraph of story.paragraphs) {
      expect(paragraph.sourceType).toBe(SOURCE_TYPES.FICTIONAL);
    }

    const serialized = JSON.stringify(story);

    expect(serialized).not.toContain(SOURCE_TYPES.IMAGE_OBSERVED);
    expect(serialized).not.toContain(SOURCE_TYPES.USER_CONFIRMED);
    expect(serialized).not.toContain(SOURCE_TYPES.AI_INFERRED);
  });

  it("accepts a memory with no images at all", async () => {
    const { story } = await generateStory({ ...INPUT, images: [] });

    expect(story.id).toBeTruthy();
  });

  it("accepts image metadata", async () => {
    const { story } = await generateStory({
      ...INPUT,
      images: [{ mimeType: "image/jpeg", width: 64, height: 48, size: 1024 }],
    });

    expect(story.id).toBeTruthy();
  });

  it("refuses image bytes smuggled in as a field", async () => {
    await expect(
      generateStory({
        ...INPUT,
        images: [{ mimeType: "image/jpeg", size: 10, data: "data:image/jpeg;base64,AAAA" }],
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });
  });

  it("refuses an api key smuggled in as a field", async () => {
    await expect(generateStory({ ...INPUT, apiKey: "sk-secret" })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
  });

  it("refuses an empty title", async () => {
    await expect(generateStory({ ...INPUT, title: "   " })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
  });

  it("refuses an empty text", async () => {
    await expect(generateStory({ ...INPUT, text: "" })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
  });

  it("refuses an over-long text", async () => {
    await expect(
      generateStory({ ...INPUT, text: "记".repeat(STORY_LIMITS.MAX_TEXT_LENGTH + 1) }),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });
  });

  it("never touches the network while the mock is on", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await generateStory(INPUT);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("submitAction", () => {
  it("keeps the story id and title while advancing", async () => {
    const { story } = await generateStory(INPUT);
    const action = { type: "choice", choiceId: story.choices[0].id };

    const next = await submitAction({ storyId: story.id, title: story.title, action });

    expect(next.story.id).toBe(story.id);
    expect(next.story.title).toBe(story.title);
    expect(next.story.paragraphs).not.toEqual(story.paragraphs);
    expect(() => storySchema.parse(next.story)).not.toThrow();
  });

  it("accepts a free-text action", async () => {
    const { story } = await generateStory(INPUT);

    const next = await submitAction({
      storyId: story.id,
      title: story.title,
      action: { type: "free", text: "我想先看看窗外" },
    });

    expect(next.story.isEnding).toBe(false);
    expect(next.story.sourceType).toBe(SOURCE_TYPES.FICTIONAL);
  });

  it("reaches an ending that offers no further choices", async () => {
    const { current } = await walkTo(3);

    expect(current.isEnding).toBe(true);
    expect(current.choices).toEqual([]);
    expect(() => storySchema.parse(current)).not.toThrow();
  });

  it("stays deterministic for the same history", async () => {
    const first = await walkTo(2);
    const second = await walkTo(2);

    expect(first.current.paragraphs).toEqual(second.current.paragraphs);
    expect(first.current.choices).toEqual(second.current.choices);
  });

  it("refuses an unknown action type", async () => {
    const { story } = await generateStory(INPUT);

    await expect(
      submitAction({ storyId: story.id, title: story.title, action: { type: "jump" } }),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });
  });

  it("refuses an empty free-text action", async () => {
    const { story } = await generateStory(INPUT);

    await expect(
      submitAction({
        storyId: story.id,
        title: story.title,
        action: { type: "free", text: "  " },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });
  });

  it("refuses a choice action without a choiceId", async () => {
    const { story } = await generateStory(INPUT);

    await expect(
      submitAction({ storyId: story.id, title: story.title, action: { type: "choice" } }),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });
  });

  it("refuses a history beyond the cap", async () => {
    const { story } = await generateStory(INPUT);
    const action = { type: "choice", choiceId: story.choices[0].id };

    await expect(
      submitAction({
        storyId: story.id,
        title: story.title,
        action,
        history: Array.from({ length: STORY_LIMITS.MAX_HISTORY + 1 }, () => action),
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });
  });
});

describe("the server seam", () => {
  it("posts the parsed input to /api/story/generate when the mock is off", async () => {
    storyApiConfig.useMock = false;

    const story = buildMockOpeningStory({ title: INPUT.title });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ story }));

    const result = await generateStory(INPUT);

    expect(result.story.id).toBe(story.id);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0];

    expect(url).toBe("/api/story/generate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ ...INPUT, images: [] });
  });

  it("posts to /api/story/action when the mock is off", async () => {
    storyApiConfig.useMock = false;

    const story = buildMockOpeningStory({ title: INPUT.title });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ story }));

    await submitAction({
      storyId: story.id,
      title: story.title,
      action: { type: "choice", choiceId: story.choices[0].id },
    });

    const [url, init] = fetchSpy.mock.calls[0];

    expect(url).toBe("/api/story/action");
    expect(JSON.parse(init.body).history).toEqual([]);
  });

  it("surfaces the 501 placeholder as not implemented", async () => {
    storyApiConfig.useMock = false;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        { code: ERROR_CODES.API_NOT_IMPLEMENTED, message: "故事生成接口尚未接入，等待 B 实现。" },
        501,
      ),
    );

    const error = await generateStory(INPUT).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe(ERROR_CODES.API_NOT_IMPLEMENTED);
    expect(error.message).toBe("故事生成接口尚未接入，等待 B 实现。");
  });

  it("rejects a server story that breaks the contract", async () => {
    storyApiConfig.useMock = false;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ story: { id: "s1", paragraphs: [] } }),
    );

    await expect(generateStory(INPUT)).rejects.toMatchObject({
      code: ERROR_CODES.API_INVALID_RESULT,
    });
  });

  it("rejects a server story that tries to pass fiction off as confirmed", async () => {
    storyApiConfig.useMock = false;

    const story = buildMockOpeningStory({ title: INPUT.title });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        story: {
          ...story,
          sourceType: SOURCE_TYPES.USER_CONFIRMED,
          paragraphs: story.paragraphs.map((paragraph) => ({
            ...paragraph,
            sourceType: SOURCE_TYPES.IMAGE_OBSERVED,
          })),
        },
      }),
    );

    await expect(generateStory(INPUT)).rejects.toMatchObject({
      code: ERROR_CODES.API_INVALID_RESULT,
    });
  });
});