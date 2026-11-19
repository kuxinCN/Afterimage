import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#0b0a09] px-5 py-16 font-[family-name:var(--font-geist-sans)]">
      <section className="glass page-in w-full max-w-md space-y-5 rounded-2xl px-6 py-10 text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-[#8d8474]">Afterimage</p>
        <h1 className="title-glow text-xl font-normal text-[#f2ebdd]">没有找到这一页</h1>
        <p className="text-sm leading-relaxed text-[#9a9082]">
          链接可能已经失效，或者地址写错了。两条线的入口都还在下面。
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/memory"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#e6d5b0] px-6 text-sm text-[#1a1712] transition-all hover:bg-[#f2e3c0] hover:shadow-[0_0_32px_rgba(230,213,176,0.35)] active:scale-[0.98]"
          >
            去记忆空间
          </Link>
          <Link
            href="/create"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#3a342c] px-6 text-sm text-[#efe7d8] transition-all hover:border-[rgba(230,213,176,0.35)] hover:bg-[#1d1a16] active:scale-[0.98]"
          >
            去平行故事
          </Link>
        </div>
        <Link href="/" className="inline-block text-xs text-[#8d8474] hover:text-[#e6ddce]">
          返回首页
        </Link>
      </section>
    </main>
  );
}