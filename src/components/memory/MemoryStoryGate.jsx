"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ERROR_CODES, STORY_LIMITS } from "@/lib/constants";
import { readMemory } from "@/services/memory/memoryService";
import { buildStorySeed } from "@/services/memory/storySeed";
import {
  clearStoryOrigin,
  readStoryOrigin,
  writeStoryOrigin,
} from "@/services/story/storyOrigin";
import { useStoryStore } from "@/store/StoryContext";

const READ_MESSAGES = {
  [ERROR_CODES.STORAGE_UNAVAILABLE]: "这个浏览器不允许本地存储，读不到已保存的记忆。",
  [ERROR_CODES.STORAGE_FAILED]: "本地数据读取失败，请刷新页面重试。",
};

function SeedPreview({ seed }) {
  const titleOverflow = seed.title.length > STORY_LIMITS.MAX_TITLE_LENGTH;
  const textOverflow = seed.text.length > STORY_LIMITS.MAX_TEXT_LENGTH;

  return (
    <div className="space-y-3 rounded-xl border border-[#2c2822] bg-[#0e0c0a] px-4 py-4 text-sm">
      <p className="text-xs text-[#8d8474]">
        以下内容将作为创作起点传入创作页，全部来自你确认过的信息：
      </p>
      <div className="space-y-1">
        <p className="text-xs text-[#8d8474]">故事标题</p>
        <p className="text-[#e6ddce]">{seed.title || "（未命名）"}</p>
        {titleOverflow ? (
          <p className="text-xs text-[#d8b8a4]">
            标题超出 {STORY_LIMITS.MAX_TITLE_LENGTH} 字，传入时会截断，进入后可修改。
          </p>
        ) : null}
      </div>
      <div className="space-y-1">
        <p className="text-xs text-[#8d8474]">故事文本</p>
        <p className="whitespace-pre-line leading-6 text-[#e6ddce]">{seed.text}</p>
        {textOverflow ? (
          <p className="text-xs text-[#d8b8a4]">
            文本超出 {STORY_LIMITS.MAX_TEXT_LENGTH} 字，传入时会保留前{" "}
            {STORY_LIMITS.MAX_TEXT_LENGTH} 字，进入后可修改。
          </p>
        ) : null}
      </div>
      <p className="text-xs text-[#8d8474]">
        照片不会自动携带；进入创作页后仍可自由添加照片、修改文字。
      </p>
    </div>
  );
}

