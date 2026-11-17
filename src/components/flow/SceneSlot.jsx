// A reserved seat for A's visual component, not the component itself. Whatever
// A builds should accept { scene, visitedHotspots, onHotspotClick } and be passed
// in as children; until then this renders an honest empty box and claims nothing.
export function SceneSlot({ children, label = "2.5D 场景" }) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-[#2c2822] bg-[#141210]">
      {children ?? (
        <div className="flex h-56 w-full flex-col items-center justify-center gap-2 border border-dashed border-[#3a342c] px-6 text-center sm:h-72">
          <p className="text-sm text-[#9a9082]">{label}组件占位</p>
          <p className="text-xs leading-relaxed text-[#6b6459]">
            等待 A 的视觉组件接入。这里目前不渲染任何场景内容，也不代表记忆中的真实画面。
          </p>
        </div>
      )}
    </div>
  );
}