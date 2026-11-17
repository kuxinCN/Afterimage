import { describe, expect, it } from "vitest";

import { SOURCE_TYPES, STORY_STORAGE_VERSION } from "@/lib/constants";
import { buildMockOpeningStory } from "@/services/api/mockStoryData";
import {
  initialStoryState,
  readPersistedState,
  storyReducer,
  writePersistedState,
} from "@/store/storyReducer";

const ACTION = { type: "choice", choiceId: "mock-look" };

function storyFixture() {
  return buildMockOpeningStory({ title: "校园午餐" });
}

function stateWithStory() {
  return storyReducer(initialStoryState, { type: "startStory", story: storyFixture() });
}

describe("storyReducer", () => {
  it("starts empty and unhydrated", () => {
    expect(initialStoryState).toEqual({
      draft: { title: "", text: "", images: [] },
      story: null,
      history: [],
      hydrated: false,
    });
  });

  it("replaces the draft", () => {
    const draft = { title: "校园午餐", text: "在食堂吃饭", images: [] };
    const next = storyReducer(initialStoryState, { type: "setDraft", draft });

    expect(next.draft).toEqual(draft);
    expect(next.story).toBeNull();
  });

  it("starts a story and clears any previous history", () => {
    const withHistory = storyReducer(stateWithStory(), {
      type: "advanceStory",
      story: storyFixture(),
      action: ACTION,
    });
    const story = storyFixture();
    const next = storyReducer(withHistory, { type: "startStory", story });

    expect(next.story).toEqual(story);
    expect(next.history).toEqual([]);
  });

  it("appends the action while replacing the story", () => {
    const next = storyReducer(stateWithStory(), {
      type: "advanceStory",
      story: storyFixture(),
      action: ACTION,
    });

    expect(next.history).toEqual([ACTION]);
  });

  it("keeps the whole history instead of truncating it", () => {
    let state = stateWithStory();

    for (let index = 0; index < 5; index += 1) {
      state = storyReducer(state, {
        type: "advanceStory",
        story: storyFixture(),
        action: { type: "free", text: `第 ${index} 步` },
      });
    }

    expect(state.history).toHaveLength(5);
    expect(state.history[0]).toEqual({ type: "free", text: "第 0 步" });
    expect(state.history[4]).toEqual({ type: "free", text: "第 4 步" });
  });

  it("resets to a clean but hydrated state", () => {
    const next = storyReducer(stateWithStory(), { type: "reset" });

    expect(next).toEqual({ ...initialStoryState, hydrated: true });
  });

  it("hydrates from nothing", () => {
    const next = storyReducer(initialStoryState, { type: "hydrate", state: null });

    expect(next).toEqual({ ...initialStoryState, hydrated: true });
  });

  it("hydrates from a restored state", () => {
    const story = storyFixture();
    const restored = {
      draft: { title: "校园午餐", text: "在食堂吃饭", images: [] },
      story,
      history: [ACTION],
    };
    const next = storyReducer(initialStoryState, { type: "hydrate", state: restored });

    expect(next).toEqual({ ...restored, hydrated: true });
  });

  it("ignores an unknown action", () => {
    const state = stateWithStory();

    expect(storyReducer(state, { type: "nonsense" })).toBe(state);
  });

  it("never mutates the previous state", () => {
    const state = stateWithStory();
    const snapshot = JSON.stringify(state);

    storyReducer(state, { type: "advanceStory", story: storyFixture(), action: ACTION });
    storyReducer(state, { type: "setDraft", draft: { title: "x", text: "y", images: [] } });
    storyReducer(state, { type: "reset" });

    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe("persisted state", () => {
  it("round-trips a story through storage", () => {
    const state = { ...stateWithStory(), hydrated: true };
    const restored = readPersistedState(writePersistedState(state));

    expect(restored.story).toEqual(state.story);
    expect(restored.draft.title).toBe("");
    expect(restored.history).toEqual([]);
  });

  it("round-trips a draft and its history", () => {
    const state = storyReducer(
      {
        ...stateWithStory(),
        draft: { title: "校园午餐", text: "在食堂吃饭", images: [] },
      },
      { type: "advanceStory", story: storyFixture(), action: ACTION },
    );
    const restored = readPersistedState(writePersistedState(state));

    expect(restored.draft).toEqual({ title: "校园午餐", text: "在食堂吃饭", images: [] });
    expect(restored.history).toEqual([ACTION]);
  });

  it("never writes image metadata into storage", () => {
    const state = {
      ...stateWithStory(),
      draft: {
        title: "校园午餐",
        text: "在食堂吃饭",
        images: [{ mimeType: "image/jpeg", width: 64, height: 48, size: 10 }],
      },
    };
    const serialized = writePersistedState(state);

    expect(serialized).not.toContain("image/jpeg");
    expect(readPersistedState(serialized).draft.images).toEqual([]);
  });

  it("stamps the storage version", () => {
    expect(JSON.parse(writePersistedState(stateWithStory())).version).toBe(
      STORY_STORAGE_VERSION,
    );
  });

  it("returns null for an empty entry", () => {
    expect(readPersistedState(null)).toBeNull();
    expect(readPersistedState("")).toBeNull();
  });

  it("returns null for broken JSON", () => {
    expect(readPersistedState("{not json")).toBeNull();
  });

  it("returns null for a stale version", () => {
    const payload = JSON.parse(writePersistedState(stateWithStory()));

    expect(readPersistedState(JSON.stringify({ ...payload, version: 999 }))).toBeNull();
  });

  it("returns null for an unexpected field", () => {
    const payload = JSON.parse(writePersistedState(stateWithStory()));

    expect(readPersistedState(JSON.stringify({ ...payload, apiKey: "sk-secret" }))).toBeNull();
  });

  it("returns null for a story that claims to be observed in a photo", () => {
    const payload = JSON.parse(writePersistedState(stateWithStory()));

    payload.story.paragraphs[0].sourceType = SOURCE_TYPES.IMAGE_OBSERVED;

    expect(readPersistedState(JSON.stringify(payload))).toBeNull();
  });

  it("returns null for a history beyond the cap", () => {
    const payload = JSON.parse(writePersistedState(stateWithStory()));

    payload.history = Array.from({ length: 21 }, () => ACTION);

    expect(readPersistedState(JSON.stringify(payload))).toBeNull();
  });
});