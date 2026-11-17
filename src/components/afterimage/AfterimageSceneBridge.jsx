"use client";

// C-side bridge for option C: A paints the room + fragments, C owns the single
// detail panel, business data, exploration state and persistence.
//
// Reuses A's public integration API (window.Afterimage.mountScene) and the pure
// fragmentLayout projection verbatim — no A core/wrapper file is modified. Unlike
// A's generic React wrapper (callback-only), this bridge keeps the mount handle so
// it can mirror C's selectedHotspotId onto A's open fragment (C→A) and report A's
// open/close back to C (A→C). That bidirectional sync is what lets C's
// HotspotDetailPanel be the only panel while A's fragment highlight stays in step.
import { useEffect, useMemo, useRef } from "react";

import { fragmentScale, isDenseLayout, projectScene } from "./fragmentLayout";

import "./styles/memory-space.css";
import "./styles/memory-fragment.css";
import "./integration.css";

export function AfterimageSceneBridge({
  scene,
  visitedHotspots = [],
  onHotspotClick,
  // Controlled mode (formal page): C owns selection. Omit for uncontrolled (sandbox).
  selectedHotspotId,
  onSelectedChange,
  // showPanel=false (default) suppresses A's built-in .ms-panel so C's panel is the
  // only one. The sandbox passes true to keep verifying A's own panel semantics.
  showPanel = false,
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
  // Reported when A's core scripts fail to load or mountScene is unavailable, so
  // the owner can fall back to C's canvas instead of leaving a blank stage.
  onMountError,
  className = "",
}) {
  const count = scene?.hotspots?.length ?? 0;
  // Memoised on scene identity: a visited-only update keeps the same scene
  // reference, so the projection (and A's scene key) stays stable and A only
  // back-fills explored state instead of rebuilding fragments.
  const projected = useMemo(() => projectScene(scene), [scene]);
  const scale = fragmentScale(count);
  const dense = isDenseLayout(count);
  const controlled = selectedHotspotId !== undefined;

  const hostRef = useRef(null);
  const handleRef = useRef(null);
  const cbRef = useRef({});
  const propsRef = useRef({});

  cbRef.current = {
    onHotspotClick,
    onSelectedChange,
    onFragmentOpen,
    onFragmentClose,
    onStateChange,
    onIssues,
    onMountError,
  };
  propsRef.current = {
    scene: projected,
    visitedHotspots,
    selectedHotspotId,
    kindMap,
    defaultKind,
    theme,
    layout,
    dust,
    reduceMotion,
  };

  useEffect(() => {
    let cancelled = false;
    let handle = null;

    (async () => {
      try {
        await import("./src/memory-fragment.js");
        await import("./src/memory-space.js");
        await import("./src/scene-adapter.js");
        await import("./src/scene-mount.js");
        if (cancelled || !hostRef.current) return;

        const mount = window.Afterimage && window.Afterimage.mountScene;
        if (typeof mount !== "function") {
          throw new Error("Afterimage.mountScene 不可用");
        }

        const p = propsRef.current;
        handle = mount(hostRef.current, {
          scene: p.scene,
          visitedHotspots: p.visitedHotspots,
          exploreOn: "open",
          kindMap: p.kindMap,
          defaultKind: p.defaultKind,
          theme: p.theme,
          layout: p.layout,
          dust: p.dust,
          reduceMotion: p.reduceMotion,
          // User click on a fragment → C's visitHotspot path (success-only explored).
          onHotspotClick: (id) => cbRef.current.onHotspotClick?.(id),
          // A open/close (user or program) → mirror selection back to C.
          onFragmentOpen: (data, info) => {
            cbRef.current.onFragmentOpen?.(data, info);
            cbRef.current.onSelectedChange?.(info.id);
          },
          onFragmentClose: (data, info) => {
            cbRef.current.onFragmentClose?.(data, info);
            cbRef.current.onSelectedChange?.(null);
          },
          onStateChange: (state) => cbRef.current.onStateChange?.(state),
          onIssues: (issues) => cbRef.current.onIssues?.(issues),
        });
        if (cancelled) {
          handle.destroy();
          handle = null;
          return;
        }
        handleRef.current = handle;
        handle.update(propsRef.current);
        // Apply any selection that arrived while the core scripts were loading.
        if (p.selectedHotspotId != null) {
          handle.space.openFragment(p.selectedHotspotId);
        }
      } catch (mountError) {
        if (handle) {
          handle.destroy();
          handle = null;
        }
        handleRef.current = null;
        if (!cancelled) {
          cbRef.current.onMountError?.(mountError);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (handle) handle.destroy();
      handleRef.current = null;
    };
    // Mount once; latest data/callbacks flow through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scene content / mapping change → A rebuilds with preserveOpen.
  useEffect(() => {
    handleRef.current?.update({
      scene: projected,
      kindMap,
      defaultKind,
      visitedHotspots: propsRef.current.visitedHotspots,
    });
  }, [projected, kindMap, defaultKind]);

  // Visited-only change → back-fill explored, never rebuild or interrupt reading.
  useEffect(() => {
    handleRef.current?.setVisited(visitedHotspots);
  }, [visitedHotspots]);

  useEffect(() => {
    handleRef.current?.update({ theme, layout, dust, reduceMotion });
  }, [theme, layout, dust, reduceMotion]);

  // C→A selection mirror. Guards keep it loop-free: A's own open/close already
  // sets openId, so we only command A when it differs from C's selection.
  useEffect(() => {
    if (!controlled) return;
    const space = handleRef.current?.space;
    if (!space) return;
    if (selectedHotspotId == null) {
      if (space.openId != null) space.closePanel();
    } else if (space.openId !== selectedHotspotId) {
      space.openFragment(selectedHotspotId);
    }
  }, [selectedHotspotId, controlled]);

  const classes = `a-bridge${dense ? " a-bridge--dense" : ""}${showPanel ? " a-bridge--panel" : ""}${
    className ? ` ${className}` : ""
  }`;

  return <div ref={hostRef} className={classes} style={{ "--a-frag-scale": scale }} />;
}