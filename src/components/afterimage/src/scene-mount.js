/* 余像 Afterimage · mountScene 客户端挂载接口（零依赖，A 任务）
 * 把「外部 scene + 外部 visited + 用户回调」一站式接到 MemorySpace，供任意框架（含 React）薄包装。
 * 仅在客户端调用（需要 document）。不读数据库、不发网络请求、不写 C 组存储。
 *
 * 用法：
 *   var handle = Afterimage.mountScene(containerEl, {
 *     scene: externalScene,            // C 形状 scene（含 hotspots）
 *     visitedHotspots: ['hs-xx'],      // 外部已探索 id（持久化结果的来源）
 *     onHotspotClick: function (id) {},// 用户点击碎片时回调（= C 的 onHotspotClick）
 *     exploreOn: 'open',               // 'open'|'close'|'none'，默认 open（与 C 点击即探索对齐）
 *     kindMap: { object: 'keepsake' }, // 可选：C type → A kind 的显式映射
 *     onIssues: function (issues) {},  // 可选：适配降级/跳过报告
 *     theme / layout / dust / reduceMotion / onFragmentOpen / onFragmentClose / onStateChange
 *   });
 *   handle.update({ scene, visitedHotspots });  // 数据变化（程序路径，不伪装用户点击）
 *   handle.setVisited(ids);                     // 仅更新外部探索态
 *   handle.getState(); handle.destroy();
 *
 * 语义保证：
 *  - 用户点击 → onExploreRequest → onHotspotClick(id)；A 不做乐观已探索标记。
 *  - 外部记录成功与否由外部决定：只有外部把 id 放进 visitedHotspots / setVisited，界面才显示已探索。
 *  - update / setVisited / setFragments 均为程序路径，不触发 onHotspotClick。
 */
(function (global) {
  'use strict';

  var Afterimage = global.Afterimage = global.Afterimage || {};

  function mountScene(container, config) {
    var cfg = config || {};
    var adapter = Afterimage.SceneAdapter;
    var MemorySpace = Afterimage.MemorySpace;
    if (!adapter || !MemorySpace) {
      throw new Error('mountScene: 需先加载 memory-fragment.js / memory-space.js / scene-adapter.js');
    }

    var adaptOpts = {
      kindMap: cfg.kindMap,
      defaultKind: cfg.defaultKind,
      maxNameLength: cfg.maxNameLength,
      visitedHotspots: cfg.visitedHotspots
    };

    var current = adapter.adaptScene(cfg.scene, adaptOpts);
    if (typeof cfg.onIssues === 'function' && current.issues.length) cfg.onIssues(current.issues);

    var space = new MemorySpace(container, {
      fragments: current.fragments,
      exploredIds: current.exploredIds,
      theme: cfg.theme,
      layout: cfg.layout,
      dust: cfg.dust,
      reduceMotion: cfg.reduceMotion,
      exploreOn: cfg.exploreOn == null ? 'open' : cfg.exploreOn,
      onFragmentOpen: cfg.onFragmentOpen,
      onFragmentClose: cfg.onFragmentClose,
      onStateChange: cfg.onStateChange,
      onExploreRequest: function (id) {
        if (typeof cfg.onHotspotClick === 'function') cfg.onHotspotClick(id);
      }
    });

    var lastMeta = current.meta;
    var lastIssues = current.issues;
    var lastSceneKey = JSON.stringify(cfg.scene == null ? null : cfg.scene);

    function applyAdapt(next) {
      lastMeta = next.meta;
      lastIssues = next.issues;
      if (typeof cfg.onIssues === 'function' && next.issues.length) cfg.onIssues(next.issues);
    }

    return {
      space: space,
      // 数据更新：程序路径，不触发用户点击回调。
      // 仅 visitedHotspots 变化（scene 内容未变）→ 只回灌探索态，不重建碎片、不打断详情。
      // scene 真变化 → setFragments(preserveOpen)，仍存在的打开项保持阅读。
      update: function (nextCfg) {
        var n = nextCfg || {};
        var hasScene = n.scene !== undefined;
        var hasVisited = n.visitedHotspots !== undefined;
        var hasKindOpts = n.kindMap !== undefined || n.defaultKind !== undefined || n.maxNameLength !== undefined;
        if (hasScene || hasVisited || hasKindOpts) {
          var opts = {
            kindMap: n.kindMap !== undefined ? n.kindMap : adaptOpts.kindMap,
            defaultKind: n.defaultKind !== undefined ? n.defaultKind : adaptOpts.defaultKind,
            maxNameLength: n.maxNameLength !== undefined ? n.maxNameLength : adaptOpts.maxNameLength,
            visitedHotspots: n.visitedHotspots !== undefined ? n.visitedHotspots : adaptOpts.visitedHotspots
          };
          adaptOpts.kindMap = opts.kindMap;
          adaptOpts.defaultKind = opts.defaultKind;
          adaptOpts.maxNameLength = opts.maxNameLength;
          adaptOpts.visitedHotspots = opts.visitedHotspots;

          var sceneObj = hasScene ? n.scene : cfg.scene;
          var sceneKey = JSON.stringify(sceneObj == null ? null : sceneObj);
          var sceneChanged = sceneKey !== lastSceneKey;
          cfg.scene = sceneObj;
          lastSceneKey = sceneKey;

          var next = adapter.adaptScene(sceneObj, opts);
          applyAdapt(next);

          var report;
          if (sceneChanged) {
            report = space.setFragments(next.fragments, {
              preserveStatus: true, preserveExplored: true, preserveOpen: true
            });
            report.sceneChanged = true;
          } else {
            report = {
              sceneChanged: false,
              kept: space.getState().fragments.length,
              droppedDuplicateIds: [],
              closedOpenId: null,
              removedOpenId: null,
              preservedOpenId: space.openId
            };
          }
          space.setExplored(next.exploredIds);
          return report;
        }
        if (n.theme || n.layout || n.dust != null || n.reduceMotion != null || n.exploreOn) {
          space.update(n);
        }
        return null;
      },
      // 仅更新外部探索态（过滤孤儿 id），不触发用户回调
      setVisited: function (ids) {
        var picked = adapter.pickExploredIds(ids, space.getState().fragments);
        adaptOpts.visitedHotspots = ids;
        return space.setExplored(picked);
      },
      getState: function () {
        var s = space.getState();
        s.meta = lastMeta;
        s.issues = lastIssues;
        return s;
      },
      destroy: function () { space.destroy(); }
    };
  }

  Afterimage.mountScene = mountScene;
})(typeof window !== 'undefined' ? window : globalThis);