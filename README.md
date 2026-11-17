# 余像 Afterimage

余像是一个 AI 辅助的个人记忆重建与探索平台（MVP 阶段）。它把真实的生活资料（文字 + 照片）重构成可以再次进入的记忆空间，并坚持「记忆真实性」原则：每条信息都标注来源，AI 推断不会被当作已确认事实展示，人物关系与情绪不会被自动编造。

所有数据保存在浏览器本地（IndexedDB / sessionStorage），不需要账号，也不需要任何 API Key。

## 两条体验线（双轨并行）

当前仓库同时提供两条独立的故事体验，互不耦合：

### 1. 互动故事线（Mock，可玩）

```
首页 → /create 输入经历 → /story 故事推进（选择行动 / 自由输入）→ /ending 结局回顾
```

- 故事由内置 Mock 连续生成（非重复内容），2–3 次行动后自然走向结局。
- 故事文字**整篇标记为虚构（fictional）**，明确是想象演绎，不冒充对真实记忆的还原。
- 状态存于 sessionStorage，刷新可恢复；含加载 / 错误 / 重试与防重复提交。

### 2. 照片建档线（记忆整理 + 2.5D 场景）

```
/memory/new 导入照片建档 → AI 整理 → 人工逐条审核确认 → 生成 2.5D 场景 → 热点探索
```

- **记忆管理**：`/memory` 记忆列表（封面、状态徽标、空 / 载 / 错态）、`/memory/[id]` 详情（存在性门控）、删除记忆级联清理关联数据。
- **照片导入**：拖拽 / 选择图片，格式与大小校验，图片以 Blob 存入 IndexedDB，刷新后可恢复预览。
- **AI 整理与审核**：生成摘要、场景类型、物件、标签、时间、地点草稿；逐条采纳、编辑、手动补充；重新整理保留已确认条目；确认后写入记忆事实。
- **2.5D 场景生成**：仅基于已确认内容生成模板化场景（食堂、教室、卧室、街道、户外等），物件成为可点击热点；重新生成保留热点访问记录。
- **热点探索**：点击热点查看信息，访问进度本地持久化。

> 互动故事页预留了 2.5D 场景组件位（`useStoryScene` 接缝），等待视觉组件与建档叙事线接入；当前为占位，不阻塞故事推进。`/scene-preview` 是 A 视觉参考包的临时独立预览页（非主线，可删）。

## 记忆真实性

每条信息都带来源标记：`user_confirmed`（用户确认）/ `image_observed`（图片可见）/ `ai_inferred`（AI 推测）/ `fictional`（想象内容）。推测不会伪装成已确认事实；只有用户确认过的内容才能进入场景。

> 当前 AI 能力由内置 **Mock Provider** 提供：基于用户文字的关键词匹配，**不读取照片像素**，也没有接入真实大模型。因此 Mock 产出不会标记为 `image_observed`，模拟推测均明确标注为模拟内容。Provider 注册表已预留接缝，后续替换为真实服务端 AI 时需重新设计密钥保护（密钥绝不进入浏览器）。

## 技术栈

- Next.js 14.2（App Router）+ React 18，JavaScript
- Tailwind CSS 3.4
- IndexedDB（[idb](https://github.com/jakearchibald/idb)）本地持久化
- Zod 3.x 数据校验（外部数据一律经 Zod）
- Vitest + fake-indexeddb 单元测试

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。数据保存在当前浏览器的 IndexedDB / sessionStorage 中，清除站点数据会删除所有记忆。

其他命令：

```bash
npm test          # 运行单元测试（Vitest，当前 25 文件 / 320 用例）
npm run lint      # ESLint（next/core-web-vitals）
npm run build     # 生产构建（请勿与 dev 服务器同时运行）
```

## 架构约定

- UI 与业务逻辑分离；数据访问经 Repository 层；AI 请求规划走服务端 API，密钥永不暴露给浏览器。
- 实体 ID 用 UUID；图片以 Blob 持久化；**绝不持久化 Blob URL**（预览 URL 仅存内存态 previewRegistry）。
- 场景生成独立于 React 渲染。
- 详见 `AGENTS.md`。

## 协作与待实现

- **A**：2.5D 场景视觉参考包（`vendor/afterimage-a/`，只读）。
- **B**：建档叙事线 Story 的设计定稿（`docs/`，T1–T7），**尚未实现**；落地时需注意与互动故事线的 schema / 常量命名隔离。
- **C**：前端架构 + 互动故事线 + 建档链路 UI（本仓库主线）。