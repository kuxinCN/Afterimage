import { z } from "zod";

import { SOURCE_TYPES, SOURCE_TYPE_LIST } from "@/lib/constants";

// Leaf module: memorySchema and analysisSchema both need these, and a shared
// leaf keeps them from importing each other in a cycle.
export const sourceTypeSchema = z.enum(SOURCE_TYPE_LIST, {
  errorMap: () => ({
    message: `sourceType must be one of: ${SOURCE_TYPE_LIST.join(", ")}`,
  }),
});

export const sourcedValueBaseSchema = z
  .object({
    value: z.union([z.string().min(1), z.number(), z.boolean()]),
    sourceType: sourceTypeSchema,
    sourceIds: z.array(z.string().min(1)).default([]),
    confidence: z.number().min(0).max(1).default(0),
    confirmed: z.boolean().default(false),
  })
  .strict();

export function assertConfirmedProvenance(item, ctx) {
  if (item.confirmed && item.sourceType !== SOURCE_TYPES.USER_CONFIRMED) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only user_confirmed items may be marked confirmed",
      path: ["sourceType"],
    });
  }
}

export const sourcedValueSchema = sourcedValueBaseSchema.superRefine(assertConfirmedProvenance);

// Provenance is never inferred from the shape of a value. A review form can
// easily re-post an AI suggestion as a plain string, so a bare string is
// rejected; callers that really mean "the user stated this" go through
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

export function inferredValue(value, confidence = 0.4) {
  return {
    value,
    sourceType: SOURCE_TYPES.AI_INFERRED,
    sourceIds: [],
    confidence,
    confirmed: false,
  };
}

// Drafts carry review state (baseline, adopted); confirmed facts must not, so
// this projects back onto the five sourced-value fields instead of spreading.
export function confirmedCopy(item) {
  return {
    value: item.value,
    sourceType: SOURCE_TYPES.USER_CONFIRMED,
    sourceIds: item.sourceIds ?? [],
    confidence: 1,
    confirmed: true,
  };
}
