"use client";

import { INTENT_META } from "@/services/api/storyService";

import { toneStyle } from "./storyTones";

// Shared read-model presentation for the story page and the ending page.
// `steps` comes from describeTrajectory; `outcomes` (ending review only) is
// aligned by step index.
export function ActionTimeline({ steps, outcomes = null }) {
  if (!steps?.length) {
    return null;
  }

  return (
    <ol className="relative space-y-4">
      {steps.map((step, position) => {
        const meta = INTENT_META[step.intent];
        const tone = toneStyle(meta?.tone);
        const outcome = outcomes?.[position] ?? null;
        const last = position === steps.length - 1;

        return (
          <li key={step.index} className="relative flex gap-4">
            <span aria-hidden="true" className="flex w-4 shrink-0 flex-col items-center">
              <span
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: tone.text, boxShadow: `0 0 10px ${tone.glow}` }}
              />
              {!last ? (
                <span className="mt-1 w-px flex-1 bg-[linear-gradient(to_bottom,rgba(230,213,176,0.28),rgba(230,213,176,0.06))]" />
              ) : null}
            </span>
            <div className="min-w-0 flex-1 space-y-1 pb-1">
              <p className="text-sm leading-relaxed text-[#c9c0b0]">
                <span className="mr-2 font-mono text-xs text-[#6b6459]">
                  {String(step.index).padStart(2, "0")}
                </span>
                {step.kind === "choice" ? `选择「${step.label}」` : `自由输入：${step.input}`}
                <span
                  className="ml-2 inline-flex items-center gap-1 align-middle text-[11px]"
                  style={{ color: tone.text }}
                >
                  <span aria-hidden="true">{meta?.glyph}</span>
                  {meta?.label}
                </span>
              </p>
              {outcome ? (
                <p className="text-xs leading-relaxed text-[#7c7466]">{outcome}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}