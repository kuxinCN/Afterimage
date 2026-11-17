"use client";

/* 余像 Afterimage · React / Next.js 包装组件（A 组提供，供 C 组按需接入）
 * 仅负责「客户端挂载 + props 同步 + 卸载清理」，业务状态/持久化/门禁仍归 C 组。
 * 不直接调用 C 组 services / Repository / IndexedDB。
 *
 * 注意：本文件未经 React/Next 运行时实测（A 工作区无 React/Next 环境），属待验证交付。
 * A 核心脚本为客户端全局脚本，已通过 dynamic import 限定在 useEffect 内加载，避免 SSR 触碰 window/document。
 *
 * Props（与 C 组 SceneCanvas 契约对齐）：
 *   scene, visitedHotspots, onHotspotClick(id)
 *   exploreOn('open'|'close'|'none'), kindMap, defaultKind,
 *   theme, layout, dust, reduceMotion,
 *   onFragmentOpen(data,info), onFragmentClose(data,info), onStateChange(state), onIssues(issues),
 *   className, style, loadCore(可选：自定义加载 A 核心脚本的函数)
 */
import { useEffect, useRef } from "react";

export default function AfterimageMemoryScene(props) {
  const {
    scene,
    visitedHotspots,
    onHotspotClick,
    exploreOn,
    kindMap,
    defaultKind,
    theme,
    layout,
    dust,
    reduceMotion,
    onFragmentOpen,
    onFragmentClose,
    onStateChange,
    onIssues,
    className,
    style,
    loadCore,
  } = props;

  const hostRef = useRef(null);
  const handleRef = useRef(null);
  const cbRef = useRef({});
  const propsRef = useRef({});

  cbRef.current = { onHotspotClick, onFragmentOpen, onFragmentClose, onStateChange, onIssues };
  propsRef.current = { scene, visitedHotspots, kindMap, defaultKind, exploreOn, theme, layout, dust, reduceMotion };

  useEffect(() => {
    let cancelled = false;
    let handle = null;

    (async () => {
      const load =
        loadCore ||
        (async () => {
          await import("../../src/memory-fragment.js");
          await import("../../src/memory-space.js");
          await import("../../src/scene-adapter.js");
          await import("../../src/scene-mount.js");
        });
      await load();
      if (cancelled || !hostRef.current) return;

      const A = window.Afterimage;
      const p = propsRef.current;
      handle = A.mountScene(hostRef.current, {
        scene: p.scene,
        visitedHotspots: p.visitedHotspots,
        exploreOn: p.exploreOn,
        kindMap: p.kindMap,
        defaultKind: p.defaultKind,
        theme: p.theme,
        layout: p.layout,
        dust: p.dust,
        reduceMotion: p.reduceMotion,
        onHotspotClick: (id) => cbRef.current.onHotspotClick && cbRef.current.onHotspotClick(id),
        onFragmentOpen: (d, i) => cbRef.current.onFragmentOpen && cbRef.current.onFragmentOpen(d, i),
        onFragmentClose: (d, i) => cbRef.current.onFragmentClose && cbRef.current.onFragmentClose(d, i),
        onStateChange: (s) => cbRef.current.onStateChange && cbRef.current.onStateChange(s),
        onIssues: (iss) => cbRef.current.onIssues && cbRef.current.onIssues(iss),
      });
      handleRef.current = handle;
      // 同步加载期间可能已变化的最新 props
      handle.update(propsRef.current);
    })();

    return () => {
      cancelled = true;
      if (handle) handle.destroy();
      handleRef.current = null;
    };
    // 仅挂载一次；回调与最新数据经 ref 同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // scene / 映射选项变化才重设碎片；mountScene 内部对「内容未变」仅回灌探索态
  useEffect(() => {
    if (handleRef.current) {
      handleRef.current.update({
        scene,
        kindMap,
        defaultKind,
        visitedHotspots: propsRef.current.visitedHotspots,
      });
    }
  }, [scene, kindMap, defaultKind]);

  // 仅探索状态变化：只回灌，不重设全部碎片、不打断详情
  useEffect(() => {
    if (handleRef.current) {
      handleRef.current.setVisited(visitedHotspots);
    }
  }, [visitedHotspots]);

  useEffect(() => {
    if (handleRef.current) {
      handleRef.current.update({ theme, layout, dust, reduceMotion, exploreOn });
    }
  }, [theme, layout, dust, reduceMotion, exploreOn]);

  return <div ref={hostRef} className={className} style={style} />;
}