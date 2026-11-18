import Link from "next/link";

// Presentational only: the current mode is marked, the other line is a plain
// client-side Link. No state writes happen here, so switching can never reset
// either line's progress.
export function ModeLinks({ current, storyHref }) {
  return (
    <span className="glass inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full px-4 py-2 text-xs">
      {current === "memory" ? (
        <span
          aria-current="page"
          className="text-[#e6d5b0] before:mr-1.5 before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-[#e6d5b0] before:align-middle before:shadow-[0_0_8px_rgba(230,213,176,0.8)]"
        >
          记忆空间
        </span>
      ) : (
        <Link href="/memory" className="text-[#8d8474] transition-colors hover:text-[#e6ddce]">
          记忆空间
        </Link>
      )}
      <span aria-hidden className="text-[#3a342c]">
        ·
      </span>
      {current === "story" ? (
        <span
          aria-current="page"
          className="text-[#e6d5b0] before:mr-1.5 before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-[#e6d5b0] before:align-middle before:shadow-[0_0_8px_rgba(230,213,176,0.8)]"
        >
          平行故事
        </span>
      ) : (
        <Link href={storyHref} className="text-[#8d8474] transition-colors hover:text-[#e6ddce]">
          平行故事
        </Link>
      )}
    </span>
  );
}