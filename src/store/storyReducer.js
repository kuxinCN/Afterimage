import { STORY_STORAGE_VERSION } from "@/lib/constants";
import { persistedStoryStateSchema } from "@/schemas/storySchema";

export const initialStoryState = {
  draft: { title: "", text: "", images: [] },
  story: null,
  history: [],
  hydrated: false,
};

export function storyReducer(state, action) {
  switch (action.type) {
    case "hydrate":
      return { ...(action.state ?? initialStoryState), hydrated: true };

    case "setDraft":
      return { ...state, draft: action.draft };

    case "startStory":
      return { ...state, story: action.story, history: [] };

    // History is kept whole, never truncated: dropping the oldest actions would
    // silently desynchronise the step the service derives from history.length.
    case "advanceStory":
      return {
        ...state,
        story: action.story,
        history: [...state.history, action.action],
      };

    case "reset":
      return { ...initialStoryState, hydrated: true };

    default:
      return state;
  }
}

// Returns null for anything unreadable so a corrupt or stale entry degrades to
// a fresh start instead of crashing the page.
export function readPersistedState(raw) {
  if (!raw) {
    return null;
  }

  let json;

  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = persistedStoryStateSchema.safeParse(json);

  if (!parsed.success) {
    return null;
  }

  return {
    draft: { ...parsed.data.draft, images: [] },
    story: parsed.data.story,
    history: parsed.data.history,
  };
}

export function writePersistedState(state) {
  return JSON.stringify({
    version: STORY_STORAGE_VERSION,
    draft: { title: state.draft.title, text: state.draft.text },
    story: state.story,
    history: state.history,
  });
}