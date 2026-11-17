# T5 · AI 生成边界与 Provider 扩展设计

状态：设计定稿（仅文档，不含 src 实现；mock 与回滚草案已用临时 vitest 套件实测，见 §8）
输入：T1 `docs/story-domain-model.md`、T2 `docs/story-schema-design.md`、T3 `docs/story-storage-design.md`、T4 `docs/story-api-contract.md`、`src/services/ai/aiProvider.js`、`src/services/ai/providers/mockProvider.js`、`src/services/ai/aiService.js`、`src/schemas/sceneSchema.js`、`src/services/scene/sceneTemplates.js`、`src/lib/constants.js`、AGENTS.md §3/§5/§6

## 0. 现状事实（设计依据）

- registry 只强制 `analyze`：`createProviderRegistry.get` 校验 `typeof provider.analyze === "function"`（aiProvider.js:29-34）；`buildScene` 能力在**调用点**检查（aiService.js:307-312），缺能力抛 `AI_PROVIDER_UNAVAILABLE`。registry 本身不知道任何具体能力。
- mock 的两个既有方法同型：入口先 `inputSchema.parse`，失败抛 `AiError(AI_INVALID_INPUT)`（mockProvider.js:129-137、229-237）；输出只从用户文字与关键词表构造，确定性（同输入同输出），`simulated: true` 徽标。
- `generateScene` 的回滚模式（aiService.js:283-371）：inFlight 守卫 → 门控 → 记录 `previousStatus` → 置 GENERATING → 构造 input → provider → **校验先于落库** → 单次 repository 写入 → 失败恢复 previousStatus（恢复失败不掩盖原因）→ finally 释放 inFlight。
- T2 已定稿 `storyGenerationInputSchema` / `storyDraftSchema`（R1–R4 门控、strict 边界）；T4 已定服务端/客户端切分：provider 调用走无状态路由，门控/合并/落库/回滚编排留在客户端。
- **新发现的边界缺口**：`storyDraftSchema` 比持久化 `storySchema` 多 `provider / simulated / generatedAt` 三个 draft 元数据字段，而 `storySchema` 是 strict——draft 原样进 `StoryRepository.create` 会被拒。scene 无此问题（sceneDraftSchema 只是 omit，无 extend）。T5 必须补上"draft → 行"投影义务（§5）。

## 1. D1 · buildStory 契约与能力发现

### 1.1 方法契约

```
async buildStory(input) → storyDraft
```

- `input`：`storyGenerationInputSchema` 的 parse 产物（§2）。provider 入口**必须自行再 parse 一次**（防御纵深，同 analyze/buildScene），失败抛 `AiError(AI_INVALID_INPUT)`。
- 返回值：`storyDraftSchema` 可 parse 的普通对象。不含 `id / createdAt / updatedAt`（仓库 stamped）；`version` 可省略（default 1，编排层注入 existing+1）；`memoryId / sceneId / sceneVersion` 从 input 回显（编排层仍会强制抄写覆写，§6）。
- 每个 beat 必须满足 R4：`sourceType ∈ {ai_inferred, fictional}`、`adopted: false`、`confirmed: false`、`baseline = provider 原文`。叙事措辞是 AI 创作，即使素材全部来自已确认 facts（T1 §4.1）。
- `hotspotIds` 只允许引用 `input.scene.hotspots[].id`；无场景时一律空数组。
- 不虚构真实人物身份与人际关系（AGENTS §5）；想象性内容显式 `fictional`。
- mock 必须确定性（同输入同 beats，`generatedAt` 除外）；真实 provider 允许不确定，但 schema 门控完全一致——**真实性防线在 schema，不在 provider 的自觉**。

### 1.2 能力发现：调用点检查，registry 不改

**结论**：`createProviderRegistry` 零改动。`generateStory`（及 T4 的 story 路由）在调用前检查 `typeof provider.buildStory !== "function"` → `AI_PROVIDER_UNAVAILABLE`，与 generateScene 对 buildScene 的检查逐行同型（aiService.js:307-312）。

