import { StoryView } from "./StoryView";

export const metadata = {
  title: "故事 · 余像 Afterimage",
};

export default function StoryPage() {
  return (
    <main className="min-h-screen bg-[#0f0e0d] font-[family-name:var(--font-geist-sans)]">
      <StoryView />
    </main>
  );
}