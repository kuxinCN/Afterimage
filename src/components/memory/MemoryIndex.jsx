"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ERROR_CODES, MEMORY_STATUS } from "@/lib/constants";
import { createPreviewRegistry } from "@/services/image/previewRegistry";
import { AssetRepository } from "@/services/storage/assetRepository";
import { MemoryRepository } from "@/services/storage/memoryRepository";

const READ_MESSAGES = {
  [ERROR_CODES.STORAGE_UNAVAILABLE]: "这个浏览器不允许本地存储，读不到已保存的记忆。",
  [ERROR_CODES.STORAGE_FAILED]: "本地数据读取失败，请刷新页面重试。",
};

const STATUS_META = {
  [MEMORY_STATUS.DRAFT]: { label: "草稿", dot: "#8d8474" },
  [MEMORY_STATUS.ANALYZING]: { label: "解析中", dot: "#e0c98f" },
  [MEMORY_STATUS.REVIEWING]: { label: "待复核", dot: "#e0c98f" },
  [MEMORY_STATUS.READY]: { label: "已确认", dot: "#b8c4a0" },
  [MEMORY_STATUS.GENERATING]: { label: "场景生成中", dot: "#e0c98f" },
  [MEMORY_STATUS.COMPLETED]: { label: "场景已生成", dot: "#b8c4a0" },
  [MEMORY_STATUS.FAILED]: { label: "处理失败", dot: "#e0a98f" },
};

function formatDay(timestamp) {
  return new Date(timestamp).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function CreateButton({ children }) {
  return (
    <Link
      href="/memory/new"
      className="inline-flex items-center gap-2 rounded-full bg-[#e6d5b0] px-6 py-3 text-sm text-[#1a1712] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#f2e3c0] hover:shadow-[0_0_36px_rgba(230,213,176,0.4)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6d5b0]"
    >
      <span aria-hidden className="text-base leading-none">＋</span>
      {children}
    </Link>
  );
}

function CoverPlaceholder() {
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,#1a1712,#0d0c0b)]">
      <div aria-hidden className="relative h-20 w-20">
        <div className="absolute inset-0 rounded-full border border-[#33302a]" />
        <div className="absolute inset-3 rounded-full border border-[#3a352c]" />
        <div className="absolute inset-6 rounded-full bg-[radial-gradient(closest-side,rgba(230,213,176,0.22),transparent)] blur-[2px]" />
      </div>
      <span className="absolute bottom-3 right-4 text-[11px] text-[#6b6459]">暂无照片</span>
    </div>
  );
}

