import { MemoryIndex } from "@/components/memory/MemoryIndex";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0f0e0d] font-[family-name:var(--font-geist-sans)]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-44 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(230,213,176,0.10),transparent)] blur-2xl" />
        <div className="absolute -bottom-52 -right-32 h-[460px] w-[460px] rounded-full bg-[radial-gradient(closest-side,rgba(224,169,143,0.07),transparent)] blur-2xl" />
        <div className="afterimage-grain absolute inset-0" />
      </div>
      <div className="relative mx-auto w-full max-w-5xl px-5 py-12 sm:px-8">
        <MemoryIndex />
      </div>
    </main>
  );
}