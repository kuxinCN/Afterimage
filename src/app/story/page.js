import { PageAtmosphere } from "@/components/visual/PageAtmosphere";

import { StoryView } from "./StoryView";

export const metadata = {
  title: "故事 · 余像 Afterimage",
};

export default function StoryPage() {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#0b0a09] font-[family-name:var(--font-geist-sans)]">
      <PageAtmosphere tone="story" />
      <StoryView />
    </main>
  );
}