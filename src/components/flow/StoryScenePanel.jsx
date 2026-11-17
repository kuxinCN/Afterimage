"use client";

import { SceneCanvas } from "@/components/scene/SceneCanvas";
import { SceneSlot } from "@/components/flow/SceneSlot";

// Integration seat between the story flow and A's visual component. It is purely
// presentational: it never reads StoryContext, so the scene can be swapped or
// tested without the story store. The props mirror A's SceneCanvas contract:
//   scene            — a full sceneSchema row, or null when unavailable
//   visitedHotspots  — string[] of explored hotspot ids
//   onHotspotClick   — (hotspotId) => void, handed back to the story page
// The scene payload is supplied by the useStoryScene seam (see hooks/useStoryScene).
// B's T4 storyGenerationInputSchema.scene ({id,version,hotspots[{id,name}]}) is an
// AI-input projection only; the visual seat needs the full sceneSchema row
// (template/background/position), resolved locally by sceneId once B lands.
export function StoryScenePanel({ scene = null, visitedHotspots = [], onHotspotClick, label }) {
  if (!scene) {
    return <SceneSlot label={label} />;
  }

  return (
    <SceneSlot label={label}>
      <SceneCanvas
        scene={scene}
        visitedHotspots={visitedHotspots}
        onHotspotClick={onHotspotClick}
      />
    </SceneSlot>
  );
}

// Story-page side of the hotspot callback: record an exploration locally without
// mutating the previous list. Pure so the interaction logic is testable apart
// from React. Persistence / linking to memory exploration is B's call (TODO).
export function appendVisitedHotspot(visitedHotspots, hotspotId) {
  if (!hotspotId || visitedHotspots.includes(hotspotId)) {
    return visitedHotspots;
  }

  return [...visitedHotspots, hotspotId];
}