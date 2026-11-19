import { z } from "zod";

// Session-scoped provenance marker for the voluntary memory→story handoff.
// Deliberately outside the story schema and IndexedDB: the story itself stays
// source-free, and the link only ever reflects an explicit user confirmation.
export const STORY_ORIGIN_KEY = "afterimage.storyOrigin";

const storyOriginSchema = z
  .object({
    memoryId: z.string().uuid(),
    memoryTitle: z.string().min(1).max(120),
    storyId: z.string().uuid().nullable(),
  })
  .strict();

function storage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStoryOrigin() {
  const area = storage();
  if (!area) {
    return null;
  }

  let raw;
  try {
    raw = area.getItem(STORY_ORIGIN_KEY);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = storyOriginSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

export function writeStoryOrigin(origin) {
  const area = storage();
  if (!area) {
    return;
  }

  const parsed = storyOriginSchema.safeParse(origin);
  if (!parsed.success) {
    return;
  }

  try {
    area.setItem(STORY_ORIGIN_KEY, JSON.stringify(parsed.data));
  } catch {
    // Storage blocked or full: the handoff still works, only the return
    // shortcut on the ending page degrades to the plain memory list link.
  }
}

// Binds the pending handoff to the story actually generated from it.
export function attachStoryOrigin(storyId) {
  const origin = readStoryOrigin();

  if (origin && origin.storyId === null) {
    writeStoryOrigin({ ...origin, storyId });
  }
}

export function clearStoryOrigin() {
  const area = storage();
  if (!area) {
    return;
  }

  try {
    area.removeItem(STORY_ORIGIN_KEY);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

// A shortcut is offered only for the exact story the user seeded; anything
// else (direct /create, restarted story, stale marker) resolves to null.
export function resolveStoryOrigin(origin, storyId) {
  if (!origin || !storyId || origin.storyId !== storyId) {
    return null;
  }

  return origin;
}