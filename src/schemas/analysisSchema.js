import { z } from "zod";

import {
  AI_PROVIDERS,
  ANALYSIS_LIMITS,
  ANALYSIS_QUALITY_LEVELS,
  SCENE_TYPE_LIST,
} from "@/lib/constants";
import {
  assertConfirmedProvenance,
  sourceTypeSchema,
  sourcedValueBaseSchema,
} from "@/schemas/sourceSchema";

const { MAX_ITEM_LENGTH, MAX_ITEMS_PER_LIST, MAX_MISSING_NOTES, MAX_SUMMARY_LENGTH } =
  ANALYSIS_LIMITS;

const itemText = z.string().trim().min(1).max(MAX_ITEM_LENGTH);
const summaryText = z.string().trim().min(1).max(MAX_SUMMARY_LENGTH);

export const analysisQualitySchema = z.enum(Object.values(ANALYSIS_QUALITY_LEVELS));

function buildAnalysisItem(textSchema) {
  return sourcedValueBaseSchema
    .extend({
      value: textSchema,
      // The untouched provider wording. User edits land in `value`, and this is
      // what lets a re-analysis recognise the same item instead of starting over.
      baseline: textSchema,
      // Nothing enters the confirmed memory unless the user adopted it.
      adopted: z.boolean().default(false),
    })
    .superRefine(assertConfirmedProvenance);
}

export const analysisItemSchema = buildAnalysisItem(summaryText);

const analysisShortItemSchema = buildAnalysisItem(itemText);

const uniqueItemValues = (items, ctx) => {
  const seen = new Set();

  items.forEach((item, index) => {
    if (seen.has(item.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate analysis item: ${item.value}`,
        path: [index, "value"],
      });
    }
    seen.add(item.value);
  });
};

export const analysisItemListSchema = z
  .array(analysisShortItemSchema)
  .max(MAX_ITEMS_PER_LIST)
  .superRefine(uniqueItemValues);

export const analysisSceneSchema = z
  .object({
    type: z.enum(SCENE_TYPE_LIST),
    title: itemText,
    sourceType: sourceTypeSchema,
  })
  .strict();

export const analysisDraftSchema = z
  .object({
    provider: z.enum(Object.values(AI_PROVIDERS)),
    // Every draft in this release comes from a simulated provider. A real
    // provider has to widen this literal, which forces the UI badge to change.
    simulated: z.literal(true),
    generatedAt: z.number().int().nonnegative(),
    revision: z.number().int().positive().default(1),
    basedOn: z
      .object({
        imageCount: z.number().int().nonnegative(),
        descriptionLength: z.number().int().nonnegative(),
        hasDate: z.boolean(),
        hasLocation: z.boolean(),
      })
      .strict(),
    quality: analysisQualitySchema,
    summary: analysisItemSchema.nullable(),
    scene: analysisSceneSchema.nullable(),
    elements: analysisItemListSchema.default([]),
    tags: analysisItemListSchema.default([]),
    times: analysisItemListSchema.default([]),
    places: analysisItemListSchema.default([]),
    missing: z
      .array(z.string().trim().min(1).max(200))
      .max(MAX_MISSING_NOTES)
      .default([]),
  })
  .strict();

// The provider boundary deliberately excludes file names and image bytes: a
// name or a resolution says nothing about what a photo depicts.
export const analysisInputSchema = z
  .object({
    memoryId: z.string().min(1),
    title: z.string().trim().max(120),
    description: z.string().trim().max(5000),
    date: z.string().nullable().default(null),
    location: z.string().nullable().default(null),
    imageCount: z.number().int().nonnegative(),
    images: z
      .array(
        z
          .object({
            mimeType: z.string().min(1),
            width: z.number().int().positive().nullable(),
            height: z.number().int().positive().nullable(),
          })
          .strict(),
      )
      .max(MAX_ITEMS_PER_LIST)
      .default([]),
  })
  .strict();