function MemoryCard({ memory, coverUrl, index }) {
  const status = STATUS_META[memory.status] ?? { label: memory.status, dot: "#8d8474" };
  const photoCount = memory.assetIds.length;

  return (
    <li className="animate-rise-in" style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}>
      <Link
        href={`/memory/${memory.id}`}
        className="group block overflow-hidden rounded-2xl border border-[#2c2822] bg-[rgba(20,18,16,0.75)] backdrop-blur transition-all duration-500 hover:-translate-y-1 hover:border-[rgba(230,213,176,0.3)] hover:shadow-[0_28px_80px_-30px_rgba(216,168,96,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6d5b0]"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-[#0d0c0b]">
          {coverUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: URL has no server to optimize it and must never leave the device */}
              <img
                src={coverUrl}
                alt=""
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
              {/* eslint-disable-next-line @next/next/no-img-element -- same local blob URL, decorative afterimage echo */}
              <img
                src={coverUrl}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover opacity-0 mix-blend-screen sepia transition-all duration-700 ease-out group-hover:translate-x-2 group-hover:scale-[1.04] group-hover:opacity-40"
              />
            </>
          ) : (
            <CoverPlaceholder />
          )}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(to_top,rgba(13,12,11,0.85),transparent)]"
          />
          <span className="absolute bottom-2.5 left-4 inline-flex items-center gap-1.5 text-[11px] text-[#c9c0b0]">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: status.dot }}
            />
            {status.label}
          </span>
          <span className="absolute bottom-2.5 right-4 text-[11px] text-[#8d8474]">
            {photoCount} 张照片
          </span>
        </div>

        <div className="space-y-2 px-4 py-4">
          <h2 className="truncate text-base text-[#f2ebdd] transition-colors group-hover:text-[#f7f0e2]" title={memory.title}>
            {memory.title}
          </h2>
          <p className="truncate text-xs text-[#8d8474]">
            {memory.date ?? formatDay(memory.createdAt)}
            {memory.location?.value ? ` · ${memory.location.value}` : ""}
          </p>
          {memory.description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-[#7c7466]">
              {memory.description}
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <section className="animate-rise-in flex flex-col items-center gap-8 rounded-2xl border border-dashed border-[#33302a] px-6 py-16 text-center">
      <div aria-hidden className="relative h-36 w-36">
        <div className="absolute inset-0 rounded-full border border-[#2c2822]" />
        <div className="absolute inset-5 rounded-full border border-[#3a352c]" />
        <div className="absolute inset-10 rounded-full border border-[#57503f]" />
        <div className="hero-ring-glow absolute inset-14 rounded-full bg-[radial-gradient(closest-side,rgba(230,213,176,0.35),transparent)] blur-[3px]" />
      </div>
      <div className="space-y-3">
        <h2 className="text-xl text-[#f2ebdd]">这里还没有留下任何余像</h2>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-[#9a9082]">
          从一张照片开始，把一段真实的生活资料留在这里。
          它会先安静地躺在这台设备上，等你回来再次进入。
        </p>
      </div>
      <CreateButton>创建第一段记忆</CreateButton>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6" role="status" aria-label="正在读取本地记忆">
      <p className="text-sm text-[#8d8474]">正在从本地存储读取记忆…</p>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <li
            key={index}
            className="animate-pulse overflow-hidden rounded-2xl border border-[#2c2822] bg-[#141210]"
          >
            <div className="aspect-[4/3] bg-[#1a1712]" />
            <div className="space-y-3 px-4 py-4">
              <div className="h-4 w-3/4 rounded bg-[#26221c]" />
              <div className="h-3 w-1/2 rounded bg-[#1f1c17]" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MemoryIndex() {
  const [state, setState] = useState({ status: "loading", memories: [] });
  const [covers, setCovers] = useState({});
  const [error, setError] = useState(null);
  const registryRef = useRef(null);

  if (!registryRef.current) {
    registryRef.current = createPreviewRegistry();
  }

  // Blob URLs do not survive a reload, so covers are rebuilt from the Blob
  // bytes stored in IndexedDB and revoked when this list unmounts.
  useEffect(() => {
    const registry = registryRef.current;

    return () => registry.releaseAll();
  }, []);

  const load = useCallback(async () => {
    setState({ status: "loading", memories: [] });
    setError(null);

    const registry = registryRef.current;
    const memories = await MemoryRepository.getAll();
    const blobs = await Promise.all(
      memories.map(async (memory) => {
        const assetId = memory.assetIds[0];
        if (!assetId) {
          return null;
        }
        const asset = await AssetRepository.getById(assetId);
        return asset?.blob ?? null;
      }),
    );

    registry.releaseAll();

    const nextCovers = {};
    memories.forEach((memory, index) => {
      const url = registry.acquire(memory.id, blobs[index]);
      if (url) {
        nextCovers[memory.id] = url;
      }
    });

    setCovers(nextCovers);
    setState({ status: "ready", memories });
  }, []);

  useEffect(() => {
    let active = true;

    load().catch((loadError) => {
      if (active) {
        setError(READ_MESSAGES[loadError?.code] ?? "读取本地记忆时出错。");
        setState({ status: "error", memories: [] });
      }
    });

    return () => {
      active = false;
    };
  }, [load]);

  const { status, memories } = state;

  return (
    <div className="page-in relative space-y-10">
      <header className="animate-rise-in flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.28em] text-[#8d8474]">Afterimage</p>
          <h1 className="title-glow text-3xl font-normal text-[#f2ebdd]">余像</h1>
          <p className="max-w-md text-sm leading-relaxed text-[#9a9082]">
            把真实的生活资料，重构成可以再次进入的记忆空间。
          </p>
        </div>
        {status === "ready" && memories.length > 0 ? (
          <CreateButton>创建新的记忆</CreateButton>
        ) : null}
      </header>

      {status === "loading" ? <LoadingState /> : null}

      {status === "error" ? (
        <section className="animate-rise-in space-y-4 rounded-2xl border border-[#3b2f2a] bg-[#141210] px-6 py-10 text-center">
          <p className="text-sm text-[#e0a98f]" role="alert">{error}</p>
          <button
            type="button"
            onClick={() => {
              load().catch((loadError) => {
                setError(READ_MESSAGES[loadError?.code] ?? "读取本地记忆时出错。");
                setState({ status: "error", memories: [] });
              });
            }}
            className="rounded-full border border-[#57503f] px-5 py-2 text-sm text-[#e6ddce] transition-colors hover:bg-[#1f1c17]"
          >
            重新读取
          </button>
        </section>
      ) : null}

      {status === "ready" && memories.length === 0 ? <EmptyState /> : null}

      {status === "ready" && memories.length > 0 ? (
        <section className="space-y-5">
          <p className="animate-rise-in text-xs text-[#7c7466]">
            共 {memories.length} 段记忆 · 全部只保存在这台设备的浏览器里
          </p>
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {memories.map((memory, index) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                coverUrl={covers[memory.id] ?? null}
                index={index}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="animate-rise-in border-t border-[#221f1a] pt-6" style={{ animationDelay: "300ms" }}>
        <p className="text-xs leading-relaxed text-[#6b6459]">
          余像不上传你的照片。清除浏览器站点数据会同时删除这里的记忆。
        </p>
      </footer>
    </div>
  );
}