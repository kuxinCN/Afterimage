import { CreateStoryForm } from "@/components/flow/CreateStoryForm";

export const metadata = {
  title: "写下一段记忆 · 余像 Afterimage",
};

export default function CreatePage() {
  return (
    <main className="min-h-screen bg-[#0f0e0d] font-[family-name:var(--font-geist-sans)]">
      <CreateStoryForm />
    </main>
  );
}