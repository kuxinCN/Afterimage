# T6 · Story 测试计划与契约验证设计

状态：设计定稿（测试用例清单 + 契约验证机制；story 尚未进入 src，本任务不新增 `src/` 代码，也不留下 `tests/` 常驻文件）
输入：T1 `docs/story-domain-model.md`、T2 `docs/story-schema-design.md`、T3 `docs/story-storage-design.md`、T4 `docs/story-api-contract.md`、T5 `docs/story-provider-design.md`、既有 `tests/**` 结构、AGENTS.md §4/§5/§6
基线（2026-11-17 实测）：`npx vitest run` → **20 个测试文件 / 204 个用例全绿**，vitest 5.1.0 + zod 3.25 + fake-indexeddb 6.2.8。本任务的全部新增用例都建立在这条基线之上，且§9 逐条列出了会被 T3/T4/T5 实现打破的既有用例。

---

## 0. 既有测试事实（设计依据）

| 事实 | 出处 | 对 T6 的直接后果 |
| --- | --- | --- |
| `tests/setup/fakeIndexedDB.js` 引 `fake-indexeddb/auto`，vitest 默认**按文件隔离** | vitest.config.mjs:11-16、setup 文件注释 | 每个测试文件拿到独立的 fake factory：迁移测试**必须单独成文件**，否则手工开低版本会污染同文件其他用例 |
| `resetDatabase()` 遍历 `Object.values(STORES)` 清空 | tests/helpers/data.js:4-7 | T3 一旦把 `stories` 加进 `STORES`，所有既有套件的清库**自动覆盖新 store**，零改动（已实测，§8-F5） |
| 夹具工厂 `memoryFixture / assetFixture / hotspotFixture / sceneFixture / imageBlob` 一律 `(..., overrides = {})` | tests/helpers/data.js | Story 夹具沿用同一签名风格（§10） |
| 错误断言统一 `await expect(x).rejects.toMatchObject({ code: ERROR_CODES.Y })`，schema 断言统一 `toThrow(ZodError)` | memoryRepository.test.js、analysisSchema.test.js | 新用例不引入第二种断言风格 |
| 不用 fake timers：靠"播种 createdAt:1 + 断言 updatedAt > 1" | memoryRepository.test.js:54-68 | Story 时间戳用例沿用，避免全局时钟改造波及既有 204 个用例 |
| 并发用例用 `Promise.allSettled([call, call])` | aiService.test.js:85-95、generateScene.test.js:107-122 | §8-F1 实测：守卫在任何 await 之前同步 `add`，该写法足以复现双击，**无需给 aiService 开测试后门** |
| provider 故障注入靠 `vi.spyOn(mockProvider, "buildScene")` | generateScene.test.js:127、144 | T4 切断客户端 provider import 后此路失效，服务层改用 fetch stub（§9） |
| 不存在任何 `src/app/api` 路由 | 实测 `find src -type d -name api` 为空 | API 契约层是全新层，需要新建 `tests/api/` |

---

## 1. 分层与文件布局

测试金字塔按"越靠下越不依赖实现细节"排布，五层 + 一层静态守卫：

| # | 层 | 文件 | 状态 | 覆盖对象 | 前置任务 | 用例数 |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | schema | `tests/schemas/storySchema.test.js` | 新增 | T2 全部 schema 与门控 | T2 | 37 |
| L2 | 存储 | `tests/services/storage/storyRepository.test.js` | 新增 | T3 §3 五接口 | T3 | 15 |
| L2 | 存储 | `tests/services/storage/storyMigration.test.js` | 新增 | T3 §2 DB_VERSION 1→2 | T3 | 6 |
| L2 | 存储 | `tests/services/storage/memoryRepository.test.js`、`transaction.test.js` | 追加 | T3 §4 级联 | T3 | 5 |
| L3 | provider | `tests/services/ai/mockProviderStory.test.js` | 新增 | T5 §3 mock.buildStory | T5 | 11 |
| L4 | 编排 | `tests/services/ai/generateStory.test.js` | 新增 | T5 §6 状态机 / 并发 / 回滚 | T3+T5 | 31 |
| L5 | API 契约 | `tests/api/v0.1/ai/story.test.js`、`analyze.test.js`、`scene.test.js`、`providers.test.js`、`envelope.test.js` | 新增 | T4 §3/§5/§6 | T4 | 20 |
| L6 | 契约守卫 | `tests/contract/designContract.test.js` | 新增 | §7 的文档↔代码一致性 | T2–T5 | 7 |

L2/L4 依赖 fake-indexeddb（已在 setup 里，无需新依赖）；L5 依赖 Node 24 自带 `Request`/`Response`（§8-F3 实测可用）；L6 只读源码文本，无运行时依赖。**全计划零新增依赖**，符合 AGENTS §6。

---

## 2. L1 · schema 用例矩阵（tests/schemas/storySchema.test.js）

夹具直接取 T2 §4 的四段合法样例与 §5 的 A1–A22 攻击载荷，做到"文档样例 = 测试夹具"单一来源（§7-C2 守卫会检查这一点）。

### 2.1 正例