**理由**：
1. 既有先例：buildScene 就是调用点检查，registry.get 只保证"是个能 analyze 的 provider"。buildStory 沿用同一模式，变更面为零。
2. 改 `get(name, capability)` 或引入能力映射表，需要动 registry 签名与全部既有调用方，为一个三方法接口引入抽象层——§6 禁止的提前设计。
3. 能力缺失是**运行时可恢复错误**（客户端可改选 E4 列出的其他 provider，T4 §5.3 归 4xx），不需要注册期静态保证。

**被否方案**：`registry.get(name, { capability: "buildStory" })`。否因如上；若将来 provider 能力超过 5 个再评估能力描述符，届时 get 签名变更属破坏性升级，走新版本。

### 1.3 三层义务切分

| 义务 | 归属 | 强制点 |
| --- | --- | --- |
| input 白名单形状 | provider 入口 + 编排层 | `storyGenerationInputSchema.parse`（双侧，strict） |
| objects 只含已确认 facts | 编排层 | 投影自 `memory.facts.objects`（confirmAnalysis 只写 adopted 条目），schema 无法表达"已确认"语义 |
| beat 溯源门控 R1–R4 | schema | `storyDraftSchema.parse`（T4 后服务端 + 客户端双侧） |
| sceneId/sceneVersion 抄写 | 编排层 | 用 input.scene 覆写 draft 绑定，provider 不得自造（T2 §6.4、T4 §3.3） |
| hotspotIds ⊆ input.scene | 编排层 | schema 无法跨输入/输出校验（T2 §6.3） |
| draft → 行投影（§5） | 编排层 | storySchema strict 兜底 |
| version 注入、id/时间戳 stamped | 编排层 + 仓库 | T3 §3、T4 §3.5 |
| 失败回滚（§6） | 编排层 | previousStatus 恢复 + 校验先于写入 |

## 2. 输入白名单（采用 T2 storyGenerationInputSchema 原样）

T2 §2 的 `storyGenerationInputSchema` 即本任务白名单定稿，**原样采用、零改动**（完整代码见 T2 §2，此处不重复）。字段投影与边界理由：

| 字段 | 来源（编排层构造） | 为什么安全 |
| --- | --- | --- |
| memoryId | memory.id | 所有权标识，非内容 |
| title | memory.title | 用户自己的文字 |
| sceneType | memory.analysis?.scene?.type ?? null | 分类标签，不是记忆事实（同 generateScene，aiService.js:318） |
| objects | memory.facts.objects[].value，slice(0, 24) | **只从已确认 facts 投影**：facts 由 confirmAnalysis 从 adopted 条目经 confirmedCopy 写入，未确认的 draft 元素永远到不了这里 |
| imageCount | memory.assetIds.length | 数量元数据，不是图片内容 |
| scene | SceneRepository 行 → { id, version, hotspots: [{ id, name }] } | 热点只给 id/name（叙事绑定所需最小集）；**不给 position / description / sourceType** |

**刻意排除**（strict 拒绝，T2 A21/A22 已实测）：

- `originalName` / 任何文件名、`blob` / 图片字节、`blobUrl`、`mimeType` / `images` 元数据数组（analysis 需要图片元数据做质量分级，story 不需要）。
- `description`：**与 analysisInputSchema 的关键差异**。analysis 的职责是从自由文本提取候选项交用户审阅，所以拿 description；story 只消费已确认投影——自由文本里可能含未确认的人物、关系、情绪，传进去等于给 provider 把猜测洗成叙事的机会。mock 的关键词叙事因此只基于 title + objects，这是边界设计的直接后果，不是 mock 的缺陷。
- 未确认 facts、analysis draft 条目、hotspot 坐标与描述。

输入构造代码（编排层，同 generateScene 的 input 构造模式）：

```js
const scene = await SceneRepository.getByMemoryId(memoryId);
const input = storyGenerationInputSchema.parse({
  memoryId: memory.id,
  title: memory.title,
  sceneType: memory.analysis?.scene?.type ?? null,
  objects: (memory.facts?.objects ?? [])
    .map((item) => item.value)
    .slice(0, SCENE_LIMITS.MAX_HOTSPOTS),
  imageCount: memory.assetIds.length,
  scene: scene
    ? {
        id: scene.id,
        version: scene.version,
        hotspots: scene.hotspots.map(({ id, name }) => ({ id, name })),
      }
    : null,
});
```

