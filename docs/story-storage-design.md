# T3 · Story 存储与迁移设计

状态：设计定稿（仅文档，不含 src 实现；迁移/级联/仓储草案已用临时 vitest 套件实测，见 §8）
输入：T1 `docs/story-domain-model.md`、T2 `docs/story-schema-design.md`、`src/services/storage/db.js`、`src/services/storage/memoryRepository.js`、`src/services/storage/sceneRepository.js`、`src/services/storage/assetRepository.js`、`src/schemas/memorySchema.js`、`src/lib/constants.js`、AGENTS.md §4/§6

## 0. 现有存储层事实（设计依据）

- `db.js` 的迁移是**版本号键控的增量表**：`migrations[n]` 把数据库升到 n，`runMigrations` 从 `oldVersion + 1` 逐版执行到 `newVersion`；已发布的迁移条目永不编辑（db.js:51-82）。全新安装（oldVersion 0）会顺序跑完所有条目。
- `withTransaction` 内只能 await IndexedDB 请求，否则事务自动提交、后续请求抛 `TransactionInactiveError`（db.js:130-149）。所有跨 store 原子操作都靠"同一事务 + 只 await IDB 请求"。
- `IDBIndex` 没有 `delete()`：`deleteByIndex` 先 `getAllKeys` 再逐主键删，两步都在调用方事务内（db.js:163-174）。
- Memory 删除级联：`CASCADE_STORES = [memories, assets, scenes, explorations]`，单事务内删 memory 行 + `deleteByIndex(assets)` + `deleteByIndex(scenes)` + `explorations.delete(memoryId)`（memoryRepository.js:6-11、87-107）。
- Scene 是 1:1 独生子：`scenes.byMemoryId` 唯一索引（db.js:64）；`SceneRepository.create` 在 `[scenes, memories]` 同事务内校验 memory 存在、检查 `memory.sceneId` 防重、写 scene 行并回写 `memory.sceneId`（sceneRepository.js:19-54）。
- 反向引用约定：`memoryPatchSchema` omit 掉 `assetIds / sceneId`，二者只能经各自 Repository 在同事务内同步（memorySchema.js:64-68）。Exploration 则**没有**反向引用，以 `memoryId` 为 keyPath，按 memoryId 直查。
- `asStorageError` 把 `ConstraintError` 归一为 `STORAGE_FAILED`（db.js:37-43）；`ZodError` 归一为 `VALIDATION_FAILED`。
- 图片 Blob 只存 `assets.blob`；Blob URL 只存在于内存态 `previewRegistry`，从不落库（AGENTS §4）。

## 1. stories store 结构

| 项 | 值 | 说明 |
| --- | --- | --- |
| store 名 | `stories`（`STORES.stories`） | 第五个 object store |
| keyPath | `id` | 与 memories/assets/scenes 同型；id 为仓库 stamped UUID |
| 索引 | `byMemoryId` → `"memoryId"`，`unique: true` | 与 `scenes.byMemoryId` 完全同构，数据库层强制 T1 D1 的 1:1 |
| 其他索引 | 无 | 1:1 实体无"按时间列全部故事"的 MVP 需求；不建 byCreatedAt（§6 最小变更，将来需要时走新版本迁移追加） |

constants.js 追加（与 T1 §2.3 / T2 §1 对齐）：

```js
export const DB_VERSION = 2;                    // 1 → 2

export const STORES = { /* …既有四项… */ stories: "stories" };

export const INDEXES = {
  // …既有四项…
  stories: { byMemoryId: "memoryId" },          // unique: true 在迁移里声明
};

export const ERROR_CODES = {
  // …既有项…
  STORY_NOT_FOUND: "STORY_NOT_FOUND",
  STORY_ALREADY_EXISTS: "STORY_ALREADY_EXISTS",
};
```

存储码只新增这两个；T1 §8 的 `STORY_NOT_CONFIRMED / STORY_GENERATION_*` 等属服务层（T4），不在本任务落 constants。`STORY_LIMITS / STORY_INITIAL_VERSION` 按 T2 §1 落地，与存储层无耦合。

行内容即 T2 `storySchema` 的 parse 产物：纯文本 + id 引用（`memoryId / sceneId / beats[].sourceIds / beats[].hotspotIds`），**不含任何 Blob、Blob URL、图片字节**（§6）。

## 2. DB_VERSION 1 → 2 迁移

### 2.1 迁移条目（db.js 追加，永不改动条目 1）

