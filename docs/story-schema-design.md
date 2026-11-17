# T2 · Story Zod Schema 设计

状态：设计定稿（仅文档，不含 src 实现；样例已用临时 vitest 套件实测，见 §7）
输入：T1 `docs/story-domain-model.md`、`src/schemas/sourceSchema.js`、`src/schemas/analysisSchema.js`、`src/schemas/sceneSchema.js`、`src/schemas/memorySchema.js`、`src/services/storage/sceneRepository.js`、`src/services/ai/aiService.js`、AGENTS.md §4/§5/§6

## 0. 设计依据（既有模式事实）

- 溯源五字段（value / sourceType / sourceIds / confidence / confirmed）由 `sourcedValueBaseSchema` 承载，`assertConfirmedProvenance` 保证只有 `user_confirmed` 可标 `confirmed: true`（sourceSchema.js:23-33）。
- 裸字符串被刻意拒绝：溯源不从值的形状推断，"用户确认"必须经 `userConfirmedValue` / `confirmedCopy` 这类可 grep 的入口（sourceSchema.js:35-47 的设计动机，ef68a3b 修复）。
- 审阅语义：`baseline` = provider 原始措辞（用户编辑落在 `value`），`adopted` = 用户采纳标记；只有 adopted 条目经 `confirmedCopy` 投影进确认事实（analysisSchema.js:23-34、aiService.js:157-158）。
- patch 模式：`xxxPatchSchema = xxxSchema.omit({ id, memoryId, createdAt }).partial()`；仓库 update 先校验 patch，再合并已有行用**完整 schema** 二次校验（sceneRepository.js:75-94）。跨字段不变量因此可以在完整 schema 上强制，patch 只需形状合法。
- Zod 3 陷阱：`.superRefine()` 返回 ZodEffects，**没有** `.omit/.partial`。sceneSchema 把 refine 全部放在嵌套子 schema 上以保持顶层是 ZodObject。Story 有顶层跨字段约束（sceneId/sceneVersion 成对、hotspotIds 门控），所以必须拆出 `storyBaseSchema`（纯 ZodObject）供 patch/draft 派生。
- provider 边界：不传文件名与图片字节（analysisSchema.js:98-99、sceneSchema.js:86-87）；draft 带 `provider / simulated: true / generatedAt`（analysisDraftSchema）。

## 1. 常量草案（constants.js 追加，风格同 ANALYSIS_LIMITS / SCENE_LIMITS）

```js
export const STORY_LIMITS = {
  MAX_BEATS: 12,
  MAX_BEAT_LENGTH: 1000,
};

export const STORY_INITIAL_VERSION = 1;
```

- `hotspotIds` 上限复用 `SCENE_LIMITS.MAX_HOTSPOTS`（24），不新增常量：一个 beat 最多引用场景里全部热点。
- title 上限沿用既有 120 字面量（memorySchema / sceneSchema 同款）。
- `STORES.stories` / `INDEXES.stories` / DB_VERSION 升级属 T3（db 层），schema 不依赖它们。
- 不新增 SOURCE_TYPES、不新增 status 枚举（T1 §2.3 约束）。

## 2. storySchema.js 完整草案

```js
import { z } from "zod";

import {
  AI_PROVIDERS,
  ANALYSIS_LIMITS,
  SCENE_LIMITS,
  SCENE_TYPE_LIST,
  SOURCE_TYPES,
  STORY_INITIAL_VERSION,
  STORY_LIMITS,
} from "@/lib/constants";
import {
  assertConfirmedProvenance,
  sourceTypeSchema,
  sourcedValueBaseSchema,
} from "@/schemas/sourceSchema";

const { MAX_BEATS, MAX_BEAT_LENGTH } = STORY_LIMITS;

const beatText = z.string().trim().min(1).max(MAX_BEAT_LENGTH);

const hotspotIdListSchema = z
  .array(z.string().min(1))
  .max(SCENE_LIMITS.MAX_HOTSPOTS)
  .default([])
  .superRefine((ids, ctx) => {
    const seen = new Set();
    ids.forEach((id, index) => {
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate hotspot id: ${id}`,
          path: [index],
        });
      }
      seen.add(id);
    });
  });