## 3. Mock buildStory 实现草案

新增于 `mockProvider.js`（与 analyze/buildScene 并列），实现期落地。草案：

```js
// The mock never reads pixels: the opening beat says so in the persisted
// narrative itself, because story rows carry no simulated flag (T2 storySchema).
const STORY_DISCLAIMER = "以下内容由 Mock 按已确认的文字线索模拟生成，没有读取任何照片。";

// Imaginative closing is always fictional, never a claim about people or events.
const FICTIONAL_CLOSING = "也许那天的光线，比记忆里还要柔和一些。";

const OBJECT_CONFIDENCE = 0.45;   // 同 KEYWORD_CONFIDENCE
const OPENING_CONFIDENCE = 0.4;
const FICTIONAL_CONFIDENCE = 0.2;

function draftBeat(id, value, sourceType, confidence, hotspotIds = []) {
  return {
    id,
    value,
    baseline: value,
    sourceType,
    sourceIds: [],
    confidence,
    confirmed: false,
    adopted: false,
    hotspotIds,
  };
}

async buildStory(input) {
  let parsed;

  try {
    parsed = storyGenerationInputSchema.parse(input);
  } catch (error) {
    throw new AiError(ERROR_CODES.AI_INVALID_INPUT, "故事生成请求缺少必要字段，已中止", {
      cause: error,
    });
  }

  const sceneLabel = parsed.sceneType ? SCENE_TYPE_LABELS[parsed.sceneType] : null;
  const opening = sceneLabel
    ? `「${parsed.title}」——这段记忆的场景是${sceneLabel}。${STORY_DISCLAIMER}`
    : `「${parsed.title}」——场景还没有确定。${STORY_DISCLAIMER}`;

  const hotspotsByName = new Map((parsed.scene?.hotspots ?? []).map((h) => [h.name, h.id]));
  // Opening + closing take two slots; the rest go to confirmed objects.
  const names = [...new Set(parsed.objects)].slice(0, STORY_LIMITS.MAX_BEATS - 2);

  const beats = [
    draftBeat("beat-1", opening, SOURCE_TYPES.AI_INFERRED, OPENING_CONFIDENCE),
    ...names.map((name, index) =>
      draftBeat(
        `beat-${index + 2}`,
        `记忆里有${name}。`,
        SOURCE_TYPES.AI_INFERRED,
        OBJECT_CONFIDENCE,
        hotspotsByName.has(name) ? [hotspotsByName.get(name)] : [],
      ),
    ),
    draftBeat(
      `beat-${names.length + 2}`,
      FICTIONAL_CLOSING,
      SOURCE_TYPES.FICTIONAL,
      FICTIONAL_CONFIDENCE,
    ),
  ];

  return {
    provider: AI_PROVIDERS.MOCK,
    simulated: true,
    generatedAt: Date.now(),
    memoryId: parsed.memoryId,
    sceneId: parsed.scene?.id ?? null,
    sceneVersion: parsed.scene?.version ?? null,
    // The user's own title, never a sentence the mock invented.
    title: parsed.title,
    beats,
  };
}
```

### 3.1 叙事构造规则

| beat | 内容 | sourceType | confidence | hotspotIds |
| --- | --- | --- | --- | --- |
| 开场（必有） | 用户标题 + 场景分类标签 + Mock 免责声明 | ai_inferred | 0.4 | [] |
| 物件段（0..MAX_BEATS-2） | 每个去重后的已确认 object 一段，按 name 匹配绑定热点 | ai_inferred | 0.45 | 匹配到的 [hotspotId]，否则 [] |
| 收束（必有） | 固定想象句（光线/氛围，无人物无事件） | **fictional** | 0.2 | [] |

- 上限：objects 最多 24（输入白名单），beats 最多 12（STORY_LIMITS）→ 物件段预算 `MAX_BEATS - 2 = 10`，超出截断。开场/收束永不被挤掉，beats min(1) 恒满足。
- 物件段措辞 `记忆里有X。` 刻意平淡：mock 不声称知道照片里发生了什么（同 SCENE_HOTSPOT_NOTE 的诚实原则）。真实 provider 在同一契约下产出更丰富的叙事，schema 门控不变。
- 无场景（scene: null）时所有 hotspotIds 为空，assertSceneBinding 恒满足。
- 确定性：同输入 → 同 beats（`generatedAt` 除外），与 buildScene 的排序破平局策略同一动机。

