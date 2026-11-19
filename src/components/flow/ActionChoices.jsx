"use client";

import { classifyActionIntent, INTENT_META } from "@/services/api/storyService";

import { toneStyle } from "./storyTones";

export function ActionChoices({ choices, onChoose, disabled = false }) {
  if (!choices?.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm text-[#c9c0b0]">你可以这样做</h3>
        <span className="text-xs text-[#6b6459]">每个行动都会改变故事的走向</span>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {choices.map((choice, index) => {
          const meta = INTENT_META[classifyActionIntent({ type: "choice", choiceId: choice.id })];
          const tone = toneStyle(meta.tone);

          return (
            <li
              key={choice.id}
              className="para-in"
              style={{ animationDelay: `${Math.min(index, 4) * 90}ms` }}
            >
              <button
                type="button"
                onClick={() => onChoose(choice.id)}
                disabled={disabled}
                className="group min-h-[44px] w-full rounded-xl border border-[#3a342c] bg-[rgba(22,20,18,0.7)] px-4 py-3 text-left text-base text-[#efe7d8] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--tone-border)] hover:bg-[#1d1a16] hover:shadow-[0_14px_40px_-16px_var(--tone-glow)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ "--tone-border": tone.border, "--tone-glow": tone.glow }}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 font-mono text-xs leading-6 text-[#6b6459] transition-colors group-hover:text-[#a89f8d]"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{choice.label}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-sm leading-6 opacity-70 transition-opacity group-hover:opacity-100"
                    style={{ color: tone.text }}
                  >
                    {meta.glyph}
                  </span>
                </span>
                <span
                  className="mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                  style={{ color: tone.text, borderColor: tone.border, background: tone.surface }}
                >
                  {meta.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}