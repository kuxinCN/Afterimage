import { describe, expect, it } from "vitest";

import { SOURCE_TYPES } from "@/lib/constants";
import { storySchema } from "@/schemas/storySchema";
import {
  buildMockActionStory,
  buildMockOpeningStory,
  classifyActionIntent,
  classifyFreeTextIntent,
  selectEnding,
} from "@/services/api/mockStoryData";
import {
  buildEndingReview,
  generateStory,
  getChoiceLabel,
  submitAction,
} from "@/services/api/storyService";
import {
  initialStoryState,
  readPersistedState,
  storyReducer,
  writePersistedState,
} from "@/store/storyReducer";

const INPUT = { title: "安静的屋子", text: "一段用于测试的文字。" };

const choice = (choiceId) => ({ type: "choice", choiceId });
const free = (text) => ({ type: "free", text });

// Mirrors the real client: history carries the prior actions, the current action
// is sent separately, and the reducer appends it only after the story lands.
async function walkRoute(actions) {
  const { story: opening } = await generateStory(INPUT);
  let current = opening;
  const history = [];

  for (const action of actions) {
    const next = await submitAction({
      storyId: opening.id,
      title: opening.title,
      action,
      history,
    });
    current = next.story;
    history.push(action);
  }

  return { opening, current, history };
}

const WARM = [choice("mock-forward"), choice("mock-closer"), choice("mock-reach")];
const MISSED = [free("转身离开"), free("沉默着走开"), choice("mock-leave")];
const OPEN = [free("犹豫"), free("担忧"), free("后悔")];
const ACCEPT = [choice("mock-look"), choice("mock-stay"), choice("mock-closer")];

describe("I1 choice-driven branching", () => {
  it("produces different plot for different choiceIds at the first beat", async () => {
    const look = await walkRoute([choice("mock-look")]);
    const forward = await walkRoute([choice("mock-forward")]);

    expect(look.current.paragraphs).not.toEqual(forward.current.paragraphs);
    expect(look.current.isEnding).toBe(false);
    expect(forward.current.isEnding).toBe(false);
  });

  it("lets an early choice keep shaping later prose (beat2 echo)", async () => {
    const viaApproach = await walkRoute([choice("mock-forward"), choice("mock-stay")]);
    const viaWithdraw = await walkRoute([free("转身离开"), choice("mock-stay")]);

    // Same second action, different first action -> different beat2 paragraph.
    expect(viaApproach.current.paragraphs[0].text).not.toBe(
      viaWithdraw.current.paragraphs[0].text,
    );
  });

  it("stays deterministic for the same choiceId and history", async () => {
    const first = await walkRoute(WARM);
    const second = await walkRoute(WARM);

    expect(first.current.paragraphs).toEqual(second.current.paragraphs);
    expect(first.current.choices).toEqual(second.current.choices);
  });
});

describe("I1 free-text intent classification", () => {
  it("classifies distinct keywords into distinct intents", () => {
    expect(classifyFreeTextIntent("我想主动沟通解释")).toBe("engage");
    expect(classifyFreeTextIntent("转身离开这里")).toBe("withdraw");
    expect(classifyFreeTextIntent("坚持再试一次")).toBe("persist");
    expect(classifyFreeTextIntent("我有些犹豫担忧")).toBe("hesitate");
  });

  it("gives different reactions for different keywords", async () => {
    const engage = await walkRoute([free("我想靠近解释")]);
    const withdraw = await walkRoute([free("转身离开")]);

    expect(engage.current.paragraphs).not.toEqual(withdraw.current.paragraphs);
  });

  it("degrades unrecognized text to a natural observe default", async () => {
    expect(classifyFreeTextIntent("嗯嗯啊啊随便")).toBe("observe");

    const unrecognized = await walkRoute([free("嗯嗯啊啊随便")]);
    const observe = await walkRoute([choice("mock-look")]);

    expect(unrecognized.current.paragraphs).toEqual(observe.current.paragraphs);
  });

  it("is deterministic for the same sentence", () => {
    expect(classifyFreeTextIntent("犹豫着要不要靠近")).toBe(
      classifyFreeTextIntent("犹豫着要不要靠近"),
    );
  });
});