### 3.2 D2 · beat id 用位置编号，不用内容哈希

hotspot 用 FNV-1a 内容哈希（sceneTemplates.js:86-95）是因为 **exploration 历史跨重生成引用 hotspot id**，必须稳定。beat 没有任何入站引用（T1 D3：exploration 只引用 hotspot；beat id 仅供 UI key 与将来引用），重生成整组替换 beats（T2 §6.6），旧 beat id 无人持有。故 mock 用 `beat-1..beat-n` 位置编号：确定性、唯一性（superRefine 强制）都满足，不引入哈希工具的新依赖。将来若出现 beat 级外部引用，再按 hotspot 先例升级为内容哈希。

### 3.3 D3 · Mock 透明性由开场 beat 文本承载

analysis/scene 的 mock 透明性靠 `simulated: true` 徽标 + missing/description 注记。story 行**不持久化 simulated**（§5），所以免责声明必须进入叙事文本本身（开场 beat），随故事一起落库、一起被阅读。`simulated: true` 仍在 draft 上供生成期 UI 使用。这是"story 行无 provider 元数据"决策（T1 字段表）的直接后果。

## 4. 输出样例（临时套件实际产出，非手写）

### 4.1 绑定场景（输入 = T2 §4.5 原样）

```json
{
  "provider": "mock",
  "simulated": true,
  "generatedAt": 1700000000000,
  "memoryId": "memory-1",
  "sceneId": "scene-1",
  "sceneVersion": 2,
  "title": "食堂的中午",
  "version": 1,
  "beats": [
    {
      "id": "beat-1",
      "value": "「食堂的中午」——这段记忆的场景是食堂 / 餐厅。以下内容由 Mock 按已确认的文字线索模拟生成，没有读取任何照片。",
      "baseline": "「食堂的中午」——这段记忆的场景是食堂 / 餐厅。以下内容由 Mock 按已确认的文字线索模拟生成，没有读取任何照片。",
      "sourceType": "ai_inferred",
      "sourceIds": [],
      "confidence": 0.4,
      "confirmed": false,
      "adopted": false,
      "hotspotIds": []
    },
    {
      "id": "beat-2",
      "value": "记忆里有餐盘。",
      "baseline": "记忆里有餐盘。",
      "sourceType": "ai_inferred",
      "sourceIds": [],
      "confidence": 0.45,
      "confirmed": false,
      "adopted": false,
      "hotspotIds": ["hotspot-1"]
    },
    {
      "id": "beat-3",
      "value": "记忆里有餐桌。",
      "baseline": "记忆里有餐桌。",
      "sourceType": "ai_inferred",
      "sourceIds": [],
      "confidence": 0.45,
      "confirmed": false,
      "adopted": false,
      "hotspotIds": ["hotspot-2"]
    },
    {
      "id": "beat-4",
      "value": "也许那天的光线，比记忆里还要柔和一些。",
      "baseline": "也许那天的光线，比记忆里还要柔和一些。",
      "sourceType": "fictional",
      "sourceIds": [],
      "confidence": 0.2,
      "confirmed": false,
      "adopted": false,
      "hotspotIds": []
    }
  ]
}
```

### 4.2 无场景（输入 scene: null）

与 4.1 同构，差异仅：`sceneId: null`、`sceneVersion: null`、四个 beat 的 `hotspotIds` 全为 `[]`（实测 `[[],[],[],[]]`）。开场措辞不变（sceneType 仍为 cafeteria）。

### 4.3 最小输入 `{ memoryId: "memory-1", title: "空白", imageCount: 0 }`

