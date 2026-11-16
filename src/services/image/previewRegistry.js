// A live object URL keeps its Blob alive for the whole page, so every URL this
// app creates has to be owned by the registry and revoked on removal, replacement
// and unmount. Closures are used instead of `this` so callers can destructure.
export function createPreviewRegistry(options = {}) {
  const hasUrlApi = typeof globalThis.URL === "function";
  const create =
    options.createObjectURL ??
    (hasUrlApi && typeof globalThis.URL.createObjectURL === "function"
      ? (blob) => globalThis.URL.createObjectURL(blob)
      : null);
  const revoke =
    options.revokeObjectURL ??
    (hasUrlApi && typeof globalThis.URL.revokeObjectURL === "function"
      ? (url) => globalThis.URL.revokeObjectURL(url)
      : null);

  const urls = new Map();
  let created = 0;
  let revoked = 0;

  function isSupported() {
    return typeof create === "function" && typeof revoke === "function";
  }

  function release(key) {
    const url = urls.get(key);

    if (!url) {
      return false;
    }

    urls.delete(key);
    revoke(url);
    revoked += 1;

    return true;
  }

  function acquire(key, blob) {
    release(key);

    if (!isSupported() || !blob) {
      return null;
    }

    const url = create(blob);

    urls.set(key, url);
    created += 1;

    return url;
  }

  function releaseAll() {
    for (const key of [...urls.keys()]) {
      release(key);
    }
  }

  return {
    isSupported,
    acquire,
    release,
    releaseAll,
    peek: (key) => urls.get(key) ?? null,
    stats: () => ({ created, revoked, live: urls.size }),
  };
}
