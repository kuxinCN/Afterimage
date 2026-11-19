import { SOURCE_TYPES } from "@/lib/constants";

// Only user-confirmed facts may seed a story. AI-inferred or fictional entries
// never qualify, even if some later flow marked them adopted.
function isConfirmedFact(item) {
  return (
    Boolean(item) &&
    item.confirmed === true &&
    item.sourceType === SOURCE_TYPES.USER_CONFIRMED &&
    typeof item.value === "string" &&
    item.value.trim().length > 0
  );
}

function confirmedValues(list) {
  return Array.isArray(list) ? list.filter(isConfirmedFact).map((item) => item.value.trim()) : [];
}

// Derives the creative starting point from a memory without touching it.
// Returns null when nothing user-confirmed exists, so the UI can say
// "insufficient confirmed content" instead of inventing a starting point.
export function buildStorySeed(memory) {
  const facts = memory?.facts;

  if (!facts) {
    return null;
  }

  const summary = isConfirmedFact(facts.summary) ? facts.summary.value.trim() : null;
  const times = confirmedValues(facts.times);
  const locations = confirmedValues(facts.locations);
  const objects = confirmedValues(facts.objects);
  const events = confirmedValues(facts.events);

  if (!summary && times.length + locations.length + objects.length + events.length === 0) {
    return null;
  }

  const lines = [];
  if (summary) lines.push(summary);
  if (times.length) lines.push(`时间：${times.join("、")}`);
  if (locations.length) lines.push(`地点：${locations.join("、")}`);
  if (objects.length) lines.push(`物件：${objects.join("、")}`);
  if (events.length) lines.push(`事件：${events.join("、")}`);

  return {
    title: typeof memory.title === "string" ? memory.title.trim() : "",
    text: lines.join("\n"),
    parts: { summary, times, locations, objects, events },
  };
}