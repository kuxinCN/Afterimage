import { afterEach, describe, expect, it, vi } from "vitest";

import { API_BASE_URL, ERROR_CODES } from "@/lib/constants";
import { ApiError, request } from "@/services/api/client";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function hangingFetch() {
  return vi.fn(
    (url, init) =>
      new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("aborted");

          error.name = "AbortError";
          reject(error);
        });
      }),
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("request", () => {
  it("posts JSON to the same-origin base url", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

    await request("/story/generate", { body: { title: "校园午餐" }, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(`${API_BASE_URL}/story/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "校园午餐" }),
      signal: expect.any(AbortSignal),
    });
    expect(API_BASE_URL).toBe("/api");
  });

  it("returns the parsed payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ story: { id: "s1" } }));

    await expect(request("/story/generate", { fetchImpl })).resolves.toEqual({
      story: { id: "s1" },
    });
  });

  it("sends no content type when there is no body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

    await request("/story/generate", { method: "GET", fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(`${API_BASE_URL}/story/generate`, {
      method: "GET",
      headers: undefined,
      body: undefined,
      signal: expect.any(AbortSignal),
    });
  });

  it("retries a 503 and succeeds on the last attempt", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "稍后再试" }, 503))
      .mockResolvedValueOnce(jsonResponse({ message: "稍后再试" }, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(
      request("/story/generate", { fetchImpl, baseDelay: 0 }),
    ).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("gives up after maxAttempts and reports the last error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ message: "挂了" }, 500));

    const error = await request("/story/generate", {
      fetchImpl,
      baseDelay: 0,
      maxAttempts: 3,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe(ERROR_CODES.API_HTTP_ERROR);
    expect(error.status).toBe(500);
    expect(error.retryable).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 400", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ message: "参数不对" }, 400));

    const error = await request("/story/generate", { fetchImpl, baseDelay: 0 }).catch(
      (caught) => caught,
    );

    expect(error.code).toBe(ERROR_CODES.API_HTTP_ERROR);
    expect(error.retryable).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 501 and names it not implemented", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 501));

    const error = await request("/story/generate", { fetchImpl, baseDelay: 0 }).catch(
      (caught) => caught,
    );

    expect(error.code).toBe(ERROR_CODES.API_NOT_IMPLEMENTED);
    expect(error.status).toBe(501);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("prefers the server's own code and message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ code: ERROR_CODES.API_NOT_IMPLEMENTED, message: "等待 B 实现。" }, 501),
    );

    const error = await request("/story/generate", { fetchImpl, baseDelay: 0 }).catch(
      (caught) => caught,
    );

    expect(error.code).toBe(ERROR_CODES.API_NOT_IMPLEMENTED);
    expect(error.message).toBe("等待 B 实现。");
  });

  it("retries a network failure", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(request("/story/generate", { fetchImpl, baseDelay: 0 })).resolves.toEqual({
      ok: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reports a network failure once the attempts run out", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await request("/story/generate", {
      fetchImpl,
      baseDelay: 0,
      maxAttempts: 2,
    }).catch((caught) => caught);

    expect(error.code).toBe(ERROR_CODES.API_NETWORK_FAILED);
    expect(error.retryable).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("backs off deterministically at 300ms then 600ms", async () => {
    vi.useFakeTimers();

    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("offline"));
    const settled = request("/story/generate", {
      fetchImpl,
      baseDelay: 300,
      maxAttempts: 3,
    }).catch((caught) => caught);

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(299);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(599);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    expect((await settled).code).toBe(ERROR_CODES.API_NETWORK_FAILED);
  });

  it("reports a retryable timeout", async () => {
    vi.useFakeTimers();

    const fetchImpl = hangingFetch();
    const settled = request("/story/generate", {
      fetchImpl,
      timeout: 50,
      maxAttempts: 1,
    }).catch((caught) => caught);

    await vi.advanceTimersByTimeAsync(50);

    const error = await settled;

    expect(error.code).toBe(ERROR_CODES.API_TIMEOUT);
    expect(error.retryable).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry when the caller aborts", async () => {
    const controller = new AbortController();
    const fetchImpl = hangingFetch();
    const settled = request("/story/generate", {
      fetchImpl,
      signal: controller.signal,
      baseDelay: 0,
      maxAttempts: 3,
    }).catch((caught) => caught);

    controller.abort();

    const error = await settled;

    expect(error.code).toBe(ERROR_CODES.API_ABORTED);
    expect(error.retryable).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refuses to start on an already aborted signal", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn();

    controller.abort();

    const error = await request("/story/generate", {
      fetchImpl,
      signal: controller.signal,
    }).catch((caught) => caught);

    expect(error.code).toBe(ERROR_CODES.API_ABORTED);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a success body that is not JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("Unexpected token <");
      },
    });

    const error = await request("/story/generate", { fetchImpl, baseDelay: 0 }).catch(
      (caught) => caught,
    );

    expect(error.code).toBe(ERROR_CODES.API_INVALID_RESULT);
    expect(error.retryable).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("clamps maxAttempts to at least one", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

    await expect(
      request("/story/generate", { fetchImpl, maxAttempts: 0 }),
    ).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});