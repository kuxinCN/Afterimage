import Link from "next/link";

import { MemoryAnalysisPanel } from "@/components/ai/MemoryAnalysisPanel";
import { MemoryAssetsViewer } from "@/components/memory/MemoryAssetsViewer";
import { MemoryDetailGate } from "@/components/memory/MemoryDetailGate";
import { MemoryStoryGate } from "@/components/memory/MemoryStoryGate";
import { MemoryScenePanel } from "@/components/scene/MemoryScenePanel";
import { PageAtmosphere } from "@/components/visual/PageAtmosphere";

export const metadata = {
  title: "记忆详情 · 余像 Afterimage",
};

export default function MemoryDetailPage({ params }) {
  return (
    <main className="relative min-h-[calc(100vh-3.5rem)] overflow-x-clip bg-[#0b0a09] font-[family-name:var(--font-geist-sans)]">
      <PageAtmosphere tone="memory" />
      <div className="relative mx-auto w-full max-w-4xl space-y-10 px-5 py-12 sm:px-8">
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#8d8474]">
          <Link href="/memory" className="hover:text-[#e6ddce]">
            ← 回到记忆列表
          </Link>
        </nav>
        <MemoryDetailGate memoryId={params.id}>
          <MemoryAssetsViewer memoryId={params.id} />
          <MemoryAnalysisPanel memoryId={params.id} />
          <MemoryStoryGate memoryId={params.id} />
          <MemoryScenePanel memoryId={params.id} />
        </MemoryDetailGate>
      </div>
    </main>
  );
}