```js
const migrations = {
  1: (db) => { /* 已发布，原样保留 */ },
  2: (db) => {
    const stories = db.createObjectStore(STORES.stories, { keyPath: "id" });
    stories.createIndex(INDEXES.stories.byMemoryId, "memoryId", { unique: true });
  },
};
```

### 2.2 两条打开路径（由既有 runMigrations 循环自动覆盖，无需新机制）

| 场景 | oldVersion | 执行 | 结果 |
| --- | --- | --- | --- |
| 老用户升级 | 1 | 仅 migration 2 | 四个既有 store 一个字节不动，新增空 stories |
| 全新安装 | 0 | migration 1 → 2 | 五个 store 一次建成 |

**迁移 2 是纯结构追加**：不读、不改、不回填任何既有行。这是"不破坏现有四个 store 数据"的最强保证——不存在数据变换，就没有变换出错的可能。upgrade 回调内只有 `createObjectStore / createIndex` 两个同步结构操作，天然满足 versionchange 事务约束。

### 2.3 原子性与失败语义

- upgrade 跑在 IndexedDB 的 versionchange 事务里：migration 2 若抛错（如 store 名冲突），整个事务 abort，**数据库停留在 v1 且数据完好**——升级失败即自动回滚，无需手工修复。
- `getDB` 的 catch 已把 `dbPromise` 置 null 并抛 `StorageError`（db.js:107-110）：下次调用重新尝试打开/升级，不会缓存坏连接。
- 多标签页：旧标签页持有 v1 连接时升级被阻塞，触发 `blocked`；旧连接的 `blocking` 回调已实现 `closeDB()`（db.js:101-106），让位后升级继续。机制原样复用，不新增代码。

### 2.4 不做的事

- 不做数据回填（无新字段落到旧 store，见 §5 决策）。
- 不做降级迁移（IndexedDB 不支持，见 §7）。
- 不在迁移里写业务数据（迁移只做结构，数据写入一律走 Repository）。

## 3. StoryRepository 接口

新文件 `src/services/storage/storyRepository.js`，整体同构 `sceneRepository.js`，差别仅在**不回写 Memory**（§5）。

```js
const LINKED_STORES = [STORES.stories, STORES.memories];
```

### 3.1 create(input) → story

1. `validate(storySchema, { ...input, id: createId(), createdAt/updatedAt: now() })`（仓库 stamped，同 sceneRepository.create）。
2. `withTransaction(LINKED_STORES, "readwrite")` 内：
   - `memories.get(input.memoryId)` 不存在 → `MEMORY_NOT_FOUND`；
   - `stories.index(byMemoryId).get(memoryId)` 已存在 → `STORY_ALREADY_EXISTS`（防重检查走索引而非 memory 反向引用）；
   - `stories.put(record)`，返回 record。
3. 唯一索引是硬兜底：即便竞态绕过预检查，`ConstraintError` 经 `asStorageError` 归一为 `STORAGE_FAILED`，事务 abort 不留孤儿行。
4. memories 进事务只为存在性校验（只读），**不写 memory 行**。

### 3.2 getById(storyId) → story | null

`readFrom(STORES.stories, tx => tx.objectStore(stories).get(storyId))`，缺失返回 null（全仓库统一约定）。

### 3.3 getByMemoryId(memoryId) → story | null

`stories.index(INDEXES.stories.byMemoryId).get(memoryId)`。唯一索引 ⇒ 至多一行，`index.get` 即 O(1) 存在性 + 内容查询，这是 UI 读取故事的主路径（T1 D3：Exploration 访问状态也经 memoryId 间接查）。

### 3.4 update(storyId, patch) → story

与 sceneRepository.update 逐行同型（sceneRepository.js:74-100）：

1. `definedOnly(validate(storyPatchSchema, patch))`——patch 已 omit `id / memoryId / createdAt`（T2 D5），所有权不可转移。
2. 事务内 `get` 缺失 → `STORY_NOT_FOUND`。
3. 合并 `{ ...existing, ...cleanPatch, id/memoryId/createdAt: existing 原值, updatedAt: now() }`，用**完整 storySchema** 二次校验后 `put`。跨字段不变量（sceneId/sceneVersion 成对、无场景时 hotspotIds 必空、beat 采纳门控 R1–R3）在合并点强制——半对 patch 在此被拒。
4. 重生成 = 服务层调 `update(id, { beats, title, sceneId, sceneVersion, version: existing.version + 1 })`：**id 不变、version 递增由服务层写入**，仓库不自动递增（与 scene 重生成经 aiService 写 version 的分工一致，aiService.js:340-351）。
5. 事务只含 stories，不触碰 memories。

