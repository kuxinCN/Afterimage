import { describe, expect, it } from "vitest";

import { SOURCE_TYPES } from "@/lib/constants";
import { buildStorySeed } from "@/services/memory/storySeed";
import { emptyFacts } from "@/schemas/memorySchema";
import { inferredValue, userConfirmedValue } from "@/schemas/sourceSchema";

function fictionalValue(value) {
  return { value, sourceType: SOURCE_TYPES.FICTIONAL, sourceIds: [], confidence: 0.5, confirmed: false };
}

function memoryWith(facts, title = "校园午餐") {
  return { id: "m1", title, facts: { ...emptyFacts(), ...facts } };
}

describe("buildStorySeed", () => {
  it("returns null without memory or facts", () => {
    expect(buildStorySeed(null)).toBeNull();
    expect(buildStorySeed({})).toBeNull();
    expect(buildStorySeed(memoryWith({}))).toBeNull();
  });

  it("returns null when nothing is user-confirmed", () => {
    const seed = buildStorySeed(
      memoryWith({
        summary: inferredValue("AI 猜的摘要"),
        objects: [inferredValue("餐盘"), fictionalValue(" imaginary")],
        times: [{ ...userConfirmedValue("中午"), confirmed: false }],
      }),
    );

    expect(seed).toBeNull();
  });

  it("builds a seed from a confirmed summary alone", () => {
    const seed = buildStorySeed(memoryWith({ summary: userConfirmedValue(" 和同学吃午餐 ") }));

    expect(seed.title).toBe("校园午餐");
    expect(seed.text).toBe("和同学吃午餐");
    expect(seed.parts.summary).toBe("和同学吃午餐");
  });

  it("builds a seed from confirmed lists without a summary", () => {
    const seed = buildStorySeed(
      memoryWith({
        times: [userConfirmedValue("中午")],
        locations: [userConfirmedValue("食堂")],
        objects: [userConfirmedValue("餐盘"), userConfirmedValue("筷子")],
        events: [userConfirmedValue("排队打饭")],
      }),
    );

    expect(seed.parts.summary).toBeNull();
    expect(seed.text).toBe("时间：中午\n地点：食堂\n物件：餐盘、筷子\n事件：排队打饭");
  });

  it("keeps only confirmed user items and trims them", () => {
    const seed = buildStorySeed(
      memoryWith({
        summary: userConfirmedValue("午餐"),
        objects: [
          userConfirmedValue(" 餐盘 "),
          inferredValue("AI 推测的菜单"),
          fictionalValue("虚构的蛋糕"),
          { ...userConfirmedValue("未确认项"), confirmed: false },
          userConfirmedValue("   "),
          userConfirmedValue(42),
        ],
      }),
    );

    expect(seed.parts.objects).toEqual(["餐盘"]);
    expect(seed.text).toBe("午餐\n物件：餐盘");
  });

  it("trims the memory title", () => {
    const seed = buildStorySeed(memoryWith({ summary: userConfirmedValue("内容") }, "  标题  "));

    expect(seed.title).toBe("标题");
  });
});