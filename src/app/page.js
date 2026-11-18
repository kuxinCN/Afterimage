import { HomeEntries } from "@/components/home/HomeEntries";
import { ModeNav } from "@/components/nav/ModeNav";
import { PageAtmosphere } from "@/components/visual/PageAtmosphere";

export const metadata = {
  title: "余像 Afterimage · 把生活资料重构成可以再次进入的记忆空间",
};

const PRINCIPLES = [
  {
    title: "只用你提供的资料",
    body: "文字与照片都来自你。照片以 Blob 存在这台设备的浏览器里，不上传，也不转成 Base64。",
  },
  {
    title: "推测与事实分开",
    body: "每条信息都带来源标记：用户确认、图片可见、AI 推测、想象内容。推测不会伪装成你确认过的事实。",
  },
  {
    title: "想象就是想象",
    body: "故事页的文字是虚构演绎，会明确标注为想象内容，不冒充对你真实记忆的还原。",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#0b0a09] font-[family-name:var(--font-geist-sans)]">
      <PageAtmosphere tone="home" />

      <div className="page-in relative mx-auto w-full max-w-6xl px-5 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 py-7">
          <p className="text-xs uppercase tracking-[0.34em] text-[#c9c0b0]">
            Afterimage
            <span aria-hidden className="ml-3 inline-block h-1 w-1 rounded-full bg-[#e6d5b0] shadow-[0_0_10px_rgba(230,213,176,0.9)] align-middle" />
          </p>
          <ModeNav />
        </header>

        <section className="relative flex flex-col items-center gap-6 pb-20 pt-16 text-center sm:pb-24 sm:pt-24">
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="hero-ring-glow absolute h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(216,168,96,0.16),transparent_72%)] blur-[6px] sm:h-[560px] sm:w-[560px]" />
            <div className="absolute h-[240px] w-[240px] rounded-full border border-[rgba(230,213,176,0.10)] sm:h-[320px] sm:w-[320px]" />
            <div className="absolute h-[360px] w-[360px] rounded-full border border-[rgba(230,213,176,0.06)] sm:h-[480px] sm:w-[480px]" />
            <div className="absolute h-[500px] w-[500px] rounded-full border border-[rgba(230,213,176,0.03)] sm:h-[660px] sm:w-[660px]" />
          </div>
          <p className="relative text-xs uppercase tracking-[0.3em] text-[#8d8474]">
            记忆重构 · 双线叙事
          </p>
          <h1 className="title-glow relative text-5xl font-normal tracking-[0.08em] text-[#f2ebdd] sm:text-7xl">
            余像
          </h1>
          <p className="relative max-w-xl text-base leading-relaxed text-[#c9c0b0] sm:text-lg">
            把真实的生活资料，重构成可以再次进入的记忆空间。
          </p>
          <p className="relative max-w-md text-sm leading-relaxed text-[#8d8474]">
            一条线整理你确认过的真实，一条线演绎你允许的想象。两者都只留在这台设备上。
          </p>
        </section>

        <HomeEntries />

        <section className="space-y-6 pt-20 sm:pt-24">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm tracking-[0.2em] text-[#8d8474]">这个产品坚持的三件事</h2>
            <span aria-hidden className="h-px flex-1 bg-[linear-gradient(to_right,rgba(230,213,176,0.18),transparent)]" />
          </div>
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {PRINCIPLES.map((principle, index) => (
              <li
                key={principle.title}
                className="glass space-y-3 rounded-2xl p-5 transition-all duration-500 hover:-translate-y-1 hover:border-[rgba(230,213,176,0.22)] hover:shadow-[0_20px_60px_-24px_rgba(216,168,96,0.35)]"
              >
                <p className="text-xs tracking-[0.3em] text-[#6b6459]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="text-base text-[#efe7d8]">{principle.title}</h3>
                <p className="text-sm leading-relaxed text-[#9a9082]">{principle.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-20 border-t border-[rgba(230,213,176,0.08)] py-8">
          <p className="text-xs leading-relaxed text-[#6b6459]">
            当前为页面流程骨架：故事内容由 Mock 提供并已明确标记，故事页的 2.5D
            场景组件位等待视觉组件接入。照片建档与记忆整理链路已可用。
          </p>
        </footer>
      </div>
    </main>
  );
}