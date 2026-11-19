"use client";

import { useState } from "react";

import { STORY_LIMITS } from "@/lib/constants";
import { classifyFreeTextIntent, INTENT_META } from "@/services/api/storyService";

import { toneStyle } from "./storyTones";

export function FreeActionInput({
  onSubmit,
  disabled = false,
  maxLength = STORY_LIMITS.MAX_FREE_ACTION_LENGTH,
}) {
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && !disabled;
  const intent = trimmed ? INTENT_META[classifyFreeTextIntent(trimmed)] : null;
  const intentTone = intent ? toneStyle(intent.tone) : null;
  const nearLimit = text.length >= maxLength * 0.9;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    // Keep the wording when the request fails so a retry does not cost the user
    // their sentence; clear it only once the action actually landed.
    const succeeded = await onSubmit(trimmed);

    if (succeeded) {
      setText("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="free-action" className="block text-sm text-[#c9c0b0]">
        或者自己写一句
      </label>
      <textarea
        id="free-action"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={maxLength}
        rows={3}
        disabled={disabled}
        placeholder="例如：我想先看看窗外"
        className="w-full resize-y rounded-xl border border-[#33302a] bg-[rgba(20,18,16,0.7)] px-4 py-3 text-base leading-relaxed text-[#efe7d8] backdrop-blur transition-all placeholder:text-[#6b6459] focus:border-[rgba(230,213,176,0.45)] focus:shadow-[0_0_0_3px_rgba(230,213,176,0.08)] focus:outline-none disabled:opacity-50"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2 text-xs text-[#7c7466]">
          <span className={nearLimit ? "text-[#d8b8a4]" : undefined}>
            {text.length} / {maxLength}
          </span>
          {intent ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
              style={{
                color: intentTone.text,
                borderColor: intentTone.border,
                background: intentTone.surface,
              }}
            >
              <span aria-hidden="true">{intent.glyph}</span>
              意图倾向：{intent.label}
            </span>
          ) : null}
        </span>
        <button
          type="submit"
          disabled={!canSubmit}
          className="min-h-[44px] rounded-full bg-[#e6d5b0] px-6 text-sm text-[#1a1712] transition-all hover:bg-[#f2e3c0] hover:shadow-[0_0_28px_rgba(230,213,176,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#3a352c] disabled:text-[#8d8474] disabled:shadow-none"
        >
          {disabled ? "正在处理…" : "发送这个行动"}
        </button>
      </div>
    </form>
  );
}