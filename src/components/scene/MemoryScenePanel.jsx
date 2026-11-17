"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AfterimageSceneBridge } from "@/components/afterimage/AfterimageSceneBridge";
import { HotspotDetailPanel } from "@/components/scene/HotspotDetailPanel";
import { SceneCanvas } from "@/components/scene/SceneCanvas";
import { ERROR_CODES, MEMORY_STATUS } from "@/lib/constants";
import { generateScene } from "@/services/ai/aiService";
import { readScene, visitHotspot } from "@/services/scene/sceneService";

const SCENE_MESSAGES = {
  [ERROR_CODES.MEMORY_NOT_FOUND]: "找不到这段记忆，它可能已经被删除。",
  [ERROR_CODES.SCENE_NOT_FOUND]: "这段记忆还没有场景。",
  [ERROR_CODES.SCENE_NOT_CONFIRMED]: "请先在上方确认整理结果，再生成场景。",
  [ERROR_CODES.SCENE_INVALID_RESULT]: "生成的场景不符合约定的数据结构，已放弃保存。",
  [ERROR_CODES.SCENE_GENERATION_FAILED]: "生成场景时出错，请稍后重试。",
  [ERROR_CODES.SCENE_GENERATION_IN_PROGRESS]: "这段记忆正在生成场景，请稍候。",
  [ERROR_CODES.AI_PROVIDER_UNAVAILABLE]: "当前的模拟 Provider 不支持场景生成。",
  [ERROR_CODES.AI_INVALID_INPUT]: "生成场景所需的信息不完整。",
  [ERROR_CODES.VALIDATION_FAILED]: "场景里没有这个热点，请刷新后重试。",
  [ERROR_CODES.STORAGE_UNAVAILABLE]: "这个浏览器不允许本地存储，无法保存场景。",
  [ERROR_CODES.STORAGE_FAILED]: "本地数据读写失败，请刷新页面重试。",
};

const CONFIRMED_STATUSES = [MEMORY_STATUS.READY, MEMORY_STATUS.COMPLETED];

function messageFor(error, fallback) {
  return SCENE_MESSAGES[error?.code] ?? fallback;
}

// Opening the panel is always instant; only the persistence write is guarded.
// An already-visited hotspot is just re-viewed (no redundant write), and a write
// already in flight blocks extra saves so rapid clicks cannot race the store.
export function shouldRecordVisit(hotspotId, visitedHotspots, busy) {
  return Boolean(hotspotId) && !busy && !visitedHotspots.includes(hotspotId);
}

export function isExplorationComplete(hotspots, visitedHotspots) {
  return hotspots.length > 0 && hotspots.every((hotspot) => visitedHotspots.includes(hotspot.id));
}

