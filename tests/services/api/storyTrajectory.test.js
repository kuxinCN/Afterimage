import { describe, expect, it } from "vitest";

import { describeTrajectory, selectEnding } from "@/services/api/mockStoryData";

const choice = (choiceId) => ({ type: "choice", choiceId });
const free = (text) => ({ type: "free", text });

describe("describeTrajectory", () => {
  it("starts with every ending reachable and a neutral tone", () => {
    const t = describeTrajectory([]);

    expect(t.steps).toEqual([]);
    expect(t.beats).toBe(3);
    expect(t.tone).toBe("paper");
    expect([...t.reachable].sort()).toEqual(["accept", "missed", "open", "warm"]);
  });

  it("reflects each carried action as a step with intent and label", () => {
    const t = describeTrajectory([choice("mock-forward"), free("转身离开")]);

    expect(t.steps).toHaveLength(2);
    expect(t.steps[0].label).toBe("走向里间的门");
    expect(t.steps[0].intent).toBe("engage");
    expect(t.steps[1].kind).toBe("free");
    expect(t.steps[1].input).toBe("转身离开");
    expect(t.steps[1].intent).toBe("withdraw");
    expect(t.tone).toBe("cool");
  });

  it("narrows reachable endings as the path commits", () => {
    const committed = describeTrajectory([free("离开"), free("离开")]);

    expect(committed.reachable).toEqual(["missed"]);
    expect(committed.leading).toBe("missed");
  });

  it("keeps multiple endings open while the path is still undecided", () => {
    const undecided = describeTrajectory([free("犹豫"), free("担忧")]);

    expect([...undecided.reachable].sort()).toEqual(["missed", "open"]);
    expect(undecided.leading).toBe("open");
  });

  it("collapses to the reached ending once the story ends", () => {
    const ended = describeTrajectory([
      choice("mock-forward"),
      choice("mock-closer"),
      choice("mock-reach"),
    ]);

    expect(ended.leading).toBe("warm");
    expect(ended.reachable).toEqual(["warm"]);
    expect(ended.tone).toBe("warm");
    expect(ended.steps).toHaveLength(3);
  });

  it("agrees with selectEnding for the leading ending", () => {
    const history = [choice("mock-look"), choice("mock-stay"), choice("mock-closer")];
    const t = describeTrajectory(history);

    expect(t.leading).toBe(selectEnding(t.intents));
  });

  it("is deterministic for the same history", () => {
    const history = [free("犹豫"), choice("mock-closer")];

    expect(describeTrajectory(history)).toEqual(describeTrajectory(history));
  });

  it("never exposes an unknown choiceId in a step label", () => {
    const t = describeTrajectory([choice("secret-internal-id")]);

    expect(t.steps[0].label).toBe("一个自定义行动");
    expect(JSON.stringify(t)).not.toContain("secret-internal-id");
  });
});