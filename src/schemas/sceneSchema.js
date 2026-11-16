import { z } from "zod";

import {
  SCENE_BACKGROUND_TYPES,
  SCENE_HOTSPOT_TYPE,
  SCENE_INITIAL_VERSION,
} from "@/lib/constants";
import { sourceTypeSchema } from "@/schemas/sourceSchema";

const normalizedCoordinate = z.number().min(0).max(1);

export const scenePositionSchema = z
  .object({
    x: normalizedCoordinate,
    y: normalizedCoordinate,
  })
  .strict();

export const sceneBackgroundSchema = z
  .object({
    type: z.enum([SCENE_BACKGROUND_TYPES.TEMPLATE, SCENE_BACKGROUND_TYPES.ASSET]),
    assetId: z.string().min(1).nullable().default(null),
  })
  .strict()
  .superRefine((background, ctx) => {
    if (background.type === SCENE_BACKGROUND_TYPES.ASSET && !background.assetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An asset background must reference an assetId",
        path: ["assetId"],
      });
    }
  });

export const hotspotSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    type: z.string().trim().min(1).max(40).default(SCENE_HOTSPOT_TYPE),
    position: scenePositionSchema,
    sourceIds: z.array(z.string().min(1)).default([]),
    description: z.string().trim().max(2000).default(""),
    sourceType: sourceTypeSchema,
  })
  .strict();

export const hotspotListSchema = z
  .array(hotspotSchema)
  .default([])
  .superRefine((hotspots, ctx) => {
    const seen = new Set();
    hotspots.forEach((hotspot, index) => {
      if (seen.has(hotspot.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate hotspot id: ${hotspot.id}`,
          path: [index, "id"],
        });
      }
      seen.add(hotspot.id);
    });
  });

export const sceneSchema = z
  .object({
    id: z.string().min(1),
    memoryId: z.string().min(1),
    template: z.string().trim().min(1).max(60),
    title: z.string().trim().min(1).max(120),
    background: sceneBackgroundSchema,
    hotspots: hotspotListSchema,
    version: z.number().int().positive().default(SCENE_INITIAL_VERSION),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
  })
  .strict();

// memoryId is the ownership link and stays fixed after creation.
export const scenePatchSchema = sceneSchema
  .omit({ id: true, memoryId: true, createdAt: true })
  .partial();