### 3.5 delete(storyId) → storyId

事务只含 stories：`get` 缺失 → `STORY_NOT_FOUND`；`delete(storyId)`；返回 storyId。无 memory 行需要清理（无反向引用）。

MVP 无独立删除入口（T1 §5"已删除"仅指级联）；本方法为接口完整性与测试对称性而设，服务层暂不暴露。Memory 级联**不经过本方法**——级联必须发生在 MemoryRepository.delete 的同一事务内，跨 Repository 调用会开出第二个事务（§4）。

### 3.6 错误码与归一

| 场景 | 码 | 来源 |
| --- | --- | --- |
| create 时 memory 不存在 | MEMORY_NOT_FOUND | 复用既有 |
| create 时该 memory 已有 story | STORY_ALREADY_EXISTS | 新增 |
| update/delete 目标行不存在 | STORY_NOT_FOUND | 新增 |
| schema/patch 校验失败 | VALIDATION_FAILED | asStorageError 既有归一 |
| 唯一索引竞态兜底 | STORAGE_FAILED | ConstraintError 既有归一 |

## 4. Memory 删除级联

`memoryRepository.js` 两处最小改动：

```js
const CASCADE_STORES = [
  STORES.memories,
  STORES.assets,
  STORES.scenes,
  STORES.explorations,
  STORES.stories,                                   // 追加
];

// delete 事务内，explorations.delete 之后追加一行：
await deleteByIndex(tx, STORES.stories, INDEXES.stories.byMemoryId, memoryId);
```

- 与既有机制完全兼容：同一 readwrite 事务、同一 `deleteByIndex` 工具、同样的"memory 行不存在则整体抛 MEMORY_NOT_FOUND 不删任何东西"前置校验。任一步失败 → 事务 abort → 五个 store 一起回滚，memory 不会比它的 story 活得更久，反之亦然。
- 唯一索引保证至多一行，但沿用 `deleteByIndex` 而非 `index.get + delete`：与 assets/scenes 的级联写法保持一致，且对"索引意外多行"的脏数据同样删干净。
- `StoryRepository.delete` 不参与级联（§3.5）；`SceneRepository.deleteByMemoryId` 等既有单独删除路径不受影响——它们不删 memory，story 行继续合法存在。
- 场景单独删除/重生成**不**级联动 story：T1 §5 已定"场景重生成只令 story 派生 stale，不改写行"。stale 是读取时派生状态，存储层不做任何失效清理。

## 5. Memory 侧 storyId 反向引用：**不新增**（决策）

### 5.1 结论

`memorySchema` 不加 `storyId` 字段，Memory 行与 stories 的关联完全由 `stories.byMemoryId` 唯一索引承载。Story 跟随 **Exploration 模式**（1:1 子实体、无父侧反向引用、按 memoryId 直查），而非 Scene 模式（父侧 sceneId + 双写同步）。

### 5.2 理由

1. **查询能力无增益**：反向引用的价值是"读父行即知子实体存在"。Story 的读取主路径本来就是 `getByMemoryId`（唯一索引 `index.get`，O(1)）；MVP 的故事入口在 memory 详情页，单次索引查询即可门控，列表页无"是否有故事"徽标需求。为一个不存在的读取场景引入冗余字段，违反 §6 最小变更。
2. **保住纯结构迁移**：加 `storyId` 意味着 migration 2 必须用游标回填所有既有 memory 行（`storyId: null`），否则 `memorySchema.strict()` 下旧行缺字段、`getById` 原样返回旧行时 `memory.storyId === undefined`。回填把"零数据变换"升级成"全表重写"，直接加大"破坏现有四 store 数据"的风险面。不加字段，迁移 2 对旧数据零接触（§2.2）。
3. **T1 边界**：T1 §6 明确"Story 只新增一个 store、一个 schema 文件、一个 Repository、一个 service 入口，不改动 memorySchema"。加反向引用需要同时改 memorySchema（新字段 + patch omit）与 memoryRepository 语义，越出 T1 划定的变更面。
4. **免除双写同步**：sceneId 模式要求 create/delete 在同事务回写 memory（sceneRepository.js:46-48、118-124），多一处写就多一类不一致可能。Story 无独立删除入口、重生成 id 不变，反向引用在整个生命周期里只有 create 时一次写入价值，收益配不上同步成本。
5. **先例支持**：Exploration 同为 1:1 子实体且无反向引用，代码库本就两种模式并存；Scene 的 sceneId 是历史选择，不是必须遵守的范式。

