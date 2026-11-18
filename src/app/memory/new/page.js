import { MemoryCreateForm } from "@/components/memory/MemoryCreateForm";
import { PageAtmosphere } from "@/components/visual/PageAtmosphere";

export const metadata = {
  title: "导入照片建档 · 余像 Afterimage",
};

export default function NewMemoryPage() {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#0b0a09] font-[family-name:var(--font-geist-sans)]">
      <PageAtmosphere tone="memory" />
      <MemoryCreateForm />
    </main>
  );
}