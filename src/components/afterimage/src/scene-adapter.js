/* 余像 Afterimage · SceneAdapter 数据适配模块（零依赖，A 任务）
 * 将外部（C 组形状）scene / hotspots 转换为 MemorySpace 可用的 fragments。
 * 纯函数式转换：不读数据库、不发网络请求、不生成故事、不写任何存储。
 *
 * 规则（详见 docs/a-handoff-for-c.md）：
 *  - 沿用外部 hotspot.id 作为碎片 id，不重新生成；缺 id 的热点被跳过并记 issue（不编造 id）。
 *  - name→title、description→content；0~1 坐标→百分比(×100)。
 *  - 重复 id 保留首条并记 issue；异常坐标夹取到 [0,1] 并记 issue；缺坐标则置 null 交由组件自动布点。
 *  - 名称超长截断到 maxNameLength 并记 issue；空名称回退「未命名碎片」并记 issue。
 *  - C 的 type 与 A 的视觉 kind 不等同：仅当调用方提供 kindMap 显式映射时才采用，否则用 defaultKind（通用图形），不靠名称猜。
 *  - 保留 sourceType / sourceIds / confidence / confirmed；confirmed 仅在 sourceType==='user_confirmed' 时才可为 true，绝不升级。
 *  - 所有降级/跳过都通过 issues 显式返回，不静默编造数据。
 */
