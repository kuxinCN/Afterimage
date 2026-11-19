export default function MemoryDetailLoading() {
  return (
    <main
      aria-busy="true"
      className="relative min-h-[calc(100vh-3.5rem)] overflow-x-clip bg-[#0b0a09] font-[family-name:var(--font-geist-sans)]"
    >
      <div className="relative mx-auto w-full max-w-4xl space-y-10 px-5 py-12 sm:px-8">
        <span className="sr-only">正在打开这段记忆…</span>
        <div className="skeleton h-4 w-28" />
        <div className="space-y-4">
          <div className="skeleton h-8 w-2/3" />
          <div className="skeleton h-3 w-1/2" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-5/6" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="skeleton h-52" />
          <div className="skeleton h-52" />
          <div className="skeleton h-52" />
        </div>
        <div className="skeleton h-40 w-full" />
      </div>
    </main>
  );
}