| ID | 用例 | 关键断言 | 验收点 |
| --- | --- | --- | --- |
| S-P1 | T2 §4.1 最小持久化故事（无场景） | `parse` 成功且 `sceneId/sceneVersion` 为 null | T2 §7「限额常量风格」 |
| S-P2 | T2 §4.2 绑定场景 + 已采纳编辑段 + 想象段 | 两段分别 `user_confirmed/adopted` 与 `fictional/adopted`，`hotspotIds` 保留 | T1 §7「每项可溯源」 |
| S-P3 | T2 §4.3 draft 省略字段 | `version→1`、beat 的 `sourceIds/confidence/confirmed/adopted/hotspotIds` 走 default | T2 D5「default 投影」 |
| S-P4 | T2 §4.5 完整生成输入 | parse 成功 | T5 §2 白名单 |
| S-P5 | T2 §4.5 最小输入 `{memoryId,title,imageCount}` | `sceneType→null, objects→[], scene→[]` | T4 §8「契约与 schema 一一对应」 |
| S-P6 | `adoptedBeatCopy(ai_inferred beat)` | 结果 `user_confirmed/confirmed:true/adopted:true/confidence:1` 且 `id/baseline/hotspotIds` 原样 | T2 D2/D3、T1 §4.2 |
| S-P7 | `adoptedBeatCopy(fictional beat)` | 仍 `fictional/confirmed:false/adopted:true` | AGENTS §5「想象不得洗成确认」 |
| S-P8 | 12 段 beats / 单段 1000 字（边界内） | parse 成功 | T2 §1 STORY_LIMITS |

### 2.2 溯源伪造（重点攻击面）

| ID | 载荷 | 断言抛错的 schema | 命中规则 | 验收点 |
| --- | --- | --- | --- | --- |
| S-F1 | beat `ai_inferred + confirmed:true`（A1） | storySchema / storyDraftSchema | R1 | T2 §7 核心项 |
| S-F2 | **beat `user_confirmed + confirmed:true + adopted:false`（A2，核心攻击）** | storySchema / storyPatchSchema.beats | R2 | T2 §7「重新 POST 成已确认事实被拒」 |
| S-F3 | A2 变体 `adopted:true + confirmed:false`（A3） | storySchema | R2 | 同上 |
| S-F4 | `user_confirmed + confirmed:true + adopted:true` 但 `confidence<1` | storySchema | 语义配对 | T2 D3 |
| S-F5 | draft beat `user_confirmed`（A6） | storyDraftSchema | R4 enum | T5 §9「不得混入 user_confirmed」 |
| S-F6 | draft beat `adopted:true`（A7） | storyDraftSchema | R4 literal(false) | 同上 |
| S-F7 | draft `simulated:false`（A8） | storyDraftSchema | literal(true) | T4 §1.2 徽标契约 |
| S-F8 | beat `image_observed + confirmed:true` | storySchema | R1 | AGENTS §5 |
| S-F9 | beat `fictional + confirmed:true`（A18） | storySchema | R1 | T5 §9 |
| S-F10 | beat `ai_inferred + adopted:true`（A17） | storySchema | R3 | T2 D3 表 |
| S-F11 | beat `sourceType:"guessed"`（A19） | storySchema | enum | T1 §2.3 不新增类别 |
| S-F12 | `beats:["从前有一个食堂…"]` 裸字符串（A4）/ beat 缺 `sourceType`（A5） | storySchema | 五字段强制 | T2 §7「禁止裸字符串绕过溯源」 |

**S-F13（差分对照，本层最有价值的单条守卫）**：同一份 A2 载荷，断言 `analysisItemSchema.parse(A2)` **成功**、`storyBeatSchema.parse(A2)` **抛 ZodError**。这条把 T2 D3 的"门控下沉到 schema"从一句设计说明变成可回归的事实：analysis 的门在 `confirmAnalysis` 服务层，story 的门必须在 schema 层。将来任何人把 `assertBeatAdoption` 挪回服务层，这一条立刻变红。

### 2.3 重复 id

| ID | 用例 | 断言 | 验收点 |
| --- | --- | --- | --- |
| S-D1 | 两个 beat 同 id（A11） | 抛 ZodError，issue.path `[index,"id"]` | T1 §2.2「beats id 唯一」 |
| S-D2 | beat 内 `hotspotIds:["h1","h1"]`（A12） | 抛 ZodError，issue.path `[index]` | T2 §2 hotspotIdListSchema |
| S-D3 | draft 层同样两组重复 | 抛 ZodError（draft 与持久化共用同一 `buildBeatList` 逻辑） | T2 D5 |

### 2.4 patch 不可变字段

| ID | 用例 | 断言 | 验收点 |
| --- | --- | --- | --- |
| S-M1 | patch 含 `id` / `memoryId` / `createdAt`（A13） | 各自抛 ZodError（omit + strict） | T2 §7「patch 剔除三字段」 |
| S-M2 | patch `{title}`、`{beats}`、`{sceneId:null,sceneVersion:null}`、`{version:4}`（T2 §4.4） | 四例全部 parse 成功 | T2 D5 |
| S-M3 | patch 含未知字段 `status:"published"`（A14） | 抛 ZodError | T1 §2.1 strict |
| S-M4 | patch 只给 `sceneVersion:2`（不给 sceneId） | `storyPatchSchema` **单独通过**（partial 允许半对）；跨字段拒绝点断言在 L2 的合并校验（R-U5） | T2 §5 边界说明 |

