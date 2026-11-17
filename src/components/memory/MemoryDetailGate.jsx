"use client";

import { useEffect, useState } from "react";

import { ERROR_CODES } from "@/lib/constants";
import { readMemory } from "@/services/memory/memoryService";

const READ_MESSAGES = {
  [ERROR_CODES.STORAGE_UNAVAILABLE]: "这个浏览器不允许本地存储，读不到已保存的记忆。",
  [ERROR_CODES.STORAGE_FAILED]: "本地数据读取失败，请刷新页面重试。",
};

export function MemoryDetailGate({ memoryId, children }) {
  const [state, setState] = useState({ status: "loading", message: null });

  useEffect(() => {
    let active = true;

    readMemory(memoryId)
      .then(() => {
        if (active) {
          setState({ status: "ready", message: null });
        }
      })
      .catch((error) => {
        if (active) {
          setState({
            status: error?.code === ERROR_CODES.MEMORY_NOT_FOUND ? "not_found" : "error",
            message: READ_MESSAGES[error?.code] ?? "读取本地记忆时出错。",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [memoryId]);

  if (state.status === "loading") {
    return <p className="text-sm text-[#8d8474]">正在从本地存储读取这段记忆…</p>;
  }

  if (state.status !== "ready") {
    const notFound = state.status === "not_found";

    return (
      <section className="space-y-4 rounded-xl border border-[#2c2822] bg-[#141210] px-6 py-10 text-center">
        <h1 className="text-xl text-[#f2ebdd]">
          {notFound ? "找不到这段记忆" : "暂时无法读取这段记忆"}
        </h1>
        <p className="text-sm text-[#8d8474]">
          {notFound ? "它可能已经被删除，或者链接有误。" : state.message}
        </p>
        <a
          href="/"
          className="inline-block rounded-full border border-[#3b352c] px-5 py-2 text-sm text-[#e6ddce] hover:bg-[#1f1a17]"
        >
          返回首页
        </a>
      </section>
    );
  }

  return children;
}