import { CreateStoryForm } from "@/components/flow/CreateStoryForm";
import { PageAtmosphere } from "@/components/visual/PageAtmosphere";

export const metadata = {
  title: "写下一段记忆 · 余像 Afterimage",
};

export default function CreatePage() {
  return (
    <main className="relative min-h-[calc(100vh-3.5rem)] overflow-x-clip bg-[#0b0a09] font-[family-name:var(--font-geist-sans)]">
      <PageAtmosphere tone="story" />
      <CreateStoryForm />
    </main>
  );
}