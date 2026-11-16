// Browsers may revoke this at any time, so a granted flag only lowers eviction
// risk — the UI must never present it as a guarantee.
export async function requestPersistence() {
  if (typeof navigator === "undefined" || typeof navigator.storage?.persist !== "function") {
    return { supported: false, granted: false };
  }

  try {
    const granted = await navigator.storage.persist();

    return { supported: true, granted: Boolean(granted) };
  } catch (error) {
    return { supported: true, granted: false, error };
  }
}

export async function readStorageUsage() {
  if (typeof navigator === "undefined" || typeof navigator.storage?.estimate !== "function") {
    return null;
  }

  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();

    return { usage, quota };
  } catch {
    return null;
  }
}
