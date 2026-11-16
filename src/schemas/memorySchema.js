import { z } from "zod";

import { MEMORY_STATUS, MEMORY_STATUS_LIST } from "@/lib/constants";
import { analysisDraftSchema } from "@/schemas/analysisSchema";
import { sourcedValueSchema } from "@/schemas/sourceSchema";

export {
  assertConfirmedProvenance,
  confirmedCopy,
  inferredValue,
  sourceTypeSchema,
  sourcedValueBaseSchema,
  sourcedValueSchema,
  userConfirmedValue,
} from "@/schemas/sourceSchema";

export const memoryStatusSchema = z.enum(MEMORY_STATUS_LIST);

export const sourcedFactSchema = z.object({
  events: z.array(sourcedValueSchema).default([]),
  objects: z.array(sourcedValueSchema).default([]),
  locations: z.array(sourcedValueSchema).default([]),
  uncertainties: z.array(z.string().min(1)).default([]),
  tags: z.array(sourcedValueSchema).default([]),
  times: z.array(sourcedValueSchema).default([]),
  summary: sourcedValueSchema.nullable().default(null),
});

export function emptyFacts() {
  return {
    events: [],
    objects: [],
    locations: [],
    uncertainties: [],
    tags: [],
    times: [],
    summary: null,
  };
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
    // The unconfirmed provider output plus the user's review edits. Nothing in
    // here counts as confirmed memory until confirmAnalysis copies it to facts.
    analysis: analysisDraftSchema.nullable().default(null),
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
