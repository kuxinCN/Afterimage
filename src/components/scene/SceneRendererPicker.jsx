"use client";

// Formal scene-experience selector. Each option paints a miniature of the space
// it switches to: C's warm canvas direction, and A's delivered cool room
// (arched window, moon, lamp glow, dust, floating fragments) — not C's palette.
// Pure presentation: the owner keeps renderer state, sync and fallback logic.

const C_DOTS = [
  { left: "30%", top: "46%" },
  { left: "52%", top: "63%" },
  { left: "68%", top: "40%" },
];

const A_FRAGMENTS = [
  { left: "24%", top: "46%", delay: "0s", label: "旧照片" },
  { left: "42%", top: "64%", delay: "-2.2s", label: "票根" },
  { left: "58%", top: "38%", delay: "-4.1s", label: "字条" },
];

const A_MOTES = [
  { left: "30%", top: "72%", delay: "0s", duration: "6s" },
  { left: "52%", top: "60%", delay: "-2.4s", duration: "7s" },
  { left: "70%", top: "76%", delay: "-4.6s", duration: "5.5s" },
];

const A_STARS = [
  "radial-gradient(1.5px 1.5px at 18% 24%, rgba(255,255,255,0.9) 50%, transparent 51%)",
  "radial-gradient(1px 1px at 34% 12%, rgba(255,255,255,0.7) 50%, transparent 51%)",
  "radial-gradient(1.5px 1.5px at 12% 52%, rgba(255,255,255,0.6) 50%, transparent 51%)",
  "radial-gradient(1px 1px at 44% 40%, rgba(255,255,255,0.75) 50%, transparent 51%)",
  "radial-gradient(1px 1px at 80% 60%, rgba(255,255,255,0.55) 50%, transparent 51%)",
].join(", ");

function CanvasPreview({ dimmed }) {
  return (
    <div
      aria-hidden="true"
      data-preview="canvas"
      className={`relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-[#e8b877]/20 bg-[#241a12] transition duration-300 ${
        dimmed ? "brightness-[.82] saturate-[.85] group-hover:brightness-100 group-hover:saturate-100" : ""
      }`}
    >
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, #3b2c1e 0%, #6a5230 52%, #a08149 100%)" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(58% 42% at 50% 26%, rgba(255,226,170,0.26), transparent 72%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[44%]"
        style={{
          background: "linear-gradient(180deg, #4e3d24, #291f13)",
          clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
        }}
      />
      <div className="absolute inset-x-0 top-[56%] h-px bg-[#ffe0b0]/15" />
      <div className="absolute inset-x-[12%] top-[40%] h-px bg-[#ffe0b0]/10" />
      {C_DOTS.map((dot) => (
        <span
          key={`${dot.left}-${dot.top}`}
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ffd9a0]/70 bg-[#ffcf8f]/25 shadow-[0_0_10px_rgba(255,190,120,0.45)]"
          style={dot}
        />
      ))}
    </div>
  );
}

