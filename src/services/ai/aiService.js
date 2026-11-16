import { DEFAULT_AI_PROVIDER, ERROR_CODES, MEMORY_STATUS } from "@/lib/constants";
import { analysisDraftSchema, analysisInputSchema } from "@/schemas/analysisSchema";
import { confirmedCopy } from "@/schemas/sourceSchema";
import { AssetRepository } from "@/services/storage/assetRepository";
import { StorageError } from "@/services/storage/db";
import { MemoryRepository } from "@/services/storage/memoryRepository";
import { AiError, createProviderRegistry } from "./aiProvider";
import { mockProvider } from "./providers/mockProvider";

const registry = createProviderRegistry({ [mockProvider.name]: mockProvider });

// The whole call is async but each step awaits a different layer, so two clicks
// can interleave; this set makes the second one fail fast instead.
const inFlight = new Set();

function asAiError(error, fallbackMessage) {
  if (error instanceof AiError) {
    return error;
  }
  if (error instanceof StorageError && error.code === ERROR_CODES.MEMORY_NOT_FOUND) {
    return error;
  }
  if (error?.name === "ZodError") {
    return new AiError(ERROR_CODES.AI_INVALID_RESULT, "整理结果不符合约定的数据结构", {
      cause: error,
    });
  }

  return new AiError(ERROR_CODES.AI_ANALYSIS_FAILED, fallbackMessage, { cause: error });
}

async function requireMemory(memoryId) {
  const memory = await MemoryRepository.getById(memoryId);

  if (!memory) {
    throw new StorageError(ERROR_CODES.MEMORY_NOT_FOUND, `Memory ${memoryId} does not exist`);
  }

  return memory;
}

function validateDraft(draft) {
  try {
    return analysisDraftSchema.parse(draft);
  } catch (error) {
    throw new AiError(ERROR_CODES.AI_INVALID_RESULT, "整理结果不符合约定的数据结构", {
      cause: error,
    });
  }
}

// Re-analysis merges instead of starting over: edits, manual additions and
// already-confirmed entries survive, keyed on the provider wording in `baseline`.
function mergeItems(nextItems, previousItems, confirmedValues) {
  const previous = new Map((previousItems ?? []).map((item) => [item.baseline, item]));
  const merged = [];
  const seen = new Set();

  for (const incoming of nextItems) {
    const item = previous.get(incoming.baseline) ?? incoming;
    const locked =
      item.adopted || confirmedValues.has(item.value) || confirmedValues.has(item.baseline);
    const next = locked ? { ...item, adopted: true } : item;

    if (!seen.has(next.value)) {
      seen.add(next.value);
      merged.push(next);
    }
  }

  for (const item of previousItems ?? []) {
    if (!seen.has(item.value)) {
      seen.add(item.value);
      merged.push(item);
    }
  }

  return merged;
}

function mergeSummary(next, previous, confirmedValue) {
  if (next && previous && previous.baseline === next.baseline) {
    return confirmedValue && confirmedValue === previous.value
      ? { ...previous, adopted: true }
      : previous;
  }
  if (!next) {
    return previous ?? null;
  }

  return confirmedValue === next.value ? { ...next, adopted: true } : next;
}

function mergeScene(next, previous) {
  if (!previous) {
    return next;
  }
  if (!next) {
    return previous;
  }

  return previous.type === next.type ? previous : next;
}

function mergeWithPreviousDraft(draft, memory) {
  const previous = memory.analysis;
  const facts = memory.facts ?? {};
  const confirmedValues = (items) => new Set((items ?? []).map((item) => item.value));

  return {
    ...draft,
    summary: mergeSummary(draft.summary, previous?.summary ?? null, facts.summary?.value ?? null),
    scene: mergeScene(draft.scene, previous?.scene ?? null),
    elements: mergeItems(draft.elements, previous?.elements, confirmedValues(facts.objects)),
    tags: mergeItems(draft.tags, previous?.tags, confirmedValues(facts.tags)),
    times: mergeItems(draft.times, previous?.times, confirmedValues(facts.times)),
    places: mergeItems(draft.places, previous?.places, confirmedValues(facts.locations)),
  };
}

