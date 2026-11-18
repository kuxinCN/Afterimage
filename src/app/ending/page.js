import { PageAtmosphere } from "@/components/visual/PageAtmosphere";

import { EndingView } from "./EndingView";

export const metadata = {
  title: "结尾 · 余像 Afterimage",
};

export default function EndingPage() {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#0b0a09] font-[family-name:var(--font-geist-sans)]">
      <PageAtmosphere tone="story" />
      <EndingView />
    </main>
  );
}