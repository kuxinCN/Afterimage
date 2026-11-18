import { describe, expect, it } from "vitest";

import * as storyService from "@/services/api/storyService";

// The pages consume the Mock presentation helpers only through the service
// seam. A missing re-export here crashes /story at runtime even though the
// provider-level tests stay green, so the seam itself is asserted.
describe("storyService presentation seam", () => {
  it("re-exports every helper the story and ending pages import", () => {
    expect(typeof storyService.classifyActionIntent).toBe("function");
    expect(typeof storyService.classifyFreeTextIntent).toBe("function");
    expect(typeof storyService.describeTrajectory).toBe("function");
    expect(typeof storyService.buildEndingReview).toBe("function");
    expect(typeof storyService.getChoiceLabel).toBe("function");
    expect(storyService.INTENT_META).toBeTypeOf("object");
    expect(storyService.ENDING_META).toBeTypeOf("object");
  });

  it("keeps the classify helpers consistent with the trajectory read-model", () => {
    const action = { type: "choice", choiceId: "mock-leave" };
    const trajectory = storyService.describeTrajectory([action]);

    expect(trajectory.intents[0]).toBe(storyService.classifyActionIntent(action));
    expect(trajectory.tone).toBe(storyService.INTENT_META[trajectory.intents[0]].tone);
  });
});