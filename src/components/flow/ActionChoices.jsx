"use client";

import { classifyActionIntent, INTENT_META } from "@/services/api/storyService";

export function ActionChoices({ choices, onChoose, disabled = false }) {
  if (!choices?.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm text-[#c9c0b0]">你可以这样做</h3>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {choices.map((choice) => {
          const meta = INTENT_META[classifyActionIntent({ type: "choice", choiceId: choice.id })];

          return (
            <li key={choice.id}>
              <button
                type="button"
                onClick={() => onChoose(choice.id)}
                disabled={disabled}
                className="min-h-[44px] w-full rounded-xl border border-[#3a342c] bg-[rgba(22,20,18,0.7)] px-4 py-3 text-left text-base text-[#efe7d8] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(230,213,176,0.35)] hover:bg-[#1d1a16] hover:shadow-[0_14px_40px_-16px_rgba(216,168,96,0.4)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {choice.label}
                <span className="mt-1 block text-xs text-[#6b6459]">· {meta.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}