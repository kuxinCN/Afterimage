import { ASSET_TYPES, ERROR_CODES, MEMORY_STATUS } from "@/lib/constants";
import { AssetRepository } from "@/services/storage/assetRepository";
import { StorageError } from "@/services/storage/db";
import { MemoryRepository } from "@/services/storage/memoryRepository";

function sameIdSet(expected, actual) {
  if (expected.length !== actual.length) {
    return false;
  }

  const wanted = [...expected].sort();
  const stored = [...actual].sort();

  return wanted.every((id, index) => id === stored[index]);
}

// Deleting the memory cascades to every asset already written, which is the
// stage 2 guarantee this import relies on instead of a second transaction layer.
async function rollback(memoryId, cause) {
  try {
    await MemoryRepository.delete(memoryId);
  } catch (cleanupError) {
    cause.cleanupFailed = true;
    cause.cleanupError = cleanupError;
  }
}

export async function createMemoryWithImages(input) {
  const images = Array.isArray(input?.images) ? input.images : [];

  if (images.length === 0) {
    throw new StorageError(ERROR_CODES.IMAGES_REQUIRED, "一段记忆至少需要一张图片");
  }

  const memory = await MemoryRepository.create({
    title: input.title,
    description: input.description ?? "",
    date: input.date ?? null,
    location: input.location ?? null,
    status: MEMORY_STATUS.DRAFT,
  });

  const assets = [];

  try {
    for (const image of images) {
      assets.push(
        await AssetRepository.create({
          memoryId: memory.id,
          type: ASSET_TYPES.IMAGE,
          blob: image?.blob ?? image?.file,
          mimeType: image?.mimeType,
          originalName: image?.originalName ?? image?.file?.name,
          width: image?.width ?? null,
          height: image?.height ?? null,
        }),
      );
    }

    const stored = await MemoryRepository.getById(memory.id);

    if (!stored) {
      throw new StorageError(ERROR_CODES.MEMORY_NOT_FOUND, `Memory ${memory.id} vanished`);
    }
    if (!sameIdSet(assets.map((asset) => asset.id), stored.assetIds)) {
      throw new StorageError(
        ERROR_CODES.STORAGE_FAILED,
        "图片记录与记忆关联不一致，已放弃本次保存",
      );
    }

    return { memory: stored, assets };
  } catch (error) {
    await rollback(memory.id, error);
    throw error;
  }
}

export async function readMemoryWithAssets(memoryId) {
  const memory = await MemoryRepository.getById(memoryId);

  if (!memory) {
    throw new StorageError(ERROR_CODES.MEMORY_NOT_FOUND, `Memory ${memoryId} does not exist`);
  }

  const assets = await AssetRepository.getByMemoryId(memoryId);

  return { memory, assets };
}

export async function removeMemoryAsset(memoryId, assetId) {
  await AssetRepository.delete(assetId);

  return readMemoryWithAssets(memoryId);
}
