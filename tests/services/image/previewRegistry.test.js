import { describe, expect, it } from "vitest";

import { createPreviewRegistry } from "@/services/image/previewRegistry";

function trackingRegistry() {
  const created = [];
  const revoked = [];
  let counter = 0;

  const registry = createPreviewRegistry({
    createObjectURL: () => {
      counter += 1;
      const url = `blob:test/${counter}`;
      created.push(url);
      return url;
    },
    revokeObjectURL: (url) => revoked.push(url),
  });

  return { registry, created, revoked };
}

describe("createPreviewRegistry", () => {
  it("creates one url per key and releases it exactly once", () => {
    const { registry, created, revoked } = trackingRegistry();
    const blob = new Blob(["x"], { type: "image/jpeg" });

    expect(registry.acquire("a", blob)).toBe("blob:test/1");
    expect(registry.peek("a")).toBe("blob:test/1");
    expect(registry.release("a")).toBe(true);

    expect(created).toEqual(["blob:test/1"]);
    expect(revoked).toEqual(["blob:test/1"]);
    expect(registry.stats()).toEqual({ created: 1, revoked: 1, live: 0 });
  });

  it("releases the previous url when a preview is replaced", () => {
    const { registry, revoked } = trackingRegistry();
    const blob = new Blob(["x"]);

    registry.acquire("a", blob);
    const second = registry.acquire("a", blob);

    expect(revoked).toEqual(["blob:test/1"]);
    expect(registry.peek("a")).toBe(second);
    expect(registry.stats().live).toBe(1);
  });

  it("treats releasing an unknown key as a no-op", () => {
    const { registry, revoked } = trackingRegistry();

    expect(registry.release("missing")).toBe(false);
    expect(registry.release("missing")).toBe(false);
    expect(revoked).toEqual([]);
  });

  it("revokes every remaining url on releaseAll", () => {
    const { registry, revoked } = trackingRegistry();
    const blob = new Blob(["x"]);

    registry.acquire("a", blob);
    registry.acquire("b", blob);
    registry.acquire("c", blob);
    registry.release("b");
    registry.releaseAll();

    expect(revoked.sort()).toEqual(["blob:test/1", "blob:test/2", "blob:test/3"]);
    expect(registry.stats()).toEqual({ created: 3, revoked: 3, live: 0 });
  });

  it("never leaks a url after every image is removed", () => {
    const { registry } = trackingRegistry();
    const blob = new Blob(["x"]);

    for (let index = 0; index < 9; index += 1) {
      registry.acquire(`key-${index}`, blob);
    }
    registry.releaseAll();

    const { created, revoked, live } = registry.stats();

    expect(live).toBe(0);
    expect(revoked).toBe(created);
  });

  it("reports no urls when the browser cannot create them", () => {
    const original = globalThis.URL.createObjectURL;
    delete globalThis.URL.createObjectURL;

    const registry = createPreviewRegistry();

    expect(registry.isSupported()).toBe(false);
    expect(registry.acquire("a", new Blob(["x"]))).toBeNull();
    expect(registry.stats()).toEqual({ created: 0, revoked: 0, live: 0 });

    globalThis.URL.createObjectURL = original;
  });
});
