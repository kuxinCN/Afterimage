"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { RequestState } from "@/components/flow/RequestState";
import { ModeNav } from "@/components/nav/ModeNav";
import { ImageDropzone } from "@/components/upload/ImageDropzone";
import { ImagePreviewList } from "@/components/upload/ImagePreviewList";
import { useImageImport } from "@/hooks/useImageImport";
import { useStoryRequest } from "@/hooks/useStoryRequest";
import { STORY_LIMITS } from "@/lib/constants";
import { generateStory } from "@/services/api/storyService";
import { useStoryStore } from "@/store/StoryContext";

// Only metadata leaves the form. The File itself stays on the device, so no
// Base64 and no file name can reach the story interface.
function imageMetadata(readyImages) {
  return readyImages.map((image) => ({
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    size: image.file.size,
  }));
}

function StoryFormFields({ initialDraft }) {
  const router = useRouter();
  const { dispatch } = useStoryStore();
  const {
    items,
    rejected,
    readyImages,
    isReading,
    canAddMore,
    remainingSlots,
    maxFiles,
    addFiles,
    removeItem,
    dismissRejected,
  } = useImageImport();
  const [title, setTitle] = useState(initialDraft.title);
  const [text, setText] = useState(initialDraft.text);
  const { isLoading, error, run, retry } = useStoryRequest();

  const canSubmit =
    title.trim().length > 0 && text.trim().length > 0 && !isReading && !isLoading;

  async function startStory(draft, signal) {
    const { story } = await generateStory(draft, { signal });

    dispatch({ type: "startStory", story });
    router.push("/story");

    return story;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    const draft = {
      title: title.trim(),
      text: text.trim(),
      images: imageMetadata(readyImages),
    };

    dispatch({ type: "setDraft", draft });
    // Navigation lives inside the task so the retry button replays the whole
    // step, not just the request.
    await run((signal) => startStory(draft, signal));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="page-in relative mx-auto w-full max-w-3xl space-y-8 px-4 py-10 sm:px-8 sm:py-12"
    >
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#8d8474]">
        <Link href="/" className="hover:text-[#e6ddce]">
          首页
        </Link>
        <span className="ml-auto">
          <ModeNav />
        </span>
      </nav>

      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.28em] text-[#8d8474]">Afterimage</p>
        <h1 className="title-glow text-2xl font-normal text-[#f2ebdd]">写下一段记忆</h1>
        <p className="text-sm leading-relaxed text-[#9a9082]">
          文字必填，照片可选。生成后进入故事页，当前故事内容由 Mock 提供。
        </p>
      </header>

      <section className="space-y-5">
        <label className="block space-y-2">
          <span className="text-sm text-[#c9c0b0]">标题</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={STORY_LIMITS.MAX_TITLE_LENGTH}
            required
            placeholder="例如：教室最后一排的那个下午"
            className="w-full rounded-xl border border-[#33302a] bg-[rgba(20,18,16,0.7)] px-4 py-3 text-base text-[#efe7d8] backdrop-blur transition-all placeholder:text-[#6b6459] focus:border-[rgba(230,213,176,0.45)] focus:shadow-[0_0_0_3px_rgba(230,213,176,0.08)] focus:outline-none"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-[#c9c0b0]">你记得的内容</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={STORY_LIMITS.MAX_TEXT_LENGTH}
            required
            rows={5}
            placeholder="当时发生了什么？只写你记得的。"
            className="w-full resize-y rounded-xl border border-[#33302a] bg-[rgba(20,18,16,0.7)] px-4 py-3 text-base leading-relaxed text-[#efe7d8] backdrop-blur transition-all placeholder:text-[#6b6459] focus:border-[rgba(230,213,176,0.45)] focus:shadow-[0_0_0_3px_rgba(230,213,176,0.08)] focus:outline-none"
          />
          <span className="block text-xs text-[#7c7466]">
            {text.length} / {STORY_LIMITS.MAX_TEXT_LENGTH}
          </span>
        </label>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm text-[#c9c0b0]">照片（可选）</h2>
          <span className="text-xs text-[#7c7466]">不传照片也能生成</span>
        </div>
        <ImageDropzone
          onFiles={addFiles}
          disabled={!canAddMore || isLoading}
          remainingSlots={remainingSlots}
          maxFiles={maxFiles}
        />
        {items.length > 0 || rejected.length > 0 ? (
          <ImagePreviewList
            items={items}
            rejected={rejected}
            onRemove={removeItem}
            onDismissRejected={dismissRejected}
          />
        ) : null}
        <p className="text-xs leading-relaxed text-[#6b6459]">
          照片只留在这台设备上。生成故事时只送出格式与尺寸等元数据，不送出图片内容或文件名。
        </p>
      </section>

      {isLoading || error ? (
        <RequestState
          isLoading={isLoading}
          error={error}
          onRetry={retry}
          loadingText="正在生成故事…"
        />
      ) : null}

      <section className="space-y-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="min-h-[44px] w-full rounded-full bg-[#e6d5b0] px-6 text-base text-[#1a1712] transition-all hover:bg-[#f2e3c0] hover:shadow-[0_0_32px_rgba(230,213,176,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#3a352c] disabled:text-[#8d8474] disabled:shadow-none sm:w-auto"
        >
          {isLoading ? "正在生成…" : isReading ? "正在读取图片…" : "生成故事"}
        </button>
        <p className="text-xs text-[#7c7466]" role="status">
          {canSubmit ? "生成后进入故事页" : "需要：标题 + 你记得的内容"}
        </p>
      </section>
    </form>
  );
}

// The Store restores from sessionStorage after mount, so the fields must not
// mount before that or they would initialise from an empty draft.
export function CreateStoryForm() {
  const { state } = useStoryStore();

  if (!state.hydrated) {
    return (
      <p className="mx-auto w-full max-w-3xl px-4 py-10 text-sm text-[#8d8474] sm:px-8">
        正在恢复本地进度…
      </p>
    );
  }

  return <StoryFormFields initialDraft={state.draft} />;
}