// Narrative is AI-authored first, so user_confirmed is only reachable through
// adoption. The gate lives in the schema because story patches replace beats
// without passing a review service.
function assertBeatAdoption(beat, ctx) {
  if (beat.sourceType === SOURCE_TYPES.USER_CONFIRMED && (!beat.adopted || !beat.confirmed)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A user_confirmed beat must be adopted and confirmed",
      path: ["adopted"],
    });
  }
  if (
    beat.adopted &&
    beat.sourceType !== SOURCE_TYPES.USER_CONFIRMED &&
    beat.sourceType !== SOURCE_TYPES.FICTIONAL
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only user_confirmed or fictional beats may be adopted",
      path: ["sourceType"],
    });
  }
}

function buildStoryBeat({ sourceType, adopted }) {
  return sourcedValueBaseSchema
    .extend({
      id: z.string().min(1),
      value: beatText,
      // The untouched provider wording; user edits land in value (same contract
      // as analysisItemSchema.baseline).
      baseline: beatText,
      sourceType,
      adopted,
      hotspotIds: hotspotIdListSchema,
    })
    .superRefine(assertConfirmedProvenance)
    .superRefine(assertBeatAdoption);
}

export const storyBeatSchema = buildStoryBeat({
  sourceType: sourceTypeSchema,
  adopted: z.boolean().default(false),
});

// Provider output can never claim confirmation or adoption: story regeneration
// has no "match an existing confirmed value" merge, adoption is a user act.
const storyDraftBeatSchema = buildStoryBeat({
  sourceType: z.enum([SOURCE_TYPES.AI_INFERRED, SOURCE_TYPES.FICTIONAL]),
  adopted: z.literal(false).default(false),
});

