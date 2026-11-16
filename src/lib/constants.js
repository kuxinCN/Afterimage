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
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  FILE_EMPTY: "FILE_EMPTY",
  UNSUPPORTED_FILE_TYPE: "UNSUPPORTED_FILE_TYPE",
  CORRUPTED_IMAGE: "CORRUPTED_IMAGE",
  TOO_MANY_IMAGES: "TOO_MANY_IMAGES",
  DUPLICATE_IMAGE: "DUPLICATE_IMAGE",
  IMAGES_REQUIRED: "IMAGES_REQUIRED",
};

// Single source of truth for import limits. UI copy reads these values so a
// later product decision only has to change one place.
export const IMAGE_IMPORT_LIMITS = {
  MAX_FILE_BYTES: 10 * 1024 * 1024,
  MAX_FILES_PER_IMPORT: 9,
  THUMBNAIL_MAX_EDGE: 512,
  THUMBNAIL_QUALITY: 0.82,
  HEADER_BYTES_TO_READ: 16,
};

export const IMAGE_FORMAT_MIME_TYPES = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const SUPPORTED_IMAGE_MIME_TYPES = Object.values(IMAGE_FORMAT_MIME_TYPES);

export const SOURCE_TYPE_LABELS = {
  [SOURCE_TYPES.USER_CONFIRMED]: "用户确认",
  [SOURCE_TYPES.IMAGE_OBSERVED]: "图片可见",
  [SOURCE_TYPES.AI_INFERRED]: "AI 推测",
  [SOURCE_TYPES.FICTIONAL]: "想象内容",
};
