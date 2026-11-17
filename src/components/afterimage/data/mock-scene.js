/* 余像 Afterimage · 对接演示用虚构数据（A 组自编，非 C 组源码/素材）
 * 形状参照 C 组 sceneSchema / hotspotSchema，但内容全部为虚构示例。
 * 模拟数据 / 未接入真实 AI / 未与 C 组实际联调。
 */
(function (global) {
  'use strict';

  var calm = {
    id: 'scene-demo-0001',
    memoryId: 'memory-demo-0001',
    template: 'cafeteria',
    title: '外婆的厨房（虚构示例）',
    background: { type: 'template', assetId: null },
    version: 1,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    hotspots: [
      {
        id: 'hs-a1b2c3d4', name: '搪瓷杯', type: 'object',
        position: { x: 0.22, y: 0.62 }, sourceIds: [],
        description: '杯口有一道磕碰的痕。虚构示例：外婆总用它盛凉白开。',
        sourceType: 'user_confirmed', confirmed: true, confidence: 1
      },
      {
        id: 'hs-e5f6a7b8', name: '旧挂钟', type: 'object',
        position: { x: 0.5, y: 0.3 }, sourceIds: [],
        description: '虚构示例：钟摆声比电视声还响。',
        sourceType: 'image_observed', confidence: 0.8
      },
      {
        id: 'hs-c9d0e1f2', name: '木桌', type: 'object',
        position: { x: 0.74, y: 0.68 }, sourceIds: [],
        description: '虚构示例：桌面上有烫出的白印。',
        sourceType: 'ai_inferred', confidence: 0.45
      },
      {
        id: 'hs-3a4b5c6d', name: '窗台上的薄荷', type: 'object',
        position: { x: 0.86, y: 0.4 }, sourceIds: [],
        description: '虚构示例：也许有一盆薄荷，也许没有。',
        sourceType: 'fictional', confidence: 0.2
      },
      {
        id: 'hs-7e8f9a0b', name: '没用上的车票', type: 'object',
        position: { x: 0.34, y: 0.44 }, sourceIds: [],
        description: '虚构示例：一张没检过的票。',
        sourceType: 'ai_inferred', confidence: 0.4
      }
    ]
  };

  var revisit = {
    id: 'scene-demo-0001',
    memoryId: 'memory-demo-0001',
    template: 'cafeteria',
    title: '外婆的厨房 · 第 2 版（虚构示例）',
    background: { type: 'template', assetId: null },
    version: 2,
    createdAt: 1700000000000,
    updatedAt: 1700000999999,
    hotspots: [
      calm.hotspots[0],
      calm.hotspots[1],
      calm.hotspots[2],
      {
        id: 'hs-new11223', name: '灶台上的铝壶', type: 'object',
        position: { x: 0.6, y: 0.55 }, sourceIds: [],
        description: '虚构示例：新增热点，用于演示数据更新。',
        sourceType: 'ai_inferred', confidence: 0.4
      }
    ]
  };

  // 边界用例：演示适配层的显式降级（重复 id / 缺 id / 异常坐标 / 超长名称 / 非字符串描述 / 误标 confirmed / 未知 type）
  var edge = {
    id: 'scene-demo-edge',
    memoryId: 'memory-demo-edge',
    template: 'generic',
    title: '边界用例（虚构示例）',
    background: { type: 'template', assetId: null },
    version: 1,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    hotspots: [
      { id: 'hs-ok00001', name: '正常热点', type: 'object', position: { x: 0.3, y: 0.5 }, sourceIds: ['src-1'], description: '正常描述', sourceType: 'user_confirmed', confirmed: true },
      { id: 'hs-ok00001', name: '重复 id 应被忽略', type: 'object', position: { x: 0.5, y: 0.5 }, sourceIds: [], description: '', sourceType: 'ai_inferred' },
      { name: '缺少 id 应被跳过', type: 'object', position: { x: 0.5, y: 0.5 }, sourceIds: [], description: '', sourceType: 'ai_inferred' },
      { id: 'hs-badpos1', name: '异常坐标应夹取', type: 'object', position: { x: 1.6, y: -0.4 }, sourceIds: [], description: '', sourceType: 'image_observed' },
      { id: 'hs-nopos1', name: '缺坐标应自动布点', type: 'object', sourceIds: [], description: '', sourceType: 'ai_inferred' },
      { id: 'hs-longname', name: '超长名称测试啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊', type: 'object', position: { x: 0.7, y: 0.3 }, sourceIds: [], description: '', sourceType: 'ai_inferred' },
      { id: 'hs-baddesc', name: '非字符串描述', type: 'object', position: { x: 0.2, y: 0.7 }, sourceIds: [], description: 12345, sourceType: 'ai_inferred' },
      { id: 'hs-fakeconf', name: '误标用户确认应降级', type: 'object', position: { x: 0.8, y: 0.7 }, sourceIds: [], description: '', sourceType: 'ai_inferred', confirmed: true },
      { id: 'hs-unktype', name: '未知 type 用通用图形', type: 'spaceship', position: { x: 0.45, y: 0.8 }, sourceIds: [], description: '', sourceType: 'fictional' },
      { id: 'hs-xss001', name: '<img src=x onerror=alert(1)>', type: 'object', position: { x: 0.6, y: 0.2 }, sourceIds: [], description: '<script>alert(2)</script> 应按文本呈现', sourceType: 'ai_inferred' }
    ]
  };

  var empty = {
    id: 'scene-demo-empty', memoryId: 'memory-demo-empty', template: 'generic',
    title: '空场景（虚构示例）', background: { type: 'template', assetId: null },
    version: 1, createdAt: 1700000000000, updatedAt: 1700000000000, hotspots: []
  };

  global.AFTERIMAGE_MOCK_SCENES = {
    calm: calm,
    revisit: revisit,
    edge: edge,
    empty: empty,
    initialVisited: ['hs-a1b2c3d4']
  };
})(typeof window !== 'undefined' ? window : globalThis);