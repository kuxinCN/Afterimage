"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { StoryText } from "@/components/flow/StoryText";
import { useStoryStore } from "@/store/StoryContext";

function describeAction(action) {
  return action.type === "choice" ? `选择 ${action.choiceId}` : `自由输入：${action.text}`;
}

export function EndingView() {
  const router = useRouter();
  const { state, dispatch } = useStoryStore();
  const { hydrated, story, history, draft } = state;

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

  function handleRestart() {
    dispatch({ type: "reset" });
    router.push("/create");
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 sm:px-8 sm:py-12">
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#8d8474]">
        <Link href="/" className="hover:text-[#e6ddce]">
          首页
        </Link>
        <Link href="/story" className="hover:text-[#e6ddce]">
          ← 回到故事页
        </Link>
      </nav>

      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.28em] text-[#8d8474]">Afterimage</p>
        <h1 className="text-2xl font-normal text-[#f2ebdd]">
          {story.isEnding ? "走到结尾" : "故事还没有走到结尾"}
        </h1>
      </header>

      <StoryText story={story} />

      {draft.text.trim().length > 0 ? (
        <section className="space-y-2 rounded-xl border border-[#2c2822] bg-[#141210] px-4 py-4">
          <h2 className="text-sm text-[#c9c0b0]">你写下的经历（用户确认，不属于上面的想象内容）</h2>
          <p className="whitespace-pre-wrap text-base leading-relaxed text-[#d9d0c0]">
            {draft.text}
          </p>
        </section>
      ) : null}

      <section className="space-y-3 rounded-xl border border-[#2c2822] bg-[#141210] px-4 py-4">
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
        <section className="space-y-2">
          <h2 className="text-sm text-[#c9c0b0]">行动回顾</h2>
          <ol className="space-y-1 text-sm text-[#9a9082]">
            {history.map((action, index) => (
              <li key={`${index}-${action.type}`}>
                {index + 1}. {describeAction(action)}
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="text-sm text-[#7c7466]">这次没有记录到任何行动。</p>
      )}

      <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleRestart}
          className="min-h-[44px] w-full rounded-full bg-[#e6d5b0] px-6 text-base text-[#1a1712] transition-colors hover:bg-[#f2e3c0] sm:w-auto"
        >
          重新开始
        </button>
        {!story.isEnding ? (
          <button
            type="button"
            onClick={() => router.push("/story")}
            className="min-h-[44px] w-full rounded-full border border-[#3a342c] px-6 text-base text-[#efe7d8] transition-colors hover:bg-[#1d1a16] sm:w-auto"
          >
            继续这个故事
          </button>
        ) : null}
      </section>

      <p className="text-xs text-[#6b6459]">
        重新开始会清空本次的故事、行动历史与输入草稿；已建档的照片记忆不受影响。
      </p>
    </div>
  );
}