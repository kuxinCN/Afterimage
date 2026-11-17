import { NextResponse } from "next/server";

import { ERROR_CODES } from "@/lib/constants";

// B's seam. This declares the endpoint and its failure contract only: no AI
// logic, no provider call, and no key ever reaches this file's client side.
export async function POST() {
  return NextResponse.json(
    {
      code: ERROR_CODES.API_NOT_IMPLEMENTED,
      message: "故事生成接口尚未接入，等待 B 实现。",
    },
    { status: 501 },
  );
}