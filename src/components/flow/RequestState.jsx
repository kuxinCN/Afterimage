const SPINNER_CLASS =
  "h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#57503f] border-t-[#e6d5b0]";

// Banners, not a gate: an error must not erase the story the reader already has.
export function RequestState({
  isLoading,
  error,
  onRetry,
  loadingText = "正在请求…",
  children,
}) {
  return (
    <div className="space-y-4">
      {isLoading ? (
        <p
          role="status"
          className="glass flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#c9c0b0]"
        >
          <span aria-hidden="true" className={SPINNER_CLASS} />
          {loadingText}
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-[#4a3227] bg-[rgba(26,20,18,0.8)] px-4 py-3 backdrop-blur"
        >
          <p className="text-sm leading-relaxed text-[#e0a98f]">{error.message}</p>
          <p className="text-xs text-[#8d8474]">错误码 {error.code}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={isLoading}
              className="min-h-[44px] rounded-full border border-[#5a4433] px-5 text-sm text-[#e6d5b0] transition-all hover:bg-[#241c17] hover:shadow-[0_0_24px_rgba(224,169,143,0.25)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "正在重试…" : "重试"}
            </button>
          ) : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}