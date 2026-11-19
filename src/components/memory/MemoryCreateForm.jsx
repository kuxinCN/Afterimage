"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ImageDropzone } from "@/components/upload/ImageDropzone";
import { ImagePreviewList } from "@/components/upload/ImagePreviewList";
import { useImageImport } from "@/hooks/useImageImport";
import { ERROR_CODES } from "@/lib/constants";
import { formatBytes } from "@/lib/utils";
import { createMemoryWithImages } from "@/services/memory/memoryService";
import { readStorageUsage, requestPersistence } from "@/services/storage/persistedStorage";
import { userConfirmedValue } from "@/schemas/memorySchema";

const SAVE_MESSAGES = {
  [ERROR_CODES.STORAGE_UNAVAILABLE]: "这个浏览器不允许本地存储，无法保存记忆。",
  [ERROR_CODES.STORAGE_FAILED]: "保存中断，图片没有完整写入本地数据库，请重试。",
  [ERROR_CODES.VALIDATION_FAILED]: "填写内容不符合要求：标题必填，日期格式为年-月-日。",
  [ERROR_CODES.IMAGES_REQUIRED]: "请至少添加一张可以读取的图片。",
};

function describeSaveError(error) {
  const base = SAVE_MESSAGES[error?.code] ?? "保存失败，请重试。";

  if (error?.cleanupFailed) {
    return `${base}自动清理也没有成功，请刷新页面后重新尝试保存。`;
  }

  return base;
}

function describeStorage(storage) {
  if (!storage) {
    return "正在检查本地存储…";
  }

  const { persistence, usage } = storage;
  const usageText = usage
    ? `已用 ${formatBytes(usage.usage)}，浏览器分配上限 ${formatBytes(usage.quota)}。`
    : "";

  if (!persistence.supported) {
    return `这个浏览器不提供持久存储接口，记忆仍存在本机，但可能被浏览器回收。${usageText}`;
  }
  if (persistence.granted) {
    return `浏览器已同意保留本站数据（手动清理站点数据仍会删除）。${usageText}`;
  }

  return `浏览器未授予持久存储：磁盘紧张时本地记忆可能被清理。${usageText}`;
}

export function MemoryCreateForm() {
  const router = useRouter();
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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState(null);
  const [storage, setStorage] = useState(null);
  // disabled only applies after a re-render; a fast double-click could
  // otherwise start two saves of the same memory before the first lands.
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;

    Promise.all([requestPersistence(), readStorageUsage()]).then(([persistence, usage]) => {
      if (active) {
        setStorage({ persistence, usage });
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const isSaving = status === "saving";
  const canSubmit = readyImages.length > 0 && title.trim().length > 0 && !isReading && !isSaving;

  async function handleSubmit(event) {
    event.preventDefault();

    if (savingRef.current) {
      return;
    }

    if (!canSubmit) {
      setStatus("error");
      setMessage(
        title.trim().length === 0
          ? "先给这段记忆起个标题。"
          : "先添加至少一张可以读取的图片。",
      );
      return;
    }

    savingRef.current = true;
    setStatus("saving");
    setMessage(null);

    try {
      const { memory } = await createMemoryWithImages({
        title: title.trim(),
        description: description.trim(),
        date: date || null,
        // Typed by the user, so provenance is stated explicitly rather than
        // inferred from the fact that it is a string.
        location: location.trim() ? userConfirmedValue(location.trim()) : null,
        images: readyImages,
      });

      router.push(`/memory/${memory.id}`);
    } catch (error) {
      savingRef.current = false;
      setStatus("error");
      setMessage(describeSaveError(error));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="page-in relative mx-auto w-full max-w-3xl space-y-8 px-5 py-12 sm:px-8"
    >
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.28em] text-[#8d8474]">Afterimage</p>
        <h1 className="title-glow text-2xl font-normal text-[#f2ebdd]">创建一段记忆</h1>
        <p className="text-sm text-[#9a9082]">
          照片只保存在这台设备的浏览器里，本阶段还不做内容识别。
        </p>
      </header>

      <section className="space-y-3">
        <ImageDropzone
          onFiles={addFiles}
          disabled={!canAddMore || isSaving || isReading}
          remainingSlots={remainingSlots}
          maxFiles={maxFiles}
        />
        <ImagePreviewList
          items={items}
          rejected={rejected}
          onRemove={removeItem}
          onDismissRejected={dismissRejected}
        />
      </section>

      <section className="space-y-5">
        <label className="block space-y-2">
          <span className="text-sm text-[#c9c0b0]">记忆标题</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
            placeholder="例如：教室最后一排的那个下午"
            className="w-full rounded-xl border border-[#33302a] bg-[rgba(20,18,16,0.7)] px-4 py-3 text-[#efe7d8] backdrop-blur transition-all placeholder:text-[#6b6459] focus:border-[rgba(230,213,176,0.45)] focus:shadow-[0_0_0_3px_rgba(230,213,176,0.08)] focus:outline-none"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-[#c9c0b0]">描述（可选）</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={5000}
            rows={4}
            placeholder="当时发生了什么？只写你记得的。"
            className="w-full resize-y rounded-xl border border-[#33302a] bg-[rgba(20,18,16,0.7)] px-4 py-3 text-[#efe7d8] backdrop-blur transition-all placeholder:text-[#6b6459] focus:border-[rgba(230,213,176,0.45)] focus:shadow-[0_0_0_3px_rgba(230,213,176,0.08)] focus:outline-none"
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm text-[#c9c0b0]">日期（可选）</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-xl border border-[#33302a] bg-[rgba(20,18,16,0.7)] px-4 py-3 text-[#efe7d8] backdrop-blur transition-all focus:border-[rgba(230,213,176,0.45)] focus:shadow-[0_0_0_3px_rgba(230,213,176,0.08)] focus:outline-none"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-[#c9c0b0]">地点（可选）</span>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              maxLength={120}
              placeholder="例如：老校区食堂二楼"
              className="w-full rounded-xl border border-[#33302a] bg-[rgba(20,18,16,0.7)] px-4 py-3 text-[#efe7d8] backdrop-blur transition-all placeholder:text-[#6b6459] focus:border-[rgba(230,213,176,0.45)] focus:shadow-[0_0_0_3px_rgba(230,213,176,0.08)] focus:outline-none"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-full bg-[#e6d5b0] px-6 py-3 text-sm text-[#1a1712] transition-all hover:bg-[#f2e3c0] hover:shadow-[0_0_32px_rgba(230,213,176,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#3a352c] disabled:text-[#8d8474] disabled:shadow-none"
          >
            {isSaving ? "正在保存记忆…" : isReading ? "正在读取图片…" : "保存这段记忆"}
          </button>
          {message ? (
            <p className="text-sm text-[#e0a98f]" role="status">
              {message}
            </p>
          ) : (
            <p className="text-sm text-[#7c7466]" role="status">
              需要：标题 + 至少 1 张图片
            </p>
          )}
        </div>

        <p className="text-xs leading-relaxed text-[#6b6459]">{describeStorage(storage)}</p>
      </section>
    </form>
  );
}
