import { AI_PROVIDERS, SOURCE_TYPES } from "@/lib/constants";
import { createId } from "@/lib/utils";

// A bounded branching vignette. The plot is driven by the *intent* of every
// action the client carries (choices have a fixed intent; free text is
// classified by deterministic Chinese keyword rules), never by randomness, the
// clock or history length alone. It invents no people, relationships, dialogue
// or specific events: the "response" comes from the room and its warm light, so
// nothing here can be mistaken for a recovered memory. Every paragraph is pinned
// to `fictional`.
//
// Depth is fixed at three beats so every valid route reaches an ending without
// getting stuck, repeating or ending early. Which ending you reach depends on
// the whole path, not on how many steps you took.

const INTENTS = {
  ENGAGE: "engage",
  WITHDRAW: "withdraw",
  PERSIST: "persist",
  HESITATE: "hesitate",
  OBSERVE: "observe",
};

// Single source of truth for choice text. The same registry generates the
// offered choices and the human-readable review labels, so no duplicate copy is
// maintained. Ids are stable; unknown ids degrade safely in getChoiceLabel.
const CHOICE_REGISTRY = {
  "mock-look": { label: "环顾四周", intent: INTENTS.OBSERVE },
  "mock-forward": { label: "走向里间的门", intent: INTENTS.ENGAGE },
  "mock-stay": { label: "停在书架前", intent: INTENTS.HESITATE },
  "mock-closer": { label: "推开里间的门", intent: INTENTS.PERSIST },
  "mock-reach": { label: "伸手触碰那团暖光", intent: INTENTS.ENGAGE },
  "mock-leave": { label: "转身离开这间屋子", intent: INTENTS.WITHDRAW },
};

const OPENING_CHOICES = ["mock-look", "mock-forward"];
const BEAT1_CHOICES = ["mock-stay", "mock-closer"];
const BEAT2_CHOICES = ["mock-closer", "mock-reach", "mock-leave"];

// Deterministic keyword rules. First matching category wins; the order is fixed
// so the same sentence always lands on the same intent. This is a light
// heuristic, not real NLP or semantic understanding. Unrecognised text falls
// through to OBSERVE, which reads as a natural "keep looking" default.
const KEYWORD_RULES = [
  [
    INTENTS.ENGAGE,
    ["沟通", "表达", "解释", "说明", "靠近", "走近", "伸手", "出声", "开口", "回应", "触摸", "触碰", "拿起", "打招呼"],
  ],
  [
    INTENTS.WITHDRAW,
    ["离开", "走开", "转身", "后退", "退后", "逃避", "逃", "沉默", "不语", "不想", "放弃", "关门", "关上", "扭头", "走人"],
  ],
  [
    INTENTS.PERSIST,
    ["坚持", "尝试", "继续", "再试", "试试", "推开", "打开", "推", "敲", "翻", "寻找", "找", "努力", "不放弃"],
  ],
  [
    INTENTS.HESITATE,
    ["犹豫", "担忧", "担心", "后悔", "害怕", "怕", "不确定", "迟疑", "停下", "停住", "愣", "怔", "纠结", "不安"],
  ],
  [INTENTS.OBSERVE, ["环顾", "观察", "打量", "注视", "看看", "看", "望"]],
];

export function classifyFreeTextIntent(text) {
  const value = String(text ?? "");

  for (const [intent, keywords] of KEYWORD_RULES) {
    if (keywords.some((keyword) => value.includes(keyword))) {
      return intent;
    }
  }

  return INTENTS.OBSERVE;
}

export function classifyActionIntent(action) {
  if (action?.type === "choice") {
    return CHOICE_REGISTRY[action.choiceId]?.intent ?? INTENTS.OBSERVE;
  }

  if (action?.type === "free") {
    return classifyFreeTextIntent(action.text);
  }

  return INTENTS.OBSERVE;
}

const OPENING_PARAGRAPHS = [
  "你推开一扇虚掩的门，走进一间安静的屋子。午后的光从半开的窗斜进来，在地板上切出一道明亮的边，尘埃在光里缓缓浮动。",
  "屋里没有人，只有旧木头和纸张的气味。墙边立着一排褪色的书架，尽头还有一道通往里间的门，一切都安静得像在等你先迈出第一步。",
];

