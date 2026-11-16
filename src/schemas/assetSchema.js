import { z } from "zod";

import { ASSET_TYPES } from "@/lib/constants";

export const assetTypeSchema = z.enum([ASSET_TYPES.IMAGE]);

export const assetSchema = z
  .object({
    id: z.string().min(1),
    memoryId: z.string().min(1),
    type: assetTypeSchema,
    blob: z.instanceof(Blob),
    mimeType: z.string().min(1),
    originalName: z.string().min(1),
    width: z.number().int().positive().nullable().default(null),
    height: z.number().int().positive().nullable().default(null),
    analysis: z.unknown().nullable().default(null),
    createdAt: z.number().int().nonnegative(),
  })
  .strict();

// id, memoryId and blob are fixed when an asset is created; replacing image
// bytes means deleting the asset and creating a new one.
export const assetPatchSchema = assetSchema
  .omit({ id: true, memoryId: true, blob: true, createdAt: true })
  .partial();
