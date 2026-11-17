"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ActionChoices } from "@/components/flow/ActionChoices";
import { FreeActionInput } from "@/components/flow/FreeActionInput";
import { RequestState } from "@/components/flow/RequestState";
import { StoryScenePanel } from "@/components/flow/StoryScenePanel";
import { StoryText } from "@/components/flow/StoryText";
import { useStoryRequest } from "@/hooks/useStoryRequest";
import { useStoryScene } from "@/hooks/useStoryScene";
import { submitAction } from "@/services/api/storyService";
import { useStoryStore } from "@/store/StoryContext";

function describeAction(action) {
  return action.type === "choice" ? `选择 ${action.choiceId}` : `自由输入：${action.text}`;
}

export function StoryView() {
  const router = useRouter();
  const { state, dispatch } = useStoryStore();
  const { isLoading, error, run, retry } = useStoryRequest();
  const { hydrated, story, history, draft } = state;
  const { scene, visitedHotspots, onHotspotClick } = useStoryScene(story);

  useEffect(() => {
    if (hydrated && !story) {
      router.replace("/create");
    }
  }, [hydrated, story, router]);

  if (!hydrated) {
    return <p className="px-4 py-10 text-sm text-[#8d8474] sm:px-8">正在恢复本地进度…</p>;
  }

  if (!story) {
    return <p className="px-4 py-10 text-sm text-[#8d8474] sm:px-8">还没有故事，正在回到输入页…</p>;
  }

  async function advance(action, signal) {
    const { story: next } = await submitAction(
      { storyId: story.id, title: story.title, action, history },
      { signal },
    );

    dispatch({ type: "advanceStory", story: next, action });

    if (next.isEnding) {
      router.push("/ending");
    }

    return next;
  }

  async function handleChoose(choiceId) {
    await run((signal) => advance({ type: "choice", choiceId }, signal));
  }

  async function handleFree(text) {
    const result = await run((signal) => advance({ type: "free", text }, signal));

    return Boolean(result);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 sm:px-8 sm:py-12">
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#8d8474]">
        <Link href="/" className="hover:text-[#e6ddce]">
          首页
        </Link>
        <Link href="/create" className="hover:text-[#e6ddce]">
          ← 回到输入页
        </Link>
        <span>第 {history.length + 1} 段</span>
      </nav>

      <h1 className="text-2xl text-[#efe7d8] sm:text-3xl">{story.title}</h1>

      {/* Scene payload + exploration come from the useStoryScene seam, not from
          the page. C interactive lane currently yields scene=null (placeholder). */}
      <StoryScenePanel
        scene={scene}
        visitedHotspots={visitedHotspots}
        onHotspotClick={onHotspotClick}
      />

      <RequestState
        isLoading={isLoading}
        error={error}
        onRetry={retry}
        loadingText="正在推进故事…"
      >
        <StoryText story={story} />
      </RequestState>

      {story.isEnding ? (
        <button
          type="button"
          onClick={() => router.push("/ending")}
          className="min-h-[44px] w-full rounded-full bg-[#e6d5b0] px-6 text-base text-[#1a1712] transition-colors hover:bg-[#f2e3c0] sm:w-auto"
        >
          查看结尾
        </button>
      ) : (
        <div className="space-y-8">
          <ActionChoices
            choices={story.choices}
            onChoose={handleChoose}
            disabled={isLoading}
          />
          <FreeActionInput onSubmit={handleFree} disabled={isLoading} />
        </div>
      )}

      {draft.text ? (
        <section className="space-y-2 rounded-xl border border-[#2c2822] bg-[#141210] px-4 py-3">
          <h3 className="text-xs text-[#8d8474]">你写下的（用户确认，不属于上面的想象内容）</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-[#c9c0b0]">
            {draft.text}
          </p>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs text-[#8d8474]">已走过的行动（{history.length}）</h3>
          <ol className="space-y-1 text-sm text-[#9a9082]">
            {history.map((action, index) => (
              <li key={`${index}-${action.type}`}>
                {index + 1}. {describeAction(action)}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}