// beat1 situation per stance reached after the first action.
const BEAT1_SITUATION = {
  approach:
    "你朝里间的门走去。脚下的木地板发出轻微的声响，门缝下那线暖光随着你的靠近一点点变宽，像屋子察觉到了你的主动。",
  withdraw:
    "你往后退了一步，背脊贴上微凉的墙。暖光没有追过来，反而在你眼前缩成细细的一线，仿佛刚才那个可以上前的瞬间，正悄悄从指缝里溜走。",
  linger:
    "你在原地停住，目光顺着书架一排排扫过去。书脊上的名字看不清，光斑在地板上缓缓移动，屋子并不催你，只是安静地陪你站着。",
};

// The room's immediate reaction to the first action's intent. This is where a
// choice or a free sentence visibly changes what happens next, not just wording.
const BEAT1_REACTION = {
  [INTENTS.ENGAGE]:
    "你主动靠近的这一步，让门后的暖意轻轻应了一声，像有什么被遗忘的东西，终于等到了有人愿意先伸手。",
  [INTENTS.WITHDRAW]:
    "你没有出声，也没有上前。那道门依旧虚掩着，只是这一次，它不再像是为你而留——一次交流的机会，就这样安静地错开了。",
  [INTENTS.PERSIST]:
    "你试着再往前一点，指尖几乎要碰到门框。木头发出极轻的一响，仿佛屋子在回应你的坚持：再试一次，也许就能推开。",
  [INTENTS.HESITATE]:
    "你的犹豫落在空气里，屋子没有替你决定。暖光忽明忽暗，像在等你把那句没说完的话，自己补完。",
  [INTENTS.OBSERVE]:
    "你只是看着，没有惊动什么。尘埃在光里翻了个身，屋子把它的安静原样交还给你，不多一分，也不少一分。",
};

// beat2 lead per stance reached after the second action.
const BEAT2_LEAD = {
  closer:
    "你离那道暖光更近了。空气里多了一点陈旧的温度，像晒过太阳的棉被，又像很久以前某个下午残留下来的余温。",
  distant:
    "你与那道暖光之间，重新隔开了几步的距离。屋子暗了一角，方才几乎要触到的东西，又退回到看不清的深处。",
  threshold:
    "你站在里间的门槛上，没有进去，也没有离开。暖光就在脚边，像一句到了嘴边却还没说出口的话。",
};

// An echo of the first stance, so an early choice keeps shaping later prose.
const BEAT1_ECHO = {
  approach: "方才你主动走近的那几步，此刻都还算数。",
  withdraw: "你先前退开的那一步，让屋子安静了几分。",
  linger: "你之前的停留，让这一刻显得格外长。",
};

const BEAT2_REACTION = {
  [INTENTS.ENGAGE]:
    "你伸出手，暖光顺着指尖漫上来。里间的轮廓清晰了一瞬——那件被遗忘的东西，似乎愿意被你重新想起。",
  [INTENTS.WITHDRAW]:
    "你转过身，把暖光留在身后。门在背后轻轻合拢，有些话一旦没说出口，就只剩屋子替你记着。",
  [INTENTS.PERSIST]:
    "你用力推那扇门，它终于让开一道缝。陈旧的光涌出来，像坚持了很久的事，忽然有了回音。",
  [INTENTS.HESITATE]:
    "你还是没能迈过那道门槛。暖光等着，屋子也等着，故事把决定权原封不动地交回你手里。",
  [INTENTS.OBSERVE]:
    "你静静看着这一切，没有伸手，也没有退开。屋子把你的注视收了下来，像收下一段不需要结论的时光。",
};

