"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AnalysisItemEditor } from "@/components/ai/AnalysisItemEditor";
import {
  ANALYSIS_QUALITY_LABELS,
  ERROR_CODES,
  MEMORY_STATUS,
  SCENE_TYPE_LABELS,
  SCENE_TYPE_LIST,
  SOURCE_TYPES,
} from "@/lib/constants";
import {
  analyzeMemory,
  confirmAnalysis,
  readAnalysis,
  saveAnalysisDraft,
} from "@/services/ai/aiService";

const PANEL_MESSAGES = {
  [ERROR_CODES.MEMORY_NOT_FOUND]: "这段记忆已经不存在了，请回到创建页面。",
  [ERROR_CODES.STORAGE_UNAVAILABLE]: "这个浏览器不允许本地存储，无法整理记忆。",
  [ERROR_CODES.AI_PROVIDER_UNAVAILABLE]: "没有可用的整理服务。",
  [ERROR_CODES.AI_ANALYSIS_IN_PROGRESS]: "这段记忆正在整理中，请稍候。",
  [ERROR_CODES.AI_INVALID_INPUT]: "这段记忆的内容还不足以开始整理。",
  [ERROR_CODES.AI_INVALID_RESULT]: "整理结果不符合约定格式，已放弃保存这次结果。",
  [ERROR_CODES.AI_ANALYSIS_FAILED]: "整理失败，稍后重试。",
  [ERROR_CODES.AI_ANALYSIS_NOT_FOUND]: "还没有可确认的整理结果。",
  [ERROR_CODES.VALIDATION_FAILED]: "有内容不符合要求，这次修改没有保存。",
};

function describeError(error) {
  return PANEL_MESSAGES[error?.code] ?? "操作没有成功，请重试。";
}

function editedText(value, adopted) {
  return {
    value,
    sourceType: SOURCE_TYPES.USER_CONFIRMED,
    confidence: 1,
    confirmed: true,
    adopted,
  };
}

function FactLine({ label, items = [] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      {label}：{items.map((item) => item.value).join("、")}
    </div>
  );
}

