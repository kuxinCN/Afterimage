import { ERROR_CODES } from "@/lib/constants";
import { generateScene } from "@/services/ai/aiService";
import { StorageError } from "@/services/storage/db";
import { ExplorationRepository } from "@/services/storage/explorationRepository";
import { MemoryRepository } from "@/services/storage/memoryRepository";
import { SceneRepository } from "@/services/storage/sceneRepository";

export async function readScene(memoryId) {
  const memory = await MemoryRepository.getById(memoryId);

  if (!memory) {
    throw new StorageError(ERROR_CODES.MEMORY_NOT_FOUND, `Memory ${memoryId} does not exist`);
  }

  const scene = await SceneRepository.getByMemoryId(memoryId);
  const exploration = await ExplorationRepository.getByMemoryId(memoryId);

  return { memory, scene, visitedHotspots: exploration?.visitedHotspots ?? [] };
}

// Idempotent: a memory keeps the scene it already has. Deliberate regeneration
// is aiService.generateScene, which bumps the version instead of returning early.
export async function generateSceneForMemory(memoryId) {
  const existing = await SceneRepository.getByMemoryId(memoryId);

  if (existing) {
    return existing;
  }

  const { scene } = await generateScene(memoryId);

  return scene;
}

async function recordVisit(memoryId, hotspotId) {
  const scene = await SceneRepository.getByMemoryId(memoryId);

  if (!scene) {
    throw new StorageError(ERROR_CODES.SCENE_NOT_FOUND, `Memory ${memoryId} has no scene`);
  }
  // An exploration entry must always point at a hotspot that still exists, so a
  // stale click after a regeneration cannot leave an orphan behind.
  if (!scene.hotspots.some((hotspot) => hotspot.id === hotspotId)) {
    throw new StorageError(ERROR_CODES.VALIDATION_FAILED, "场景里没有这个热点，请重新生成后再试。");
  }

  const exploration = await ExplorationRepository.markHotspotVisited(memoryId, hotspotId);

  return { scene, exploration };
}

export async function markHotspotVisited(memoryId, hotspotId) {
  const { exploration } = await recordVisit(memoryId, hotspotId);

  return exploration;
}

export async function visitHotspot(memoryId, hotspotId) {
  const { scene, exploration } = await recordVisit(memoryId, hotspotId);

  return { scene, visitedHotspots: exploration.visitedHotspots };
}