const ENDINGS = {
  warm: [
    "你终于走到暖光深处。那件被遗忘很久的东西，在你主动靠近、又试着推开之后，安安静静地显出了轮廓——原来它一直在这里，等一个愿意上前的人。",
    "屋子亮了起来，像一段被重新想起的时光。这一段想象不构成任何关于你真实记忆的断言，它只是把你主动走过的每一步，收成了一个温暖的结尾。",
  ],
  missed: [
    "你离开了这间屋子。门在身后合上，暖光被关在里面，那件几乎要触到的东西，终究没能被你想起。有些交流的机会，一旦退开，就只剩安静。",
    "走廊的光比屋里冷一些。这一段想象不构成任何关于你真实记忆的断言，它只是陪你把「错过」这条路线走完——你随时可以重新开始，换一种走法。",
  ],
  open: [
    "你始终站在门槛上，没有进去，也没有离开。暖光忽明忽暗，那件被遗忘的东西仍在里间等着，故事没有替你给出答案。",
    "也许犹豫本身也是一种回答。这一段想象不构成任何关于你真实记忆的断言，它把结尾留成一道敞开的门，等你下一次自己决定要不要迈过去。",
  ],
  accept: [
    "光慢慢暗了下去，屋子的轮廓融进一片柔和的暮色里。你没有刻意靠近，也没有执意离开，只是把这一段路安静地走完，屋子便把你的每一步都收了下来。",
    "故事到这里就停了。这一段想象不构成任何关于你真实记忆的断言，它只是陪你把这段流程走完。你可以重新开始，换一段文字、换一种走法，再走一遍。",
  ],
};

// Short plot-result phrases for the ending review. They describe what the room
// did, never the user's psychology, and never claim a real experience.
const REVIEW_OUTCOME = {
  [INTENTS.ENGAGE]: "你主动上前，屋子给了暖意回应。",
  [INTENTS.WITHDRAW]: "你退开或离开，一次交流的机会错开了。",
  [INTENTS.PERSIST]: "你试着推进，门让开了一道缝。",
  [INTENTS.HESITATE]: "你停在原地，故事把决定留给了你。",
  [INTENTS.OBSERVE]: "你安静观察，屋子原样收下了这一步。",
};

const ENDING_NOTE = {
  warm: "因为你多半选择了主动靠近与坚持，故事走向了「重新想起」的暖光结尾。",
  missed: "因为你在关键的一步选择了退开或离开，故事走向了「错过」的安静结尾。",
  open: "因为你多次犹豫、停在门槛上，故事没有替你给出答案，留成了敞开的结尾。",
  accept: "你的走法安静而克制，没有刻意靠近也没有执意离开，故事收成了一个平和的结尾。",
};

function stanceOf(intent) {
  if (intent === INTENTS.ENGAGE || intent === INTENTS.PERSIST) {
    return "approach";
  }

  if (intent === INTENTS.WITHDRAW) {
    return "withdraw";
  }

  return "linger";
}

function beat2StanceOf(intent) {
  if (intent === INTENTS.ENGAGE || intent === INTENTS.PERSIST) {
    return "closer";
  }

  if (intent === INTENTS.WITHDRAW) {
    return "distant";
  }

  return "threshold";
}

// The ending is decided by the whole path's intents, not by its length.
export function selectEnding(intents) {
  const count = (target) => intents.filter((intent) => intent === target).length;
  const approach = count(INTENTS.ENGAGE) + count(INTENTS.PERSIST);
  const withdraw = count(INTENTS.WITHDRAW);
  const hesitate = count(INTENTS.HESITATE);

  if (withdraw >= 1 && withdraw >= approach) {
    return "missed";
  }

  if (approach >= 2 && withdraw === 0) {
    return "warm";
  }

  if (hesitate >= 2) {
    return "open";
  }

  return "accept";
}

function choicesFor(ids) {
  return ids.map((id) => ({ id, label: CHOICE_REGISTRY[id].label }));
}

function paragraphsOf(texts) {
  return texts.map((text) => ({ text, sourceType: SOURCE_TYPES.FICTIONAL }));
}

function assemble(id, title, { paragraphs, choices, isEnding }) {
  return {
    id,
    title,
    paragraphs: paragraphsOf(paragraphs),
    choices: choicesFor(choices),
    isEnding,
    provider: AI_PROVIDERS.MOCK,
    isMock: true,
    sourceType: SOURCE_TYPES.FICTIONAL,
  };
}

export function buildMockOpeningStory({ title }) {
  return assemble(createId(), title, {
    paragraphs: OPENING_PARAGRAPHS,
    choices: OPENING_CHOICES,
    isEnding: false,
  });
}