export function MemoryAnalysisPanel({ memoryId }) {
  const [memory, setMemory] = useState(null);
  const [draft, setDraft] = useState(null);
  const [phase, setPhase] = useState("loading");
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  // Event handlers fire before React commits the new state, so the freshest
  // draft lives in a ref and every persist reads from it.
  const draftRef = useRef(null);

  const replaceDraft = useCallback((next) => {
    draftRef.current = next;
    setDraft(next);

    return next;
  }, []);

  useEffect(() => {
    let active = true;

    readAnalysis(memoryId)
      .then(({ memory: loaded, draft: loadedDraft }) => {
        if (!active) {
          return;
        }

        setMemory(loaded);
        replaceDraft(loadedDraft);
        setPhase(loaded.status === MEMORY_STATUS.ANALYZING ? "stale" : "ready");
      })
      .catch((error) => {
        if (active) {
          setNotice(describeError(error));
          setPhase("error");
        }
      });

    return () => {
      active = false;
    };
  }, [memoryId, replaceDraft]);

  const commitDraft = useCallback(
    async (nextDraft = draftRef.current) => {
      if (!nextDraft) {
        return;
      }

      setSaving(true);

      try {
        const { memory: updated, draft: saved } = await saveAnalysisDraft(memoryId, nextDraft);

        setMemory(updated);
        replaceDraft(saved);
        setNotice(null);
      } catch (error) {
        setNotice(describeError(error));
      } finally {
        setSaving(false);
      }
    },
    [memoryId, replaceDraft],
  );

  async function handleAnalyze() {
    setNotice(null);
    setPhase("analyzing");

    try {
      const { memory: updated, draft: produced } = await analyzeMemory(memoryId);

      setMemory(updated);
      replaceDraft(produced);
      setPhase("reviewing");
    } catch (error) {
      setNotice(describeError(error));
      setPhase("ready");
    }
  }

  async function handleConfirm() {
    setNotice(null);
    setSaving(true);

    try {
      const { memory: updated } = await confirmAnalysis(memoryId, draftRef.current);

      setMemory(updated);
      setPhase("confirmed");
      setNotice("已保存你确认的内容。");
    } catch (error) {
      setNotice(describeError(error));
    } finally {
      setSaving(false);
    }
  }

  if (phase === "loading") {
    return <p className="text-sm text-[#8d8474]">正在读取整理状态…</p>;
  }

  const facts = memory?.facts ?? {};
  const isConfirmed = memory?.status === MEMORY_STATUS.READY;
  // The confirmed facts survive a re-analysis (only 确认并保存 rewrites them), so
  // this block follows the data instead of the status.
  const hasConfirmedFacts = Boolean(
    facts.summary ||
      [facts.objects, facts.times, facts.locations, facts.tags].some((items) => Boolean(items?.length)),
  );
  const busy = phase === "analyzing";
  const imageCountChanged = Boolean(draft && memory && draft.basedOn.imageCount !== memory.assetIds.length);

  return (
    <section className="space-y-6 rounded-2xl border border-[#2c2822] bg-[#121110] p-5 sm:p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg text-[#f2ebdd]">记忆整理</h2>
          <span className="rounded-full border border-amber-200/30 bg-amber-100/5 px-2 py-0.5 text-[11px] text-amber-100/80">
            模拟分析结果 · 尚未接入真实 AI
          </span>
        </div>
        <p className="text-xs leading-relaxed text-[#8d8474]">
          现在由 Mock Provider 按你填写的文字做关键词整理，它没有读取照片内容，也不会判断人物关系和情绪。每一条都需要你逐项确认。
        </p>
      </header>

      {!draft ? (
        <div className="space-y-3">
          <p className="text-sm text-[#c9c0b0]">
            {busy
              ? "正在整理这段记忆…"
              : "还没有整理结果。点一下按钮，把这段记忆里你写过的内容拆成可以逐条核对的条目。"}
          </p>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={busy}
            className="rounded-full bg-[#e6d5b0] px-5 py-2.5 text-sm text-[#1a1712] hover:bg-[#f2e3c0] disabled:cursor-wait disabled:bg-[#3a352c] disabled:text-[#8d8474]"
          >
            {busy ? "整理中…" : "开始整理记忆"}
          </button>
          {notice ? <p className="text-xs text-[#e0a98f]">{notice}</p> : null}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#8d8474]">
            <span>资料完整度：{ANALYSIS_QUALITY_LABELS[draft.quality]}</span>
            <span>
              依据：{draft.basedOn.imageCount} 张照片 · 描述 {draft.basedOn.descriptionLength} 字
            </span>
            <span>第 {draft.revision} 次整理</span>
            {isConfirmed ? <span className="text-emerald-200/70">已确认并保存</span> : null}
            {saving ? <span>正在保存草稿…</span> : null}
          </div>

          {imageCountChanged ? (
            <p className="rounded-lg border border-[#3b2f2a] bg-[#1a1513] px-3 py-2 text-xs text-[#d8b8a4]">
              照片数量与上次整理时不同（当时 {draft.basedOn.imageCount} 张，现在{" "}
              {memory.assetIds.length} 张），建议重新整理一次。
            </p>
          ) : null}

          {phase === "stale" ? (
            <p className="text-xs text-[#d8b8a4]">上次整理可能没有完成，当前显示的是上一次的结果。</p>
          ) : null}

          <div className="space-y-2">
            <h3 className="text-sm text-[#c9c0b0]">记忆摘要</h3>
            <textarea
              value={draft.summary?.value ?? ""}
              rows={3}
              disabled={busy}
              placeholder="没有描述可以整理，你可以直接写一句。"
              aria-label="记忆摘要"
              onChange={(event) => {
                const value = event.target.value;

                replaceDraft({
                  ...draft,
                  summary: value.trim()
                    ? {
                        // `baseline` keeps the provider wording so a later
                        // re-analysis can recognise this same entry.
                        baseline: value.trim(),
                        sourceIds: [],
                        ...draft.summary,
                        ...editedText(value, draft.summary?.adopted ?? true),
                      }
                    : null,
                });
              }}
              onBlur={() => commitDraft()}
              className="w-full resize-y rounded-xl border border-[#2c2822] bg-[#141210] px-3 py-2 text-sm text-[#e6ddce] placeholder:text-[#5f5950] focus:border-[#57503f] focus:outline-none"
            />
            {draft.summary ? (
              <label className="flex items-center gap-2 text-xs text-[#8d8474]">
                <input
                  type="checkbox"
                  checked={draft.summary.adopted}
                  disabled={busy}
                  onChange={(event) => {
                    const next = {
                      ...draft,
                      summary: { ...draft.summary, adopted: event.target.checked },
                    };

                    commitDraft(replaceDraft(next));
                  }}
                  className="h-4 w-4 accent-[#e6d5b0]"
                />
                采用这段摘要
              </label>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm text-[#c9c0b0]">场景类型</span>
              <select
                value={draft.scene?.type ?? ""}
                disabled={busy}
                onChange={(event) => {
                  const type = event.target.value;

                  if (!type) {
                    commitDraft(replaceDraft({ ...draft, scene: null }));
                    return;
                  }

                  const sameType = draft.scene?.type === type;
                  const label = SCENE_TYPE_LABELS[type] ?? type;

                  commitDraft(
                    replaceDraft({
                      ...draft,
                      scene: {
                        type,
                        title: sameType ? draft.scene.title : `${label}场景`,
                        sourceType: sameType
                          ? draft.scene.sourceType
                          : SOURCE_TYPES.USER_CONFIRMED,
                      },
                    }),
                  );
                }}
                className="w-full rounded-xl border border-[#2c2822] bg-[#141210] px-3 py-2.5 text-sm text-[#e6ddce] focus:border-[#57503f] focus:outline-none"
              >
                <option value="">未判断出来</option>
                {SCENE_TYPE_LIST.map((type) => (
                  <option key={type} value={type}>
                    {SCENE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-[#c9c0b0]">场景标题</span>
              <input
                value={draft.scene?.title ?? ""}
                disabled={busy || !draft.scene}
                aria-label="场景标题"
                onChange={(event) => {
                  const value = event.target.value;

                  replaceDraft({
                    ...draft,
                    scene: draft.scene
                      ? {
                          ...draft.scene,
                          title: value,
                          sourceType: SOURCE_TYPES.USER_CONFIRMED,
                        }
                      : draft.scene,
                  });
                }}
                onBlur={() => {
                  if (!draft.scene) {
                    return;
                  }

                  const label = SCENE_TYPE_LABELS[draft.scene.type] ?? draft.scene.type;
                  const title = draftRef.current.scene.title.trim() || `${label}场景`;

                  commitDraft(replaceDraft({ ...draft, scene: { ...draft.scene, title } }));
                }}
                className="w-full rounded-xl border border-[#2c2822] bg-[#141210] px-3 py-2.5 text-sm text-[#e6ddce] focus:border-[#57503f] focus:outline-none disabled:opacity-40"
              />
            </label>
          </div>

          <AnalysisItemEditor
            label="物品与元素"
            items={draft.elements}
            disabled={busy}
            addPlaceholder="补充一个你记得的物品"
            onChange={(elements, commit) => {
              const next = replaceDraft({ ...draft, elements });

              if (commit) {
                commitDraft(next);
              }
            }}
          />
          <AnalysisItemEditor
            label="时间线索"
            items={draft.times}
            disabled={busy}
            addPlaceholder="补充一个时间点"
            onChange={(times, commit) => {
              const next = replaceDraft({ ...draft, times });

              if (commit) {
                commitDraft(next);
              }
            }}
          />
          <AnalysisItemEditor
            label="地点线索"
            items={draft.places}
            disabled={busy}
            addPlaceholder="补充一个地点"
            onChange={(places, commit) => {
              const next = replaceDraft({ ...draft, places });

              if (commit) {
                commitDraft(next);
              }
            }}
          />
          <AnalysisItemEditor
            label="标签"
            items={draft.tags}
            disabled={busy}
            addPlaceholder="补充一个标签"
            onChange={(tags, commit) => {
              const next = replaceDraft({ ...draft, tags });

              if (commit) {
                commitDraft(next);
              }
            }}
          />

          {draft.missing.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-[#2a2620] bg-[#0f0e0d] p-3">
              <h3 className="text-sm text-[#c9c0b0]">还需要你补充 / 注意</h3>
              <ul className="space-y-1 text-xs leading-relaxed text-[#9a9082]">
                {draft.missing.map((note) => (
                  <li key={note}>· {note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || busy}
              className="rounded-full bg-[#e6d5b0] px-5 py-2.5 text-sm text-[#1a1712] hover:bg-[#f2e3c0] disabled:cursor-wait disabled:bg-[#3a352c] disabled:text-[#8d8474]"
            >
              {saving ? "正在保存…" : "确认并保存"}
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={saving || busy}
              className="rounded-full border border-[#3a342c] px-5 py-2.5 text-sm text-[#c9c0b0] hover:bg-[#1f1c18] disabled:opacity-40"
            >
              重新整理
            </button>
            {notice ? <span className="text-xs text-[#d8b8a4]">{notice}</span> : null}
          </div>

          {hasConfirmedFacts ? (
            <div className="space-y-2 rounded-xl border border-emerald-200/15 bg-emerald-100/5 p-3">
              <h3 className="text-sm text-emerald-100/80">已确认的记忆内容</h3>
              {!isConfirmed ? (
                <p className="text-xs text-[#9a9082]">
                  这些是上一次确认保存的内容，目前还没有改动。点「确认并保存」会用上面勾选的条目替换它们。
                </p>
              ) : null}
              <dl className="space-y-1 text-xs text-[#b8b0a2]">
                {facts.summary ? <div>摘要：{facts.summary.value}</div> : null}
                <FactLine label="物品" items={facts.objects} />
                <FactLine label="时间" items={facts.times} />
                <FactLine label="地点" items={facts.locations} />
                <FactLine label="标签" items={facts.tags} />
              </dl>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
