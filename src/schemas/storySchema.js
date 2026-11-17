import { z } from "zod";

import {
  IMAGE_IMPORT_LIMITS,
  SOURCE_TYPES,
  STORY_ACTION_TYPES,
  STORY_LIMITS,
  STORY_STORAGE_VERSION,
} from "@/lib/constants";

// Only metadata crosses the wire. Bytes, Base64 and file names never do, so a
// story request cannot leak a photo out of the device.
export const storyImageMetaSchema = z
  .object({
    mimeType: z.string().min(1),
    width: z.number().int().positive().nullable().default(null),
    height: z.number().int().positive().nullable().default(null),
    size: z.number().int().nonnegative(),
  })
  .strict();

export const storyGenerateInputSchema = z
  .object({
    title: z.string().trim().min(1).max(STORY_LIMITS.MAX_TITLE_LENGTH),
    text: z.string().trim().min(1).max(STORY_LIMITS.MAX_TEXT_LENGTH),
    images: z
      .array(storyImageMetaSchema)
      .max(IMAGE_IMPORT_LIMITS.MAX_FILES_PER_IMPORT)
      .default([]),
  })
  .strict();

export const storyActionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal(STORY_ACTION_TYPES.CHOICE),
      choiceId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal(STORY_ACTION_TYPES.FREE),
      text: z.string().trim().min(1).max(STORY_LIMITS.MAX_FREE_ACTION_LENGTH),
    })
    .strict(),
]);

// The client carries the title and history so the service stays stateless: a
// reload restores the Store and the next action still lands on the right
// segment under the same title.
export const storyActionInputSchema = z
  .object({
    storyId: z.string().min(1),
    title: z.string().trim().min(1).max(STORY_LIMITS.MAX_TITLE_LENGTH),
    action: storyActionSchema,
    history: z.array(storyActionSchema).max(STORY_LIMITS.MAX_HISTORY).default([]),
  })
  .strict();

// A story is fiction by construction. Pinning sourceType to a literal means no
// provider can ever relabel invented prose as a recovered memory.
export const storyParagraphSchema = z
  .object({
    text: z.string().min(1).max(STORY_LIMITS.MAX_PARAGRAPH_LENGTH),
    sourceType: z.literal(SOURCE_TYPES.FICTIONAL),
  })
  .strict();

export const storyChoiceSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().trim().min(1).max(STORY_LIMITS.MAX_CHOICE_LABEL_LENGTH),
  })
  .strict();

export const storySchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(STORY_LIMITS.MAX_TITLE_LENGTH),
    paragraphs: z.array(storyParagraphSchema).min(1).max(STORY_LIMITS.MAX_PARAGRAPHS),
    choices: z.array(storyChoiceSchema).max(STORY_LIMITS.MAX_CHOICES).default([]),
    isEnding: z.boolean().default(false),
    provider: z.string().min(1),
    isMock: z.boolean(),
    sourceType: z.literal(SOURCE_TYPES.FICTIONAL),
  })
  .strict()
  .superRefine((story, ctx) => {
    if (story.isEnding && story.choices.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An ending story must not offer further choices",
        path: ["choices"],
      });
    }

    const seen = new Set();

    story.choices.forEach((choice, index) => {
      if (seen.has(choice.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate choice id: ${choice.id}`,
          path: ["choices", index, "id"],
        });
      }
      seen.add(choice.id);
    });
  });

// The form may hold a half-written draft, so unlike the generate input these
// two fields are allowed to be empty.
export const storyDraftSchema = z
  .object({
    title: z.string().max(STORY_LIMITS.MAX_TITLE_LENGTH).default(""),
    text: z.string().max(STORY_LIMITS.MAX_TEXT_LENGTH).default(""),
    images: z
      .array(storyImageMetaSchema)
      .max(IMAGE_IMPORT_LIMITS.MAX_FILES_PER_IMPORT)
      .default([]),
  })
  .strict();

// sessionStorage is external data: it can be stale, hand-edited or left over
// from an older build. Images are deliberately absent — a File handle and its
// blob: URL cannot survive a reload, and persisting either is forbidden.
export const persistedStoryStateSchema = z
  .object({
    version: z.literal(STORY_STORAGE_VERSION),
    draft: storyDraftSchema.omit({ images: true }),
    story: storySchema.nullable(),
    history: z.array(storyActionSchema).max(STORY_LIMITS.MAX_HISTORY),
  })
  .strict();