```json
{
  "provider": "mock",
  "simulated": true,
  "generatedAt": 1700000000000,
  "memoryId": "memory-1",
  "sceneId": null,
  "sceneVersion": null,
  "title": "空白",
  "version": 1,
  "beats": [
    {
      "id": "beat-1",
      "value": "「空白」——场景还没有确定。以下内容由 Mock 按已确认的文字线索模拟生成，没有读取任何照片。",
      "baseline": "「空白」——场景还没有确定。以下内容由 Mock 按已确认的文字线索模拟生成，没有读取任何照片。",
      "sourceType": "ai_inferred",
      "sourceIds": [],
      "confidence": 0.4,
      "confirmed": false,
      "adopted": false,
      "hotspotIds": []
    },
    {
      "id": "beat-2",
      "value": "也许那天的光线，比记忆里还要柔和一些。",
      "baseline": "也许那天的光线，比记忆里还要柔和一些。",
      "sourceType": "fictional",
      "sourceIds": [],
      "confidence": 0.2,
      "confirmed": false,
      "adopted": false,
      "hotspotIds": []
    }
  ]
}
```

### 4.4 投影后的持久化行（4.1 draft → storySchema）

行键实测为 `["id","memoryId","sceneId","sceneVersion","title","version","beats","createdAt","updatedAt"]`——**无 provider / simulated / generatedAt**。beats 原样保留（draft beat 与持久化 beat 形状兼容：ai_inferred/fictional + adopted:false 在 storyBeatSchema 下合法）。id/时间戳由仓库 stamped，version 由编排层注入。

## 5. D4 · draft → 行投影（T5 新增义务）

**问题**：`storyDraftSchema = storyBaseSchema.omit(...).extend({ provider, simulated, generatedAt, ... })`，而 `storySchema` strict 且无这三个字段。draft 原样传给 `StoryRepository.create` 必然 `VALIDATION_FAILED`。T2/T3/T4 均未显式处理此投影（T4 §3.5 注入表只列了增字段，没列减字段）。

**结论**：编排层在落库前把校验后的 draft 投影为行字段，**draft 元数据不落库**：

```js
const row = {
  memoryId: memory.id,        // create 时；update patch 不含（所有权不可移）
  title: parsed.title,
  beats: parsed.beats,
  sceneId: parsed.sceneId,
  sceneVersion: parsed.sceneVersion,
  version,                    // existing ? existing.version + 1 : STORY_INITIAL_VERSION
};
```

**理由**：
1. 不改 T2 storySchema（已定稿、已实测）：给行加 provider/simulated 字段需要动 T1 字段表与 T2 schema，越出 T5 变更面。
2. 真实性信号不丢失：逐 beat 的 sourceType 徽标（AI 推测/想象内容）+ 开场免责声明（D3）已承载"这是模拟生成"的全部用户可见信息；`simulated` 徽标的受众是生成期 UI，draft 上有就够了。
3. 与 analysis 的差异是刻意的：analysis draft **整体**落库于 memory.analysis（审阅态需要 revision/provider），story 行是叙事产物、审阅态在 beat 级（baseline/adopted），不需要 draft 信封。

**归属**：客户端 generateStory（T4 D1 下服务端零持久化，路由只校验并返回 draft）。storySchema strict 是兜底——任何实现忘记投影都会在 create/update 校验点被拒，不会静默落库脏字段。

## 6. 失败回滚语义（generateStory 编排）

### 6.1 编排草案

沿用 generateScene 骨架（aiService.js:283-371），差异点以注释标出。实现期落入 aiService.js，**inFlight 必须复用既有模块级 Set**（草案用独立 Set 仅为隔离测试；T4 §6.1 要求 analyze/generateScene/generateStory 三入口互斥）。