(function (global) {
  'use strict';

  var Afterimage = global.Afterimage = global.Afterimage || {};

  var SOURCE_TYPES = {
    USER_CONFIRMED: 'user_confirmed',
    IMAGE_OBSERVED: 'image_observed',
    AI_INFERRED: 'ai_inferred',
    FICTIONAL: 'fictional'
  };

  var SOURCE_LABELS = {
    user_confirmed: '用户确认',
    image_observed: '图片可见',
    ai_inferred: 'AI 推测',
    fictional: '想象内容'
  };

  var KNOWN_SOURCE_TYPES = [
    SOURCE_TYPES.USER_CONFIRMED, SOURCE_TYPES.IMAGE_OBSERVED,
    SOURCE_TYPES.AI_INFERRED, SOURCE_TYPES.FICTIONAL
  ];

  var A_KINDS = ['photo', 'note', 'ticket', 'clock', 'cup', 'keepsake'];

  var ISSUE = {
    SCENE_INVALID: 'SCENE_INVALID',
    HOTSPOTS_INVALID: 'HOTSPOTS_INVALID',
    HOTSPOT_INVALID: 'HOTSPOT_INVALID',
    MISSING_ID: 'MISSING_ID',
    DUPLICATE_ID: 'DUPLICATE_ID',
    EMPTY_NAME: 'EMPTY_NAME',
    NAME_TRUNCATED: 'NAME_TRUNCATED',
    INVALID_DESCRIPTION: 'INVALID_DESCRIPTION',
    POSITION_MISSING: 'POSITION_MISSING',
    POSITION_CLAMPED: 'POSITION_CLAMPED',
    TYPE_FALLBACK: 'TYPE_FALLBACK',
    SOURCE_TYPE_MISSING: 'SOURCE_TYPE_MISSING',
    SOURCE_TYPE_UNKNOWN: 'SOURCE_TYPE_UNKNOWN',
    SOURCE_IDS_INVALID: 'SOURCE_IDS_INVALID',
    CONFIDENCE_INVALID: 'CONFIDENCE_INVALID',
    CONFIRMED_DOWNGRADED: 'CONFIRMED_DOWNGRADED'
  };

  function isObj(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
  function finiteNum(v) { return typeof v === 'number' && isFinite(v); }
  function clamp01(v) { return Math.min(1, Math.max(0, v)); }

  function issue(code, message, hotspotId) {
    return { code: code, message: message, hotspotId: hotspotId == null ? null : String(hotspotId) };
  }

  function validKind(k) { return A_KINDS.indexOf(k) >= 0; }

  // 单个热点 → 碎片；返回 { fragment, issues }。fragment 为 null 表示被跳过。
  function adaptHotspot(hotspot, opts) {
    var o = opts || {};
    var issues = [];
    if (!isObj(hotspot)) {
      return { fragment: null, issues: [issue(ISSUE.HOTSPOT_INVALID, '热点不是对象，已跳过')] };
    }

    // id：沿用外部值，不编造
    var rawId = hotspot.id;
    if (rawId == null || String(rawId) === '') {
      return { fragment: null, issues: [issue(ISSUE.MISSING_ID, '热点缺少 id，已跳过（不编造 id）')] };
    }
    var id = String(rawId);

    // name → title
    var name = typeof hotspot.name === 'string' ? hotspot.name.trim() : '';
    var maxName = finiteNum(o.maxNameLength) ? o.maxNameLength : 120;
    var title;
    if (!name) {
      title = '未命名碎片';
      issues.push(issue(ISSUE.EMPTY_NAME, '热点 name 为空，回退「未命名碎片」', id));
    } else if (name.length > maxName) {
      title = name.slice(0, maxName);
      issues.push(issue(ISSUE.NAME_TRUNCATED, '热点 name 超过 ' + maxName + ' 字符，已截断', id));
    } else {
      title = name;
    }

    // description → content
    var content;
    if (typeof hotspot.description === 'string') {
      content = hotspot.description;
    } else {
      content = '';
      if (hotspot.description != null) {
        issues.push(issue(ISSUE.INVALID_DESCRIPTION, 'description 非字符串，按空内容处理', id));
      }
    }

    // position：0~1 → 百分比；异常夹取；缺失置 null
    var position = null;
    var p = hotspot.position;
    if (isObj(p) && finiteNum(p.x) && finiteNum(p.y)) {
      var cx = clamp01(p.x), cy = clamp01(p.y);
      if (cx !== p.x || cy !== p.y) {
        issues.push(issue(ISSUE.POSITION_CLAMPED, '坐标超出 0~1，已夹取到边界', id));
      }
      position = { x: cx * 100, y: cy * 100 };
    } else {
      issues.push(issue(ISSUE.POSITION_MISSING, '坐标缺失或非法，置空交由组件自动布点', id));
    }

    // type → kind：仅显式 kindMap 才映射，否则通用图形
    var defaultKind = validKind(o.defaultKind) ? o.defaultKind : 'keepsake';
    var type = typeof hotspot.type === 'string' ? hotspot.type.trim() : '';
    var kindMap = isObj(o.kindMap) ? o.kindMap : {};
    var kind = defaultKind;
    if (type && validKind(kindMap[type])) {
      kind = kindMap[type];
    } else if (type) {
      issues.push(issue(ISSUE.TYPE_FALLBACK, 'type「' + type + '」无显式 kindMap 映射，使用通用图形 ' + defaultKind, id));
    }

    // provenance：保留且不升级 confirmed
    var sourceType = typeof hotspot.sourceType === 'string' ? hotspot.sourceType : null;
    if (!sourceType) {
      issues.push(issue(ISSUE.SOURCE_TYPE_MISSING, '缺少 sourceType，来源标为未知（不编造）', id));
    } else if (KNOWN_SOURCE_TYPES.indexOf(sourceType) < 0) {
      issues.push(issue(ISSUE.SOURCE_TYPE_UNKNOWN, '未知 sourceType「' + sourceType + '」，原样保留', id));
    }

    var sourceIds;
    if (Array.isArray(hotspot.sourceIds)) {
      sourceIds = hotspot.sourceIds.filter(function (s) { return typeof s === 'string' && s !== ''; });
    } else {
      sourceIds = [];
      if (hotspot.sourceIds != null) {
        issues.push(issue(ISSUE.SOURCE_IDS_INVALID, 'sourceIds 非数组，按空数组处理', id));
      }
    }

    var confidence = null;
    if (finiteNum(hotspot.confidence)) {
      confidence = clamp01(hotspot.confidence);
      if (confidence !== hotspot.confidence) {
        issues.push(issue(ISSUE.CONFIDENCE_INVALID, 'confidence 超出 0~1，已夹取', id));
      }
    } else if (hotspot.confidence != null) {
      issues.push(issue(ISSUE.CONFIDENCE_INVALID, 'confidence 非法，置空', id));
    }

    var claimedConfirmed = hotspot.confirmed === true;
    var confirmed = sourceType === SOURCE_TYPES.USER_CONFIRMED && claimedConfirmed;
    if (claimedConfirmed && !confirmed) {
      issues.push(issue(ISSUE.CONFIRMED_DOWNGRADED, '非 user_confirmed 来源不得标记为用户确认，confirmed 已置 false', id));
    }

    // raw 保留原始业务字段，但来源字段经规范化（confirmed 不升级），供面板安全展示
    var raw = {};
    for (var k in hotspot) { if (Object.prototype.hasOwnProperty.call(hotspot, k)) raw[k] = hotspot[k]; }
    raw.sourceType = sourceType;
    raw.sourceIds = sourceIds;
    raw.confidence = confidence;
    raw.confirmed = confirmed;

    var fragment = {
      id: id,
      kind: kind,
      title: title,
      content: content,
      position: position,
      sourceType: sourceType,
      sourceIds: sourceIds,
      confidence: confidence,
      confirmed: confirmed,
      raw: raw
    };
    return { fragment: fragment, issues: issues };
  }

  // 从外部 visited 列表挑出仍存在于当前碎片的 id（孤儿 id 丢弃，不写入）
  function pickExploredIds(visitedHotspots, fragmentsOrIds) {
    var ids = {};
    (Array.isArray(fragmentsOrIds) ? fragmentsOrIds : []).forEach(function (f) {
      var id = typeof f === 'string' ? f : (f && f.id);
      if (id != null && String(id) !== '') ids[String(id)] = true;
    });
    var out = [], seen = {};
    (Array.isArray(visitedHotspots) ? visitedHotspots : []).forEach(function (v) {
      var id = v == null ? '' : String(v);
      if (id && ids[id] && !seen[id]) { seen[id] = true; out.push(id); }
    });
    return out;
  }

  // scene → { fragments, meta, issues, exploredIds }
  function adaptScene(scene, opts) {
    var o = opts || {};
    var issues = [];
    if (!isObj(scene)) {
      return { fragments: [], meta: null, issues: [issue(ISSUE.SCENE_INVALID, 'scene 不是对象，返回空碎片列表')], exploredIds: [] };
    }

    var meta = {
      id: scene.id != null ? String(scene.id) : null,
      memoryId: scene.memoryId != null ? String(scene.memoryId) : null,
      template: typeof scene.template === 'string' ? scene.template : null,
      title: typeof scene.title === 'string' ? scene.title : null,
      version: finiteNum(scene.version) ? scene.version : null,
      background: isObj(scene.background) ? scene.background : null
    };

    var hotspots;
    if (Array.isArray(scene.hotspots)) {
      hotspots = scene.hotspots;
    } else {
      hotspots = [];
      issues.push(issue(ISSUE.HOTSPOTS_INVALID, 'scene.hotspots 非数组，按空列表处理'));
    }

    var fragments = [];
    var seen = {};
    var fallbackTypes = {};
    hotspots.forEach(function (h) {
      var res = adaptHotspot(h, o);
      res.issues.forEach(function (iss) {
        // TYPE_FALLBACK 同类型只记一次，避免噪声
        if (iss.code === ISSUE.TYPE_FALLBACK) {
          var t = iss.message;
          if (fallbackTypes[t]) return;
          fallbackTypes[t] = true;
        }
        issues.push(iss);
      });
      if (!res.fragment) return;
      var id = res.fragment.id;
      if (seen[id]) {
        issues.push(issue(ISSUE.DUPLICATE_ID, '重复热点 id「' + id + '」，保留首条、忽略后续', id));
        return;
      }
      seen[id] = true;
      fragments.push(res.fragment);
    });

    var exploredIds = pickExploredIds(o.visitedHotspots, fragments);
    return { fragments: fragments, meta: meta, issues: issues, exploredIds: exploredIds };
  }

  Afterimage.SceneAdapter = {
    SOURCE_TYPES: SOURCE_TYPES,
    ISSUE: ISSUE,
    adaptHotspot: adaptHotspot,
    adaptScene: adaptScene,
    pickExploredIds: pickExploredIds
  };
  Afterimage.SOURCE_LABELS = SOURCE_LABELS;
})(typeof window !== 'undefined' ? window : globalThis);