function buildBeatList(beatSchema) {
  return z
    .array(beatSchema)
    .min(1)
    .max(MAX_BEATS)
    .superRefine((beats, ctx) => {
      const seen = new Set();
      beats.forEach((beat, index) => {
        if (seen.has(beat.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate beat id: ${beat.id}`,
            path: [index, "id"],
          });
        }
        seen.add(beat.id);
      });
    });
}

const storyFields = {
  memoryId: z.string().min(1),
  sceneId: z.string().min(1).nullable().default(null),
  sceneVersion: z.number().int().positive().nullable().default(null),
  title: z.string().trim().min(1).max(120),
  version: z.number().int().positive().default(STORY_INITIAL_VERSION),
};

function assertSceneBinding(story, ctx) {
  if ((story.sceneId === null) !== (story.sceneVersion === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "sceneId and sceneVersion must be set together",
      path: ["sceneVersion"],
    });
  }
  if (story.sceneId === null) {
    story.beats.forEach((beat, index) => {
      if (beat.hotspotIds.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "hotspotIds require a bound scene",
          path: ["beats", index, "hotspotIds"],
        });
      }
    });
  }
}

// Plain ZodObject so patch/draft can use omit/extend; the cross-field refine
// would turn it into ZodEffects and break derivation.
const storyBaseSchema = z
  .object({
    id: z.string().min(1),
    ...storyFields,
    beats: buildBeatList(storyBeatSchema),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
  })
  .strict();

export const storySchema = storyBaseSchema.superRefine(assertSceneBinding);

// memoryId is the ownership link and stays fixed after creation. Cross-field
// invariants are enforced by the repository's merged full-schema validation
// (same pattern as sceneRepository.update), not by the partial patch.
export const storyPatchSchema = storyBaseSchema
  .omit({ id: true, memoryId: true, createdAt: true })
  .partial();

// The provider's output before the repository stamps id and timestamps.
export const storyDraftSchema = storyBaseSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    provider: z.enum(Object.values(AI_PROVIDERS)),
    simulated: z.literal(true),
    generatedAt: z.number().int().nonnegative(),
    beats: buildBeatList(storyDraftBeatSchema),
  })
  .superRefine(assertSceneBinding);

// What the story provider is allowed to see: the user's own title, the objects
// they confirmed, a classification label, and the hotspot ids/names it may bind
// beats to. No file names, no image bytes, no unconfirmed facts.
export const storyGenerationInputSchema = z
  .object({
    memoryId: z.string().min(1),
    title: z.string().trim().min(1).max(120),
    sceneType: z.enum(SCENE_TYPE_LIST).nullable().default(null),
    objects: z
      .array(z.string().trim().min(1).max(ANALYSIS_LIMITS.MAX_ITEM_LENGTH))
      .max(SCENE_LIMITS.MAX_HOTSPOTS)
      .default([]),
    imageCount: z.number().int().nonnegative(),
    scene: z
      .object({
        id: z.string().min(1),
        version: z.number().int().positive(),
        hotspots: z
          .array(
            z
              .object({
                id: z.string().min(1),
                name: z.string().trim().min(1).max(120),
              })
              .strict(),
          )
          .max(SCENE_LIMITS.MAX_HOTSPOTS)
          .default([]),
      })
      .strict()
      .nullable()
      .default(null),
  })
  .strict();

// Beat-level counterpart of confirmedCopy: adoption keeps beat identity and
// review state (beats never leave the story into facts, so no projection onto
// bare five fields). Fictional beats stay fictional forever: adopting an
// imaginative paragraph never launders it into a confirmed memory.
export function adoptedBeatCopy(beat, editedValue = beat.value) {
  const fictional = beat.sourceType === SOURCE_TYPES.FICTIONAL;
  return {
    ...beat,
    value: editedValue,
    sourceType: fictional ? SOURCE_TYPES.FICTIONAL : SOURCE_TYPES.USER_CONFIRMED,
    confidence: fictional ? beat.confidence : 1,
    confirmed: !fictional,
    adopted: true,
  };
}
```

## 3. 关键决策与 T1 偏差说明

### D1 · beat 叙事字段用 `value`，不用 T1 字段表的 `text`

T1 §2.2 字段表写 `text`，但同节又要求"复用 `sourcedValueBaseSchema.extend`、与 analysisItemSchema 同型"。extend 不会移除 `value`，二者只能取其一：

- 取 `value`：五字段原样复用，`assertConfirmedProvenance` / `confirmedCopy` / `inferredValue` 直接可用，审阅 UI 可复用 analysis 的条目组件。
- 取 `text`（omit value）：溯源 helper 全部失配，需要为 beat fork 一套投影函数——正是 ef68a3b 之后刻意避免的"另造一套溯源"。

**结论：`value` 即叙事段落文本**，UI 层标签显示为"段落"。此为对 T1 字段表的修订，语义不变。

### D2 · beat 携带 baseline / adopted（T1 字段表未列，T2 验收要求）

Story 是**持久化的可审阅产物**（同 `memory.analysis` 落库于 Memory），不是 facts 那样的终态确认数据。生成即落库（T1 §5），采纳发生在落库之后、经 patch 更新，因此审阅状态必须随 beat 持久化：

- `baseline`：provider 原始措辞，用户编辑落在 `value`，重生成/编辑追踪以此为锚（与 analysisItemSchema.baseline 同一契约）。
- `adopted`：用户采纳标记，默认 false；未采纳段落永远带"AI 推测"徽标。
- beat 永不进入 facts，所以不需要 `confirmedCopy` 式的五字段投影；`adoptedBeatCopy` 保留 id / baseline / hotspotIds，只改溯源字段。

### D3 · 采纳门控写进 schema（比 analysisDraftSchema 更严，语义一致）

analysis 的确认门控在服务层（`confirmAnalysis` 只采纳 adopted 条目）；story 的 beat 可被 `storyPatchSchema` 整组替换、**不经过任何审阅服务**，所以门控必须下沉到 schema：

| 规则 | 内容 | 杀死的攻击 |
| --- | --- | --- |
| R1（继承） | `confirmed: true` ⇒ `sourceType = user_confirmed` | AI 推测直接标 confirmed |
| R2 | `sourceType = user_confirmed` ⇒ `adopted: true` 且 `confirmed: true` | 把 AI 段落重新 POST 成"已确认事实"（改 sourceType 但绕过采纳） |
| R3 | `adopted: true` ⇒ `sourceType ∈ {user_confirmed, fictional}` | "采纳了但仍标 AI 推测"的歧义态 |
| R4（draft 专属） | draft beat 的 sourceType 只许 `ai_inferred \| fictional`，adopted 只许 `false` | provider 输出冒充用户确认 / 预采纳 |

R2 是核心验收点：`{ sourceType: "user_confirmed", confirmed: true, adopted: false }` 在 analysisItemSchema 下能通过（其门控在服务层），在 storyBeatSchema 下被拒绝。R4 比 analysisDraft 严——analysis 的 mock provider 会因"匹配既有确认值"预标 adopted（aiService.js:98-127 的 mergeReview），story 整体重生成、无此合并逻辑，采纳只能是用户动作。

fictional 的采纳（R3 放行）保持 `fictional / confirmed: false`：用户采纳想象段落 ≠ 把想象洗成确认记忆（AGENTS §5）。

### D4 · beats 必填且 min(1)，修订 T1 的 "default []"

T1 字段表 "1..MAX_BEATS，default []" 自相矛盾（default 出的 [] 过不了 min(1)）。取 **必填、min(1)、无 default**：空故事无意义，provider 必须至少产出一段；`STORY_INVALID_RESULT` 兜底。

### D5 · patch / draft 从 storyBaseSchema 派生（ZodEffects 陷阱）

顶层跨字段 refine（sceneId/sceneVersion 成对、无场景时 hotspotIds 必须为空）使 storySchema 成为 ZodEffects，无法 `.omit/.partial`。故拆 `storyBaseSchema`（纯 ZodObject、strict）：

- `storySchema = storyBaseSchema.superRefine(assertSceneBinding)`
- `storyPatchSchema = storyBaseSchema.omit({ id, memoryId, createdAt }).partial()`
- `storyDraftSchema = storyBaseSchema.omit({ id, createdAt, updatedAt }).extend({ provider, simulated, generatedAt, beats: draftBeatList }).superRefine(assertSceneBinding)`

patch 单独看允许"只改 sceneVersion 不改 sceneId"这类半对字段——这不是漏洞：仓库 update 合并已有行后必走完整 storySchema（sceneRepository.js:87-94 同型），跨字段不变量在合并点强制。beat 级编辑 = beats 整组替换（同 memory facts 的 patch 方式），不存在半条 beat。

### D6 · 生成输入 = scene 输入边界 + 场景绑定块

T1 §4.4 要求沿用 sceneGenerationInputSchema 边界（标题、已确认 objects、分类标签、图片数量），但 T1 D3 的 hotspot 绑定要求 provider 知道热点 id/name，故追加 `scene: { id, version, hotspots: [{ id, name }] } | null`：

- 仍然不传文件名、图片字节、未确认 facts、hotspot 坐标/描述（叙事不需要）。
- `objects` 由服务层从**已确认** facts 投影（同 generateScene 的输入构造），schema 只约束形状。
- 无场景时 `scene: null`，draft 的 beats 不得带 hotspotIds（assertSceneBinding 强制）。

## 4. 合法样例

### 4.1 storySchema · 最小持久化故事（无场景）

```js
{
  id: "story-1",
  memoryId: "memory-1",
  sceneId: null,
  sceneVersion: null,
  title: "食堂的中午",
  beats: [
    {
      id: "beat-1",
      value: "中午的食堂很热闹，餐盘碰撞声此起彼伏。",
      baseline: "中午的食堂很热闹，餐盘碰撞声此起彼伏。",
      sourceType: "ai_inferred",
      sourceIds: ["asset-1"],
      confidence: 0.4,
      confirmed: false,
      adopted: false,
      hotspotIds: [],
    },
  ],
  version: 1,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
}
```

### 4.2 storySchema · 绑定场景 + 已采纳编辑段 + 想象段

```js
{
  id: "story-2",
  memoryId: "memory-1",
  sceneId: "scene-1",
  sceneVersion: 2,
  title: "食堂的中午",
  beats: [
    {
      id: "beat-1",
      value: "我们常坐靠窗的那排位置，阳光正好落在餐盘上。", // 用户编辑
      baseline: "食堂里有靠窗的座位。",                        // provider 原文
      sourceType: "user_confirmed",
      sourceIds: ["asset-1"],
      confidence: 1,
      confirmed: true,
      adopted: true,
      hotspotIds: ["hotspot-1", "hotspot-2"],
    },
    {
      id: "beat-2",
      value: "也许那天窗外飘着一点雨丝。",
      baseline: "也许那天窗外飘着一点雨丝。",
      sourceType: "fictional",
      sourceIds: [],
      confidence: 0.2,
      confirmed: false,
      adopted: true, // 采纳想象段仍是 fictional（R3 + adoptedBeatCopy）
      hotspotIds: [],
    },
  ],
  version: 3,
  createdAt: 1700000000000,
  updatedAt: 1700000009000,
}
```

### 4.3 storyDraftSchema · provider 输出（省略字段走 default）

```js
{
  provider: "mock",
  simulated: true,
  generatedAt: 1700000000000,
  memoryId: "memory-1",
  sceneId: "scene-1",
  sceneVersion: 2,
  title: "食堂的中午",
  // version 缺省 → 1；beat 的 sourceIds/confidence/confirmed/adopted/hotspotIds 缺省 → []/0/false/false/[]
  beats: [
    {
      id: "beat-1",
      value: "中午的食堂很热闹。",
      baseline: "中午的食堂很热闹。",
      sourceType: "ai_inferred",
      hotspotIds: ["hotspot-1"],
    },
  ],
}
```

### 4.4 storyPatchSchema

```js
{ title: "新的标题" }                          // 只改标题
{ beats: [ /* 4.2 的完整 beats 数组 */ ] }      // 采纳/编辑 = 整组替换
{ sceneId: null, sceneVersion: null }          // 成对解绑（合并后仍过完整校验）
{ version: 4 }                                 // 重生成递增（服务层写入）
```

### 4.5 storyGenerationInputSchema

```js
{
  memoryId: "memory-1",
  title: "食堂的中午",
  sceneType: "cafeteria",
  objects: ["餐盘", "餐桌"],
  imageCount: 2,
  scene: {
    id: "scene-1",
    version: 2,
    hotspots: [
      { id: "hotspot-1", name: "餐盘" },
      { id: "hotspot-2", name: "餐桌" },
    ],
  },
}
// 最小输入：{ memoryId: "memory-1", title: "空白", imageCount: 0 }
// → sceneType/objects/scene 走 default（null/[]/null）
```

## 5. 非法样例（攻击与拒绝路径）

| # | 样例（相对合法基线的改动） | 拒绝于 | 命中规则 |
| --- | --- | --- | --- |
| A1 | beat `{ sourceType: "ai_inferred", confirmed: true }` | storySchema / storyDraftSchema | R1 assertConfirmedProvenance |
| A2 | **核心攻击**：AI 段落重新 POST 成已确认事实——beat `{ value: <AI原文>, sourceType: "user_confirmed", confirmed: true, adopted: false }` | storySchema / storyPatchSchema.beats | R2 采纳门控 |
| A3 | A2 变体：`adopted: true` 但 `confirmed: false`（半确认歧义态） | storySchema | R2 |
| A4 | `beats: ["从前有一个食堂…"]`（裸字符串绕过溯源） | storySchema | beat 必须是五字段对象 |
| A5 | beat 只有 `{ id, value }`，缺 sourceType | storySchema | sourceType 必填 |
| A6 | draft beat `{ sourceType: "user_confirmed", confirmed: true, adopted: true }`（provider 冒充确认） | storyDraftSchema | R4 enum |
| A7 | draft beat `{ adopted: true }`（provider 预采纳） | storyDraftSchema | R4 literal(false) |
| A8 | draft `{ simulated: false }`（冒充真实 AI 输出） | storyDraftSchema | literal(true) |
| A9 | `sceneId: null` 但 beat `hotspotIds: ["hotspot-1"]` | storySchema / storyDraftSchema | assertSceneBinding |
| A10 | `sceneId: "scene-1", sceneVersion: null`（半对绑定） | storySchema / storyDraftSchema | assertSceneBinding |
| A11 | 两个 beat 同 id | storySchema | beat id 唯一 |
| A12 | beat 内 `hotspotIds: ["h1", "h1"]` | storySchema | hotspotId 去重 |
| A13 | patch 含 `memoryId` / `id` / `createdAt` | storyPatchSchema | omit + strict |
| A14 | story 含未知字段 `status: "published"`；beat 含 `secret: 1` | storySchema | strict |
| A15 | `beats: []` | storySchema / storyDraftSchema | min(1) |
| A16 | beat `confidence: 1.5` | storySchema | 0..1 |
| A17 | beat `{ sourceType: "ai_inferred", adopted: true }` | storySchema | R3 |
| A18 | beat `{ sourceType: "fictional", confirmed: true }`（想象洗成确认） | storySchema | R1 |
| A19 | beat `{ sourceType: "guessed" }`（发明溯源类别） | storySchema | sourceTypeSchema enum |
| A20 | beat value 超 1000 字 / 空串 | storySchema | beatText |
| A21 | 输入含 `originalName: "mum.jpg"` 或 hotspots 条目含 `blob` | storyGenerationInputSchema | strict（provider 边界） |
| A22 | 输入 `scene: { id: "scene-1" }` 缺 version | storyGenerationInputSchema | version 必填 |

边界说明（非 schema 拒绝）：patch `{ sceneVersion: 2 }` 单独通过 storyPatchSchema（partial 允许半对），但仓库合并已有行（sceneId: null）后走完整 storySchema 时被 A10 同规则拒绝——与 sceneRepository.update 的既有强制点一致。

## 6. 服务层义务（schema 之外，T3/T4 实现时落实）

1. 生成门控：`memory.status ∈ {ready, completed}` 才许 generateStory（同 generateScene，aiService.js:297），防止未确认 draft 洗成叙事。
2. `storyGenerationInputSchema.objects` 只从已确认 facts 投影；`scene` 块从当前 Scene 行构造。
3. provider 输出校验：draft beats 的 `hotspotIds ⊆ input.scene.hotspots[].id`，越界 → `STORY_INVALID_RESULT`（schema 无法跨输入/输出校验，同 visitHotspot 的存在性校验归属服务层）。
4. `story.sceneId / sceneVersion` 由服务层从 input.scene 抄写，provider 不得自造绑定。
5. 采纳路径统一走 `adoptedBeatCopy`（可 grep，同 userConfirmedValue 的设计动机），UI 不得手拼溯源字段。
6. 重生成：id 不变、version+1，整组替换 beats；场景重生成只令 story 派生 stale，不改写行（T1 §5）。

## 7. 验收对照与实测结果

| 验收项 | 落点 | 结果 |
| --- | --- | --- |
| "AI 推测被重新 POST 成已确认事实"被拒绝 | A1/A2/A3/A6/A7（R1/R2/R4） | ✅ 实测拒绝 |
| 禁止裸字符串绕过溯源 | A4/A5 | ✅ 实测拒绝 |
| strict() 全覆盖 | storyBaseSchema / beat / draft / input 均 strict；A13/A14/A21 | ✅ 实测拒绝 |
| patch 剔除 id/memoryId/createdAt | storyPatchSchema omit；A13 | ✅ 实测拒绝 |
| 限额常量进 constants.js 风格 | STORY_LIMITS / STORY_INITIAL_VERSION（§1） | 设计符合 |
| baseline/adopted 审阅语义与 analysisDraftSchema 一致 | D2/D3：baseline=provider 原文、adopted=采纳门、编辑落 value；story 门控下沉 schema 的理由见 D3 | ✅ 实测对照 |

实测方式：将 §2 草案原样置于临时 vitest 套件（依赖真实 `@/lib/constants`、`@/schemas/sourceSchema`），对 §4 全部合法样例断言 parse 成功、§5 全部非法样例断言 throw。

实测补记（2026-11-17，vitest 5.1.0 / zod 3.25）：

- 临时套件 **38/38 通过**：合法样例（含 default 投影、adoptedBeatCopy 两种采纳路径、patch 合并后跨字段拒绝）全部 parse 成功；A1–A22 全部按预期 throw。
- 核心攻击对照实测：A2 载荷 `{ sourceType: "user_confirmed", confirmed: true, adopted: false }` 在 **analysisItemSchema 下通过**（其门控在 confirmAnalysis 服务层）、在 **storyBeatSchema / storyPatchSchema 下拒绝**——证实 D3"门控下沉 schema"的必要性，而非语义分歧。
- 全量回归：21 个测试文件 242/242 通过（含本套件），既有 schema/服务无回归。
- 验证后临时套件已删除（本任务仅交付设计稿；正式测试随 T3 实现落地，届时 §2 草案进 `src/schemas/storySchema.js`、§1 常量进 `constants.js`，本文件样例可直接转为测试夹具）。