```js
function asStoryError(error, fallbackMessage) {
  if (error instanceof AiError) return error;
  if (error instanceof StorageError && error.code === ERROR_CODES.MEMORY_NOT_FOUND) return error;
  if (error?.name === "ZodError") {
    return new AiError(ERROR_CODES.STORY_INVALID_RESULT, "故事结果不符合约定的数据结构", { cause: error });
  }
  return new AiError(ERROR_CODES.STORY_GENERATION_FAILED, fallbackMessage, { cause: error });
}

function validateStoryDraft(draft) {
  try {
    return storyDraftSchema.parse(draft);
  } catch (error) {
    throw new AiError(ERROR_CODES.STORY_INVALID_RESULT, "故事结果不符合约定的数据结构", { cause: error });
  }
}

export async function generateStory(memoryId, { providerName = DEFAULT_AI_PROVIDER } = {}) {
  if (inFlight.has(memoryId)) {
    throw new AiError(ERROR_CODES.STORY_GENERATION_IN_PROGRESS, "这段记忆正在生成故事，请稍候。");
  }
  inFlight.add(memoryId);

  let previousStatus = null;

  try {
    const memory = await requireMemory(memoryId);

    if (memory.status !== MEMORY_STATUS.READY && memory.status !== MEMORY_STATUS.COMPLETED) {
      throw new AiError(ERROR_CODES.STORY_NOT_CONFIRMED, "请先确认整理结果，再生成故事。");
    }

    previousStatus = memory.status;
    await MemoryRepository.update(memoryId, { status: MEMORY_STATUS.GENERATING });

    const provider = registry.get(providerName);
    if (typeof provider.buildStory !== "function") {
      throw new AiError(ERROR_CODES.AI_PROVIDER_UNAVAILABLE, `Provider ${providerName} 不支持故事生成。`);
    }

    const input = /* §2 的白名单投影 */;

    let draft;
    try {
      draft = await provider.buildStory(input);
    } catch (error) {
      throw asStoryError(error, "生成故事时出错，请稍后重试。");
    }

    // Binding transcription: the provider cannot invent or move the scene link.
    const parsed = validateStoryDraft({
      ...draft,
      memoryId: memory.id,
      sceneId: input.scene?.id ?? null,
      sceneVersion: input.scene?.version ?? null,
    });

    const allowed = new Set((input.scene?.hotspots ?? []).map((hotspot) => hotspot.id));
    for (const beat of parsed.beats) {
      if (beat.hotspotIds.some((id) => !allowed.has(id))) {
        throw new AiError(ERROR_CODES.STORY_INVALID_RESULT, "故事结果不符合约定的数据结构");
      }
    }

    const existing = await StoryRepository.getByMemoryId(memoryId);
    const version = existing ? existing.version + 1 : STORY_INITIAL_VERSION;

    // §5 投影：provider/simulated/generatedAt 不进 stories store。
    const story = existing
      ? await StoryRepository.update(existing.id, {
          title: parsed.title, beats: parsed.beats,
          sceneId: parsed.sceneId, sceneVersion: parsed.sceneVersion, version,
        })
      : await StoryRepository.create({
          memoryId: memory.id, title: parsed.title, beats: parsed.beats,
          sceneId: parsed.sceneId, sceneVersion: parsed.sceneVersion, version,
        });

    // 差异点：故事成功恢复 previousStatus（ready/completed），不像 scene 强制 COMPLETED（T1 §5）。
    const updated = await MemoryRepository.update(memoryId, { status: previousStatus });
    return { memory: updated, story };
  } catch (error) {
    if (previousStatus) {
      try {
        await MemoryRepository.update(memoryId, { status: previousStatus });
      } catch {
        // Restoring the status must not hide the reason generation failed.
      }
    }
    throw asStoryError(error, "生成故事时出错，请稍后重试。");
  } finally {
    inFlight.delete(memoryId);
  }
}
```

### 6.2 D5 · 成功状态 = previousStatus（与 generateScene 的关键差异）

generateScene 成功置 COMPLETED（aiService.js:353-355）；generateStory 成功**恢复 previousStatus**（ready 或 completed），因为故事生成不改变"场景是否完成"这一事实（T1 §5 状态机：`generating --> ready : 故事生成成功`）。story 的存在与否由 stories 行表达，不由 memory.status 表达。

### 6.3 失败矩阵（每个失败点的回滚保证）

