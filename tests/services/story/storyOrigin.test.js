import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  attachStoryOrigin,
  clearStoryOrigin,
  readStoryOrigin,
  resolveStoryOrigin,
  STORY_ORIGIN_KEY,
  writeStoryOrigin,
} from "@/services/story/storyOrigin";

function fakeSessionStorage() {
  const map = new Map();

  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

const memoryId = crypto.randomUUID();
const storyId = crypto.randomUUID();
const origin = { memoryId, memoryTitle: "校园午餐", storyId: null };

beforeEach(() => {
  vi.stubGlobal("window", { sessionStorage: fakeSessionStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("storyOrigin persistence", () => {
  it("round-trips a valid origin", () => {
    writeStoryOrigin(origin);

    expect(readStoryOrigin()).toEqual(origin);
  });

  it("returns null when nothing is stored", () => {
    expect(readStoryOrigin()).toBeNull();
  });

  it("rejects corrupt or hand-edited entries", () => {
    window.sessionStorage.setItem(STORY_ORIGIN_KEY, "{not json");
    expect(readStoryOrigin()).toBeNull();

    window.sessionStorage.setItem(STORY_ORIGIN_KEY, JSON.stringify({ ...origin, memoryId: "nope" }));
    expect(readStoryOrigin()).toBeNull();

    window.sessionStorage.setItem(
      STORY_ORIGIN_KEY,
      JSON.stringify({ ...origin, extra: "field" }),
    );
    expect(readStoryOrigin()).toBeNull();
  });

  it("refuses to write an invalid origin", () => {
    writeStoryOrigin({ ...origin, memoryTitle: "" });

    expect(readStoryOrigin()).toBeNull();
  });

  it("clears the marker", () => {
    writeStoryOrigin(origin);
    clearStoryOrigin();

    expect(readStoryOrigin()).toBeNull();
  });

  it("degrades quietly when storage is blocked", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      },
    });

    expect(() => writeStoryOrigin(origin)).not.toThrow();
    expect(readStoryOrigin()).toBeNull();
    expect(() => clearStoryOrigin()).not.toThrow();
  });

  it("is a no-op outside a browser", () => {
    vi.stubGlobal("window", undefined);

    expect(readStoryOrigin()).toBeNull();
    expect(() => writeStoryOrigin(origin)).not.toThrow();
  });
});

describe("attachStoryOrigin", () => {
  it("binds the pending handoff to the first generated story", () => {
    writeStoryOrigin(origin);
    attachStoryOrigin(storyId);

    expect(readStoryOrigin()).toEqual({ ...origin, storyId });
  });

  it("never rebinds an already-bound origin", () => {
    writeStoryOrigin({ ...origin, storyId });
    attachStoryOrigin(crypto.randomUUID());

    expect(readStoryOrigin().storyId).toBe(storyId);
  });

  it("does nothing without a pending handoff", () => {
    attachStoryOrigin(storyId);

    expect(readStoryOrigin()).toBeNull();
  });
});

describe("resolveStoryOrigin", () => {
  it("resolves only for the exact story seeded from the memory", () => {
    const bound = { ...origin, storyId };

    expect(resolveStoryOrigin(bound, storyId)).toEqual(bound);
    expect(resolveStoryOrigin(bound, crypto.randomUUID())).toBeNull();
    expect(resolveStoryOrigin(origin, storyId)).toBeNull();
    expect(resolveStoryOrigin(null, storyId)).toBeNull();
    expect(resolveStoryOrigin(bound, null)).toBeNull();
  });
});