> M4 刻意断言"通过"，用来钉死 T2 D5 的分工：patch 只管形状，不变量在合并点强制。若有人误在 patch 上加 refine，这条会红。

### 2.5 strict / 边界 / 引用完整性

| ID | 用例 | 断言 | 验收点 |
| --- | --- | --- | --- |
| S-B1 | story 未知字段、beat `secret:1`（A14） | 抛 ZodError | T2 §7 strict 全覆盖 |
| S-B2 | `beats:[]`（A15） | 抛 ZodError | T2 D4 |
| S-B3 | `confidence:1.5`（A16）/ `-0.1` | 抛 ZodError | sourcedValue 0..1 |
| S-B4 | beat value 1001 字 / 空串 / 纯空格（A20） | 抛 ZodError | STORY_LIMITS.MAX_BEAT_LENGTH |
| S-B5 | 13 段 beats | 抛 ZodError | STORY_LIMITS.MAX_BEATS |
| S-B6 | `sceneId:null` 但 beat 带 hotspotIds（A9）；`sceneId` 有值而 `sceneVersion:null`（A10） | 各自抛 ZodError，path 命中 `sceneVersion` / `beats.i.hotspotIds` | T1 D3 版本钉住 |
| S-B7 | 输入含 `originalName:"mum.jpg"`、`blob`、`description`、`images`、hotspot `position`（A21） | 各自抛 ZodError | T5 §9「白名单不含文件名/图片字节」 |
| S-B8 | 输入 `scene:{id}` 缺 version（A22） | 抛 ZodError | T2 §5 |
| S-B9 | title 121 字 / 25 个 objects | 抛 ZodError | T2 §1、SCENE_LIMITS |

---

## 3. L2 · 存储层

### 3.1 StoryRepository（tests/services/storage/storyRepository.test.js）

沿用 `describe("StoryRepository") + beforeEach(resetDatabase)`，夹具 `storyFixture(memoryId, overrides)`（§10）。

| ID | 用例 | 断言 | 验收点 |
| --- | --- | --- | --- |
| R-C1 | create 落库 | 行 `id` 匹配 UUID_V4、`version=1`、`createdAt<=updatedAt` | T3 §3.1、AGENTS §4 |
| R-C2 | create 后 memory 行零改动 | `getById(memory.id)` deep-equal 原行，且 **无 `storyId` 键** | T3 §5「不新增反向引用」 |
| R-C3 | 同一 memory 二次 create | `STORY_ALREADY_EXISTS`，`db.getAll(stories)` 仍 1 行 | T3 §3.1.2 |
| R-C4 | memory 不存在 | `MEMORY_NOT_FOUND` 且零行写入 | T3 §3.6 |
| R-C5 | 校验先于事务 | `create` 传坏 beat → `VALIDATION_FAILED` 且 store 为空 | AGENTS §6 |
| R-G1 | `getById("missing")` / `getByMemoryId("missing")` | 均 `resolves.toBeNull()` | T3 §3.2/3.3 |
| R-G2 | `getByMemoryId` 命中 | 返回行 deep-equal create 结果 | T4 §4 L2 |
| R-U1 | update 合并保留 `id/memoryId/createdAt`，`updatedAt` 递增 | `updatedAt` 严格大于播种值 | T3 §3.4.3 |
| R-U2 | update 目标缺失 | `STORY_NOT_FOUND` | T3 §3.6 |
| R-U3 | patch 含 `memoryId` | `VALIDATION_FAILED` 且原行不动 | T2 A13、T3 §3.4 |
| R-U4 | patch 用 A2 采纳攻击整组替换 beats | `VALIDATION_FAILED` 且原 beats 不动 | **T2 §7 核心项在存储边界的复现** |
| R-U5 | patch `{sceneVersion:2}` 半对（接 S-M4） | `VALIDATION_FAILED`（合并后完整 schema 拒绝） | T2 §5 边界说明 |
| R-U6 | patch 带 `coverBlobUrl` / beat 带 `blobUrl` | `VALIDATION_FAILED`，库中零残留 | T3 §6「不持久化 Blob URL」 |
| R-D1 | delete 后 `getById` null、memory 行仍在 | T3 §3.5 |
| R-D2 | delete 缺失 | `STORY_NOT_FOUND` | T3 §3.6 |

### 3.2 迁移（tests/services/storage/storyMigration.test.js，必须独立成文件）

| ID | 用例 | 断言 | 验收点 |
| --- | --- | --- | --- |
| M-1 | 常量形状 | `DB_VERSION===2`、`STORES.stories==="stories"`、`INDEXES.stories.byMemoryId==="memoryId"` | T3 §1 |
| M-2 | 老用户升级路径 | 手工 `openDB(DB_NAME,1,{upgrade:迁移1副本})` → 用**四个真实 Repository** 播种 memory/asset/scene/exploration → `closeDB()` → `getDB()`；断言 `version===2`、五 store 齐备、四个既有 store 逐行 deep-equal（asset 的 Blob 按 `instanceof Blob` + size/type 比对） | T3 §10「不破坏现有四个 store 的数据」 |
| M-3 | 全新安装路径 | 空库直开 v2：五 store、`memories` 的 byStatus/byCreatedAt 与 `stories` 的 memoryId 索引齐备 | T3 §2.2 |
| M-4 | 唯一索引在库层生效 | 同 memoryId 第二次 `put` → `ConstraintError`；经 Repository → `STORAGE_FAILED` 且不落库 | T3 §3.1.3 |
| M-5 | 迁移条目 1 未被改动 | 对 `src/services/storage/db.js` 取 `migrations[1]` 源码片段做结构断言（含四个 `createObjectStore`、不含 `stories`） | T3 §7「禁止编辑已发布条目」 |
| M-6 | 迁移抛错 → 整体回滚到 v1 | 见 §8-F2 的 harness：断言拒绝的是迁移自己的 Error、重开 v1 成功、旧数据逐行完好、半成品 store 不存在 | T3 §2.3、§7 L1 |