| 失败点 | 错误码 | stories 行 | memory.status | inFlight |
| --- | --- | --- | --- | --- |
| inFlight 命中 | STORY_GENERATION_IN_PROGRESS | 不动 | 不动（未置 GENERATING） | 原持有者 finally 释放 |
| memory 不存在 | MEMORY_NOT_FOUND | 不动 | 不动 | 释放 |
| 门控（draft/analyzing/reviewing/failed） | STORY_NOT_CONFIRMED | 不动 | 不动（门控在置 GENERATING 之前） | 释放 |
| provider 未注册 / 缺 buildStory | AI_PROVIDER_UNAVAILABLE | 不动 | 恢复 previousStatus | 释放 |
| input 投影 parse 失败 | STORY_INVALID_RESULT（ZodError 归一） | 不动 | 恢复 previousStatus | 释放 |
| provider 抛错 | provider 的 AiError 原样 / STORY_GENERATION_FAILED 兜底 | 不动 | 恢复 previousStatus | 释放 |
| draft 不合 storyDraftSchema（含 R4 冒充确认） | STORY_INVALID_RESULT | **零写入** | 恢复 previousStatus | 释放 |
| hotspotIds 越界 | STORY_INVALID_RESULT | **零写入** | 恢复 previousStatus | 释放 |
| repository create/update 失败 | STORAGE_FAILED / VALIDATION_FAILED 等 | IDB 事务 abort，旧行原样（T3 §3） | 恢复 previousStatus | 释放 |
| 成功后状态回写失败 | 走 catch：恢复 previousStatus 再试一次 | 新行已落库（唯一先写后状态的窗口，见下） | 尽力恢复 | 释放 |

**核心不变量**：

1. **校验先于写入**：storyDraftSchema parse + hotspot 子集校验全部通过后才发生第一次 stories 写入。provider 输出不可信（AGENTS §3），坏结果在落库前被拒，旧故事一个字节不动。
2. **单写入点 + 事务原子性**：一次生成只调一次 create 或 update；IDB 事务保证 update 要么整体生效要么整体不生效（T3 已实测），不存在半组 beats。
3. **失败永不覆盖旧结果**：重生成失败时旧 story 行（含用户已采纳/编辑的 beats）原样保留；只有成功才整组替换（T2 §6.6 的刻意语义，UI 在生成期禁用编辑并提示重生成会替换采纳态，T4 §4）。
4. **状态恢复不掩盖原因**：恢复 previousStatus 的写失败被吞掉，原始错误照常抛出（既有模式，aiService.js:360-365）。
5. **无 merge**：story 重生成不做 mergeWithPreviousDraft 式合并（T2 D3：采纳只能是用户动作，provider 输出不得预采纳）。失败路径因此天然不触碰旧 beats。
6. 已知窗口：story 落库成功后状态回写失败 → 新故事已存在但 status 可能停在 GENERATING，catch 会再恢复一次；两次都失败属存储层故障，行数据仍完整合法。与 generateScene 的既有窗口同型，不新增机制。

### 6.4 与 T4 服务端化的衔接

T4 落地后，`provider.buildStory(input)` 一行替换为 fetch E3；**绑定抄写与 hotspot 子集校验在路由侧执行**（T4 §3.3），客户端保留二次 storyDraftSchema 校验（服务端响应按不可信外部数据对待）与全部回滚编排。本节草案的校验顺序在两侧各自完整成立，不依赖对端。

## 7. 错误归一化小结

- provider 入口：input parse 失败 → `AI_INVALID_INPUT`（provider 自抛，同 analyze/buildScene）。
- 编排层：`asStoryError` 仿 asSceneError（aiService.js:62-76）——AiError 透传、MEMORY_NOT_FOUND 透传、ZodError → STORY_INVALID_RESULT、其余 → STORY_GENERATION_FAILED。无裸 Error 出口。
- 不新增错误码：六个 STORY_* 码已由 T1 §8 / T3 §1 / T4 §5.2 定义，T5 零追加。

## 8. 实测记录（临时 vitest 套件，验证后删除）

方法：`tests/tmp-t5/` 临时套件含——T2 §2 schema 草案（constants 改引本地 shim：真实 constants + STORY_LIMITS/STORY_INITIAL_VERSION/六个 STORY_* 码）、§3 mock buildStory 草案、§6 generateStory 编排草案、Map 后端 fake StoryRepository（create/update 校验点与 T3 同型：完整 storySchema 校验、patch 合并后二次校验、1:1 防重；IDB 事务原子性本身属 T3 已实测范围，此处不重复）。memory/scene 侧用**真实** Repository 与真实 analyzeMemory/confirmAnalysis/generateScene 流程（fake-indexeddb 环境同既有测试）。

实测结果（2026-11-17，vitest 5.1.0 / zod 3.25）：

