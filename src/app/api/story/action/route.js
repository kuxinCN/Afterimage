import { NextResponse } from "next/server";

import { ERROR_CODES } from "@/lib/constants";

// B's seam. Accepts { storyId, title, action, history } and returns { story }.
export async function POST() {
  return NextResponse.json(
    {
      code: ERROR_CODES.API_NOT_IMPLEMENTED,
      message: "故事行动接口尚未接入，等待 B 实现。",
    },
    { status: 501 },
  );
}