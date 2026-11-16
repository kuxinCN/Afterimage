"use client";

import { SCENE_TYPE_LABELS } from "@/lib/constants";
import { hotspotLayout } from "@/services/scene/sceneTemplates";

// Warm, low-contrast palettes. The background is painted, never a user photo:
// placing a hotspot on a real picture would assert a position we cannot know.
const TEMPLATE_PALETTES = {
  cafeteria: {
    wall: "from-[#40291a] via-[#6b4526] to-[#a9713a]",
    floor: "from-[#54371f] to-[#2b1c11]",
    glow: "rgba(255, 205, 140, 0.30)",
  },
  classroom: {
    wall: "from-[#3b2c1e] via-[#6a5230] to-[#a08149]",
    floor: "from-[#4e3d24] to-[#291f13]",
    glow: "rgba(255, 226, 170, 0.26)",
  },
  bedroom: {
    wall: "from-[#3a2620] via-[#6d4636] to-[#b07a55]",
    floor: "from-[#55382a] to-[#2a1a14]",
    glow: "rgba(255, 190, 150, 0.30)",
  },
  street: {
    wall: "from-[#33261c] via-[#5f452c] to-[#96703f]",
    floor: "from-[#463524] to-[#241a12]",
    glow: "rgba(255, 214, 150, 0.24)",
  },
  outdoor: {
    wall: "from-[#3d2f1c] via-[#7a5c2e] to-[#c09a4e]",
    floor: "from-[#5b4a26] to-[#2c2413]",
    glow: "rgba(255, 236, 180, 0.32)",
  },
  generic: {
    wall: "from-[#382a1e] via-[#63482e] to-[#9c7444]",
    floor: "from-[#4c3a26] to-[#271d14]",
    glow: "rgba(255, 210, 160, 0.26)",
  },
};

const FALLBACK_PALETTE = TEMPLATE_PALETTES.generic;

export function SceneCanvas({ scene, visitedHotspots = [], onHotspotClick }) {
  if (!scene) {
    return null;
  }

  const palette = TEMPLATE_PALETTES[scene.template] ?? FALLBACK_PALETTE;
  const visited = new Set(visitedHotspots);

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-[#e8b877]/20 bg-[#241a12] shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]">
      <div className={`absolute inset-0 bg-gradient-to-b ${palette.wall}`} />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(58% 42% at 50% 26%, ${palette.glow}, transparent 72%)`,
        }}
      />
      <div
        className={`absolute inset-x-0 bottom-0 h-[44%] bg-gradient-to-b ${palette.floor}`}
        style={{ clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)" }}
      />
      <div className="absolute inset-x-0 top-[56%] h-px bg-[#ffe0b0]/15" />
      <div className="absolute inset-x-[12%] top-[40%] h-px bg-[#ffe0b0]/10" />
      <div className="absolute inset-x-[6%] top-[70%] h-px bg-[#ffe0b0]/10" />

      <div className="absolute left-4 top-4 z-40 space-y-1">
        <p className="text-sm text-[#f6e7cd] drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
          {scene.title}
        </p>
        <p className="text-[11px] text-[#f0d9b5]/70">
          {SCENE_TYPE_LABELS[scene.template] ?? scene.template} · 第 {scene.version} 版
        </p>
      </div>

      {scene.hotspots.length === 0 ? (
        <p className="absolute inset-x-0 top-1/2 z-40 -translate-y-1/2 px-6 text-center text-xs text-[#f0d9b5]/70">
          这段记忆还没有确认过的物件，所以场景里暂时没有可探索的热点。
        </p>
      ) : null}

      {scene.hotspots.map((hotspot) => {
        const isVisited = visited.has(hotspot.id);
        const layout = hotspotLayout(hotspot.position, { visited: isVisited });

        // Markers are sized against the canvas, not in pixels: the tightest
        // template row leaves a 4% gap, so 3.4% can never overlap a neighbour.
        return (
          <button
            key={hotspot.id}
            type="button"
            onClick={() => onHotspotClick?.(hotspot.id)}
            aria-label={`热点 ${hotspot.name}${isVisited ? "，已探索" : ""}`}
            aria-pressed={isVisited}
            title={hotspot.description}
            style={layout}
            className={`group absolute flex aspect-square w-[3.4%] items-center justify-center rounded-full border backdrop-blur-[2px] transition duration-300 hover:border-[#ffd9a0] hover:shadow-[0_0_20px_rgba(255,205,140,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffd9a0] ${
              isVisited
                ? "border-[#e8b877]/30 bg-[#2a1d13]/70 text-[#f0c987]"
                : "border-[#ffd9a0]/70 bg-[#ffcf8f]/25 text-[#ffe6bd] shadow-[0_0_16px_rgba(255,190,120,0.45)]"
            }`}
          >
            <span aria-hidden="true" className="text-[10px] leading-none">
              {isVisited ? "✓" : "·"}
            </span>
            <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-[#1a120c]/90 px-2 py-0.5 text-[10px] text-[#f6e7cd] opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              {hotspot.name}
            </span>
          </button>
        );
      })}

      <p className="absolute bottom-3 left-4 z-40 text-[10px] text-[#f0d9b5]/55">
        模拟场景 · 热点位置为示意排布，不代表照片中的真实位置
      </p>
    </div>
  );
}