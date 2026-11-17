import { API_BASE_URL, API_RETRY, ERROR_CODES } from "@/lib/constants";

export class ApiError extends Error {
  constructor(code, message, { status = null, retryable = false, cause = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.cause = cause;
  }
}

// 4xx means the request itself is wrong, so repeating it cannot help. 408 and
// 429 are the two exceptions where waiting and retrying is the documented cure.
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function aborted() {
  return new ApiError(ERROR_CODES.API_ABORTED, "请求已取消。");
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(aborted());
      return;
    }

    let timer = null;
    const onAbort = () => {
      clearTimeout(timer);
      reject(aborted());
    };

    timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function readPayload(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function attemptOnce({ url, method, body, timeout, fetchImpl, signal }) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  const onAbort = () => controller.abort();

  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetchImpl(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await readPayload(response);

    if (!response.ok) {
      const code =
        payload?.code ??
        (response.status === 501 ? ERROR_CODES.API_NOT_IMPLEMENTED : ERROR_CODES.API_HTTP_ERROR);

      throw new ApiError(code, payload?.message ?? `服务返回 ${response.status}。`, {
        status: response.status,
        retryable: RETRYABLE_STATUS.has(response.status),
      });
    }

    if (payload === null) {
      throw new ApiError(ERROR_CODES.API_INVALID_RESULT, "服务没有返回可解析的 JSON。", {
        status: response.status,
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error?.name === "AbortError") {
      if (signal?.aborted) {
        throw aborted();
      }
      throw new ApiError(ERROR_CODES.API_TIMEOUT, "请求超时了。", {
        retryable: true,
        cause: error,
      });
    }

    throw new ApiError(ERROR_CODES.API_NETWORK_FAILED, "连不上服务，请检查网络。", {
      retryable: true,
      cause: error,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

// Backoff is deterministic (300 / 600 / 1200ms) rather than jittered, matching
// the rest of the project's no-randomness rule and keeping the tests exact.
export async function request(
  path,
  {
    method = "POST",
    body,
    signal,
    timeout = API_RETRY.TIMEOUT_MS,
    maxAttempts = API_RETRY.MAX_ATTEMPTS,
    baseDelay = API_RETRY.BASE_DELAY_MS,
    fetchImpl = (input, init) => globalThis.fetch(input, init),
  } = {},
) {
  const url = `${API_BASE_URL}${path}`;
  const attempts = Math.max(1, maxAttempts);
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (signal?.aborted) {
      throw aborted();
    }

    try {
      return await attemptOnce({ url, method, body, timeout, fetchImpl, signal });
    } catch (error) {
      lastError = error;

      if (!error.retryable || attempt === attempts) {
        throw error;
      }

      await wait(baseDelay * 2 ** (attempt - 1), signal);
    }
  }

  throw lastError;
}