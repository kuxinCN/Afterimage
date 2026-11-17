"use client";

// TEMPORARY integration sandbox (deletable). Verifies A's MemorySpace against C's
// contract with fixture data: 8/9/24 layout, update semantics, provenance variety,
// unmount cleanup and overlap measurement. Fixture hotspots are 虚构示例, NOT real
// memories — the four source types are shown only to exercise badge mapping.
import { useCallback, useMemo, useState } from "react";

import { AfterimageSceneBridge } from "@/components/afterimage/AfterimageSceneBridge";
import { SceneCanvas } from "@/components/scene/SceneCanvas";
import { SOURCE_TYPES } from "@/lib/constants";
import { hotspotIdFor } from "@/services/scene/sceneTemplates";

const SOURCE_CYCLE = [
  SOURCE_TYPES.USER_CONFIRMED,
  SOURCE_TYPES.AI_INFERRED,
  SOURCE_TYPES.IMAGE_OBSERVED,
  SOURCE_TYPES.FICTIONAL,
];

function buildFixture(count) {
  const hotspots = Array.from({ length: count }, (_, index) => {
    const name = `示例碎片 ${index + 1}`;
    return {
      id: hotspotIdFor(name),
      name,
      type: "object",
      // Deliberately dense C-style coordinates: the bridge must re-project them.
      position: { x: 0.5 + (index % 6) * 0.04 - 0.1, y: 0.24 + Math.floor(index / 6) * 0.18 },
      description: `这是第 ${index + 1} 个示例碎片的描述（虚构演示数据）。`,
      sourceType: SOURCE_CYCLE[index % SOURCE_CYCLE.length],
      sourceIds: [`src-${index}`],
    };
  });

  return {
    id: "sandbox-scene",
    memoryId: "sandbox-memory",
    template: "generic",
    title: "联调示例场景",
    version: 1,
    hotspots,
  };
}

