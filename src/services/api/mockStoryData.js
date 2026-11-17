import { AI_PROVIDERS, SOURCE_TYPES } from "@/lib/constants";
import { createId } from "@/lib/utils";

// Everything here is scaffolding for the front-end flow. It deliberately invents
// no people, relationships, dialogue or events, and every paragraph is pinned to
// `fictional` so it can never be mistaken for a recovered memory.
const MOCK_STORY_STEPS = 3;

const MOCK_SEGMENTS = [
  [
    "故事从这里开始。下面几段都是 Mock 占位文字，只用来跑通页面流程。",
    "正式文本由 B 的故事接口生成，会带上明确的溯源标记，不会伪装成对你记忆的还原。",
  ],
  [
    "这是第二段 Mock 占位内容。你刚刚的行动已经被记进行动历史。",
    "故事文字、行动选项和自由输入框由同一份状态驱动，所以它们不会各说各话。",
  ],
  [
    "这是第三段 Mock 占位内容，流程接近结尾。",
    "再走一步就会进入结尾页，那里会汇总你这一路做过的选择。",
  ],
  [
    "故事走到结尾。这一路的每一步都是 Mock 占位内容，不构成任何关于你真实记忆的断言。",
    "你可以重新开始，换一段文字再走一遍流程。",
  ],
];

const MOCK_CHOICES = [
  [
    { id: "mock-look", label: "环顾四周" },
    { id: "mock-forward", label: "向前一步" },
  ],
  [
    { id: "mock-stay", label: "停在原地" },
    { id: "mock-closer", label: "再靠近一点" },
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