"use client";

import { SOURCE_TYPE_LABELS } from "@/lib/constants";

// The banner is not optional decoration: a story is invented prose, and the
// reader must never be able to mistake it for a recovered memory.
export function StoryText({ story }) {
  if (!story) {
    return null;
  }

  const sourceLabel = SOURCE_TYPE_LABELS[story.sourceType] ?? story.sourceType;

  return (
    <section className="space-y-5">
      <div className="space-y-3">
        <h2 className="text-xl leading-snug text-[#f2ebdd] sm:text-2xl">{story.title}</h2>
        <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-[#4a3f2c] bg-[#1a1712] px-3 py-1 text-xs text-[#d8c49a]">
          <span>{story.isMock ? "Mock 占位内容" : "接口生成内容"}</span>
          <span aria-hidden="true">·</span>
          <span>
            以下 {story.paragraphs.length} 段全部标记为「{sourceLabel}」，非真实记忆还原
          </span>
        </p>
        <div aria-hidden="true" className="story-divider" />
      </div>

      {/* Keyed by story id so each new segment replays the entrance instead of
          silently swapping text in place. */}
      <div className="space-y-4">
        {story.paragraphs.map((paragraph, index) => (
          <p
            key={`${story.id}-${index}-${paragraph.sourceType}`}
            className="para-in text-[15px] leading-8 text-[#d9d0c0] [text-indent:2em] sm:text-base"
            style={{ animationDelay: `${Math.min(index, 8) * 110}ms` }}
          >
            {paragraph.text}
          </p>
        ))}
      </div>
    </section>
  );
}