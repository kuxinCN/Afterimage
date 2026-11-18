import { ERROR_CODES } from "@/lib/constants";
import {
  storyActionInputSchema,
  storyGenerateInputSchema,
  storySchema,
} from "@/schemas/storySchema";
import { ApiError, request } from "./client";
import { buildMockActionStory, buildMockOpeningStory } from "./mockStoryData";

// Presentation helpers for the Mock lane, surfaced through the service seam so
// pages never import the provider directly. A real AI lane would supply its own
// labels/review behind these same names.
export {
  buildEndingReview,
  classifyActionIntent,
  classifyFreeTextIntent,
  describeTrajectory,
  ENDING_META,
  getChoiceLabel,
  INTENT_META,
} from "./mockStoryData";

// Flip useMock to false once B's server route is real. The signatures and the
// returned shape stay identical, so no page has to change. Deliberately not an
// env var: a NEXT_PUBLIC_ switch would sit next to the place keys must never go.
export const storyApiConfig = { useMock: true };

function invalidInput(cause) {
  return new ApiError(ERROR_CODES.VALIDATION_FAILED, "输入内容不符合接口要求。", { cause });
}

function parseStory(value) {
  try {
    return storySchema.parse(value);
  } catch (error) {
    throw new ApiError(ERROR_CODES.API_INVALID_RESULT, "故事结果不符合约定的数据结构。", {
      cause: error,
    });
  }
}

export async function generateStory(input, { signal } = {}) {
  let parsed;

  try {
    parsed = storyGenerateInputSchema.parse(input);
  } catch (error) {
    throw invalidInput(error);
  }

  if (storyApiConfig.useMock) {
    return { story: parseStory(buildMockOpeningStory(parsed)) };
  }

  const payload = await request("/story/generate", { body: parsed, signal });

  return { story: parseStory(payload?.story) };
}

export async function submitAction(input, { signal } = {}) {
  let parsed;

  try {
    parsed = storyActionInputSchema.parse(input);
  } catch (error) {
    throw invalidInput(error);
  }

  if (storyApiConfig.useMock) {
    return { story: parseStory(buildMockActionStory(parsed)) };
  }

  const payload = await request("/story/action", { body: parsed, signal });

  return { story: parseStory(payload?.story) };
}