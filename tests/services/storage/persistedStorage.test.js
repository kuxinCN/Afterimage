import { afterEach, describe, expect, it, vi } from "vitest";

import { readStorageUsage, requestPersistence } from "@/services/storage/persistedStorage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestPersistence", () => {
  it("reports unsupported instead of throwing outside a browser", async () => {
    vi.stubGlobal("navigator", undefined);

    await expect(requestPersistence()).resolves.toEqual({ supported: false, granted: false });
  });

  it("reports unsupported when the storage API has no persist", async () => {
    vi.stubGlobal("navigator", { storage: {} });

    await expect(requestPersistence()).resolves.toEqual({ supported: false, granted: false });
  });

  it("passes the browser decision through without overstating it", async () => {
    vi.stubGlobal("navigator", { storage: { persist: async () => true } });
    await expect(requestPersistence()).resolves.toEqual({ supported: true, granted: true });

    vi.stubGlobal("navigator", { storage: { persist: async () => false } });
    await expect(requestPersistence()).resolves.toMatchObject({ supported: true, granted: false });
  });

  it("survives a browser that rejects the call", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        persist: async () => {
          throw new Error("blocked");
        },
      },
    });

    const result = await requestPersistence();

    expect(result).toMatchObject({ supported: true, granted: false });
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe("readStorageUsage", () => {
  it("returns null when estimate is unavailable", async () => {
    vi.stubGlobal("navigator", { storage: {} });

    await expect(readStorageUsage()).resolves.toBeNull();
  });

  it("normalises a partial estimate", async () => {
    vi.stubGlobal("navigator", { storage: { estimate: async () => ({ usage: 1024 }) } });

    await expect(readStorageUsage()).resolves.toEqual({ usage: 1024, quota: 0 });
  });

  it("returns null instead of throwing when estimate fails", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        estimate: async () => {
          throw new Error("unavailable");
        },
      },
    });

    await expect(readStorageUsage()).resolves.toBeNull();
  });
});