M-2 的播种写法有一处硬约束：**upgrade 回调内不能 await 普通 `db` 句柄发请求**（§8-F2 实测会 abort 整个升级），结构操作在 upgrade 里做，数据播种放到 open 之后的普通读写事务。

### 3.3 级联（追加到 memoryRepository.test.js / transaction.test.js）

| ID | 用例 | 断言 | 验收点 |
| --- | --- | --- | --- |
| C-1 | 删 memory 连带 story | 五 store 对应行全部消失 | T3 §4 |
| C-2 | 只删 story，memory 存活 | `StoryRepository.delete` 后 memory/scene 行不动 | T3 §3.5 |
| C-3 | 级联中途抛错 | 仿 transaction.test.js:20-45 的 `withTransaction` 注入：五 store 一起回滚、逐行 deep-equal | T3 §4「原子性」 |
| C-4 | 重复删除 | `MEMORY_NOT_FOUND` 且 story 行不动 | T3 §4 |
| C-5 | 场景单独删除/重生成不动 story | `SceneRepository.deleteByMemoryId` 后 story 行仍在 | T3 §4 末段 |

---

## 4. L3 · mock provider（tests/services/ai/mockProviderStory.test.js）

对齐 T5 §8 已实测的 11 项，直接转正式：

| ID | 用例 | 断言 | 验收点 |
| --- | --- | --- | --- |
| P-1 | T5 §4.1 绑定场景 draft | 过 `storyDraftSchema`，四段、`generatedAt` 之外确定性 | T5 §9 |
| P-2 | T5 §4.2 无场景 | `sceneId/sceneVersion` 双 null、四段 `hotspotIds` 全空 | T2 A9 |
| P-3 | T5 §4.3 最小输入 | 两段（开场 + 想象收束） | T2 D4 |
| P-4 | 白名单越界五连（originalName / images / blob / description / hotspot.position） | 各自 `AI_INVALID_INPUT` | T5 §9 第一行 |
| P-5 | 缺 memoryId / title | `AI_INVALID_INPUT` | T5 §1.1 |
| P-6 | 全 beat 溯源 | 每条 `confirmed:false`、`adopted:false`、`sourceType ∈ {ai_inferred, fictional}` | T1 §4.1、AGENTS §5 |
| P-7 | 收束段恒 fictional，且不含人名/关系词 | `sourceType==="fictional"` | AGENTS §5「不虚构人物关系」 |
| P-8 | `hotspotIds ⊆ input.scene.hotspots[].id`，无匹配则空 | T5 §3.1 |
| P-9 | 24 objects → 截断到 `MAX_BEATS` 且开场/收束不被挤掉；重复 object 去重 | T5 §3.1 |
| P-10 | 同输入两次调用 deep-equal（除 `generatedAt`） | T5 §0 确定性事实 |
| P-11 | beat id 唯一（`beat-1..n`） | 过 `buildBeatList` superRefine | T5 D2 |

---

## 5. L4 · 编排服务（tests/services/ai/generateStory.test.js）

`seededMemory / confirmedMemory` 两个夹具函数沿用 generateScene.test.js:28-48 的写法。

### 5.1 状态机

| ID | 前置 status | 期望结果 | 验收点 |
| --- | --- | --- | --- |
| SM-1 | draft | `STORY_NOT_CONFIRMED`，status 仍 draft、零 story 行 | T4 §8「未确认不得生成 story」 |
| SM-2 | reviewing | `STORY_NOT_CONFIRMED`，status 仍 reviewing | 同上 |
| SM-3 | analyzing / failed | `STORY_NOT_CONFIRMED` | T5 §6.3 门控行 |
| SM-4 | ready 成功 | 结束态 **ready**（非 completed），story 行 version=1 | T5 D5 |
| SM-5 | completed 成功 | 结束态 completed，story 重生成 version+1、id 与 createdAt 不变 | T1 §5、T2 §6.6 |
| SM-6 | ready 失败 | 恢复 ready（不是 completed） | T5 D5 |
| SM-7 | 生成成功但 memory 未新增 status | `memory.status` 永不出现 story 专有值 | T1 §5「Story 无自有 status」 |
| SM-8 | stale 派生 | 改 scene.version 后读取不抛错，`{story, stale}` 视图标记为 true，且**库中行不变** | T1 D3、T4 §4 补充约定 |

### 5.2 并发防重入

矩阵驱动（T4 §6.1）写成一张表 + `it.each`，同 memoryId 下 3 个在途 × 3 个新请求 + 本地 patch 列：

