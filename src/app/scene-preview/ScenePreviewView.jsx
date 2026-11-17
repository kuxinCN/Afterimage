"use client";

// 临时预览页：仅用于在 Next 开发浏览器里查看 A 的场景组件渲染与交互。
// 不属于故事主线，不读写 StoryContext / sessionStorage / IndexedDB；
// 外部「持久化」用浏览器内存模拟。可随时整目录删除。A 文件原样引用，未修改。
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import AfterimageMemoryScene from "../../../vendor/afterimage-a/integrations/react/AfterimageMemoryScene";

const SCENE_OPTIONS = [
  { key: "calm", label: "calm · 5 热点" },
  { key: "revisit", label: "revisit · 第 2 版" },
  { key: "edge", label: "edge · 边界用例" },
  { key: "empty", label: "empty · 空场景" },
];

const SOURCE_LEGEND = [
  { type: "user_confirmed", label: "用户确认" },
  { type: "image_observed", label: "图片可见" },
  { type: "ai_inferred", label: "AI 推测" },
  { type: "fictional", label: "想象内容" },
];

export function ScenePreviewView() {
  const [scenes, setScenes] = useState(null);
  const [sceneKey, setSceneKey] = useState("calm");
  const [visited, setVisited] = useState([]);
  const [issues, setIssues] = useState([]);
  const [log, setLog] = useState([]);
  const [failRecord, setFailRecord] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await import("../../../vendor/afterimage-a/data/mock-scene.js");
      if (cancelled) {
        return;
      }
      const mock = window.AFTERIMAGE_MOCK_SCENES;
      setScenes(mock);
      setVisited(mock.initialVisited || []);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const pushLog = useCallback((text) => {
    setLog((current) => [text, ...current].slice(0, 30));
  }, []);

  const handleHotspotClick = useCallback(
    (id) => {
      pushLog(`用户点击碎片 → onHotspotClick(${id})`);
      if (failRecord) {
        pushLog("模拟外部记录失败：不回灌、不显示已探索（A 不做乐观标记）");
        return;
      }
      setVisited((current) => (current.includes(id) ? current : [...current, id]));
      pushLog(`外部已记录 ${id} → 回灌 visitedHotspots，界面显示已探索`);
    },
    [failRecord, pushLog],
  );

  const handleIssues = useCallback((next) => {
    setIssues((current) => [...next, ...current].slice(0, 40));
  }, []);

  function switchScene(key) {
    setSceneKey(key);
    pushLog(`程序数据更新 update()：scene=${key}（不触发用户点击）`);
  }

  function resetVisited() {
    setVisited([]);
    pushLog("重置外部探索（程序 setVisited，不触发用户点击）");
  }

  const scene = scenes ? scenes[sceneKey] : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-8 sm:py-12">
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#8d8474]">
        <Link href="/" className="hover:text-[#e6ddce]">
          首页
        </Link>
        <Link href="/story" className="hover:text-[#e6ddce]">
          故事页
        </Link>
        <span>临时预览 · 非主线</span>
      </nav>

      <header className="space-y-3">
        <h1 className="text-2xl text-[#efe7d8] sm:text-3xl">A 场景组件 · 临时预览</h1>
        <p className="rounded-xl border border-[#e8b87755] bg-[#2a1d13] px-4 py-3 text-xs leading-relaxed text-[#f0d9b5]">
          模拟数据 / 虚构示例 · 未接入真实 AI · 未与 C 故事主线联调。本页仅用于查看 A
          的视觉组件在 Next 中的渲染与交互；外部「持久化」为浏览器内存模拟，非 IndexedDB。
          推测 / 虚构不会被标成用户确认。本目录可随时删除，不影响故事流程。
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        {SCENE_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => switchScene(option.key)}
            className={`min-h-[36px] rounded-full border px-4 text-xs transition-colors ${
              sceneKey === option.key
                ? "border-[#e6d5b0] bg-[#e6d5b0] text-[#1a1712]"
                : "border-[#2c2822] bg-[#141210] text-[#c9c0b0] hover:border-[#3a342c]"
            }`}
          >
            {option.label}
          </button>
        ))}
        <label className="ml-2 inline-flex items-center gap-2 text-xs text-[#9a9082]">
          <input
            type="checkbox"
            checked={failRecord}
            onChange={(event) => setFailRecord(event.target.checked)}
            className="h-4 w-4 accent-[#e6d5b0]"
          />
          模拟外部记录失败
        </label>
        <button
          type="button"
          onClick={resetVisited}
          className="min-h-[36px] rounded-full border border-[#2c2822] bg-[#141210] px-4 text-xs text-[#c9c0b0] transition-colors hover:border-[#3a342c]"
        >
          重置外部探索
        </button>
      </section>

      <section className="w-full">
        {scene ? (
          <AfterimageMemoryScene
            scene={scene}
            visitedHotspots={visited}
            onHotspotClick={handleHotspotClick}
            onIssues={handleIssues}
            exploreOn="open"
            className="w-full"
          />
        ) : (
          <div className="flex h-72 w-full items-center justify-center rounded-2xl border border-dashed border-[#3a342c] bg-[#141210] text-sm text-[#8d8474]">
            正在加载 A 核心脚本与 mock 场景…
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs text-[#8d8474]">外部已探索（内存模拟持久化结果）</h2>
        <div className="flex flex-wrap gap-2">
          {visited.length === 0 ? (
            <span className="rounded-full border border-[#2c2822] px-3 py-1 text-xs text-[#6b6459]">
              （无）
            </span>
          ) : (
            visited.map((id) => (
              <span
                key={id}
                className="rounded-full border border-[#2c2822] bg-[#141210] px-3 py-1 text-xs text-[#c9c0b0]"
              >
                {id}
              </span>
            ))
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs text-[#8d8474]">来源图例（保留四类，不升级）</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#9a9082]">
          {SOURCE_LEGEND.map((item) => (
            <span key={item.type}>
              {item.label}
              <span className="ml-1 text-[#6b6459]">{item.type}</span>
            </span>
          ))}
        </div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-xs text-[#8d8474]">适配降级 / 跳过报告（{issues.length}）</h2>
          <ul className="max-h-48 space-y-1 overflow-auto rounded-xl border border-[#2c2822] bg-[#0a0d16] px-3 py-2 text-[11px] leading-relaxed text-[#9a9082]">
            {issues.length === 0 ? (
              <li className="text-[#6b6459]">（无）</li>
            ) : (
              issues.map((issue, index) => (
                <li key={`${index}-${issue.code}`}>
                  [{issue.code}] {issue.message}
                  {issue.hotspotId ? ` (${issue.hotspotId})` : ""}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs text-[#8d8474]">事件日志（用户 vs 程序 vs 外部）</h2>
          <ul className="max-h-48 space-y-1 overflow-auto rounded-xl border border-[#2c2822] bg-[#0a0d16] px-3 py-2 text-[11px] leading-relaxed text-[#9a9082]">
            {log.length === 0 ? (
              <li className="text-[#6b6459]">（点击碎片或切换场景后显示）</li>
            ) : (
              log.map((text, index) => <li key={`${index}-${text}`}>{text}</li>)
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}