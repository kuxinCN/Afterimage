import { MemoryAssetsViewer } from "@/components/memory/MemoryAssetsViewer";

export const metadata = {
  title: "记忆详情 · 余像 Afterimage",
};

export default function MemoryDetailPage({ params }) {
  return (
    <main className="min-h-screen bg-[#0f0e0d] font-[family-name:var(--font-geist-sans)]">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        <a href="/create" className="text-xs text-[#8d8474] hover:text-[#e6ddce]">
          ← 回到创建页面
        </a>
        <div className="mt-6">
          <MemoryAssetsViewer memoryId={params.id} />
        </div>
      </div>
    </main>
  );
}