| ID | 在途 \ 新请求 | 期望 |
| --- | --- | --- |
| CX-1..3 | analyze × {analyze, generateScene, generateStory} | AI_ANALYSIS_IN_PROGRESS / SCENE_GENERATION_IN_PROGRESS / STORY_GENERATION_IN_PROGRESS |
| CX-4..6 | generateScene × 同上三个 | AI_ANALYSIS_IN_PROGRESS / SCENE_GENERATION_IN_PROGRESS / STORY_GENERATION_IN_PROGRESS |
| CX-7..9 | generateStory × 同上三个 | 三行同上 |
| CX-10 | generateStory 在途 + `StoryRepository.update` | 允许（IDB 事务串行化），断言最终 title 与 status 一致 |
| CX-11 | generateStory 在途 + 另一 memoryId 的 generateStory | 成功（守卫按 memoryId 分桶） |
| CX-12 | 双击 generateStory | 第二条 `*_IN_PROGRESS`，`db.getAll(stories)` 恰 1 行，`finally` 后可再次成功 |

写法约束（§8-F1 实测）：守卫必须在**第一个 await 之前同步 `inFlight.add`**，`Promise.allSettled([a, b])` 才足以确定性复现——这是可测性要求，须写进实现注释。同时**不要断言在途期间的中间 status 值**：并发本地写与生成的状态写谁先落库不确定（§8-F1 实测踩过），只断言终态。

### 5.3 失败回滚

把 T5 §6.3 的十行失败矩阵逐行转成断言（每行同时检查 stories 行、memory.status、inFlight 释放）：

| ID | 注入 | 期望码 | stories 行 | status |
| --- | --- | --- | --- | --- |
| RB-1 | memory 不存在 | MEMORY_NOT_FOUND | 不动 | 不动 |
| RB-2 | provider 缺 `buildStory` | AI_PROVIDER_UNAVAILABLE | 不动 | 恢复 |
| RB-3 | provider 抛错 | STORY_GENERATION_FAILED | 不动 | 恢复 |
| RB-4 | provider 返回缺字段 draft | STORY_INVALID_RESULT | **零写入** | 恢复 |
| RB-5 | provider 返回 R4 冒充确认 draft | STORY_INVALID_RESULT | **零写入** | 恢复 |
| RB-6 | provider 返回越界 hotspotIds | STORY_INVALID_RESULT | **零写入** | 恢复 |
| RB-7 | provider 自造 sceneId/sceneVersion | 成功，但行绑定被抄写覆写 | 写入 | 恢复 |
| RB-8 | Repository create 抛 STORAGE_FAILED | STORAGE_FAILED | 旧行原样 | 恢复 |
| RB-9 | 重生成失败（已有旧 story + 用户已采纳 beats） | 对应码 | **旧行逐字段 deep-equal 不动** | 恢复 |
| RB-10 | 恢复 status 的写也失败 | 抛的仍是原始错误（不被掩盖） | — | — |
| RB-11 | 成功路径落库后回写 status 失败（已知窗口） | 走 catch 再恢复一次；行仍合法 | 新行 | 尽力恢复 |

通用后置断言（每条都跑）：`inFlight` 已释放（再次调用不再报 IN_PROGRESS）、`facts/analysis/title/description/assetIds` 零改动、序列化行不含 `blob:` / 私有文件名 / `image_observed`。T4 落地后 provider 故障注入从 `vi.spyOn(mockProvider,...)` 换成 `vi.stubGlobal("fetch", ...)`（§9）。

---

## 6. L5 · API 契约（tests/api/v0.1/ai/*.test.js）

直接 `import { POST } from "@/app/api/v0.1/ai/story/route"` 并传 `new Request(...)`，无需 dev server（§8-F3 实测）。

### 6.1 成功路径

| ID | 端点 | 断言 | 验收点 |
| --- | --- | --- | --- |
| A-S1 | E3 story | 200、`{draft}` 过 `storyDraftSchema`、draft 体与 T5 §4.1 样例同构 | T4 §8「契约一一对应」 |
| A-S2 | E3，input 无 scene | draft `sceneId/sceneVersion` 双 null | T4 §3.3 |
| A-S3 | E3，provider 自造绑定 | 响应绑定 = `input.scene` 的 id/version | T2 §6.4、T4 §3.3.3 |
| A-S4 | E1/E2/E4 | 各自 200 形状；E4 返回 `{providers,defaultProvider}` | T4 §3.4 |

### 6.2 错误路径（T4 §5.3 表逐行转断言）

| ID | 触发 | 期望 |
| --- | --- | --- |
| A-E1 | 请求体非 JSON | 400 `VALIDATION_FAILED` |
| A-E2 | 请求体合法 JSON 但缺 memoryId / 含 `originalName` | 400 `VALIDATION_FAILED` |
| A-E3 | `X-AI-Provider: gpt-9` 未注册 | 400 `AI_PROVIDER_UNAVAILABLE` |
| A-E4 | provider 缺 `buildStory` | 400 `AI_PROVIDER_UNAVAILABLE` |
| A-E5 | provider 输出不合 draft schema | 502 `STORY_INVALID_RESULT` |
| A-E6 | beat hotspotIds 越界 | 502 `STORY_INVALID_RESULT` |
| A-E7 | provider 抛未知异常 | 502 `STORY_GENERATION_FAILED`（无裸 Error 逃出路由） |
| A-E8 | analyze / scene 同型兜底 | 502 `AI_INVALID_RESULT` / `SCENE_INVALID_RESULT` |
| A-E9 | 每条错误响应体形状 | 恰为 `{error:{code,message}}`，`code ∈ ERROR_CODES`，`message` 非空中文 |
| A-E10 | 路由模块方法面 | `typeof GET/PUT/DELETE === "undefined"`，只有声明过的动词（框架级 405 无信封，T4 §5.1） |