function SpacePreview({ dimmed }) {
  return (
    <div
      aria-hidden="true"
      data-preview="afterimage"
      className={`relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-[rgba(111,214,255,0.22)] transition duration-300 ${
        dimmed ? "brightness-[.82] saturate-[.85] group-hover:brightness-100 group-hover:saturate-100" : ""
      }`}
      style={{ background: "linear-gradient(180deg, #0e1730 0%, #070b16 100%)" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(90deg, rgba(111,214,255,0.05) 0 2px, transparent 2px 44px), radial-gradient(120% 90% at 70% 0%, #1b2a4a 0%, #16203c 46%, #070b16 100%)",
        }}
      />
      <div
        className="picker-breathe absolute left-[52%] top-[12%] h-[88%] w-[46%]"
        style={{
          background:
            "linear-gradient(200deg, rgba(111,214,255,0.45) 0%, rgba(111,214,255,0.08) 46%, transparent 78%)",
          clipPath: "polygon(28% 0, 62% 0, 100% 100%, 2% 100%)",
        }}
      />
      <div
        className="picker-breathe absolute bottom-[-18%] left-[-12%] h-[70%] w-[62%]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,180,84,0.5) 0%, rgba(255,180,84,0.12) 52%, transparent 76%)",
          animationDelay: "-3.5s",
        }}
      />
      <div
        className="absolute left-[63%] top-[7%] aspect-[3/3.8] w-[21%] overflow-hidden"
        style={{
          borderRadius: "46% 46% 10px 10px / 34% 34% 10px 10px",
          border: "2px solid #0d1425",
          background: "linear-gradient(180deg, #0b1a3a 0%, #14294e 55%, #1d3a63 100%)",
          boxShadow: "0 0 18px rgba(111,214,255,0.45), inset 0 0 12px rgba(0,0,0,0.55)",
        }}
      >
        <span
          className="absolute left-[56%] top-[16%] aspect-square w-[30%] rounded-full"
          style={{
            background: "radial-gradient(circle at 38% 34%, #fff8e3 0%, #ffe9b0 52%, #e8c987 100%)",
            boxShadow: "0 0 12px rgba(255,233,176,0.8)",
          }}
        />
        <span className="picker-twinkle absolute inset-0" style={{ backgroundImage: A_STARS }} />
        <span
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent calc(50% - 1px), #0d1425 calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)), linear-gradient(0deg, transparent calc(56% - 1px), #0d1425 calc(56% - 1px) calc(56% + 1px), transparent calc(56% + 1px))",
          }}
        />
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-[21%]"
        style={{
          background: "linear-gradient(180deg, #101a33 0%, #0a0f1f 34%, #04060d 100%)",
          borderTop: "1px solid rgba(255,255,255,0.09)",
        }}
      />
      {A_FRAGMENTS.map((fragment) => (
        <div
          key={fragment.label}
          className="absolute w-[16%] -translate-x-1/2 -translate-y-1/2"
          style={{ left: fragment.left, top: fragment.top }}
        >
          <div className="picker-float" style={{ animationDelay: fragment.delay }}>
            <span
              className="block aspect-[3/4] w-full rounded-md border border-[rgba(111,214,255,0.35)]"
              style={{
                background: "linear-gradient(180deg, rgba(23,32,60,0.95), rgba(13,20,40,0.92))",
                boxShadow: "0 4px 10px rgba(0,0,0,0.55), 0 0 8px rgba(111,214,255,0.45)",
              }}
            >
              <span
                className="mx-auto mt-[18%] block h-[34%] w-[46%] rounded-sm"
                style={{
                  background:
                    "radial-gradient(circle at 40% 35%, rgba(255,233,176,0.9), rgba(255,180,84,0.35) 70%, transparent)",
                }}
              />
            </span>
            <span className="mx-auto mt-1 block w-[86%] truncate rounded-full border border-white/10 bg-[rgba(4,7,15,0.62)] px-1 text-center text-[8px] leading-[1.5] text-[#eef2fc]/80">
              {fragment.label}
            </span>
          </div>
        </div>
      ))}
      {A_MOTES.map((mote) => (
        <span
          key={`${mote.left}-${mote.top}`}
          className="picker-mote h-[3px] w-[3px]"
          style={{
            left: mote.left,
            top: mote.top,
            animationDelay: mote.delay,
            animationDuration: mote.duration,
          }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(120% 100% at 50% 42%, transparent 52%, rgba(2,4,10,0.62) 100%)",
        }}
      />
    </div>
  );
}

const OPTIONS = [
  {
    value: "canvas",
    name: "C 画布",
    hint: "暖色画布 · 热点示意排布",
    Preview: CanvasPreview,
    selectedClass:
      "border-[#e8b877]/60 bg-[#1d1712] shadow-[0_16px_44px_-18px_rgba(232,184,119,0.45)] focus-visible:outline-[#ffd9a0]",
    badgeClass: "text-[#e6d5b0]",
    dotClass: "bg-[#e6d5b0] shadow-[0_0_8px_rgba(230,213,176,0.8)]",
  },
  {
    value: "afterimage",
    name: "A 空间",
    hint: "冷色房间 · 月光与漂浮碎片",
    Preview: SpacePreview,
    selectedClass:
      "border-[#6fd6ff]/50 bg-[#0d1424] shadow-[0_16px_44px_-18px_rgba(111,214,255,0.4)] focus-visible:outline-[#6fd6ff]",
    badgeClass: "text-[#cfeaff]",
    dotClass: "bg-[#6fd6ff] shadow-[0_0_8px_rgba(111,214,255,0.8)]",
  },
];

export function SceneRendererPicker({ value, onChange }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-[#8d8474]">场景体验 · 点选切换渲染空间</p>
      <div role="group" aria-label="场景渲染器" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map(({ value: option, name, hint, Preview, selectedClass, badgeClass, dotClass }) => {
          const selected = value === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={selected}
              className={`group relative block w-full rounded-2xl border p-2 text-left transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-3 ${
                selected
                  ? selectedClass
                  : "border-[#33302a] bg-[rgba(20,18,16,0.6)] hover:-translate-y-0.5 hover:border-[#4a443a] hover:shadow-[0_14px_36px_-18px_rgba(0,0,0,0.8)] focus-visible:outline-[#8d8474]"
              }`}
            >
              <Preview dimmed={!selected} />
              <span className="mt-2 flex items-center justify-between gap-2 px-1">
                <span className="block space-y-0.5">
                  <span className="block text-sm text-[#f2ebdd]">{name}</span>
                  <span className="block text-[11px] text-[#8d8474]">{hint}</span>
                </span>
                {selected ? (
                  <span className={`flex shrink-0 items-center gap-1.5 text-[11px] ${badgeClass}`}>
                    <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                    使用中
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] text-[#6b6459] transition-colors group-hover:text-[#9a9082]">
                    点按切换
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}