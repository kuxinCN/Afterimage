"use client";

import { createContext, useContext, useEffect, useMemo, useReducer } from "react";

import { STORY_STORAGE_KEY } from "@/lib/constants";
import {
  initialStoryState,
  readPersistedState,
  storyReducer,
  writePersistedState,
} from "./storyReducer";

const StoryContext = createContext(null);

function readStorage() {
  try {
    return window.sessionStorage.getItem(STORY_STORAGE_KEY);
  } catch {
    // Private mode or a blocked storage area: fall back to memory-only state.
    return null;
  }
}

function writeStorage(serialized) {
  try {
    window.sessionStorage.setItem(STORY_STORAGE_KEY, serialized);
  } catch {
    // Quota exceeded or storage blocked. The flow still works in memory.
  }
}

export function StoryProvider({ children }) {
  const [state, dispatch] = useReducer(storyReducer, initialStoryState);

  // Reading during render would desynchronise the server HTML from the client,
  // so the restore happens after mount and pages wait for `hydrated`.
  useEffect(() => {
    const restored = readPersistedState(readStorage());

    if (!restored) {
      try {
        window.sessionStorage.removeItem(STORY_STORAGE_KEY);
      } catch {
        // Nothing to clean up when storage is unavailable.
      }
    }

    dispatch({ type: "hydrate", state: restored });
  }, []);

  useEffect(() => {
    if (!state.hydrated) {
      return;
    }

    writeStorage(writePersistedState(state));
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <StoryContext.Provider value={value}>{children}</StoryContext.Provider>;
}

export function useStoryStore() {
  const context = useContext(StoryContext);

  if (!context) {
    throw new Error("useStoryStore must be used inside StoryProvider");
  }

  return context;
}