### 6.3 客户端封装与密钥隔离

| ID | 用例 | 断言 | 验收点 |
| --- | --- | --- | --- |
| A-K1 | 信封 → AiError | stub fetch 返 502 信封，`generateStory` 抛出的错误 `code` 与信封一致（UI 文案字典零改动） | T4 §5.1 |
| A-K2 | 无信封的非 2xx | 兜底为 `STORY_GENERATION_FAILED` | T4 §5.1 |
| A-K3 | 5xx 不自动重试 | stub fetch 计数 = 1 | T4 §6.3 |
| A-K4 | 请求体边界 | fetch 收到的 body 序列化后不含 `blob`、文件名、`description`；`X-AI-Provider` 透传且**不在 body 里** | T4 §3 通用约定 |
| A-K5 | 响应不含 stamped 字段 | draft JSON 无 `id/createdAt/updatedAt` | T4 §3.5 |
| A-K6 | 静态密钥守卫 | 见 §7-C6（客户端 import 图 + `NEXT_PUBLIC_` 扫描） | T4 §8 第一行 |

---

## 7. 契约验证机制（L6，tests/contract/designContract.test.js）

这一层是 T6 相对"写一堆单测"的增量：把 T1–T5 之间靠人眼对齐的约定变成会失败的断言。

| ID | 守卫 | 断言方式 | 红了意味着什么 | 局限 |
| --- | --- | --- | --- | --- |
| C-1 | 错误码双向完备 | `ERROR_CODES` 里每个 `STORY_*` 至少出现在 `docs/story-api-contract.md` 的 §5.3/§5.4 表中；反向：文档表里每个码都在 `ERROR_CODES` 存在 | 加了码没文案 / 文档承诺了不存在的码 | 只能查名字，不能查触发路径是否真被覆盖（靠 RB-*/A-E*） |
| C-2 | 文档样例 = 夹具 | `tests/helpers/storyData.js` 导出的样例 JSON 与 T2 §4 / T5 §4 的样例 deep-equal（样例以常量文件形式落盘，注释标文档小节号） | 文档漂移，测试在测一个不存在的形状 | 需人工保持常量与文档同步（这正是目的） |
| C-3 | 不可变字段清单 | 对 `storyPatchSchema` 断言 `memoryId`/`id`/`createdAt` 不在 shape 中，且 `definedOnly` 语义下显式 `undefined` 不清空 | patch 面被悄悄放宽，所有权可转移 | 无 |
| C-4 | 持久化行键集合 | 对真实落库行断言 `Object.keys(row).sort()` 恰为 T5 §4.4 的九个键（无 `provider/simulated/generatedAt`） | draft 元数据被写进库（D4 投影被忘记） | 无 |
| C-5 | 溯源入口唯一 | 扫 `src/**`：`sourceType: SOURCE_TYPES.USER_CONFIRMED` 字面量只允许出现在 `sourceSchema.js`、`analysisSchema.js`（`confirmedCopy`/`userConfirmedValue` 内）与 `storySchema.js`（`adoptedBeatCopy` 内）；组件目录命中即失败 | UI 手拼溯源字段，绕过可 grep 入口 | 静态文本扫描，注释/字符串会误报，需在守卫里维护极小白名单 |
| C-6 | 密钥边界 | (a) `src/app/**`（除 `src/app/api/**`）与 `src/components/**`、`src/hooks/**` 不得 import `services/ai/providers/*` 或 registry；(b) 全仓 `NEXT_PUBLIC_` 命中数 = 0 | AI 密钥/ provider 代码进浏览器包 | 只能覆盖静态 import；动态 import 与打包产物需另做 build 期检查 |
| C-7 | 互斥矩阵一致性 | 把 §5.2 表驱动数组与 T4 §6.1 表逐格比对（同表常量导出给文档注释引用） | 新增生成入口忘了进互斥矩阵 | 无 |

C-5/C-6 是本仓第一次引入静态源码守卫；价值直接对应 AGENTS §3「密钥不下发」「不得把 AI 推测伪装成已确认」两条硬约束——它们光靠行为用例盖不全。若评审认为静态扫描过于脆弱，降级方案是只保留 C-6(b)（`NEXT_PUBLIC_` 计数）并把 C-5 改成 code-review checklist，其余五条均为纯结构断言、不受影响。

---

## 8. 实测记录（临时套件，验证后已删除）

方法：`tests/tmp-t6/`（4 文件 / 16 用例）在真实 vitest + fake-indexeddb + 真实 `db.js`/`aiService`/四个 Repository 上跑本计划推荐的三套 harness，跑通后整目录删除。基线复跑 **20 文件 / 204 用例全绿**，工作树未残留。