被否方案：`memory.storyId`（同 sceneId 模式）。否因如上；若未来列表页确需"含故事"过滤/徽标，再按下节规则升级。

### 5.3 将来若新增 storyId 的同步规则（预留约定，本任务不实现）

完全参照 `assetIds / sceneId` 的既有约定：

1. `memorySchema` 增 `storyId: z.string().min(1).nullable().default(null)`；`memoryPatchSchema` 的 omit 列表追加 `storyId`——**调用方永远不可直接 patch**，只能经 StoryRepository 同步。
2. 写入点收敛且同事务：`StoryRepository.create` 在 `[stories, memories]` 事务内置 `memory.storyId = record.id`；`delete` 扩展为 `[stories, memories]` 事务并清 `memory.storyId = null`（仅当指向被删 story 时，同 sceneRepository.deleteByMemoryId 的条件清理）。重生成 id 不变，无需触碰。
3. 需要一次新的 DB_VERSION 迁移（v3）：结构上加字段无需动 store，但必须游标回填既有 memory 行 `storyId: null`，并处理"旧行缺字段"的读取兼容；回填与结构变更同 versionchange 事务，失败整体 abort。
4. `MemoryRepository.delete` 无需改动（memory 行本身被删，反向引用随之消失）。

## 6. 数据规则与 MVP 边界

- **不持久化 Blob URL**：story 行只有文本与 id 引用；`storySchema / storyBeatSchema` 均 `.strict()`，任何 `blob / blobUrl / coverUrl` 之类字段直接 `VALIDATION_FAILED`。图片本体仍唯一存于 `assets.blob`，预览 URL 仍只走内存态 previewRegistry。Repository 层不调用 `URL.createObjectURL`。
- **引用完整性归属**：`beats[].sourceIds ⊆ memory.assetIds`、`hotspotIds ⊆ scene.hotspots[].id` 是服务层校验义务（T2 §6，同 visitHotspot 的存在性校验归属）；存储层只保证形状与 1:1 唯一性，不做跨 store 引用校验——与 scene 存储层不校验 hotspot sourceIds 的既有分工一致。
- 不做：stories 的 byCreatedAt 索引、getAll/list 接口、独立删除 UI、跨 Memory 聚合、导出/备份功能（均为假想需求，§6/§7 禁区自检通过）。
- 变更面清单：`constants.js`（DB_VERSION/STORES/INDEXES/ERROR_CODES 追加）、`db.js`（migrations[2]）、`memoryRepository.js`（CASCADE_STORES + 一行级联）、新增 `storyRepository.js`。`memorySchema / sceneSchema / explorationSchema / assetRepository / sceneRepository / explorationRepository` 零改动。

## 7. 回滚策略

IndexedDB **不支持版本降级**：磁盘已是 v2 时用 `openDB(name, 1)` 打开会抛 `VersionError`。因此回滚分三层：

| 层 | 场景 | 策略 | 数据后果 |
| --- | --- | --- | --- |
| L1 自动 | migration 2 执行失败 | versionchange 事务 abort，DB 停留 v1；`dbPromise` 已置 null，下次 getDB 重试 | 零损失，无需人工 |
| L2 代码回滚 | 上线后撤销 Story 功能 | **DB_VERSION 保持 2、保留 migrations[2] 与 STORES/INDEXES.stories**，只撤 UI/service/schema/repository 业务代码；建议同时保留 memoryRepository 的 stories 级联行（对空 store 执行 deleteByIndex 无副作用，且避免已生成的 story 行变孤儿） | 四个既有 store 不受影响；stories 空转或残留 inert 数据 |
| L3 彻底重置 | 开发期脏库 / 用户明确放弃全部本地数据 | `closeDB()` 后 `indexedDB.deleteDatabase(DB_NAME)`，再按当前版本重建 | **销毁全部本地记忆，不可逆**；仅限开发调试或经用户明确确认，绝不进入应用自动流程 |

要点：
- L2 是唯一生产可用的"回滚"：因为迁移 2 纯追加、无数据变换，v2 库对 v1 业务代码完全向后兼容（旧代码不认识 stories store，也不会打开它），**不需要任何反向迁移**。
- 禁止的"回滚"：把 DB_VERSION 改回 1 发布（老用户直接 VersionError 打不开库）；编辑已发布的 migrations[1]（db.js:51-52 注释明令禁止，且会破坏全新安装路径）。
- 无数据导出/导入预案：MVP 无此功能，不为本任务发明；L3 的破坏性由"用户明确确认"兜底。

