import { AI_PROVIDERS, SOURCE_TYPES } from "@/lib/constants";
import { createId } from "@/lib/utils";

// A single continuous vignette that advances one beat per action, so the flow
// reads as a playable story rather than repeated filler. It deliberately invents
// no people, relationships, dialogue or specific events, and every paragraph is
// pinned to `fictional` so it can never be mistaken for a recovered memory.
const MOCK_STORY_STEPS = 3;

const MOCK_SEGMENTS = [
  [
    "你推开一扇虚掩的门，走进一间安静的屋子。午后的光从半开的窗斜进来，在地板上切出一道明亮的边，尘埃在光里缓缓浮动。",
    "屋里没有人，只有旧木头和纸张的气味。墙边立着一排褪色的书架，尽头还有一道通往里间的门，一切都安静得像在等你先迈出第一步。",
  ],
  [
    "你顺着方才的行动往前。脚下的木地板发出轻微的声响，光斑随着你的位置缓缓移动，仿佛这间屋子也在悄悄调整呼吸。",
    "书架上的书脊看不清名字。里间的门缝下透出一线更暖的光，那里似乎放着某样被遗忘很久的东西，正等着被人重新想起。",
  ],
  [
    "你离那道暖光更近了。空气里多了一点陈旧的温度，像晒过太阳的棉被，又像很久以前某个下午残留下来的余温。",
    "你忽然明白，这间屋子并不急着给你答案。它只是把你走过的每一步都收了下来，等你自己决定要不要走到结尾。",
  ],
  [
    "光慢慢暗了下去，屋子的轮廓融进一片柔和的暮色里。你走过的路在身后合拢，像一本被轻轻翻到最后一页的书。",
    "故事到这里就停了。这一段想象不构成任何关于你真实记忆的断言，它只是陪你把这段流程走完。你可以重新开始，换一段文字再走一遍。",
  ],
];

const MOCK_CHOICES = [
  [
    { id: "mock-look", label: "环顾四周" },
    { id: "mock-forward", label: "走向里间的门" },
  ],
  [
    { id: "mock-stay", label: "停在书架前" },
    { id: "mock-closer", label: "推开里间的门" },
  ],
  [{ id: "mock-finish", label: "走向结尾" }],
  [],
];

function segment(step) {
  const index = Math.min(step, MOCK_SEGMENTS.length - 1);

  return {
    paragraphs: MOCK_SEGMENTS[index].map((text) => ({
      text,
      sourceType: SOURCE_TYPES.FICTIONAL,
    })),
    choices: MOCK_CHOICES[index],
    isEnding: index >= MOCK_STORY_STEPS,
  };
}

function assemble(id, title, step) {
  return {
    id,
    title,
    ...segment(step),
    provider: AI_PROVIDERS.MOCK,
    isMock: true,
    sourceType: SOURCE_TYPES.FICTIONAL,
  };
}

export function buildMockOpeningStory({ title }) {
  return assemble(createId(), title, 0);
}

// Stateless on purpose: the step comes from the history the client carries, so a
// page reload cannot desynchronise the mock from the restored Store.
export function buildMockActionStory({ storyId, title, history }) {
  return assemble(storyId, title, history.length + 1);
}