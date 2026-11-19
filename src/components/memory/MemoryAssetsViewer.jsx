"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ERROR_CODES, SOURCE_TYPE_LABELS } from "@/lib/constants";
import { formatBytes } from "@/lib/utils";
import { createPreviewRegistry } from "@/services/image/previewRegistry";
import { readMemoryWithAssets, removeMemoryAsset } from "@/services/memory/memoryService";

const READ_MESSAGES = {
  [ERROR_CODES.MEMORY_NOT_FOUND]: "找不到这段记忆，它可能已经被删除。",
  [ERROR_CODES.STORAGE_UNAVAILABLE]: "这个浏览器不允许本地存储，读不到已保存的记忆。",
  [ERROR_CODES.STORAGE_FAILED]: "本地数据读取失败，请刷新页面重试。",
};

function AssetCard({ asset, previewUrl, onRemove, isRemoving, isConfirming, onAskRemove, onCancelRemove }) {
  return (
    <li className="overflow-hidden rounded-xl border border-[#2c2822] bg-[#141210]">
      <div className="flex h-40 items-center justify-center bg-[#0d0c0b]">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL has no server to optimize it and must never leave the device
          <img src={previewUrl} alt={asset.originalName} className="h-full w-full object-contain" />
        ) : (
          <span className="px-3 text-center text-xs text-[#7c7466]">这张图片无法生成预览</span>
        )}
      </div>
      <div className="space-y-1 px-3 py-2">
        <p className="truncate text-sm text-[#e6ddce]" title={asset.originalName}>
          {asset.originalName}
        </p>
        <p className="text-xs text-[#8d8474]">
          {formatBytes(asset.blob?.size)}
          {asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ""} ·{" "}
          {asset.mimeType}
        </p>
        {isConfirming ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onRemove(asset.id)}
              disabled={isRemoving}
              className="rounded-full border border-[#7a4a3a] bg-[rgba(160,80,56,0.16)] px-3 py-1 text-xs text-[#e8b39c] transition-colors hover:bg-[rgba(160,80,56,0.3)] disabled:opacity-50"
            >
              {isRemoving ? "正在删除…" : "确认删除"}
            </button>
            <button
              type="button"
              onClick={onCancelRemove}
              disabled={isRemoving}
              className="rounded-full border border-[#3b352c] px-3 py-1 text-xs text-[#c9c0b0] hover:bg-[#1f1a17] disabled:opacity-50"
            >
              取消
            </button>
            <span className="text-xs text-[#8d8474]">删除后无法恢复</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onAskRemove(asset.id)}
            disabled={isRemoving}
            className="mt-1 rounded-full border border-[#3b2f2a] px-3 py-1 text-xs text-[#d8b8a4] hover:bg-[#1f1a17] disabled:opacity-50"
          >
            删除这张
          </button>
        )}
      </div>
    </li>
  );
}

export function MemoryAssetsViewer({ memoryId }) {
  const [state, setState] = useState({ status: "loading", memory: null, assets: [] });
  const [previews, setPreviews] = useState({});
  const [error, setError] = useState(null);
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const registryRef = useRef(null);
  const mountedRef = useRef(true);

  if (!registryRef.current) {
    registryRef.current = createPreviewRegistry();
  }

  // Blob URLs do not survive a reload, so every preview is rebuilt from the
  // Blob bytes that came back out of IndexedDB.
  useEffect(() => {
    const registry = registryRef.current;

    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      registry.releaseAll();
    };
  }, []);

  const load = useCallback(async () => {
    const registry = registryRef.current;
    const { memory, assets } = await readMemoryWithAssets(memoryId);

    if (!mountedRef.current) {
      return;
    }

    const next = {};

    registry.releaseAll();

    for (const asset of assets) {
      const url = registry.acquire(asset.id, asset.blob);

      if (url) {
        next[asset.id] = url;
      }
    }

    setState({ status: "ready", memory, assets });
    setPreviews(next);
    setConfirmingId(null);
  }, [memoryId]);

  useEffect(() => {
    let active = true;

    load().catch((loadError) => {
      if (active) {
        setError(READ_MESSAGES[loadError?.code] ?? "读取本地记忆时出错。");
        setState((current) => ({ ...current, status: "error" }));
      }
    });

    return () => {
      active = false;
    };
  }, [load]);

  async function handleRemove(assetId) {
    if (pendingRemoval) {
      return;
    }

    setPendingRemoval(assetId);
    setError(null);

    try {
      await removeMemoryAsset(memoryId, assetId);

      if (mountedRef.current) {
        await load();
      }
    } catch (removeError) {
      if (mountedRef.current) {
        setError(READ_MESSAGES[removeError?.code] ?? "删除图片失败，请重试。");
        setConfirmingId(null);
      }
    } finally {
      if (mountedRef.current) {
        setPendingRemoval(null);
      }
    }
  }

  if (state.status === "loading") {
    return <p className="text-sm text-[#8d8474]">正在从本地存储读取这段记忆…</p>;
  }

  if (!state.memory) {
    return <p className="text-sm text-[#e0a98f]">{error ?? "这段记忆不存在。"}</p>;
  }

  const { memory, assets } = state;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl text-[#f2ebdd]">{memory.title}</h1>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[#8d8474]">
          <div className="flex gap-1">
            <dt>状态</dt>
            <dd>{memory.status}</dd>
          </div>
          <div className="flex gap-1">
            <dt>日期</dt>
            <dd>{memory.date ?? "未填写"}</dd>
          </div>
          <div className="flex gap-1">
            <dt>地点</dt>
            <dd>
              {memory.location
                ? `${memory.location.value}（${
                    SOURCE_TYPE_LABELS[memory.location.sourceType] ?? memory.location.sourceType
                  }）`
                : "未填写"}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>创建</dt>
            <dd>{new Date(memory.createdAt).toLocaleString()}</dd>
          </div>
        </dl>
        {memory.description ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-[#c9c0b0]">
            {memory.description}
          </p>
        ) : null}
      </header>

      {error ? <p className="text-sm text-[#e0a98f]">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="text-sm text-[#c9c0b0]">已保存的照片（{assets.length}）</h2>
        {assets.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                previewUrl={previews[asset.id]}
                onRemove={handleRemove}
                isRemoving={pendingRemoval !== null}
                isConfirming={confirmingId === asset.id}
                onAskRemove={setConfirmingId}
                onCancelRemove={() => setConfirmingId(null)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#7c7466]">这段记忆还没有照片。</p>
        )}
      </section>
    </div>
  );
}
