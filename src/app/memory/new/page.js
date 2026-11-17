import { MemoryCreateForm } from "@/components/memory/MemoryCreateForm";

export const metadata = {
  title: "导入照片建档 · 余像 Afterimage",
};

export default function NewMemoryPage() {
  return (
    <main className="min-h-screen bg-[#0f0e0d] font-[family-name:var(--font-geist-sans)]">
      <MemoryCreateForm />
    </main>
  );
}