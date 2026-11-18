import Link from "next/link";

const LINES = [
  {
    href: "/memory",
    tag: "MEMORY",
    overline: "真实记忆 · 整理与探索",
    overlineColor: "#d8b878",
    title: "记忆空间",
    body: "导入照片与文字，整理、复核，并生成可以再次进入的 2.5D 记忆场景。",
    scene: "scene-memory",
  },
  {
    tag: "STORY",
    overline: "虚构演绎 · 互动选择",
    overlineColor: "#b9c2d8",
    title: "平行故事",
    body: "写下一段记忆，用选择与自由输入走出不同分支与结局。内容明确标记为想象。",
    scene: "scene-story",
  },
];

function MemoryScene() {
  return (
    <>
      <div className="portal-beam" />
      <div
        className="portal-frame left-[12%] top-[16%] h-28 rotate-[-5deg] group-hover:-translate-y-2 group-hover:rotate-[-3deg]"
        style={{ width: "88px" }}
      />
      <div
        className="portal-frame left-[34%] top-[34%] rotate-[4deg] group-hover:-translate-y-1 group-hover:rotate-[2deg]"
        style={{ width: "64px", height: "80px", opacity: 0.75 }}
      />
      <div className="portal-floor" />
    </>
  );
}

function StoryScene() {
  return (
    <>
      <div className="portal-door-halo opacity-80 transition-opacity duration-700 group-hover:opacity-100" />
      <div className="portal-door transition-[filter] duration-700 group-hover:brightness-125" />
      <span className="portal-spark left-[24%] top-[30%]" style={{ animationDelay: "0s" }} />
      <span className="portal-spark left-[72%] top-[24%]" style={{ animationDelay: "1.6s" }} />
      <span className="portal-spark left-[64%] top-[52%]" style={{ animationDelay: "3.2s" }} />
      <div className="portal-floor" />
    </>
  );
}

// Two spatial portals, one per line. Pure presentational: the story href is
// decided by the caller so an in-progress story resumes instead of restarting.
export function LineCards({ storyHref }) {
  return (
    <section aria-label="两条业务线入口" className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {LINES.map((line) => (
        <Link
          key={line.title}
          href={line.href ?? storyHref}
          className={`group relative block min-h-[420px] overflow-hidden rounded-3xl border border-[rgba(230,213,176,0.10)] ${line.scene} transition-all duration-500 hover:-translate-y-1.5 hover:border-[rgba(230,213,176,0.30)] hover:shadow-[0_28px_90px_-28px_rgba(216,168,96,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6d5b0]`}
        >
          {line.href ? <MemoryScene /> : <StoryScene />}
          <span className="absolute right-6 top-5 text-[10px] tracking-[0.3em] text-[#6b6459]">
            {line.tag}
          </span>
          <div className="absolute inset-x-0 bottom-0 space-y-2 bg-[linear-gradient(to_top,rgba(7,6,5,0.92),rgba(7,6,5,0.55)_60%,transparent)] p-6 sm:p-7">
            <p className="text-xs tracking-[0.22em]" style={{ color: line.overlineColor }}>
              {line.overline}
            </p>
            <h2 className="title-glow text-2xl text-[#f2ebdd] sm:text-3xl">{line.title}</h2>
            <p className="text-sm leading-relaxed text-[#9a9082]">{line.body}</p>
            <p className="inline-flex items-center gap-2 pt-1 text-xs text-[#8d8474] transition-colors group-hover:text-[#e6d5b0]">
              进入
              <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1.5">
                →
              </span>
            </p>
          </div>
        </Link>
      ))}
    </section>
  );
}