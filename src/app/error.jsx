"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#0b0a09] px-5 py-16 font-[family-name:var(--font-geist-sans)]">
      <section className="glass page-in w-full max-w-md space-y-5 rounded-2xl px-6 py-10 text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-[#8d8474]">Afterimage</p>
        <h1 className="title-glow text-xl font-normal text-[#f2ebdd]">这一页暂时出了问题</h1>
        <p className="text-sm leading-relaxed text-[#9a9082]">
          页面渲染时遇到了意外错误。你已保存在本机的记忆与照片不受影响，可以重试或先回到首页。
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="min-h-[44px] rounded-full bg-[#e6d5b0] px-6 text-sm text-[#1a1712] transition-all hover:bg-[#f2e3c0] hover:shadow-[0_0_32px_rgba(230,213,176,0.35)] active:scale-[0.98]"
          >
            重试这一页
          </button>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#3a342c] px-6 text-sm text-[#efe7d8] transition-all hover:border-[rgba(230,213,176,0.35)] hover:bg-[#1d1a16] active:scale-[0.98]"
          >
            返回首页
          </Link>
        </div>
      </section>
    </main>
  );
}