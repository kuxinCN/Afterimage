import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  MemoryScenePanel,
  isExplorationComplete,
  shouldRecordVisit,
} from "@/components/scene/MemoryScenePanel";

describe("shouldRecordVisit", () => {
  it("records a first visit to an unvisited hotspot when idle", () => {
    expect(shouldRecordVisit("h1", [], false)).toBe(true);
  });

  it("does not re-record an already visited hotspot (re-view only)", () => {
    expect(shouldRecordVisit("h1", ["h1"], false)).toBe(false);
  });

  it("blocks extra saves while a write is in flight", () => {
    expect(shouldRecordVisit("h2", ["h1"], true)).toBe(false);
  });

  it("ignores a falsy hotspot id", () => {
    expect(shouldRecordVisit("", [], false)).toBe(false);
    expect(shouldRecordVisit(undefined, [], false)).toBe(false);
  });
});

describe("isExplorationComplete", () => {
  const hotspots = [{ id: "h1" }, { id: "h2" }];

  it("is false when nothing is visited", () => {
    expect(isExplorationComplete(hotspots, [])).toBe(false);
  });

  it("is false when only some are visited", () => {
    expect(isExplorationComplete(hotspots, ["h1"])).toBe(false);
  });

  it("is true only when every hotspot is visited", () => {
    expect(isExplorationComplete(hotspots, ["h1", "h2"])).toBe(true);
  });

  it("is false for an empty scene (no completion feedback on nothing)", () => {
    expect(isExplorationComplete([], [])).toBe(false);
  });

  it("ignores visited ids that are not part of the scene", () => {
    expect(isExplorationComplete(hotspots, ["h1", "ghost"])).toBe(false);
  });
});

describe("MemoryScenePanel", () => {
  it("renders the local-loading state on first paint", () => {
    const html = renderToStaticMarkup(createElement(MemoryScenePanel, { memoryId: "memory-1" }));

    expect(html).toContain("正在从本地存储读取场景");
  });
});