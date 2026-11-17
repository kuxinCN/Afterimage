import Link from "next/link";

import { MemoryIndex } from "@/components/memory/MemoryIndex";

export const metadata = {
  title: "记忆列表 · 余像 Afterimage",
};

export default function MemoryListPage() {
  return (
    <main className="min-h-screen bg-[#0f0e0d] font-[family-name:var(--font-geist-sans)]">
      <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8">
        <Link href="/" className="text-xs text-[#8d8474] hover:text-[#e6ddce]">
          ← 返回首页
        </Link>
        <div className="mt-6">
          <MemoryIndex />
        </div>
      </div>
    </main>
  );
}