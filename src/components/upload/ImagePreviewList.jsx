"use client";

import { formatBytes } from "@/lib/utils";

function PreviewCard({ item, onRemove }) {
  const dimensions =
    item.width && item.height ? `${item.width} × ${item.height}` : "尺寸读取中";

  return (
    <li className="overflow-hidden rounded-xl border border-[#2c2822] bg-[#141210]">
      <div className="relative flex h-28 items-center justify-center bg-[#0d0c0b]">
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL has no server to optimize it and must never leave the device
          <img
            src={item.previewUrl}
            alt={item.name}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <span className="animate-pulse text-xs text-[#7c7466]">正在读取…</span>
        )}
        <button
          type="button"
          onClick={() => onRemove(item.key)}
          aria-label={`移除 ${item.name}`}
          className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-[#efe7d8] hover:bg-black/80"
        >
          移除
        </button>
      </div>
      <div className="space-y-1 px-3 py-2">
        <p className="truncate text-sm text-[#e6ddce]" title={item.name}>
          {item.name}
        </p>
        <p className="text-xs text-[#8d8474]">
          {formatBytes(item.size)} · {dimensions}
        </p>
        {item.mimeTypeAdjusted ? (
          <p className="text-xs text-amber-200/70">扩展名与内容不符，将按实际格式保存</p>
        ) : null}
      </div>
    </li>
  );
}

export function ImagePreviewList({ items, rejected, onRemove, onDismissRejected }) {
  return (
    <div className="space-y-4">
      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <PreviewCard key={item.key} item={item} onRemove={onRemove} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#7c7466]">还没有选择照片。一段记忆至少需要一张图片。</p>
      )}

      {rejected.length > 0 ? (
        <ul className="space-y-2 rounded-xl border border-[#3b2f2a] bg-[#1a1513] p-3">
          {rejected.map((entry) => (
            <li key={entry.key} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-[#d8b8a4]">
                <span className="font-medium">{entry.name}</span>
                <span className="ml-2 text-[#a08a7c]">{entry.message}</span>
              </span>
              <button
                type="button"
                onClick={() => onDismissRejected(entry.key)}
                className="shrink-0 text-xs text-[#8d8474] hover:text-[#e6ddce]"
              >
                知道了
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
