import { MemoryAnalysisPanel } from "@/components/ai/MemoryAnalysisPanel";
import { MemoryAssetsViewer } from "@/components/memory/MemoryAssetsViewer";
import { MemoryScenePanel } from "@/components/scene/MemoryScenePanel";

export const metadata = {
  title: "记忆详情 · 余像 Afterimage",
};

export default function MemoryDetailPage({ params }) {
  return (
    <main className="min-h-screen bg-[#0f0e0d] font-[family-name:var(--font-geist-sans)]">
      <div className="mx-auto w-full max-w-4xl space-y-10 px-5 py-12 sm:px-8">
        <a href="/create" className="text-xs text-[#8d8474] hover:text-[#e6ddce]">
          ← 回到创建页面
        </a>
        <MemoryAssetsViewer memoryId={params.id} />
        <MemoryAnalysisPanel memoryId={params.id} />
        <MemoryScenePanel memoryId={params.id} />
      </div>
    </main>
  );
}