| # | 发现 | 证据 | 对计划的约束 |
| --- | --- | --- | --- |
| F1 | `Promise.allSettled([analyzeMemory, generateScene])` **足以**复现跨入口互斥：在途 generateScene → `SCENE_GENERATION_IN_PROGRESS`、在途 analyze → `AI_ANALYSIS_IN_PROGRESS`，各 1 例通过。原因：守卫在任何 await 之前同步 `inFlight.add`（aiService.js:166-170、284-288） | 4 例并发用例绿 | §5.2 不需要给 aiService 加测试后门；同时把"守卫须同步加锁"写成实现期注释要求 |
| F1b | 在途期间并发本地写的**中间 status 值不可断言**：首版断言 patch 读到 `generating`，实测读到 `ready`（写序不确定） | 该断言失败，改为终态断言后绿 | §5.2 CX-10 明确只断言终态与 title 存活 |
| F2 | 迁移失败回滚**用 idb 的 `openDB` 包一层会脏**：upgrade 抛错时 fake-indexeddb ①把错误吞成通用 `AbortError`（拿不到迁移自己的 message）②额外泄漏 2 次 unhandled rejection，vitest 把整轮标红（首版实测 18 例中 4 处 unhandled） | 改前 FAIL/Unhandled，改后 2 例绿且零 unhandled | M-6 必须用**裸 `indexedDB.open` + `onupgradeneeded` 内 try/catch + 显式 `tx.abort()` + reject** 的 harness；断言落在"重开 v1 成功、旧行 deep-equal、半成品 store 不存在" |
| F2b | upgrade 回调里用 `db.objectStore(x).put()` 播种会 abort 整个升级；播种须在 open 之后的普通事务，或走 `event.target.transaction` | 首版 3 例红，改后绿 | M-2 夹具写法固定 |
| F3 | Next App Router 的 `export async function POST(request)` 可在 vitest node 环境直接单测：`new Request()` 入、`Response.json()` 出，`status/headers/json()` 齐备；动词面用 `typeof routeModule.GET === "undefined"` 断言；客户端封装"信封 → 带 code 的 Error"用 `vi.stubGlobal` 式 fetch stub 验证通过 | routeHarness 6 例全绿 | §6 不需要 dev server、不需要 supertest 等新依赖，L5 可行 |
| F4 | 手工把库开到 v1 再让应用层 `getDB()` 接管，与 v1→v2 逐行比对（含 Blob `instanceof` 与 size）在 fake-indexeddb 上成立；对 v2 库开更低版本得到 `VersionError`（T3 §7「不支持降级」的可断言形式） | migrationHarness 绿 | M-2/M-3 及 T3 §7 L3 的回滚说明具备可测性 |
| F5 | `resetDatabase()` 由 `Object.values(STORES)` 驱动，加 `stories` 后自动清 5 个 store | 实测 `Object.values(STORES).length===4` 断言 + 清库绿 | helpers 零改动（§10） |

未纳入自动化（须手工或后续任务，如实说明）：多标签页 `blocked/blocking` 让位（fake-indexeddb 单连接，无法模拟两个页面）；真实浏览器的 `VersionError` 表现；`NEXT_PUBLIC_` 在构建产物里的最终消失（属 build 期验证，AGENTS §6 不为测试引入构建改造）。

---

## 9. 既有测试影响清单（实现期回归面，逐条列到行）

| 位置 | 现状 | 谁打破它 | 需要的改动 |
| --- | --- | --- | --- |
| tests/services/ai/generateScene.test.js:60 | `expect(DB_VERSION).toBe(1)` | T3 升 v2 | 改为 `toBe(2)`，或删掉并让 M-1 独占该断言（**推荐**，避免两处钉版本号） |
| tests/services/ai/aiService.test.js:298-299 | 用例名 "stays readable and writable on database version 1" + `expect(DB_VERSION).toBe(1)` | T3 升 v2 | 版本号断言移交 M-1；用例名改述为"stage-2 无 analysis 字段的旧行"，其"旧行缺字段仍可读"的语义在 v2 下依然成立（migration 2 纯追加） |
| tests/services/ai/aiService.test.js:100、116 与 generateScene.test.js:127、144 | `vi.spyOn(mockProvider, "analyze"/"buildScene")` | **T4 切断客户端 provider import** | 服务层故障注入改 `vi.stubGlobal("fetch", ...)`；provider 自身行为回归 L3（直接调 `mockProvider.buildStory`）。这是影响面最大的一项，建议与 T4 同批改 |
| tests/services/ai/aiService.test.js:45 | `expect(listAiProviders()).toEqual(["mock"])` | T4 §3.4 把 registry 移服务端 | 客户端改走 E4：断言 fetch stub 返回值，registry 断言迁到 providers.test.js |
| tests/helpers/data.js | `resetDatabase` 遍历 STORES | T3 | 零改动（F5） |
| tests/schemas/schema.test.js、analysisSchema.test.js | 不涉及 story | — | 零改动；但 S-F13 差分守卫会 import `analysisItemSchema`，注意别改动其导出名 |

门槛：上述改动与新增用例同批落地，落地后 `npm test` 必须 **204 全绿 + 新增全绿 + 零 skipped + 零 unhandled error**（F2 的教训：unhandled rejection 会让"绿"失去意义）。