export function BridgePreviewView() {
  const [count, setCount] = useState(8);
  const [scene, setScene] = useState(() => buildFixture(8));
  const [visited, setVisited] = useState([]);
  const [failMode, setFailMode] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [stateReport, setStateReport] = useState(null);
  const [issues, setIssues] = useState([]);
  const [overlap, setOverlap] = useState(null);

  const chooseCount = useCallback((next) => {
    setCount(next);
    setScene(buildFixture(next));
    setVisited([]);
    setOpenId(null);
    setError(null);
    setOverlap(null);
  }, []);

  // Mirrors C's visit semantics: explored only on a successful write.
  const handleHotspotClick = useCallback(
    (id) => {
      setError(null);
      if (failMode) {
        setError("模拟记录失败：未写入探索态（不应显示已探索）。");
        return;
      }
      setVisited((current) => (current.includes(id) ? current : [...current, id]));
    },
    [failMode],
  );

  // Scene content update that KEEPS every hotspot id, so an open fragment must
  // stay open (A preserveOpen) rather than close without reason.
  const updateSceneContent = useCallback(() => {
    setScene((current) => ({
      ...current,
      version: current.version + 1,
      hotspots: current.hotspots.map((hotspot, index) =>
        index === current.hotspots.length - 1
          ? { ...hotspot, description: `${hotspot.description}（内容已更新）` }
          : hotspot,
      ),
    }));
  }, []);

  // Visited-only backfill: scene reference unchanged → A must not rebuild.
  const backfillVisitedOnly = useCallback(() => {
    setVisited((current) => {
      const next = scene.hotspots.find((hotspot) => !current.includes(hotspot.id));
      return next ? [...current, next.id] : current;
    });
  }, [scene]);

  const measureOverlap = useCallback(() => {
    const cards = Array.from(document.querySelectorAll(".a-bridge .mf"));
    const rects = cards.map((card) => card.getBoundingClientRect());
    let pairs = 0;
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i];
        const b = rects[j];
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (x > 1 && y > 1) pairs += 1;
      }
    }
    setOverlap({ cards: cards.length, overlappingPairs: pairs });
  }, []);

  const visitedCount = useMemo(
    () => scene.hotspots.filter((hotspot) => visited.includes(hotspot.id)).length,
    [scene, visited],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="space-y-1">
        <h1 className="text-lg text-[#f3e3c8]">A 场景模块联调沙箱（临时验证入口）</h1>
        <p className="text-xs text-[#9a9082]">
          下方为虚构示例数据，仅用于验证布局 / 更新语义 / 来源徽标 / 卸载，非真实记忆。
          左：C 原始 SceneCanvas（密集坐标）。右：A MemorySpace（经 C 适配层网格投影）。
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[#8d8474]">热点数：</span>
        {[8, 9, 24].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => chooseCount(n)}
            aria-pressed={count === n}
            className={`rounded-full border px-3 py-1 ${
              count === n
                ? "border-[#e8b877]/60 bg-[#2a1d13] text-[#f3e3c8]"
                : "border-[#3b2f2a] text-[#9a9082] hover:bg-[#1f1a17]"
            }`}
          >
            {n}
          </button>
        ))}
        <button type="button" onClick={updateSceneContent} className="rounded-full border border-[#3b2f2a] px-3 py-1 text-[#c9c0b0] hover:bg-[#1f1a17]">
          更新场景内容（保留 id）
        </button>
        <button type="button" onClick={backfillVisitedOnly} className="rounded-full border border-[#3b2f2a] px-3 py-1 text-[#c9c0b0] hover:bg-[#1f1a17]">
          仅回灌探索态
        </button>
        <button type="button" onClick={measureOverlap} className="rounded-full border border-[#6fd6ff]/40 px-3 py-1 text-[#cfeaff] hover:bg-[#10202e]">
          测量 A 碎片重叠
        </button>
        <label className="flex items-center gap-1 text-[#9a9082]">
          <input type="checkbox" checked={failMode} onChange={(e) => setFailMode(e.target.checked)} />
          模拟记录失败
        </label>
        <label className="flex items-center gap-1 text-[#9a9082]">
          <input type="checkbox" checked={mounted} onChange={(e) => setMounted(e.target.checked)} />
          挂载 A 组件
        </label>
      </section>

      <p className="text-xs text-[#c9c0b0]">
        已探索 {visitedCount} / {scene.hotspots.length} · 当前打开碎片：{openId ?? "无"} · 场景版本 {scene.version}
      </p>
      {error ? <p className="text-xs text-[#e0a98f]">{error}</p> : null}
      {overlap ? (
        <p id="overlap-report" className="text-xs text-[#bfe3a8]">
          A 碎片数 {overlap.cards} · 重叠对数 {overlap.overlappingPairs}
        </p>
      ) : null}
      {stateReport ? (
        <pre id="state-report" className="overflow-x-auto rounded-lg border border-[#2c2822] bg-[#141210] p-2 text-[11px] text-[#a89878]">
          {JSON.stringify(stateReport)}
        </pre>
      ) : null}
      {issues.length ? (
        <pre id="issue-report" className="overflow-x-auto rounded-lg border border-[#2c2822] bg-[#141210] p-2 text-[11px] text-[#a89878]">
          {JSON.stringify(issues.map((issue) => issue.code))}
        </pre>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-xs text-[#8d8474]">C · SceneCanvas（原始密集坐标）</h2>
          <SceneCanvas scene={scene} visitedHotspots={visited} onHotspotClick={handleHotspotClick} />
        </section>
        <section className="space-y-2">
          <h2 className="text-xs text-[#8d8474]">A · MemorySpace（适配层投影）</h2>
          {mounted ? (
            <AfterimageSceneBridge
              scene={scene}
              visitedHotspots={visited}
              onHotspotClick={handleHotspotClick}
              showPanel
              onFragmentOpen={(data) => setOpenId(data.id)}
              onFragmentClose={() => setOpenId(null)}
              onStateChange={setStateReport}
              onIssues={setIssues}
            />
          ) : (
            <p className="rounded-xl border border-[#2c2822] bg-[#141210] px-4 py-6 text-center text-xs text-[#7c7466]">
              A 组件已卸载（验证清理）。
            </p>
          )}
        </section>
      </div>
    </div>
  );
}