import { MemoryCreateForm } from "@/components/memory/MemoryCreateForm";

export const metadata = {
  title: "创建一段记忆 · 余像 Afterimage",
};

export default function CreateMemoryPage() {
  return (
    <main className="min-h-screen bg-[#0f0e0d] font-[family-name:var(--font-geist-sans)]">
      <MemoryCreateForm />
    </main>
  );
}
