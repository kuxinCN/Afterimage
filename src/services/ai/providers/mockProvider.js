import {
  AI_PROVIDERS,
  ERROR_CODES,
  SCENE_BACKGROUND_TYPES,
  SCENE_HOTSPOT_TYPE,
  SCENE_LIMITS,
  SCENE_TYPES,
  SOURCE_TYPES,
} from "@/lib/constants";
import { analysisInputSchema } from "@/schemas/analysisSchema";
import { sceneGenerationInputSchema } from "@/schemas/sceneSchema";
import { assignHotspotIds, resolveTemplate, templateSlots } from "@/services/scene/sceneTemplates";
import { AiError } from "../aiProvider";

// Keyword tables only ever pick words the user already typed. Nothing here
// claims to know what a photo shows.
const SCENE_RULES = [
  {
    type: SCENE_TYPES.CAFETERIA,
    label: "食堂",
    keywords: ["食堂", "餐厅", "午饭", "晚饭", "早饭", "早餐", "午餐", "晚餐", "吃饭", "餐盘", "打饭"],
  },
  {
    type: SCENE_TYPES.CLASSROOM,
    label: "教室",
    keywords: ["教室", "上课", "黑板", "课桌", "自习", "考试", "晚自习", "课堂"],
  },
  {
    type: SCENE_TYPES.BEDROOM,
    label: "卧室",
    keywords: ["卧室", "床", "睡前", "午睡", "房间"],
  },
  {
    type: SCENE_TYPES.STREET,
    label: "街道",
    keywords: ["街", "马路", "巷子", "路口", "门口", "车站", "公交", "地铁", "天桥"],
  },
  {
    type: SCENE_TYPES.OUTDOOR,
    label: "户外",
    keywords: ["操场", "公园", "海边", "河", "山", "天空", "田野", "草地", "下雨", "雪"],
  },
];

const OBJECT_KEYWORDS = [
  "餐盘", "碗", "筷子", "桌子", "椅子", "窗户", "黑板", "课桌", "床", "书包", "笔", "书",
  "球", "自行车", "伞", "杯子", "灯", "门", "跑道", "面包", "饮料", "电视", "沙发", "台阶", "树",
];

const TIME_KEYWORDS = [
  "昨天", "前天", "今天", "上午", "中午", "下午", "傍晚", "晚上", "夜里", "周末",
  "春天", "夏天", "秋天", "冬天", "开学", "毕业", "过年", "小时候",
];

const PLACE_KEYWORDS = [
  "学校", "家里", "老家", "教室", "食堂", "操场", "公园", "车站", "图书馆", "宿舍", "楼下", "门口",
];

// People, relationships and feelings belong to the user. The mock reports that
// it found such words and stops there.
const PERSON_WORDS = [
  "妈妈", "爸爸", "姐姐", "哥哥", "弟弟", "妹妹", "同学", "朋友", "老师", "同事", "室友", "他们", "她们",
];

const FEELING_WORDS = ["开心", "难过", "害怕", "想念", "生气", "紧张", "委屈", "激动", "孤单", "舒服"];

const KEYWORD_CONFIDENCE = 0.45;

function findMatches(text, words) {
  const hits = [];

  for (const word of words) {
    const index = text.indexOf(word);

    if (index >= 0) {
      hits.push({ word, index });
    }
  }

  return hits.sort((a, b) => a.index - b.index || a.word.localeCompare(b.word)).map((hit) => hit.word);
}

function providerItem(value, confidence = KEYWORD_CONFIDENCE) {
  return {
    value,
    baseline: value,
    sourceType: SOURCE_TYPES.AI_INFERRED,
    sourceIds: [],
    confidence,
    confirmed: false,
    adopted: false,
  };
}

function userItem(value) {
  return {
    value,
    baseline: value,
    sourceType: SOURCE_TYPES.USER_CONFIRMED,
    sourceIds: [],
    confidence: 1,
    confirmed: true,
    adopted: true,
  };
}

function dedupe(values) {
  return [...new Set(values)];
}

// The summary is the user's own wording: the description when there is one,
// otherwise the title. Never a rewritten sentence.
function userItemFor(description, title) {
  const text = description || title;

  return text ? userItem(text.slice(0, 500)) : null;
}

// The mock never reads pixels, so a hotspot position is an arrangement, not an
// observation. Every hotspot carries this note and the ai_inferred label.
const SCENE_HOTSPOT_NOTE = "位置由 Mock 模拟排布，不代表照片中的真实位置。";

