"use client";

import { usePathname } from "next/navigation";

import { ModeLinks } from "@/components/nav/ModeLinks";
import { useStoryStore } from "@/store/StoryContext";

// Read-only shell: derives the current line from the route and the story entry
// from the store. It never dispatches, so mounting it cannot restart a story.
export function ModeNav() {
  const pathname = usePathname();
  const { state } = useStoryStore();

  const current =
    pathname === "/" ? null : pathname.startsWith("/memory") ? "memory" : "story";
  const storyHref = state.hydrated && state.story ? "/story" : "/create";

  return <ModeLinks current={current} storyHref={storyHref} />;
}