export function MemoryScenePanel({ memoryId }) {
  const [state, setState] = useState({
    status: "loading",
    memory: null,
    scene: null,
    visitedHotspots: [],
  });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Experimental parallel renderer for A's MemorySpace; C's canvas stays default.
  const [renderer, setRenderer] = useState("canvas");
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    const next = await readScene(memoryId);

    setState({ status: "ready", ...next });
  }, [memoryId]);

  useEffect(() => {
    let active = true;

    readScene(memoryId)
      .then((next) => {
        if (active) {
          setState({ status: "ready", ...next });
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(messageFor(loadError, "读取本地场景时出错。"));
          setState((current) => ({ ...current, status: "error" }));
        }
      });

    return () => {
      active = false;
    };
  }, [memoryId]);

  async function handleGenerate() {
    setBusy("generate");
    setError(null);

    try {
      await generateScene(memoryId);
      await load();
    } catch (generateError) {
      setError(messageFor(generateError, "生成场景时出错，请稍后重试。"));
    } finally {
      setBusy(null);
    }
  }

  async function handleHotspotClick(hotspotId) {
    // Selection is instant and never blocked, so the fragment is readable even
    // while a previous save is still settling.
    setSelectedId(hotspotId);
    setReviewOpen(false);

    if (!shouldRecordVisit(hotspotId, state.visitedHotspots, busyRef.current)) {
      return;
    }

    busyRef.current = true;
    setBusy(hotspotId);
    setError(null);

    try {
      const { visitedHotspots } = await visitHotspot(memoryId, hotspotId);

      setState((current) => ({ ...current, visitedHotspots }));
    } catch (visitError) {
      // Visited state is left untouched: a failed save must not look explored.
      setError(messageFor(visitError, "记录探索进度失败，请重试。"));
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  function handleClosePanel() {
    setSelectedId(null);
  }

  // A's core scripts failed to load (or mountScene is unavailable): fall back to
  // C's canvas so the page stays usable. C canvas is never affected by A's failure.
  function handleRendererError() {
    setRenderer("canvas");
    setSelectedId(null);
    setError("A 空间渲染器加载失败，已自动切回 C 画布。");
  }

  function handleReviewAll() {
    setSelectedId(null);
    setReviewOpen(true);
  }

  async function handleRefresh() {
    setBusy("refresh");
    setError(null);

    try {
      await load();
    } catch (refreshError) {
      setError(messageFor(refreshError, "读取本地场景时出错。"));
    } finally {
      setBusy(null);
    }
  }

  if (state.status === "loading") {
    return <p className="text-sm text-[#8d8474]">正在从本地存储读取场景…</p>;
  }

  if (!state.memory) {
    return <p className="text-sm text-[#e0a98f]">{error ?? "这段记忆不存在。"}</p>;
  }

  const { memory, scene, visitedHotspots } = state;
  const isConfirmed = CONFIRMED_STATUSES.includes(memory.status);
  const visitedCount = scene
    ? scene.hotspots.filter((hotspot) => visitedHotspots.includes(hotspot.id)).length
    : 0;
  const selectedHotspot = scene?.hotspots.find((hotspot) => hotspot.id === selectedId) ?? null;
  const complete = scene ? isExplorationComplete(scene.hotspots, visitedHotspots) : false;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm text-[#c9c0b0]">2.5D 记忆场景</h2>
          <p className="text-xs text-[#8d8474]">
            {scene
              ? `已探索 ${visitedCount} / ${scene.hotspots.length} 个热点`
              : "还没有生成场景"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={busy !== null}
            className="rounded-full border border-[#3b2f2a] px-3 py-1 text-xs text-[#c9c0b0] hover:bg-[#1f1a17] disabled:opacity-50"
          >
            {busy === "refresh" ? "正在刷新…" : "刷新状态"}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy !== null || !isConfirmed}
            className="rounded-full border border-[#e8b877]/40 bg-[#2a1d13] px-4 py-1 text-xs text-[#f3e3c8] hover:bg-[#3a281a] disabled:opacity-50"
          >
            {busy === "generate" ? "正在生成…" : scene ? "重新生成场景" : "生成 2.5D 场景"}
          </button>
        </div>
      </header>

      {!isConfirmed ? (
        <p className="text-xs text-[#9a9082]">
          场景只根据你确认过的内容生成。请先在上方完成整理并点「确认并保存」，再回到这里。
        </p>
      ) : null}

      {error ? <p className="text-sm text-[#e0a98f]">{error}</p> : null}

      {scene ? (
        <>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="场景渲染器">
            <span className="text-xs text-[#8d8474]">渲染器：</span>
            <button
              type="button"
              onClick={() => setRenderer("canvas")}
              aria-pressed={renderer === "canvas"}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                renderer === "canvas"
                  ? "border-[#e8b877]/60 bg-[#2a1d13] text-[#f3e3c8]"
                  : "border-[#3b2f2a] text-[#9a9082] hover:bg-[#1f1a17]"
              }`}
            >
              C 画布
            </button>
            <button
              type="button"
              onClick={() => setRenderer("afterimage")}
              aria-pressed={renderer === "afterimage"}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                renderer === "afterimage"
                  ? "border-[#6fd6ff]/60 bg-[#10202e] text-[#cfeaff]"
                  : "border-[#3b2f2a] text-[#9a9082] hover:bg-[#1f1a17]"
              }`}
            >
              A 空间（实验）
            </button>
          </div>

          {renderer === "afterimage" ? (
            <AfterimageSceneBridge
              scene={scene}
              visitedHotspots={visitedHotspots}
              onHotspotClick={handleHotspotClick}
              selectedHotspotId={selectedId}
              onSelectedChange={setSelectedId}
              onMountError={handleRendererError}
            />
          ) : (
            <SceneCanvas
              scene={scene}
              visitedHotspots={visitedHotspots}
              onHotspotClick={handleHotspotClick}
              selectedHotspotId={selectedId}
            />
          )}
          {scene.hotspots.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {scene.hotspots.map((hotspot) => {
                const isVisited = visitedHotspots.includes(hotspot.id);
                const isSelected = hotspot.id === selectedId;

                return (
                  <li key={hotspot.id}>
                    <button
                      type="button"
                      onClick={() => handleHotspotClick(hotspot.id)}
                      aria-pressed={isVisited}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                        isSelected ? "ring-2 ring-[#ffd9a0]/60 ring-offset-1 ring-offset-[#0f0e0d]" : ""
                      } ${
                        isVisited
                          ? "border-[#e8b877]/25 bg-[#1f1a17] text-[#a89878]"
                          : "border-[#e8b877]/40 bg-[#2a1d13] text-[#f3e3c8] hover:bg-[#3a281a]"
                      }`}
                    >
                      <span aria-hidden="true">{isVisited ? "✓" : "○"}</span>
                      {hotspot.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {selectedHotspot && !reviewOpen ? (
            <HotspotDetailPanel
              hotspot={selectedHotspot}
              visited={visitedHotspots.includes(selectedHotspot.id)}
              onClose={handleClosePanel}
              className="animate-panel-in"
            />
          ) : null}

          {complete ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#7fb069]/30 bg-[#141f0f] px-4 py-3">
              <p className="text-sm text-[#bfe3a8]">
                你已经走完这段记忆里的 {scene.hotspots.length} 个细节。
              </p>
              <button
                type="button"
                onClick={handleReviewAll}
                className="min-h-[36px] rounded-full border border-[#7fb069]/40 px-4 text-xs text-[#bfe3a8] transition-colors hover:bg-[#1c2a18]"
              >
                重新浏览所有碎片
              </button>
            </div>
          ) : null}

          {reviewOpen ? (
            <section className="space-y-3">
              <header className="flex items-center justify-between gap-3">
                <h3 className="text-sm text-[#c9c0b0]">所有记忆碎片</h3>
                <button
                  type="button"
                  onClick={() => setReviewOpen(false)}
                  className="min-h-[32px] rounded-full border border-[#3a342c] px-3 text-xs text-[#9a9082] transition-colors hover:bg-[#1f1c18]"
                >
                  收起
                </button>
              </header>
              {scene.hotspots.map((hotspot) => (
                <HotspotDetailPanel
                  key={hotspot.id}
                  hotspot={hotspot}
                  visited={visitedHotspots.includes(hotspot.id)}
                />
              ))}
            </section>
          ) : null}

          <p className="text-xs leading-relaxed text-[#8d8474]">
            场景由 Mock Provider 模拟排布，没有读取照片像素：物件名称来自你确认的内容，位置只是示意。
            点一个热点即可查看它的细节并标记「我探索过它」，进度会保存在本地，重新生成场景也不会丢失。
          </p>
        </>
      ) : (
        <p className="rounded-xl border border-[#2c2822] bg-[#141210] px-4 py-6 text-center text-xs text-[#7c7466]">
          {isConfirmed
            ? "点「生成 2.5D 场景」，把确认过的物件排布成一个可探索的暖色空间。"
            : "确认整理结果之后，这里会出现一个可探索的暖色空间。"}
        </p>
      )}
    </section>
  );
}