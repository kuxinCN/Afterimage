"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ERROR_CODES } from "@/lib/constants";

const REQUEST_MESSAGES = {
  [ERROR_CODES.API_NETWORK_FAILED]: "连不上服务，请检查网络后重试。",
  [ERROR_CODES.API_TIMEOUT]: "请求超时了，请重试。",
  [ERROR_CODES.API_HTTP_ERROR]: "服务出错了，请稍后重试。",
  [ERROR_CODES.API_NOT_IMPLEMENTED]: "故事接口还没接好，目前只能走 Mock 数据。",
  [ERROR_CODES.API_INVALID_RESULT]: "服务返回的故事不符合约定结构，已拒绝显示。",
  [ERROR_CODES.VALIDATION_FAILED]: "标题和文字都要填写，且不能超过长度上限。",
};

function describeError(error) {
  return {
    code: error?.code ?? "UNKNOWN",
    message: REQUEST_MESSAGES[error?.code] ?? error?.message ?? "请求失败，请重试。",
    retryable: error?.retryable ?? true,
  };
}

// One place owns loading / error / retry so every page renders the same three
// states. The task receives an AbortSignal and is kept for the retry button.
export function useStoryRequest() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);
  const lastTaskRef = useRef(null);
  const mountedRef = useRef(true);
  // A synchronous re-entrancy guard: isLoading only disables the button after a
  // re-render, so a fast double-click could otherwise start two runs that both
  // capture the same history and append the action twice.
  const busyRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const run = useCallback(async (task) => {
    if (busyRef.current) {
      return null;
    }

    busyRef.current = true;
    controllerRef.current?.abort();

    const controller = new AbortController();

    controllerRef.current = controller;
    lastTaskRef.current = task;

    setStatus("loading");
    setError(null);

    try {
      const result = await task(controller.signal);

      if (!mountedRef.current || controller.signal.aborted) {
        return null;
      }

      setStatus("ready");

      return result;
    } catch (caught) {
      if (!mountedRef.current || caught?.code === ERROR_CODES.API_ABORTED) {
        return null;
      }

      setStatus("error");
      setError(describeError(caught));

      return null;
    } finally {
      busyRef.current = false;
    }
  }, []);

  const retry = useCallback(() => {
    if (!lastTaskRef.current) {
      return Promise.resolve(null);
    }

    return run(lastTaskRef.current);
  }, [run]);

  const clearError = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return {
    status,
    error,
    isLoading: status === "loading",
    run,
    retry,
    clearError,
  };
}