export const mockProvider = {
  name: AI_PROVIDERS.MOCK,

  async analyze(input) {
    let parsed;

    try {
      parsed = analysisInputSchema.parse(input);
    } catch (error) {
      throw new AiError(
        ERROR_CODES.AI_INVALID_INPUT,
        "分析请求缺少必要字段，已中止",
        { cause: error },
      );
    }

    const description = parsed.description.trim();
    const title = parsed.title.trim();
    // The title and the description are both user text. Image metadata never is.
    const haystack = `${title}\n${description}`;
    const hasUserText = Boolean(title || description);
    const imageCount = parsed.imageCount;

    const sceneHits = SCENE_RULES.map((rule) => {
      const matched = findMatches(haystack, rule.keywords);

      return matched.length > 0
        ? { ...rule, score: matched.length, firstIndex: haystack.indexOf(matched[0]) }
        : null;
    }).filter(Boolean);

    // The rule with the most evidence wins; position and name break ties, so
    // the same input always produces the same scene.
    const scene = sceneHits.sort(
      (a, b) => b.score - a.score || a.firstIndex - b.firstIndex || a.type.localeCompare(b.type),
    )[0];

    const objectHits = findMatches(haystack, OBJECT_KEYWORDS);
    const timeHits = findMatches(haystack, TIME_KEYWORDS);
    const placeHits = findMatches(haystack, PLACE_KEYWORDS);
    const personHits = findMatches(haystack, PERSON_WORDS);
    const feelingHits = findMatches(haystack, FEELING_WORDS);

    const times = dedupe([
      ...(parsed.date ? [parsed.date] : []),
      ...timeHits,
    ]);

    const places = dedupe([...(parsed.location ? [parsed.location] : []), ...placeHits]);

    const tags = [];

    if (scene) {
      tags.push(scene.label);
    }
    tags.push(imageCount > 0 ? "含照片" : "纯文字");

    const missing = [
      "本结果由 Mock Provider 按关键词生成，没有读取任何照片像素，也没有真实视觉识别能力。",
    ];

    if (!hasUserText) {
      missing.push("标题和描述都是空的：请补充你记得的时间、地点和发生了什么，否则无法整理出场景与元素。");
    }
    if (imageCount === 0) {
      missing.push("这段记忆还没有照片，后续做场景重建时会缺少可视依据。");
    }
    if (!scene) {
      missing.push("没能从文字里判断场景类型，可以在下面手动选择。");
    }
    if (personHits.length > 0 || feelingHits.length > 0) {
      missing.push("描述中提到人物或情绪，这些内容不会被自动推断，请自行确认。");
    }

    const quality =
      hasUserText && imageCount > 0 && scene
        ? "A"
        : hasUserText && (imageCount > 0 || scene)
          ? "B"
          : "C";

    return {
      provider: AI_PROVIDERS.MOCK,
      simulated: true,
      generatedAt: Date.now(),
      revision: 1,
      basedOn: {
        imageCount,
        descriptionLength: description.length,
        hasDate: Boolean(parsed.date),
        hasLocation: Boolean(parsed.location),
      },
      quality,
      summary: userItemFor(description, title),
      scene: scene ? { type: scene.type, title: `${scene.label}场景`, sourceType: SOURCE_TYPES.AI_INFERRED } : null,
      elements: objectHits.map((word) => providerItem(word)),
      tags: tags.map((word) => providerItem(word, scene ? 0.5 : 0.4)),
      times: times.map((value) => (value === parsed.date ? userItem(value) : providerItem(value))),
      places: places.map((value) => (value === parsed.location ? userItem(value) : providerItem(value))),
      missing: missing.slice(0, 8),
    };
  },

  async buildScene(input) {
    let parsed;

    try {
      parsed = sceneGenerationInputSchema.parse(input);
    } catch (error) {
      throw new AiError(
        ERROR_CODES.AI_INVALID_INPUT,
        "场景生成请求缺少必要字段，已中止",
        { cause: error },
      );
    }

    const template = resolveTemplate(parsed.sceneType);
    const slots = templateSlots(template);
    const names = dedupe(parsed.objects).slice(0, SCENE_LIMITS.MAX_HOTSPOTS);
    const ids = assignHotspotIds(names);

    return {
      memoryId: parsed.memoryId,
      template,
      // The user's own title, never a sentence the mock invented.
      title: parsed.title,
      background: { type: SCENE_BACKGROUND_TYPES.TEMPLATE, assetId: null },
      hotspots: names.map((name, index) => ({
        id: ids[index],
        name,
        type: SCENE_HOTSPOT_TYPE,
        position: slots[index],
        sourceIds: [],
        description: SCENE_HOTSPOT_NOTE,
        sourceType: SOURCE_TYPES.AI_INFERRED,
      })),
    };
  },
};
