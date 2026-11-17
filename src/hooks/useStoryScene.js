"use client";

import { useCallback, useState } from "react";

import { appendVisitedHotspot } from "@/components/flow/StoryScenePanel";

// The single seam between the story page and the scene lane. The page never
// resolves scene data itself; it consumes { scene, visitedHotspots, onHotspotClick }
// from here, so swapping lanes later is a one-file change.
//
// Two parallel lanes (decision: keep both, do not merge yet):
//   C interactive lane (current): standalone Mock story in sessionStorage, no
//     memory/scene binding -> scene stays null and the seat shows a placeholder.
//   B memory-bound lane (T4 contract, not implemented): story carries
//     sceneId/sceneVersion; exploration persists via visitHotspot.
//
// TODO(B): when the memory-bound lane lands, resolve the FULL sceneSchema row
// here from the local scene Repository by story.sceneId, and persist exploration
// through visitHotspot(memoryId, id). Note B's storyGenerationInputSchema.scene
// ({id,version,hotspots[{id,name}]}) is an AI-input projection only — it lacks
// template/background/position and is NOT a valid visual payload for the seat.
// TODO(B): plug point. C interactive lane has no scene binding, so this returns
// null. When the memory-bound lane lands, look up the full sceneSchema row from
// the local scene Repository by story.sceneId here.
function resolveScene(story) {
  return null;
}

export function useStoryScene(story) {
  const [visitedHotspots, setVisitedHotspots] = useState([]);

  const scene = resolveScene(story);

  const onHotspotClick = useCallback((hotspotId) => {
    setVisitedHotspots((current) => appendVisitedHotspot(current, hotspotId));
  }, []);

  return { scene, visitedHotspots, onHotspotClick };
}