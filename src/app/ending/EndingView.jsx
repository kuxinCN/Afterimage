"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ActionTimeline } from "@/components/flow/ActionTimeline";
import { StoryText } from "@/components/flow/StoryText";
import { toneStyle } from "@/components/flow/storyTones";
import {
  buildEndingReview,
  describeTrajectory,
  ENDING_META,
} from "@/services/api/storyService";
import { readMemory } from "@/services/memory/memoryService";
import {
  clearStoryOrigin,
  readStoryOrigin,
  resolveStoryOrigin,
} from "@/services/story/storyOrigin";
import { useStoryStore } from "@/store/StoryContext";

export function EndingView() {
  const router = useRouter();
  const { state, dispatch } = useStoryStore();
  const { hydrated, story, history, draft } = state;
  const [origin, setOrigin] = useState(null);
  const [sourceAlive, setSourceAlive] = useState(false);

  // sessionStorage is a side effect, so the origin marker is read in an
  // effect rather than during render.
  useEffect(() => {
    setOrigin(hydrated && story ? resolveStoryOrigin(readStoryOrigin(), story.id) : null);
  }, [hydrated, story]);

  const originMemoryId = origin?.memoryId ?? null;

  useEffect(() => {
    if (hydrated && !story) {
      router.replace("/create");
    }
  }, [hydrated, story, router]);

  // The shortcut is offered only while the source memory still exists; a
  // deleted memory degrades to the plain memory-space link.
  useEffect(() => {
    if (!originMemoryId) {
      setSourceAlive(false);
      return;
    }

    let active = true;

    readMemory(originMemoryId)
      .then(() => {
        if (active) {
          setSourceAlive(true);
        }
      })
      .catch(() => {
        if (active) {
          setSourceAlive(false);
        }
      });

    return () => {
      active = false;
    };
  }, [originMemoryId]);

  if (!hydrated) {
    return <p className="px-4 py-10 text-sm text-[#8d8474] sm:px-8">正在恢复本地进度…</p>;
  }

  if (!story) {
    return <p className="px-4 py-10 text-sm text-[#8d8474] sm:px-8">还没有故事，正在回到输入页…</p>;
  }

  function handleRestart() {
    clearStoryOrigin();
    dispatch({ type: "reset" });
    router.push("/create");
  }

  const review = buildEndingReview(history);
  const trajectory = describeTrajectory(history);
  const endingTone = toneStyle(ENDING_META[review.ending].tone);

  return (
    <div className="page-in relative mx-auto w-full max-w-3xl space-y-8 px-4 py-10 sm:px-8 sm:py-12">
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#8d8474]">
        <Link href="/story" className="hover:text-[#e6ddce]">
          ← 回到故事页
        </Link>
      </nav>

      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.28em] text-[#8d8474]">Afterimage</p>
        <h1 className="title-glow text-2xl font-normal text-[#f2ebdd]">
          {story.isEnding ? "走到结尾" : "故事还没有走到结尾"}
        </h1>
        {story.isEnding ? (
          <p
            className="seal-in inline-flex items-center gap-3 rounded-full border px-5 py-2.5 text-sm"
            style={{
              color: endingTone.text,
              borderColor: endingTone.border,
              background: endingTone.surface,
              boxShadow: `0 0 36px -6px ${endingTone.glow}`,
            }}
          >
            <span
              aria-hidden="true"
              className="flex h-6 w-6 items-center justify-center rounded-full border text-xs"
              style={{ borderColor: endingTone.border }}
            >
              ◈
            </span>
            本次结局 · {ENDING_META[review.ending].title}
          </p>
        ) : null}
      </header>

      <StoryText story={story} />

      {draft.text.trim().length > 0 ? (
        <section className="space-y-2 glass rounded-xl px-4 py-4">
          <h2 className="text-sm text-[#c9c0b0]">你写下的经历（用户确认，不属于上面的想象内容）</h2>
          <p className="whitespace-pre-wrap text-base leading-relaxed text-[#d9d0c0]">
            {draft.text}
          </p>
        </section>
      ) : null}

      <section className="space-y-3 glass rounded-xl px-4 py-4">
        <h2 className="text-sm text-[#c9c0b0]">最终结果</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-[#8d8474]">标题</dt>
            <dd className="text-[#e6ddce]">{story.title}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-[#8d8474]">行动步数</dt>
            <dd className="text-[#e6ddce]">{history.length}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-[#8d8474]">内容性质</dt>
            <dd className="text-[#e6ddce]">
              {story.isMock ? "Mock 占位" : "接口生成"} · 想象内容
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-[#8d8474]">附加照片</dt>
            <dd className="text-[#e6ddce]">{draft.images.length} 张（仅元数据）</dd>
          </div>
        </dl>
        <p className="text-xs leading-relaxed text-[#6b6459]">
          这一页汇总的是本次流程的运行结果，不是对你真实记忆的断言。照片字节始终留在这台设备上。
        </p>
      </section>

      {history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm text-[#c9c0b0]">行动回顾</h2>
          <ActionTimeline
            steps={trajectory.steps}
            outcomes={review.steps.map((step) => step.outcome)}
          />
          {story.isEnding ? (
            <p className="glass rounded-xl px-4 py-3 text-xs leading-relaxed text-[#8d8474]">
              {review.endingNote}
            </p>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-[#7c7466]">这次没有记录到任何行动。</p>
      )}

      <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleRestart}
          className="min-h-[44px] w-full rounded-full bg-[#e6d5b0] px-6 text-base text-[#1a1712] transition-all hover:bg-[#f2e3c0] hover:shadow-[0_0_32px_rgba(230,213,176,0.35)] active:scale-[0.98] sm:w-auto"
        >
          重新开始
        </button>
        {!story.isEnding ? (
          <button
            type="button"
            onClick={() => router.push("/story")}
            className="min-h-[44px] w-full rounded-full border border-[#3a342c] px-6 text-base text-[#efe7d8] transition-all hover:border-[rgba(230,213,176,0.35)] hover:bg-[#1d1a16] hover:shadow-[0_0_28px_rgba(230,213,176,0.2)] active:scale-[0.98] sm:w-auto"
          >
            继续这个故事
          </button>
        ) : null}
      </section>

      <section className="space-y-3 glass rounded-xl px-4 py-4">
        <h2 className="text-sm text-[#c9c0b0]">回到记忆空间</h2>
        <p className="text-xs leading-relaxed text-[#8d8474]">
          这条故事是想象内容，不会保存为真实记忆。你的记忆档案仍在记忆空间里，随时可以回去。
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/memory"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#3a342c] px-6 text-sm text-[#efe7d8] transition-all hover:border-[rgba(230,213,176,0.35)] hover:bg-[#1d1a16] hover:shadow-[0_0_28px_rgba(230,213,176,0.2)] active:scale-[0.98]"
          >
            回到记忆空间
          </Link>
          {origin && sourceAlive ? (
            <Link
              href={`/memory/${origin.memoryId}`}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[rgba(230,213,176,0.35)] bg-[rgba(230,213,176,0.06)] px-6 text-sm text-[#e6d5b0] transition-all hover:border-[rgba(230,213,176,0.6)] hover:bg-[rgba(230,213,176,0.12)] hover:shadow-[0_0_28px_rgba(230,213,176,0.18)] active:scale-[0.98]"
            >
              回到来源记忆「{origin.memoryTitle}」
            </Link>
          ) : null}
        </div>
      </section>

      <p className="text-xs text-[#6b6459]">
        重新开始会清空本次的故事、行动历史与输入草稿；已建档的照片记忆不受影响。
      </p>
    </div>
  );
}