describe("I1 multiple distinct endings", () => {
  it("reaches a different ending for different key actions", async () => {
    const warm = await walkRoute(WARM);
    const missed = await walkRoute(MISSED);
    const open = await walkRoute(OPEN);
    const accept = await walkRoute(ACCEPT);

    expect(buildEndingReview(warm.history).ending).toBe("warm");
    expect(buildEndingReview(missed.history).ending).toBe("missed");
    expect(buildEndingReview(open.history).ending).toBe("open");
    expect(buildEndingReview(accept.history).ending).toBe("accept");

    const texts = [warm, missed, open, accept].map((r) => r.current.paragraphs[0].text);
    expect(new Set(texts).size).toBe(4);
  });

  it("decides the ending by the path intents, not by history length", () => {
    expect(selectEnding(["engage", "persist", "engage"])).toBe("warm");
    expect(selectEnding(["withdraw", "withdraw", "withdraw"])).toBe("missed");
    expect(selectEnding(["hesitate", "hesitate", "hesitate"])).toBe("open");
    expect(selectEnding(["observe", "hesitate", "persist"])).toBe("accept");
  });

  it("lets free input alone drive an ending", async () => {
    const open = await walkRoute([free("犹豫"), free("担忧"), free("后悔")]);

    expect(open.current.isEnding).toBe(true);
    expect(buildEndingReview(open.history).ending).toBe("open");
  });
});

describe("I1 every valid route reaches an ending", () => {
  const routes = [WARM, MISSED, OPEN, ACCEPT, [free("看看"), free("看看"), free("看看")]];

  it("never ends early and always offers choices before the final beat", async () => {
    for (const route of routes) {
      const one = await walkRoute(route.slice(0, 1));
      const two = await walkRoute(route.slice(0, 2));

      expect(one.current.isEnding).toBe(false);
      expect(one.current.choices.length).toBeGreaterThan(0);
      expect(two.current.isEnding).toBe(false);
      expect(two.current.choices.length).toBeGreaterThan(0);
    }
  });

  it("ends with no further choices after three actions", async () => {
    for (const route of routes) {
      const full = await walkRoute(route);

      expect(full.current.isEnding).toBe(true);
      expect(full.current.choices).toEqual([]);
      expect(() => storySchema.parse(full.current)).not.toThrow();
    }
  });

  it("does not get stuck when asked to advance past the ending", async () => {
    const full = await walkRoute(WARM);
    const again = await submitAction({
      storyId: full.opening.id,
      title: full.opening.title,
      action: choice("mock-reach"),
      history: full.history,
    });

    expect(again.story.isEnding).toBe(true);
    expect(again.story.choices).toEqual([]);
  });
});

describe("I1 Mock transparency and contract", () => {
  it("keeps every branch node fictional, mock-labelled and schema-valid", async () => {
    const nodes = [
      buildMockOpeningStory({ title: INPUT.title }),
      (await walkRoute([choice("mock-look")])).current,
      (await walkRoute([choice("mock-forward")])).current,
      (await walkRoute([free("转身离开")])).current,
      (await walkRoute(WARM)).current,
      (await walkRoute(MISSED)).current,
      (await walkRoute(OPEN)).current,
      (await walkRoute(ACCEPT)).current,
    ];

    for (const node of nodes) {
      expect(() => storySchema.parse(node)).not.toThrow();
      expect(node.isMock).toBe(true);
      expect(node.provider).toBe("mock");
      expect(node.sourceType).toBe(SOURCE_TYPES.FICTIONAL);

      for (const paragraph of node.paragraphs) {
        expect(paragraph.sourceType).toBe(SOURCE_TYPES.FICTIONAL);
      }

      const serialized = JSON.stringify(node);
      expect(serialized).not.toContain(SOURCE_TYPES.IMAGE_OBSERVED);
      expect(serialized).not.toContain(SOURCE_TYPES.USER_CONFIRMED);
      expect(serialized).not.toContain(SOURCE_TYPES.AI_INFERRED);
    }
  });

  it("never repeats a paragraph within the same node", async () => {
    const nodes = [
      (await walkRoute([choice("mock-forward")])).current,
      (await walkRoute([choice("mock-forward"), choice("mock-closer")])).current,
      (await walkRoute(WARM)).current,
    ];

    for (const node of nodes) {
      const texts = node.paragraphs.map((p) => p.text);
      expect(new Set(texts).size).toBe(texts.length);
    }
  });
});

