"use client";

import { useEffect, useRef } from "react";

import { SOURCE_TYPES, SOURCE_TYPE_LABELS } from "@/lib/constants";

// Visual provenance language. Confirmed reads green/trustworthy, inference reads
// amber/uncertain, fiction reads purple/imagined — so a glance separates fact
// from guess. Keys are the canonical SOURCE_TYPES, never raw strings.
const SOURCE_META = {
  [SOURCE_TYPES.USER_CONFIRMED]: {
    badge: "border-[#7fb069]/50 bg-[#16240f] text-[#bfe3a8]",
    icon: "✓",
    hint: "你确认过的内容。",
  },
  [SOURCE_TYPES.IMAGE_OBSERVED]: {
    badge: "border-[#6f9bd1]/50 bg-[#111c28] text-[#bcd6f5]",
    icon: "◉",
    hint: "来自图片中可见的信息。",
  },
  [SOURCE_TYPES.AI_INFERRED]: {
    badge: "border-[#e8b877]/50 bg-[#2a1d13] text-[#f3d9a8]",
    icon: "?",
    hint: "这是 AI 的推测，尚未被你确认，可能与真实记忆不符。",
  },
  [SOURCE_TYPES.FICTIONAL]: {
    badge: "border-[#a98bd1]/50 bg-[#20182a] text-[#d9c2f0]",
    icon: "✦",
    hint: "这是想象内容，不是真实记忆。",
  },
};

const FALLBACK_META = {
  badge: "border-[#3a342c] bg-[#161412] text-[#9a9082]",
  icon: "·",
  hint: "",
};

function metaFor(sourceType) {
  return SOURCE_META[sourceType] ?? FALLBACK_META;
}

// Exported so A's MemoryFragment / MemorySpace can reuse the exact same badge
// without re-deriving colours or labels.
export function SourceBadge({ sourceType, className = "" }) {
  const meta = metaFor(sourceType);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${meta.badge} ${className}`}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {SOURCE_TYPE_LABELS[sourceType] ?? sourceType}
    </span>
  );
}

// Presentational and self-contained: it reads a hotspot-shaped object and never
// touches storage or the story store, so the memory lane today and A's fragment
// view later can mount it identically. It only renders fields that exist —
// confidence/confirmed are shown defensively if a richer fragment supplies them,
// and confirmed is never asserted for a non user_confirmed source.
export function HotspotDetailPanel({ hotspot, visited = false, onClose, className = "" }) {
  const closeRef = useRef(null);
  const restoreRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Client-only: focus the close control on open, restore focus to whatever was
  // focused before (the fragment or list button) on close, and let Escape close.
  // Mount-scoped so switching hotspots keeps focus steady; SSR markup is unchanged.
  useEffect(() => {
    if (!onCloseRef.current) {
      return undefined;
    }
    restoreRef.current = document.activeElement;
    closeRef.current?.focus();

    function handleKey(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current?.();
      }
    }
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
      const target = restoreRef.current;
      if (target && typeof target.focus === "function" && target.isConnected) {
        target.focus();
      }
    };
  }, []);

  if (!hotspot) {
    return null;
  }

  const meta = metaFor(hotspot.sourceType);
  const headingId = `hotspot-detail-${hotspot.id}`;
  const sourceIds = hotspot.sourceIds ?? [];
  const description = hotspot.description?.trim();

  return (
    <section
      aria-labelledby={headingId}
      className={`space-y-3 rounded-2xl border border-[#3a342c] bg-[#161412] px-4 py-4 sm:px-5 ${className}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h3 id={headingId} className="text-base text-[#efe7d8]">
            {hotspot.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge sourceType={hotspot.sourceType} />
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${
                visited
                  ? "border-[#e8b877]/30 bg-[#1f1a17] text-[#a89878]"
                  : "border-[#3a342c] bg-[#100f0e] text-[#7c7466]"
              }`}
            >
              <span aria-hidden="true">{visited ? "✓" : "○"}</span>
              {visited ? "已探索" : "未探索"}
            </span>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            aria-label="关闭详情"
            className="min-h-[32px] min-w-[32px] shrink-0 rounded-full border border-[#3a342c] text-sm text-[#9a9082] transition-colors hover:bg-[#1f1c18] hover:text-[#e6ddce]"
          >
            <span aria-hidden="true">✕</span>
          </button>
        ) : null}
      </header>

      <p className="whitespace-pre-line text-sm leading-relaxed text-[#c9c0b0]">
        {description || "这个热点还没有更多描述。"}
      </p>

      {meta.hint ? <p className="text-xs leading-relaxed text-[#8d8474]">{meta.hint}</p> : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#7c7466]">
        {sourceIds.length > 0 ? <span>关联 {sourceIds.length} 条来源记录</span> : null}
        {typeof hotspot.confidence === "number" ? (
          <span>置信度 {Math.round(hotspot.confidence * 100)}%</span>
        ) : null}
        {hotspot.confirmed && hotspot.sourceType === SOURCE_TYPES.USER_CONFIRMED ? (
          <span className="text-[#bfe3a8]">已确认</span>
        ) : null}
      </div>
    </section>
  );
}