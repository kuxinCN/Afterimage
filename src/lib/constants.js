export const DB_NAME = "afterimage_db";

export const DB_VERSION = 1;

export const STORES = {
  memories: "memories",
  assets: "assets",
  scenes: "scenes",
  explorations: "explorations",
};

export const INDEXES = {
  memories: { byStatus: "status", byCreatedAt: "createdAt" },
  assets: { byMemoryId: "memoryId", byCreatedAt: "createdAt" },
  scenes: { byMemoryId: "memoryId" },
  explorations: { byLastVisitedAt: "lastVisitedAt" },
};

export const MEMORY_STATUS = {
  DRAFT: "draft",
  ANALYZING: "analyzing",
  REVIEWING: "reviewing",
  READY: "ready",
  GENERATING: "generating",
  COMPLETED: "completed",
  FAILED: "failed",
};

export const SOURCE_TYPES = {
  USER_CONFIRMED: "user_confirmed",
  IMAGE_OBSERVED: "image_observed",
  AI_INFERRED: "ai_inferred",
  FICTIONAL: "fictional",
};

export const SOURCE_TYPE_LIST = Object.values(SOURCE_TYPES);

export const MEMORY_STATUS_LIST = Object.values(MEMORY_STATUS);

export const ASSET_TYPES = {
  IMAGE: "image",
};

export const SCENE_BACKGROUND_TYPES = {
  TEMPLATE: "template",
  ASSET: "asset",
};

export const SCENE_HOTSPOT_TYPE = "object";

export const SCENE_INITIAL_VERSION = 1;

export const ERROR_CODES = {
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
  STORAGE_FAILED: "STORAGE_FAILED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  MEMORY_NOT_FOUND: "MEMORY_NOT_FOUND",
  ASSET_NOT_FOUND: "ASSET_NOT_FOUND",
  SCENE_NOT_FOUND: "SCENE_NOT_FOUND",
  SCENE_ALREADY_EXISTS: "SCENE_ALREADY_EXISTS",
  EXPLORATION_NOT_FOUND: "EXPLORATION_NOT_FOUND",
  EXPLORATION_ALREADY_EXISTS: "EXPLORATION_ALREADY_EXISTS",
};
