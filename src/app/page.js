import Link from "next/link";

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
    <main className="min-h-screen bg-[#0f0e0d] font-[family-name:var(--font-geist-sans)]">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-10 px-4 py-16 sm:px-8">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.28em] text-[#8d8474]">Afterimage</p>
          <h1 className="text-3xl leading-tight text-[#f2ebdd] sm:text-4xl">余像</h1>
          <p className="text-base leading-relaxed text-[#c9c0b0] sm:text-lg">
            把真实的生活资料，重构成可以再次进入的记忆空间。
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-sm text-[#8d8474]">这个产品坚持的三件事</h2>
          <ul className="space-y-4">
            {PRINCIPLES.map((principle) => (
              <li
                key={principle.title}
                className="space-y-1 rounded-xl border border-[#2c2822] bg-[#141210] px-4 py-3"
              >
                <h3 className="text-base text-[#efe7d8]">{principle.title}</h3>
                <p className="text-sm leading-relaxed text-[#9a9082]">{principle.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs leading-relaxed text-[#6b6459]">
          当前为页面流程骨架：故事内容由 Mock 提供并已明确标记，故事页的 2.5D
          场景组件位等待视觉组件接入。照片建档与记忆整理链路已可用。
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/create"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#e6d5b0] px-8 text-base text-[#1a1712] transition-colors hover:bg-[#f2e3c0]"
          >
            开始
          </Link>
          <Link
            href="/memory/new"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#3a342c] px-6 text-base text-[#efe7d8] transition-colors hover:bg-[#1d1a16]"
          >
            导入照片建档
          </Link>
        </div>
      </div>
    </main>
  );
}