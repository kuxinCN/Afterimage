import { z } from "zod";

import { MEMORY_STATUS, MEMORY_STATUS_LIST, SOURCE_TYPES, SOURCE_TYPE_LIST } from "@/lib/constants";

export const memoryStatusSchema = z.enum(MEMORY_STATUS_LIST);

export const sourceTypeSchema = z.enum(SOURCE_TYPE_LIST, {
  errorMap: () => ({
    message: `sourceType must be one of: ${SOURCE_TYPE_LIST.join(", ")}`,
  }),
});

export const sourcedValueSchema = z
  .object({
    value: z.union([z.string().min(1), z.number(), z.boolean()]),
    sourceType: sourceTypeSchema,
    sourceIds: z.array(z.string().min(1)).default([]),
    confidence: z.number().min(0).max(1).default(0),
    confirmed: z.boolean().default(false),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.confirmed && item.sourceType !== SOURCE_TYPES.USER_CONFIRMED) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only user_confirmed items may be marked confirmed",
        path: ["sourceType"],
      });
    }
  });

// Provenance is never inferred from the shape of a value. A review form can
// easily re-post an AI suggestion as a plain string, so a bare string is
// rejected here; callers that really mean "the user stated this" go through
// userConfirmedValue, which is greppable in review.
export function userConfirmedValue(value, sourceIds = []) {
  return {
    value,
    sourceType: SOURCE_TYPES.USER_CONFIRMED,
    sourceIds,
    confidence: 1,
    confirmed: true,
  };
}

export const sourcedFactSchema = z.object({
  events: z.array(sourcedValueSchema).default([]),
  objects: z.array(sourcedValueSchema).default([]),
  locations: z.array(sourcedValueSchema).default([]),
  uncertainties: z.array(z.string().min(1)).default([]),
});

export function emptyFacts() {
  return { events: [], objects: [], locations: [], uncertainties: [] };
}

export const memorySchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(5000).default(""),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date must use the YYYY-MM-DD format")
      .nullable()
      .default(null),
    location: sourcedValueSchema.nullable().default(null),
    facts: sourcedFactSchema.default(emptyFacts),
    status: memoryStatusSchema.default(MEMORY_STATUS.DRAFT),
    assetIds: z.array(z.string().min(1)).default([]),
    sceneId: z.string().min(1).nullable().default(null),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
  })
  .strict();

// assetIds and sceneId stay in sync through their own repositories, so callers
// cannot patch them directly.
export const memoryPatchSchema = memorySchema
  .omit({ id: true, createdAt: true, assetIds: true, sceneId: true })
  .partial();
