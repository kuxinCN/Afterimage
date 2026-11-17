import { BridgePreviewView } from "./BridgePreviewView";

export const metadata = {
  title: "A 场景联调沙箱（临时）· 余像 Afterimage",
};

export default function SceneBridgePreviewPage() {
  return (
    <main className="min-h-screen bg-[#0f0e0d] px-4 py-6 font-[family-name:var(--font-geist-sans)] text-[#e8e2d6]">
      <BridgePreviewView />
    </main>
  );
}