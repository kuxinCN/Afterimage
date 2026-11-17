# 余像 Afterimage

余像是一个 AI 辅助的个人记忆重建与探索平台（MVP 阶段）。你导入一段记忆的文字描述和照片，AI 帮你整理出其中的场景、物件、时间、地点等要素；你逐条审核、修改并确认后，余像会基于确认内容生成一个可点击探索的 2.5D 记忆场景。

所有数据保存在浏览器本地（IndexedDB），不需要账号，也不需要任何 API Key。

## 核心体验

```
导入记忆（文字 + 照片） → AI 整理 → 人工审核确认 → 生成 2.5D 场景 → 热点探索
```

余像坚持「记忆真实性」原则：每条信息都标注来源（`user_confirmed` / `image_observed` / `ai_inferred` / `fictional`），AI 推断不会被当作已确认事实展示，人物关系与情绪不会被自动编造，只有用户确认过的内容才能进入场景。

## 已实现功能

- **记忆管理**：首页记忆列表、创建记忆（标题、描述、日期、地点）、删除记忆（级联清理关联数据）。
- **照片导入**：拖拽/选择图片，格式与大小校验，图片以 Blob 存入 IndexedDB，刷新后可恢复预览。
- **AI 整理与审核**：生成摘要、场景类型、物件、标签、时间、地点的整理草稿；逐条采纳、编辑、手动补充；重新整理时保留已确认条目；确认后写入记忆事实。
- **2.5D 场景生成**：仅基于已确认内容生成模板化 2.5D 场景（食堂、教室、卧室、街道、户外等），物件成为可点击热点；重新生成保留热点访问记录。
- **热点探索**：点击热点查看信息，访问进度本地持久化。
- **本地持久化**：Memory / Asset / Scene / Exploration 四类实体通过 Repository 层读写 IndexedDB，外部数据一律经 Zod 校验。

> 当前 AI 能力由内置 Mock Provider 提供：基于用户文字的关键词匹配，不读取照片像素，也没有接入真实大模型。Provider 注册表已预留接缝，后续可替换为真实服务端 AI。

## 技术栈

- Next.js 14.2（App Router）+ React 18，JavaScript
- Tailwind CSS 3.4
- IndexedDB（[idb](https://github.com/jakearchibald/idb)）本地持久化
- Zod 数据校验
- Vitest + fake-indexeddb 单元测试

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。数据保存在当前浏览器的 IndexedDB 中，清除站点数据会删除所有记忆。

其他命令：

```bash
npm test          # 运行单元测试（Vitest）
npm run test:watch
npm run lint      # ESLint
npm run build     # 生产构建
```

## 项目结构

```
src/
├── app/                  # 页面：首页（记忆列表）、/create（创建）、/memory/[id]（详情）
├── components/           # UI 组件：upload / memory / ai / scene
├── hooks/                # 图片导入等 React hooks
├── schemas/              # Zod 数据模型与来源溯源约束
├── services/
│   ├── ai/               # Provider 注册表、整理/场景生成服务、Mock Provider
│   ├── image/            # 图片校验（文件头嗅探）、元数据、预览管理
│   ├── memory/           # 记忆创建/读取/删除的业务编排
│   ├── scene/            # 场景读取、热点访问、2.5D 模板
│   └── storage/          # IndexedDB 与四类 Repository
└── lib/                  # 常量与工具函数
tests/                    # Vitest 测试（schemas + services）
docs/                     # 领域模型、Schema、存储、API 契约等设计文档
AGENTS.md                 # 项目架构与开发规则
```

## Qoder 在本项目中的作用

本项目使用 Qoder 协作开发：`AGENTS.md` 约定了技术栈、架构与记忆真实性等规则，供 AI 在每次任务中遵循；`docs/` 沉淀了领域模型与数据结构设计；功能按「设计 → 实现 → 测试」的小步迭代推进，UI 与业务逻辑分离，数据层与 AI 层均有测试覆盖。

## 当前边界

- AI 为 Mock 实现，暂无真实视觉识别或大模型调用，也没有服务端 API。
- 场景为 CSS 模板渲染的 2.5D 效果，不是完整 3D 环境。
- 数据仅存于本地浏览器，暂无云同步。