function adoptedFacts(items) {
  return items.filter((item) => item.adopted).map(confirmedCopy);
}

export function listAiProviders() {
  return registry.list();
}

export async function analyzeMemory(memoryId, { providerName = DEFAULT_AI_PROVIDER } = {}) {
  if (inFlight.has(memoryId)) {
    throw new AiError(ERROR_CODES.AI_ANALYSIS_IN_PROGRESS, "这段记忆正在整理中，请稍候。");
  }

  inFlight.add(memoryId);

  const memory = await requireMemory(memoryId);
  const previousStatus = memory.status;

  await MemoryRepository.update(memoryId, { status: MEMORY_STATUS.ANALYZING });

  try {
    const assets = await AssetRepository.getByMemoryId(memoryId);
    const provider = registry.get(providerName);

    const input = analysisInputSchema.parse({
      memoryId: memory.id,
      title: memory.title,
      description: memory.description ?? "",
      date: memory.date ?? null,
      // Only the user's own words and record metadata reach the provider: no
      // file names, no image bytes.
      location: memory.location?.value ?? null,
      imageCount: assets.length,
      images: assets.map((asset) => ({
        mimeType: asset.mimeType,
        width: asset.width ?? null,
        height: asset.height ?? null,
      })),
    });

    let draft;

    try {
      draft = await provider.analyze(input);
    } catch (error) {
      throw asAiError(error, "整理记忆时出错，请稍后重试。");
    }

    const revision = (memory.analysis?.revision ?? 0) + 1;
    // Validate the provider's contract first, then the merged draft, so a bad
    // provider is reported as an invalid result rather than as a crash.
    const parsed = validateDraft(
      mergeWithPreviousDraft(validateDraft({ ...draft, revision }), memory),
    );

    const updated = await MemoryRepository.update(memoryId, {
      analysis: parsed,
      status: MEMORY_STATUS.REVIEWING,
    });

    return { memory: updated, draft: parsed };
  } catch (error) {
    // A failed run leaves the memory exactly as it was found: no draft is
    // written over the previous one, and the status is not marked failed.
    try {
      await MemoryRepository.update(memoryId, { status: previousStatus });
    } catch {
      // Restoring the status must not hide the reason the analysis failed.
    }

    throw asAiError(error, "整理记忆时出错，请稍后重试。");
  } finally {
    inFlight.delete(memoryId);
  }
}

export async function readAnalysis(memoryId) {
  const memory = await requireMemory(memoryId);

  return { memory, draft: memory.analysis ?? null };
}

export async function saveAnalysisDraft(memoryId, draft) {
  const memory = await requireMemory(memoryId);
  const parsed = validateDraft(draft);

  const updated = await MemoryRepository.update(memoryId, {
    analysis: { ...parsed, revision: memory.analysis?.revision ?? parsed.revision },
  });

  return { memory: updated, draft: updated.analysis };
}

export async function confirmAnalysis(memoryId, draft) {
  const memory = await requireMemory(memoryId);
  const source = draft ?? memory.analysis;

  if (!source) {
    throw new AiError(ERROR_CODES.AI_ANALYSIS_NOT_FOUND, "还没有可确认的整理结果。");
  }

  const parsed = validateDraft(source);
  const facts = memory.facts ?? {};

  // The confirmed memory equals what the user adopted in this review pass.
  // Values confirmed earlier are guaranteed to still be in the draft because
  // mergeWithPreviousDraft carries them forward on every re-analysis.
  const nextFacts = {
    events: facts.events ?? [],
    objects: adoptedFacts(parsed.elements),
    locations: adoptedFacts(parsed.places),
    tags: adoptedFacts(parsed.tags),
    times: adoptedFacts(parsed.times),
    uncertainties: [...new Set(parsed.missing)],
    summary: parsed.summary?.adopted ? confirmedCopy(parsed.summary) : null,
  };

  const updated = await MemoryRepository.update(memoryId, {
    facts: nextFacts,
    analysis: parsed,
    status: MEMORY_STATUS.READY,
  });

  return { memory: updated, facts: updated.facts };
}