export function MemoryStoryGate({ memoryId }) {
  const router = useRouter();
  const { state, dispatch } = useStoryStore();
  const [memory, setMemory] = useState(null);
  const [status, setStatus] = useState("loading");
  const [readMessage, setReadMessage] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [hint, setHint] = useState(null);
  const [origin, setOrigin] = useState(null);

  useEffect(() => {
    let active = true;

    readMemory(memoryId)
      .then((found) => {
        if (active) {
          setMemory(found);
          setStatus("ready");
        }
      })
      .catch((error) => {
        if (active) {
          setReadMessage(READ_MESSAGES[error?.code] ?? "读取本地记忆时出错。");
          setStatus(error?.code === ERROR_CODES.MEMORY_NOT_FOUND ? "not_found" : "error");
        }
      });

    return () => {
      active = false;
    };
  }, [memoryId]);

  useEffect(() => {
    if (state.hydrated) {
      setOrigin(readStoryOrigin());
    }
  }, [state.hydrated, state.story]);

  const seed = useMemo(() => (memory ? buildStorySeed(memory) : null), [memory]);

  // The facts panel saves confirmations without telling this section, so the
  // entry re-reads the memory on every open instead of trusting mount state.
  async function openConfirm() {
    setHint(null);

    try {
      const fresh = await readMemory(memoryId);
      setMemory(fresh);

      if (!buildStorySeed(fresh)) {
        setConfirming(false);
        setHint(
          "还没有「我确认」的内容可以作为起点。先在上方记忆整理里确认并保存至少一条事实（摘要、时间、地点、物件或事件）；AI 的推测与虚构补充不会传入。",
        );
        return;
      }

      setConfirming(true);
    } catch (error) {
      setHint(READ_MESSAGES[error?.code] ?? "读取本地记忆时出错，请刷新重试。");
    }
  }

  function handleConfirm() {
    if (!seed || !memory) {
      return;
    }

    writeStoryOrigin({
      memoryId: memory.id,
      memoryTitle: memory.title.slice(0, STORY_LIMITS.MAX_TITLE_LENGTH),
      storyId: null,
    });
    dispatch({
      type: "setDraft",
      draft: {
        title: seed.title.slice(0, STORY_LIMITS.MAX_TITLE_LENGTH),
        text: seed.text.slice(0, STORY_LIMITS.MAX_TEXT_LENGTH),
        images: [],
      },
    });
    router.push("/create");
  }

  if (status === "loading" || !state.hydrated || status === "not_found") {
    return null;
  }

  if (status === "error") {
    return <p className="text-sm text-[#e0a98f]">{readMessage}</p>;
  }

  const pendingOrigin = origin && origin.storyId === null ? origin : null;

  return (
    <section className="space-y-4 rounded-2xl border border-[#2c2822] bg-[#121110] p-5 sm:p-6">
      <header className="space-y-2">
        <h2 className="text-lg text-[#f2ebdd]">开启平行故事</h2>
        <p className="text-xs leading-relaxed text-[#8d8474]">
          以这段真实经历为起点，进入故事创作页，生成一条完全虚构的平行故事。
          故事不会写回记忆空间，也不会改动这段记忆。
        </p>
      </header>

      {pendingOrigin && !confirming ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8d8474]">
          <span>已为「{pendingOrigin.memoryTitle}」准备好一次故事起点，尚未生成。</span>
          <a href="/create" className="text-[#d8c49a] transition-colors hover:text-[#f2e3c0]">
            去继续 →
          </a>
          <button
            type="button"
            onClick={() => {
              clearStoryOrigin();
              setOrigin(null);
            }}
            className="text-[#8d8474] transition-colors hover:text-[#e6ddce]"
          >
            撤销准备
          </button>
        </p>
      ) : null}

      {confirming && seed ? (
        <div className="space-y-4 rounded-xl border border-[#3b352c] bg-[#141210] px-4 py-4">
          <p className="text-xs leading-5 text-[#a89f8d]">
            确认后进入现有的故事创作页：下面的信息会填入标题与文本，你可以继续修改。
            生成的故事属于想象内容，与这段记忆的真实档案彼此独立。
          </p>
          <SeedPreview seed={seed} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              className="min-h-[44px] rounded-full bg-[#e6d5b0] px-6 text-sm text-[#1a1712] transition-all hover:bg-[#f2e3c0] hover:shadow-[0_0_28px_rgba(230,213,176,0.3)] active:scale-[0.98]"
            >
              确认，进入故事创作
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-[44px] rounded-full border border-[#3a342c] px-5 text-sm text-[#c9c0b0] transition-colors hover:bg-[#1f1c18]"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={openConfirm}
            className="min-h-[44px] rounded-full border border-[rgba(230,213,176,0.35)] bg-[rgba(230,213,176,0.06)] px-6 text-sm text-[#e6d5b0] transition-all hover:border-[rgba(230,213,176,0.6)] hover:bg-[rgba(230,213,176,0.12)] hover:shadow-[0_0_28px_rgba(230,213,176,0.18)] active:scale-[0.98]"
          >
            以这段记忆开启平行故事 →
          </button>
          {!seed ? (
            <p className="text-xs leading-5 text-[#7c7466]">
              需要先在上方确认并保存至少一条事实，才能作为创作起点。
            </p>
          ) : null}
          {hint ? (
            <p className="text-xs leading-5 text-[#d8b8a4]" role="status">
              {hint}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}