## 8. 实测记录（临时 vitest 套件，验证后删除）

方法：将 §2 迁移条目、§3 仓储草案、§4 级联改动置于 `tests/tmp-t3/` 临时套件，依赖真实 `db.js` 工具函数（StorageError/asStorageError/validate/deleteByIndex）、真实四个 Repository（v1 播种）、T2 schema 草案与真实 constants/utils；fake-indexeddb 环境同既有测试。

实测结果（2026-11-17，vitest 5.1.0 / fake-indexeddb，同既有 setup）：

- 临时套件 **13/13 通过**（migration.test.js 2 项 + storyRepository.test.js 11 项）：
  - **升级路径**：真实 v1 库经四个真实 Repository 播种（memory/asset/scene/exploration 各 1 行）→ closeDB → 草案 v2 重开。`db.version === 2`，五个 store 齐备；四个既有 store 逐行 deep-equal 完好（asset 的 Blob 按 size/type 比对且仍为 Blob 实例）；stories 为空、keyPath `id`、`memoryId` 索引 `unique === true`。
  - **全新安装路径**：空库直开草案 v2，migrations 1→2 顺序执行，五 store 与 memories 的 byStatus/byCreatedAt 索引齐备。
  - **唯一索引**：同 memoryId 第二行 put 抛 `ConstraintError`；`deleteByIndex` 在事务内删净。
  - **仓储草案**：create stamped id/时间戳/version=1 且 memory 行零改动（无 storyId 键）；MEMORY_NOT_FOUND / STORY_ALREADY_EXISTS / STORY_NOT_FOUND 各归其位；get 缺失返 null；update 固定 id/memoryId/createdAt；patch 含 memoryId、半对 sceneVersion、A2 采纳攻击（user_confirmed + confirmed + 未 adopted）均 VALIDATION_FAILED 且原行不动；delete 后 memory 行不受影响。
  - **级联草案**：删 memory 后五 store 对应行全部消失；重复删除 MEMORY_NOT_FOUND；级联中途抛错 → 事务 abort，五 store（含 story）一起回滚、逐行完好。
  - **Blob URL**：story 级 `coverBlobUrl` 与 beat 级 `blobUrl` 均被 strict schema 拒绝（VALIDATION_FAILED），库中零残留。
- 全量回归：22 个测试文件 **217/217 通过**（既有 204 + 本套件 13），既有 schema/仓储/服务无回归。
- 验证后临时套件已删除，删除后基线复跑 20 文件 **204/204 通过**。本任务仅交付设计稿；正式测试随实现按 §9 落地。

## 9. 正式测试计划（随实现落地，非本任务产出）

- `tests/services/storage/storyRepository.test.js`：create stamped 字段与 1:1 防重（STORY_ALREADY_EXISTS）、memory 缺失（MEMORY_NOT_FOUND）、getById/getByMemoryId 缺失返 null、update 合并强制 id/memoryId/createdAt 与跨字段拒绝、delete 缺失报 STORY_NOT_FOUND、strict 拒绝 blobUrl 字段。
- 迁移测试：v1 播种四 store → closeDB → v2 重开，逐行断言数据完好 + stories 结构/唯一索引；全新安装五 store 齐备。
- `memoryRepository.test.js` / `transaction.test.js` 追加：删 memory 后 story 行消失；级联中途失败五 store 一起回滚；重复删除报 MEMORY_NOT_FOUND 且不动 story。

## 10. 验收对照

| 验收项 | 落点 |
| --- | --- |
| 不破坏现有四个 store 的数据 | 迁移 2 纯结构追加、零数据变换（§2.2）；失败自动 abort 回 v1（§2.3、§7 L1）；实测逐行比对（§8） |
| 级联与 CASCADE_STORES 机制兼容 | 同事务 + deleteByIndex 追加一行，前置校验/回滚语义不变（§4）；实测级联与原子性（§8） |
| 不持久化 Blob URL | story 行仅文本 + id 引用，strict schema 拒绝未知字段，Blob 仍唯一存 assets（§6）；实测拒绝（§8） |
| StoryRepository 五接口 | create/getById/getByMemoryId/update/delete，错误码与事务边界明确（§3） |
| storyId 反向引用有结论与同步规则 | 不新增（五条理由）；将来新增时 patch omit + 同事务双写 + v3 回填（§5） |
| 迁移与回滚策略 | 1→2 双路径 + 三层回滚，禁止降级与改条目 1（§2、§7） |