---

## 10. 夹具与基础设施

`tests/helpers/data.js` 追加两个工厂，或独立 `tests/helpers/storyData.js`（**推荐独立**，避免把 story 常量混进图片导入夹具文件）：

```js
export function beatFixture(id = "beat-1", overrides = {}) {
  return {
    id,
    value: "中午的食堂很热闹。",
    baseline: "中午的食堂很热闹。",
    sourceType: "ai_inferred",
    sourceIds: [],
    confidence: 0.4,
    confirmed: false,
    adopted: false,
    hotspotIds: [],
    ...overrides,
  };
}

export function storyFixture(memoryId, overrides = {}) {
  return { memoryId, sceneId: null, sceneVersion: null, title: "食堂的中午",
           beats: [beatFixture()], ...overrides };
}

// T2 §5 的攻击载荷表：{ "A2": { beats: [ ... ] }, ... }，schema 层与仓储层共用
export const STORY_ATTACKS = { /* 与 docs/story-schema-design.md §5 同序号 */ };
```

约定：① `STORY_LIMITS / STORY_INITIAL_VERSION` 一律从 `@/lib/constants` 读，夹具里不写字面量 12/1000（否则限额改动会造成假失败）；② 时间戳沿用"播种 `createdAt:1` + 断言 `updatedAt>1`"，不引 fake timers；③ `id` 断言复用 memoryRepository.test.js:8 的 `UUID_V4` 常量（提到 helpers 里共享，避免第三处复制）；④ 攻击载荷集中在 `STORY_ATTACKS`，L1（schema 直接拒）与 L2（合并后拒）从同一处取，保证两层测的是同一个载荷。

---

## 11. 实施顺序与准入门槛

按 schema → 存储 → provider → 编排 → 路由 → 守卫推进，每步"先让该层用例红→实现→绿→全量回归"：

1. **T2 落地即写 L1**（37 例，纯函数、零 DB，最快建立溯源门控护栏，其中 S-F13 差分守卫必须第一批）。
2. **T3 落地写 L2**（25 例）：先 M-2/M-3/M-6 迁移与回滚，再 R-* CRUD，最后 C-* 级联；同批改 §9 两处 `DB_VERSION`。
3. **T5 落地写 L3 + L4**（42 例）：L3 先行（不依赖 fetch 改造），L4 的 SM-4/5/6 依赖 T3 的真实 StoryRepository（tmp-t5 的 fake repo 全部替换）。
4. **T4 落地写 L5**（22 例）：与 §9 的 spyOn→fetch stub 同批。
5. **最后写 L6 守卫**（7 例）：五层齐了才有比对对象；C-5/C-6 若评审不采纳则转 code-review checklist。

覆盖门槛（按可核查口径，不设百分比指标）：T2 §5 的 A1–A22 **每条至少一个用例**（S-F*/S-D*/S-M*/S-B*/R-U*）；T5 §6.3 失败矩阵**每行一个**（RB-1..11）；T4 §5.3 映射表**每行一个**（A-E1..8）；T4 §6.1 互斥矩阵**每格一个**（CX-1..9）。四条齐了才认定 story 测试完成。

合计新增 **132 例**（L1 37 / L2 26 / L3 11 / L4 31 / L5 20 / L6 7），全部落在既有 `tests/` 结构上，不新增依赖、不新增构建步骤。

---

## 12. 验收对照

| 来源验收项 | 覆盖用例 |
| --- | --- |
| T2 §7「AI 推测被重新 POST 成已确认事实被拒绝」 | S-F1..F13、R-U4、RB-5 |
| T2 §7「禁止裸字符串绕过溯源」 | S-F12、S-B1 |
| T2 §7「strict 全覆盖 / patch 剔除三字段」 | S-B1、S-M1..M4、C-3 |
| T3 §10「不破坏现有四个 store 的数据」 | M-2、M-3、M-6、F4 |
| T3 §10「级联与 CASCADE_STORES 兼容」 | C-1..C-5 |
| T3 §10「不持久化 Blob URL」 | R-U6、C-4、A-K4 |
| T3 §10「五接口」 | R-C1..R-D2 |
| T3 §10「storyId 反向引用有结论」 | R-C2（断言无该键） |
| T4 §8「密钥永不下发浏览器」 | A-K4、A-K6、C-6 |
| T4 §8「未确认不得生成 story」 | SM-1..SM-3 |
| T4 §8「每个错误路径有明确错误码」 | A-E1..E10、RB-1..RB-11、C-1 |
| T4 §8「契约与 schema 一一对应」 | A-S1..A-S4、C-2、C-4 |
| T4 §6「并发控制」 | CX-1..CX-12、A-K3 |
| T5 §9「输入白名单」 | P-4、P-5、S-B7、C-2 |
| T5 §9「输出经 schema 校验后才落库」 | RB-4..RB-6、C-4 |
| T5 §9「虚构内容标 fictional」 | S-F9、P-6、P-7、S-P7 |
| T1 §7「每个信息项可溯源」 | S-P2、S-F12、C-5 |
| T1 §7「不虚构真实人物身份/关系」 | P-7、S-F9、C-5 |
| AGENTS §4/§5/§6 | R-C1、S-M1、零新增依赖（§1/§11） |