describe("I2 human-readable choice labels", () => {
  it("maps every offered choiceId to its registry label", async () => {
    const offered = new Set();
    const opening = buildMockOpeningStory({ title: INPUT.title });
    opening.choices.forEach((c) => offered.add(c.id));
    (await walkRoute([choice("mock-look")])).current.choices.forEach((c) => offered.add(c.id));
    (await walkRoute([choice("mock-forward")])).current.choices.forEach((c) => offered.add(c.id));

    expect(offered.size).toBeGreaterThan(0);

    for (const id of offered) {
      const label = getChoiceLabel(id);
      expect(label).not.toBe("一个自定义行动");
      expect(label).not.toContain(id);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("reuses the existing option wording", () => {
    expect(getChoiceLabel("mock-look")).toBe("环顾四周");
    expect(getChoiceLabel("mock-forward")).toBe("走向里间的门");
    expect(getChoiceLabel("mock-stay")).toBe("停在书架前");
    expect(getChoiceLabel("mock-closer")).toBe("推开里间的门");
  });

  it("degrades an unknown choiceId safely without exposing the code", () => {
    const label = getChoiceLabel("secret-internal-id");

    expect(label).toBe("一个自定义行动");
    expect(label).not.toContain("secret-internal-id");
  });
});

describe("I2 ending review matches the actual history", () => {
  it("renders key choices and free inputs with their plot results", async () => {
    const route = [choice("mock-forward"), free("我想伸手触碰那团暖光"), choice("mock-reach")];
    const { current, history } = await walkRoute(route);
    const review = buildEndingReview(history);

    expect(review.steps).toHaveLength(3);
    expect(review.steps[0].label).toBe("走向里间的门");
    expect(review.steps[1].kind).toBe("free");
    expect(review.steps[1].input).toBe("我想伸手触碰那团暖光");
    expect(review.steps[2].label).toBe("伸手触碰那团暖光");

    for (const step of review.steps) {
      expect(step.outcome.length).toBeGreaterThan(0);
    }

    expect(review.ending).toBe("warm");
    expect(review.endingNote).toContain("暖光");
    expect(current.isEnding).toBe(true);
  });

  it("truncates a long free input for display without altering the original", async () => {
    const long = "靠近".repeat(60);
    const { history } = await walkRoute([free(long), choice("mock-closer"), choice("mock-reach")]);
    const review = buildEndingReview(history);

    expect(review.steps[0].input.length).toBeLessThan(long.length);
    expect(review.steps[0].input.endsWith("…")).toBe(true);
    expect(history[0].text).toBe(long);
  });

  it("never exposes an unknown choiceId in the review payload", () => {
    const review = buildEndingReview([choice("secret-internal-id")]);

    expect(review.steps[0].label).toBe("一个自定义行动");
    expect(JSON.stringify(review)).not.toContain("secret-internal-id");
  });

  it("derives the same ending as the story the user actually reached", async () => {
    for (const [route, expected] of [
      [WARM, "warm"],
      [MISSED, "missed"],
      [OPEN, "open"],
      [ACCEPT, "accept"],
    ]) {
      const { current, history } = await walkRoute(route);
      const review = buildEndingReview(history);

      expect(review.ending).toBe(expected);
      expect(current.paragraphs).toEqual(
        buildMockActionStory({
          storyId: current.id,
          title: current.title,
          history: history.slice(0, -1),
          action: history[history.length - 1],
        }).paragraphs,
      );
    }
  });
});

describe("I1 refresh keeps history and branch consistent", () => {
  it("restores from storage and lands on the same branch as an unbroken run", async () => {
    const direct = await walkRoute(WARM);

    // Rebuild the store the way the client does, persist it, then restore it.
    let state = storyReducer(initialStoryState, {
      type: "startStory",
      story: direct.opening,
    });
    const history = [];

    for (const action of WARM.slice(0, 2)) {
      const next = await submitAction({
        storyId: direct.opening.id,
        title: direct.opening.title,
        action,
        history,
      });
      state = storyReducer(state, { type: "advanceStory", story: next.story, action });
      history.push(action);
    }

    const restored = readPersistedState(writePersistedState(state));
    expect(restored.history).toEqual(history);

    const finalAction = WARM[2];
    const afterReload = await submitAction({
      storyId: restored.story.id,
      title: restored.story.title,
      action: finalAction,
      history: restored.history,
    });

    expect(afterReload.story.paragraphs).toEqual(direct.current.paragraphs);
    expect(afterReload.story.isEnding).toBe(true);
  });
});

describe("I1 failure / retry does not regress", () => {
  it("rejects an invalid action and still serves the correct branch on retry", async () => {
    const { story } = await generateStory(INPUT);

    await expect(
      submitAction({ storyId: story.id, title: story.title, action: { type: "free", text: "  " } }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    const retry = await submitAction({
      storyId: story.id,
      title: story.title,
      action: choice("mock-forward"),
      history: [],
    });

    expect(retry.story.isEnding).toBe(false);
    expect(classifyActionIntent(choice("mock-forward"))).toBe("engage");
    expect(() => storySchema.parse(retry.story)).not.toThrow();
  });

  it("returns an identical story when the same request is retried", async () => {
    const { story } = await generateStory(INPUT);
    const input = {
      storyId: story.id,
      title: story.title,
      action: choice("mock-closer"),
      history: [choice("mock-forward")],
    };

    const first = await submitAction(input);
    const second = await submitAction(input);

    expect(first.story).toEqual(second.story);
  });
});