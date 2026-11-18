"use client";

import Link from "next/link";

import { LineCards } from "@/components/home/LineCards";
import { useStoryStore } from "@/store/StoryContext";

export function HomeEntries() {
  const { state } = useStoryStore();
  const hasStory = state.hydrated && Boolean(state.story);
  const storyHref = hasStory ? "/story" : "/create";

  return (
    <div className="space-y-4">
      <LineCards storyHref={storyHref} />
      <p className="text-xs leading-relaxed text-[#6b6459]">
        想直接从照片开始？
        <Link href="/memory/new" className="text-[#8d8474] underline-offset-4 transition-colors hover:text-[#e6ddce] hover:underline">
          导入照片建档
        </Link>
        {hasStory ? (
          <>
            {" · 检测到进行中的故事，"}
            <Link href="/story" className="text-[#8d8474] underline-offset-4 transition-colors hover:text-[#e6ddce] hover:underline">
              继续上次故事
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}