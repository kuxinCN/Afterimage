import Link from "next/link";

import { MemoryIndex } from "@/components/memory/MemoryIndex";
import { PageAtmosphere } from "@/components/visual/PageAtmosphere";

export const metadata = {
  title: "记忆列表 · 余像 Afterimage",
};

export default function MemoryListPage() {
  return (
    <main className="relative min-h-[calc(100vh-3.5rem)] overflow-x-clip bg-[#0b0a09] font-[family-name:var(--font-geist-sans)]">
      <PageAtmosphere tone="memory" />
      <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8">
        <nav className="relative flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#8d8474]">
          <Link href="/" className="hover:text-[#e6ddce]">
            ← 返回首页
          </Link>
        </nav>
        <div className="relative mt-6">
          <MemoryIndex />
        </div>
      </div>
    </main>
  );
}