import { STORES } from "@/lib/constants";
import { getDB } from "@/services/storage/db";

export async function resetDatabase() {
  const db = await getDB();
  await Promise.all(Object.values(STORES).map((store) => db.clear(store)));
}

export function memoryFixture(overrides = {}) {
  return {
    title: "校园午餐",
    description: "和同学吃午餐",
    date: "2026-11-15",
    ...overrides,
  };
}

export function imageBlob(bytes = [255, 216, 255, 219], type = "image/jpeg") {
  return new Blob([new Uint8Array(bytes)], { type });
}

export function assetFixture(memoryId, overrides = {}) {
  return {
    memoryId,
    type: "image",
    blob: imageBlob(),
    mimeType: "image/jpeg",
    originalName: "photo.jpg",
    width: 1920,
    height: 1080,
    ...overrides,
  };
}

export function hotspotFixture(id = "hotspot_001", overrides = {}) {
  return {
    id,
    name: "餐盘",
    position: { x: 0.45, y: 0.7 },
    sourceIds: [],
    description: "照片中可见的餐盘",
    sourceType: "image_observed",
    ...overrides,
  };
}

export function sceneFixture(memoryId, overrides = {}) {
  return {
    memoryId,
    template: "cafeteria",
    title: "校园食堂",
    background: { type: "template", assetId: null },
    hotspots: [hotspotFixture()],
    ...overrides,
  };
}