- 临时套件 **26/26 通过**（mockStory.test.js 11 项 + generateStory.test.js 15 项）：
  - **白名单**：originalName / images / blob / description / hotspot.position 五类越界输入全部 AI_INVALID_INPUT 拒绝；缺 memoryId/title 拒绝；最小输入走 default 成功。
  - **mock 输出**：绑定场景/无场景/最小输入三种 draft 均过 storyDraftSchema；全部 beat confirmed:false、adopted:false、sourceType ∈ {ai_inferred, fictional}；收束段恒 fictional；hotspotIds ⊆ input.scene；24 objects 截断至 12 beats；去重生效；同输入确定性；无匹配热点的物件段 hotspotIds 为空。
  - **回滚**：provider 抛错 → STORY_GENERATION_FAILED，status 恢复 COMPLETED，旧 story 逐字段 deep-equal 不动，写入计数不变；坏 draft / R4 冒充确认 / hotspotIds 越界 → STORY_INVALID_RESULT 且**零写入**；门控（draft/reviewing）→ STORY_NOT_CONFIRMED 零写入；缺 buildStory → AI_PROVIDER_UNAVAILABLE；双击 → STORY_GENERATION_IN_PROGRESS 且仅一行。
  - **编排语义**：ready 成功恢复 READY（非 COMPLETED）、completed 成功保持 COMPLETED；重生成 id 不变 version+1、createdAt 不变；伪造 sceneId/sceneVersion 被抄写覆写；行键无 provider/simulated/generatedAt（D4 投影）；facts/analysis/title/description/assetIds 零改动；序列化行不含 blob:/私有文件名/image_observed。
- 夹具修正记录：首版"上限+去重"用例传了 25 个 objects，被输入白名单 max(24) 正确拒绝——这恰好验证了编排层必须先 slice(0,24) 再调 provider（§2 投影代码已含）；拆为两个合法夹具用例后通过。
- 全量回归：22 个测试文件 **230/230 通过**（既有 204 + 本套件 26），既有 schema/仓储/服务无回归。
- §4 样例由临时套件实际运行打印（printSamples），非手写。验证后临时套件已删除，本任务仅交付设计稿。

## 9. 验收对照

| 验收项 | 落点 | 结果 |
| --- | --- | --- |
| 输入白名单不含文件名/图片字节 | §2：T2 schema 原样采用 + strict；description 刻意排除；五类越界攻击实测拒绝 | ✅ |
| 输出经 schema 校验后才落库 | §6.1 校验先于写入 + §6.3 矩阵；坏 draft/R4/越界三路实测零写入；D4 投影由 storySchema strict 兜底 | ✅ |
| 虚构内容必须标记 fictional，不得混入 user_confirmed | §3 收束段恒 fictional；R4 拒绝 provider 冒充确认（实测）；adoptedBeatCopy 保证采纳想象段仍是 fictional（T2 D3） | ✅ |
| provider 接口扩展（buildStory） | §1：调用点能力检查，registry 零改动，与 buildScene 同型 | 设计符合 |
| 失败回滚（状态恢复、不覆盖旧结果） | §6：previousStatus 恢复 + 单写入点 + 失败永不覆盖；成功/失败状态语义差异（D5）明示 | ✅ 实测 |

## 10. 对后续实现任务的提示（非本任务产出）

- `mockProvider.js`：追加 §3 的 buildStory 与三个常量；`aiService.js`：追加 generateStory / asStoryError / validateStoryDraft，**复用既有 inFlight Set**；registry 与 createProviderRegistry 零改动。
- 实现顺序依赖：T2 schema + T3 仓储/迁移先行（本套件的 fake StoryRepository 届时替换为真实仓储，编排草案的校验点不变）。
- 正式测试：tmp-t5 的 26 个用例直接转 `tests/services/ai/mockProviderStory.test.js` 与 `generateStory.test.js`（真实 StoryRepository + 真实 DB_VERSION 2）；另需补跨入口互斥用例（analyze/generateScene 在途时 generateStory 报 STORY_GENERATION_IN_PROGRESS，既有 aiService.test.js:93 / generateScene.test.js:116 模式扩展）——草案用独立 Set 无法覆盖此项，属实现期必测。
- T4 路由实现时：绑定抄写 + 子集校验放路由侧（§6.4），客户端二次校验保留；E3 请求/响应夹具即 §4 样例。