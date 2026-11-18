"use client";

import { useRef, useState } from "react";

export function ImageDropzone({ onFiles, disabled = false, remainingSlots, maxFiles }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  function openPicker() {
    if (disabled) {
      return;
    }
    inputRef.current?.click();
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);

    if (disabled) {
      return;
    }

    onFiles(event.dataTransfer?.files);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => {
          onFiles(event.target.files);
          // Reset so picking the same file again still fires a change event.
          event.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsDragging(true);
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={[
          "flex min-h-[132px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center transition-all hover:border-[rgba(230,213,176,0.4)] hover:shadow-[0_0_44px_-12px_rgba(216,168,96,0.35)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/40",
          isDragging
            ? "border-amber-200/60 bg-amber-100/5"
            : "border-[#3a342c] bg-[#161412] hover:border-[#57503f]",
          disabled ? "cursor-not-allowed opacity-50" : "",
        ].join(" ")}
      >
        <span className="text-base text-[#efe7d8]">
          {isDragging ? "松手即可添加照片" : "拖拽照片到这里，或点击选择"}
        </span>
        <span className="text-sm text-[#9a9082]">
          支持 JPG、PNG、WebP · 单张不超过 10 MB · 还能添加 {remainingSlots} / {maxFiles} 张
        </span>
      </div>
    </div>
  );
}
