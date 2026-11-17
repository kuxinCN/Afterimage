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
  AI_PROVIDER_UNAVAILABLE: "AI_PROVIDER_UNAVAILABLE",
  AI_INVALID_INPUT: "AI_INVALID_INPUT",
  AI_ANALYSIS_FAILED: "AI_ANALYSIS_FAILED",
  AI_INVALID_RESULT: "AI_INVALID_RESULT",
  AI_ANALYSIS_IN_PROGRESS: "AI_ANALYSIS_IN_PROGRESS",
  AI_ANALYSIS_NOT_FOUND: "AI_ANALYSIS_NOT_FOUND",
  SCENE_NOT_CONFIRMED: "SCENE_NOT_CONFIRMED",
  SCENE_INVALID_RESULT: "SCENE_INVALID_RESULT",
  SCENE_GENERATION_FAILED: "SCENE_GENERATION_FAILED",
  SCENE_GENERATION_IN_PROGRESS: "SCENE_GENERATION_IN_PROGRESS",
  API_NETWORK_FAILED: "API_NETWORK_FAILED",
  API_TIMEOUT: "API_TIMEOUT",
  API_HTTP_ERROR: "API_HTTP_ERROR",
  API_INVALID_RESULT: "API_INVALID_RESULT",
  API_NOT_IMPLEMENTED: "API_NOT_IMPLEMENTED",
  API_ABORTED: "API_ABORTED",
  STORY_INPUT_REQUIRED: "STORY_INPUT_REQUIRED",
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

export const AI_PROVIDERS = {
  MOCK: "mock",
};

export const DEFAULT_AI_PROVIDER = AI_PROVIDERS.MOCK;

// Scene template names. The mock classifies into these; sceneTemplates turns
// them into a schematic layout, never into a claim about the photo.
export const SCENE_TYPES = {
  CAFETERIA: "cafeteria",
  BEDROOM: "bedroom",
  CLASSROOM: "classroom",
  STREET: "street",
  OUTDOOR: "outdoor",
  GENERIC: "generic",
};

export const SCENE_TYPE_LIST = Object.values(SCENE_TYPES);

export const SCENE_TYPE_LABELS = {
  [SCENE_TYPES.CAFETERIA]: "食堂 / 餐厅",
  [SCENE_TYPES.BEDROOM]: "卧室",
  [SCENE_TYPES.CLASSROOM]: "教室",
  [SCENE_TYPES.STREET]: "街道",
  [SCENE_TYPES.OUTDOOR]: "户外",
  [SCENE_TYPES.GENERIC]: "未定场景",
};

export const ANALYSIS_QUALITY_LEVELS = {
  A: "A",
  B: "B",
  C: "C",
};

export const ANALYSIS_QUALITY_LABELS = {
  A: "资料充分",
  B: "资料有限",
  C: "资料不足",
};

export const ANALYSIS_LIMITS = {
  MAX_SUMMARY_LENGTH: 500,
  MAX_ITEM_LENGTH: 80,
  MAX_ITEMS_PER_LIST: 24,
  MAX_MISSING_NOTES: 8,
};

// One hotspot per template slot, so the layout can never overlap itself.
export const SCENE_LIMITS = {
  MAX_HOTSPOTS: 24,
};

// Same-origin on purpose: a cross-origin base URL would push the AI call, and
// therefore its key, into the browser. Keys stay server-side.
export const API_BASE_URL = "/api";

export const API_RETRY = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY_MS: 300,
  TIMEOUT_MS: 15000,
};

export const STORY_LIMITS = {
  MAX_TITLE_LENGTH: 120,
  MAX_TEXT_LENGTH: 5000,
  MAX_FREE_ACTION_LENGTH: 500,
  MAX_PARAGRAPHS: 12,
  MAX_PARAGRAPH_LENGTH: 1000,
  MAX_CHOICES: 4,
  MAX_CHOICE_LABEL_LENGTH: 60,
  MAX_HISTORY: 20,
};

export const STORY_ACTION_TYPES = {
  CHOICE: "choice",
  FREE: "free",
};

export const STORY_STORAGE_KEY = "afterimage.story";

export const STORY_STORAGE_VERSION = 1;