// Stateless on purpose: the whole path comes from the history the client carries
// plus the current action, so a page reload restores the Store and the next
// action still lands on the same branch under the same title.
export function buildMockActionStory({ storyId, title, history, action }) {
  const path = [...(history ?? []), action];
  const intents = path.map(classifyActionIntent);
  const step = path.length;

  if (step >= 3) {
    const ending = selectEnding(intents);

    return assemble(storyId, title, {
      paragraphs: ENDINGS[ending],
      choices: [],
      isEnding: true,
    });
  }

  if (step === 1) {
    const stance = stanceOf(intents[0]);

    return assemble(storyId, title, {
      paragraphs: [BEAT1_SITUATION[stance], BEAT1_REACTION[intents[0]]],
      choices: BEAT1_CHOICES,
      isEnding: false,
    });
  }

  const stance1 = stanceOf(intents[0]);
  const stance2 = beat2StanceOf(intents[1]);

  return assemble(storyId, title, {
    paragraphs: [BEAT2_LEAD[stance2] + BEAT1_ECHO[stance1], BEAT2_REACTION[intents[1]]],
    choices: BEAT2_CHOICES,
    isEnding: false,
  });
}

// Presentation metadata for the branching UI. Tones map to the ambient palette
// so the interface colour follows the story's actual stance, not a fixed theme.
export const INTENT_META = {
  [INTENTS.ENGAGE]: { label: "主动", glyph: "◈", tone: "warm" },
  [INTENTS.WITHDRAW]: { label: "退开", glyph: "◁", tone: "cool" },
  [INTENTS.PERSIST]: { label: "坚持", glyph: "▲", tone: "ember" },
  [INTENTS.HESITATE]: { label: "犹豫", glyph: "◍", tone: "dusk" },
  [INTENTS.OBSERVE]: { label: "观察", glyph: "◎", tone: "paper" },
};

export const ENDING_META = {
  warm: { title: "重新想起", tone: "warm" },
  missed: { title: "错过", tone: "cool" },
  open: { title: "敞开的门", tone: "dusk" },
  accept: { title: "平和收尾", tone: "paper" },
};

const BEATS_TOTAL = 3;

// Pure trajectory read-model for the branching UI. `reachable` enumerates every
// completion of the remaining beats, so the ending map shows which endings the
// current path can still reach — real state, not decoration.
export function describeTrajectory(history) {
  const actions = history ?? [];
  const intents = actions.map(classifyActionIntent);

  const steps = actions.map((action, index) => ({
    index: index + 1,
    kind: action.type,
    label: action.type === "choice" ? getChoiceLabel(action.choiceId) : "自由输入",
    input: action.type === "free" ? truncate(action.text, 40) : null,
    intent: intents[index],
  }));

  const leading = selectEnding(intents);
  const remaining = Math.max(0, BEATS_TOTAL - intents.length);
  const reachable = new Set();

  if (remaining === 0) {
    reachable.add(leading);
  } else {
    const pool = Object.values(INTENTS);

    const walk = (prefix) => {
      if (prefix.length === remaining) {
        reachable.add(selectEnding([...intents, ...prefix]));
        return;
      }

      for (const intent of pool) {
        walk([...prefix, intent]);
      }
    };

    walk([]);
  }

  const tone =
    intents.length >= BEATS_TOTAL
      ? ENDING_META[leading].tone
      : intents.length
        ? INTENT_META[intents[intents.length - 1]].tone
        : "paper";

  return {
    steps,
    intents,
    leading,
    reachable: [...reachable],
    tone,
    beats: BEATS_TOTAL,
  };
}

// Human-readable label for any choice id. Unknown ids (e.g. a future real-AI
// provider's own ids) degrade to a neutral phrase and never expose the raw code.
export function getChoiceLabel(choiceId) {
  return CHOICE_REGISTRY[choiceId]?.label ?? "一个自定义行动";
}

function truncate(text, max) {
  const value = String(text ?? "");

  return value.length > max ? `${value.slice(0, max)}…` : value;
}

// Presentation helper for the Mock lane. It reads only the carried history, so
// the ending review always matches the actions the user actually took. A real
// AI lane would supply its own review behind the same service seam.
export function buildEndingReview(history) {
  const actions = history ?? [];
  const intents = actions.map(classifyActionIntent);

  const steps = actions.map((action, index) => {
    const intent = intents[index];

    return {
      index: index + 1,
      kind: action.type,
      label: action.type === "choice" ? getChoiceLabel(action.choiceId) : "自由输入",
      input: action.type === "free" ? truncate(action.text, 40) : null,
      outcome: REVIEW_OUTCOME[intent],
    };
  });

  const ending = selectEnding(intents);

  return { steps, ending, endingNote: ENDING_NOTE[ending] };
}