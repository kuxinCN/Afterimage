"use client";

import Link from "next/link";

import { ModeNav } from "@/components/nav/ModeNav";

// One fixed entry point for both lines: the brand always leads home and the
// mode pill keeps the other line one click away from every page.
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(230,213,176,0.08)] bg-[rgba(11,10,9,0.78)] backdrop-blur-md">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-2 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="text-xs uppercase tracking-[0.3em] text-[#c9c0b0] transition-colors group-hover:text-[#f2ebdd]">
            Afterimage
          </span>
          <span
            aria-hidden
            className="inline-block h-1 w-1 rounded-full bg-[#e6d5b0] shadow-[0_0_10px_rgba(230,213,176,0.9)]"
          />
          <span className="text-xs text-[#8d8474] transition-colors group-hover:text-[#c9c0b0]">
            余像
          </span>
        </Link>
        <ModeNav />
      </div>
    </header>
  );
}