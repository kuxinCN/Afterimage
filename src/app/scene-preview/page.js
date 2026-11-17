import "../../../vendor/afterimage-a/styles/memory-space.css";
import "../../../vendor/afterimage-a/styles/memory-fragment.css";
import { ScenePreviewView } from "./ScenePreviewView";

export const metadata = {
  title: "场景预览（临时）· 余像 Afterimage",
};

export default function ScenePreviewPage() {
  return (
    <main className="min-h-screen bg-[#0f0e0d] font-[family-name:var(--font-geist-sans)]">
      <ScenePreviewView />
    </main>
  );
}