/* 余像 Afterimage · MemorySpace 记忆房间场景组件（零依赖，A 任务）
 * 负责展示场景与碎片列表、详情面板与查看状态；不请求 AI、不包含故事数据。
 * 数据通过 options.fragments / setFragments() 传入，事件通过回调抛出。详见 README.md。
 *
 * 状态三轴（互不覆盖）：
 *   - 内部阅读三态 status: unseen / open / viewed（viewed 在关闭详情时标记，内存态）
 *   - 外部探索 explored: 由外部持久化结果经 setExplored()/exploredIds 驱动，A 不做乐观标记
 *   - 用户点击上报 onExploreRequest: 仅在「用户」触发且 exploreOn 匹配时发出，程序调用不发
 */
(function (global) {
  'use strict';

  var Afterimage = global.Afterimage = global.Afterimage || {};
  var MemoryFragment = Afterimage.MemoryFragment;

  var SCATTER_SLOTS = [
    { x: 17, y: 32 }, { x: 43, y: 22 }, { x: 71, y: 30 },
    { x: 28, y: 64 }, { x: 60, y: 66 }, { x: 84, y: 60 },
    { x: 12, y: 52 }, { x: 50, y: 46 }
  ];

  var THEMES = ['dusk', 'amber', 'moss'];
  var EXPLORE_ON = ['open', 'close', 'none'];

  var SOURCE_LABELS_FALLBACK = {
    user_confirmed: '用户确认',
    image_observed: '图片可见',
    ai_inferred: 'AI 推测',
    fictional: '想象内容'
  };

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function prefersReducedMotion() {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function idSet(ids) {
    var set = {};
    (Array.isArray(ids) ? ids : []).forEach(function (id) {
      if (id != null && String(id) !== '') set[String(id)] = true;
    });
    return set;
  }

  function sourceLabel(sourceType) {
    var labels = Afterimage.SOURCE_LABELS || SOURCE_LABELS_FALLBACK;
    return labels[sourceType] || sourceType || '未知';
  }

  function MemorySpace(container, options) {
    if (!container || !(container instanceof global.HTMLElement)) {
      throw new Error('MemorySpace: 需要一个有效的容器元素');
    }
    var opts = options || {};
    this.container = container;
    this.options = {
      theme: THEMES.indexOf(opts.theme) >= 0 ? opts.theme : 'dusk',
      layout: opts.layout === 'shelf' ? 'shelf' : 'scatter',
      dust: clamp(opts.dust == null ? 22 : opts.dust, 0, 80),
      reduceMotion: opts.reduceMotion == null ? prefersReducedMotion() : !!opts.reduceMotion,
      exploreOn: EXPLORE_ON.indexOf(opts.exploreOn) >= 0 ? opts.exploreOn : 'open',
      onFragmentOpen: typeof opts.onFragmentOpen === 'function' ? opts.onFragmentOpen : null,
      onFragmentClose: typeof opts.onFragmentClose === 'function' ? opts.onFragmentClose : null,
      onStateChange: typeof opts.onStateChange === 'function' ? opts.onStateChange : null,
      onExploreRequest: typeof opts.onExploreRequest === 'function' ? opts.onExploreRequest : null
    };

    this.fragments = [];
    this.statusById = {};
    this.exploredById = idSet(opts.exploredIds);
    this.openId = null;
    this._returnFocusEl = null;
    this._destroyed = false;

    this._build();
    this.setFragments(opts.fragments || [], { preserveStatus: false });
  }

  MemorySpace.prototype._build = function () {
    var root = document.createElement('div');
    root.className = 'ms ms--theme-' + this.options.theme +
      ' ms--layout-' + this.options.layout +
      (this.options.reduceMotion ? ' ms--still' : '');
    root.innerHTML =
      '<div class="ms-room" aria-hidden="true">' +
        '<div class="ms-wall"></div>' +
        '<div class="ms-window"><div class="ms-moon"></div><div class="ms-mullion"></div><div class="ms-stars"></div></div>' +
        '<div class="ms-beam"></div>' +
        '<div class="ms-lamp"></div>' +
        '<div class="ms-floor"></div>' +
        '<div class="ms-shelf ms-shelf--a"></div>' +
        '<div class="ms-shelf ms-shelf--b"></div>' +
        '<div class="ms-dust"></div>' +
        '<div class="ms-grain"></div>' +
        '<div class="ms-vignette"></div>' +
      '</div>' +
      '<div class="ms-stage"></div>' +
      '<p class="ms-empty" hidden>这个记忆空间还没有碎片。<span>传入 fragments 数据后，它们会在这里浮现。</span></p>' +
      '<section class="ms-panel" role="dialog" aria-modal="false" aria-labelledby="ms-panel-title" hidden>' +
        '<header class="ms-panel-head">' +
          '<span class="ms-panel-kind"></span>' +
          '<button type="button" class="ms-panel-close" aria-label="收起碎片详情">✕ 收起</button>' +
        '</header>' +
        '<h3 class="ms-panel-title" id="ms-panel-title"></h3>' +
        '<p class="ms-panel-source"></p>' +
        '<div class="ms-panel-body" tabindex="0"></div>' +
        '<footer class="ms-panel-foot"><span class="ms-panel-status"></span><span class="ms-panel-explored"></span><span class="ms-panel-hint">Esc 或「收起」关闭，关闭后标记为已查看</span></footer>' +
      '</section>' +
      '<p class="ms-live sr-only" aria-live="polite"></p>';

    this.root = root;
    this.stage = root.querySelector('.ms-stage');
    this.dustLayer = root.querySelector('.ms-dust');
    this.emptyEl = root.querySelector('.ms-empty');
    this.panel = root.querySelector('.ms-panel');
    this.panelKind = root.querySelector('.ms-panel-kind');
    this.panelTitle = root.querySelector('.ms-panel-title');
    this.panelSource = root.querySelector('.ms-panel-source');
    this.panelBody = root.querySelector('.ms-panel-body');
    this.panelStatus = root.querySelector('.ms-panel-status');
    this.panelExplored = root.querySelector('.ms-panel-explored');
    this.panelClose = root.querySelector('.ms-panel-close');
    this.liveEl = root.querySelector('.ms-live');

    this._onCloseClick = function () { this._close('user'); }.bind(this);
    this.panelClose.addEventListener('click', this._onCloseClick);

    this._onKeydown = function (event) {
      if (event.key === 'Escape' && this.openId != null) {
        event.stopPropagation();
        this._close('user');
      }
    }.bind(this);
    root.addEventListener('keydown', this._onKeydown);

    this.container.appendChild(root);
    this._renderDust();
  };

  MemorySpace.prototype._renderDust = function () {
    var layer = this.dustLayer;
    layer.textContent = '';
    var count = this.options.dust;
    for (var i = 0; i < count; i++) {
      var mote = document.createElement('span');
      mote.className = 'ms-mote';
      var size = 1.5 + Math.random() * 2.5;
      mote.style.width = size + 'px';
      mote.style.height = size + 'px';
      mote.style.left = (Math.random() * 100) + '%';
      mote.style.top = (30 + Math.random() * 65) + '%';
      mote.style.setProperty('--drift', (Math.random() * 60 - 30) + 'px');
      mote.style.animationDuration = (9 + Math.random() * 14) + 's';
      mote.style.animationDelay = (-Math.random() * 20) + 's';
      layer.appendChild(mote);
    }
  };

  MemorySpace.prototype._slotFor = function (index, total, data) {
    if (this.options.layout === 'shelf') {
      var rows = total <= 3 ? 1 : 2;
      var row = rows === 1 ? 0 : (index < Math.ceil(total / 2) ? 0 : 1);
      var rowCount = rows === 1 ? total : (row === 0 ? Math.ceil(total / 2) : total - Math.ceil(total / 2));
      var posInRow = rows === 1 ? index : index - (row === 0 ? 0 : Math.ceil(total / 2));
      var x = rowCount === 1 ? 50 : 14 + (72 * posInRow / (rowCount - 1));
      return { x: x, y: row === 0 ? 36 : 68 };
    }
    if (data.position) return data.position;
    return SCATTER_SLOTS[index % SCATTER_SLOTS.length];
  };

  MemorySpace.prototype.setFragments = function (list, opts) {
    var preserve = !opts || opts.preserveStatus !== false;
    var preserveExplored = !opts || opts.preserveExplored !== false;
    var items = Array.isArray(list) ? list : [];
    var self = this;

    // 记录更新前焦点位置，便于重建后安全归还
    var active = document.activeElement;
    var focusInPanel = this.panel.contains(active);
    var focusOnOldFragment = this.fragments.some(function (f) { return f.el === active; });

    // 1) 归一化 id 并去重：同一 id 保留首次出现，忽略后续重复（不静默）
    var seen = {};
    var kept = [];
    var droppedDuplicateIds = [];
    items.forEach(function (item, index) {
      var id = fragmentIdOf(item, index);
      if (seen[id]) { droppedDuplicateIds.push(id); return; }
      seen[id] = true;
      kept.push({ item: item, oi: index });
    });
    if (droppedDuplicateIds.length && global.console && typeof global.console.warn === 'function') {
      global.console.warn('[Afterimage.MemorySpace] setFragments: 忽略重复 id（保留首次出现）: ' + droppedDuplicateIds.join(', '));
    }

    // 2) 若详情打开：preserveOpen 且该 id 仍存在 → 保持打开（稍后刷新面板）；
    //    否则按一次正常关闭处理（标记 viewed + 触发 onFragmentClose）；程序路径，不上报探索
    var closedOpenId = null;
    var removedOpenId = null;
    var preservedOpenId = null;
    var wantPreserveOpen = !!(opts && opts.preserveOpen);
    if (this.openId != null) {
      if (wantPreserveOpen && seen[this.openId]) {
        preservedOpenId = this.openId;
      } else {
        closedOpenId = this.openId;
        var survives = !!seen[closedOpenId];
        if (!survives) removedOpenId = closedOpenId;
        var oldFragment = null;
        for (var i = 0; i < this.fragments.length; i++) {
          if (this.fragments[i].data.id === closedOpenId) { oldFragment = this.fragments[i]; break; }
        }
        this.statusById[closedOpenId] = 'viewed';
        this.panel.hidden = true;
        this.root.classList.remove('ms--panel-open');
        this.openId = null;
        this._returnFocusEl = null;
        this._announce('数据更新：已收起「' + (oldFragment ? oldFragment.data.title : closedOpenId) + '」');
        if (this.options.onFragmentClose && oldFragment) {
          this.options.onFragmentClose(oldFragment.data.raw, {
            id: closedOpenId, status: 'viewed', removed: !survives
          });
        }
      }
    }

    // 3) 计算需保留的 viewed / explored：仅当该 id 仍存在于新列表（seen）时延续
    var nextStatus = {};
    var nextExplored = {};
    if (preserve) {
      for (var key in this.statusById) {
        if (this.statusById[key] === 'viewed' && seen[key]) nextStatus[key] = 'viewed';
      }
    }
    if (preserveExplored) {
      for (var ekey in this.exploredById) {
        if (this.exploredById[ekey] && seen[ekey]) nextExplored[ekey] = true;
      }
    }

    // 4) 重建碎片（用原始序号生成回退 id，保证与去重/状态键一致）
    this.fragments.forEach(function (f) { f.destroy(); });
    this.fragments = [];
    this.statusById = nextStatus;
    this.exploredById = nextExplored;
    kept.forEach(function (entry, pos) {
      var id = fragmentIdOf(entry.item, entry.oi);
      var fragment = new MemoryFragment({
        data: entry.item,
        index: entry.oi,
        status: nextStatus[id] || 'unseen',
        explored: !!nextExplored[id],
        onActivate: function (f) { self._onFragmentActivate(f); }
      });
      self.statusById[fragment.data.id] = fragment.status;
      var slot = self._slotFor(pos, kept.length, fragment.data);
      fragment.setPosition(slot.x, slot.y);
      fragment.el.style.setProperty('--float-delay', (pos * 0.7) + 's');
      self.stage.appendChild(fragment.el);
      self.fragments.push(fragment);
    });
    this.emptyEl.hidden = this.fragments.length > 0;

    // 4b) 保留打开项：刷新面板内容到新数据，不触发 open/close/探索回调，不移动焦点
    if (preservedOpenId != null) {
      this._refreshOpenPanel(preservedOpenId);
    }

    // 5) 焦点安全归还（面板未重建且焦点在面板内时保持不动）
    if (preservedOpenId != null && focusInPanel) {
      // 面板 DOM 未销毁，焦点仍在面板内，无需归还
    } else if (focusInPanel || focusOnOldFragment) {
      var focusTargetId = closedOpenId;
      if (focusTargetId == null && focusOnOldFragment && active && active.dataset) {
        focusTargetId = active.dataset.fragmentId || null;
      }
      if (focusTargetId != null && seen[focusTargetId]) {
        for (var j = 0; j < this.fragments.length; j++) {
          if (this.fragments[j].data.id === focusTargetId) {
            this.fragments[j].el.focus({ preventScroll: true });
            break;
          }
        }
      } else if (active && typeof active.blur === 'function') {
        active.blur();
      }
    }

    this._emitState();
    return {
      kept: kept.length,
      droppedDuplicateIds: droppedDuplicateIds,
      closedOpenId: closedOpenId,
      removedOpenId: removedOpenId,
      preservedOpenId: preservedOpenId
    };
  };

  // 数据更新但打开项仍存在：把面板内容同步到新碎片，保持打开与阅读位置，不发任何用户回调
  MemorySpace.prototype._refreshOpenPanel = function (id) {
    var target = null;
    for (var i = 0; i < this.fragments.length; i++) {
      if (this.fragments[i].data.id === id) { target = this.fragments[i]; break; }
    }
    if (!target) return;
    this.openId = target.data.id;
    this._returnFocusEl = target.el;
    target.setStatus('open');
    this.statusById[target.data.id] = 'open';
    var kindLabels = Afterimage.FRAGMENT_KINDS || {};
    this.panelKind.textContent = (kindLabels[target.data.kind] || '纪念物') + ' · 记忆碎片';
    this.panelTitle.textContent = target.data.title;
    this.panelBody.textContent = '';
    if (target.data.content.trim()) {
      this.panelBody.textContent = target.data.content;
    } else {
      var fallback = document.createElement('em');
      fallback.className = 'ms-panel-fallback';
      fallback.textContent = '这枚碎片还没有留下文字。它只是安静地待在这里。';
      this.panelBody.appendChild(fallback);
    }
    this.panelStatus.textContent = '状态：阅读中';
    this._renderPanelMeta(target);
    this.panel.hidden = false;
    this.root.classList.add('ms--panel-open');
    this._announce('数据更新：详情保持打开「' + target.data.title + '」');
  };

  function fragmentIdOf(item, index) {
    return item && item.id != null && String(item.id) !== '' ? String(item.id) : 'fragment-' + index;
  }

  // 外部探索态入口：仅反映外部持久化结果；不触发任何用户回调、不上报探索、不改内部 viewed
  MemorySpace.prototype.setExplored = function (ids) {
    var set = idSet(ids);
    var self = this;
    var count = 0;
    this.exploredById = {};
    this.fragments.forEach(function (f) {
      var ex = !!set[f.data.id];
      f.setExplored(ex);
      if (ex) { self.exploredById[f.data.id] = true; count++; }
    });
    if (this.openId != null) {
      for (var i = 0; i < this.fragments.length; i++) {
        if (this.fragments[i].data.id === this.openId) { this._renderPanelMeta(this.fragments[i]); break; }
      }
    }
    this._announce('外部探索状态已更新：' + count + ' 枚已探索');
    this._emitState();
    return { exploredCount: count };
  };

  MemorySpace.prototype._onFragmentActivate = function (fragment) {
    if (this.openId === fragment.data.id) {
      this._close('user');
      return;
    }
    this._open(fragment.data.id, 'user');
  };

  // 编程式打开（不视为用户点击，不上报探索）
  MemorySpace.prototype.openFragment = function (id) {
    return this._open(id, 'program');
  };

  MemorySpace.prototype._open = function (id, source) {
    var target = null;
    for (var i = 0; i < this.fragments.length; i++) {
      if (this.fragments[i].data.id === String(id)) { target = this.fragments[i]; break; }
    }
    if (!target) return false;

    if (this.openId != null && this.openId !== target.data.id) {
      var previous = this._closePanelInternal(true);
      if (previous && this.options.onFragmentClose) {
        this.options.onFragmentClose(previous.data.raw, { id: previous.data.id, status: 'viewed' });
      }
    }

    var previousStatus = target.status;
    this.openId = target.data.id;
    this._returnFocusEl = target.el;
    target.setStatus('open');
    this.statusById[target.data.id] = 'open';

    var kindLabels = Afterimage.FRAGMENT_KINDS || {};
    this.panelKind.textContent = (kindLabels[target.data.kind] || '纪念物') + ' · 记忆碎片';
    this.panelTitle.textContent = target.data.title;
    this.panelBody.textContent = '';
    if (target.data.content.trim()) {
      this.panelBody.textContent = target.data.content;
    } else {
      var fallback = document.createElement('em');
      fallback.className = 'ms-panel-fallback';
      fallback.textContent = '这枚碎片还没有留下文字。它只是安静地待在这里。';
      this.panelBody.appendChild(fallback);
    }
    this.panelStatus.textContent = '状态：阅读中';
    this._renderPanelMeta(target);
    this.panel.hidden = false;
    this.root.classList.add('ms--panel-open');
    this.panelBody.scrollTop = 0;
    this.panelClose.focus();
    this._announce('已打开碎片：' + target.data.title);

    if (this.options.onFragmentOpen) {
      this.options.onFragmentOpen(target.data.raw, { id: target.data.id, previousStatus: previousStatus });
    }
    if (source === 'user' && this.options.exploreOn === 'open' && this.options.onExploreRequest) {
      this.options.onExploreRequest(target.data.id, { trigger: 'open' });
    }
    this._emitState();
    return true;
  };

  MemorySpace.prototype._renderPanelMeta = function (target) {
    var raw = target.data.raw || {};
    var sourceType = typeof raw.sourceType === 'string' ? raw.sourceType : null;
    this.panelSource.textContent = '来源：' + sourceLabel(sourceType) +
      (sourceType && sourceType !== 'user_confirmed' ? '（非用户确认）' : '');
    this.panelExplored.textContent = target.explored ? '外部：已探索' : '外部：未探索';
  };

  MemorySpace.prototype._closePanelInternal = function (markViewed) {
    if (this.openId == null) return null;
    var closing = null;
    for (var i = 0; i < this.fragments.length; i++) {
      if (this.fragments[i].data.id === this.openId) { closing = this.fragments[i]; break; }
    }
    this.panel.hidden = true;
    this.root.classList.remove('ms--panel-open');
    this.openId = null;
    if (closing) {
      if (markViewed) {
        closing.setStatus('viewed');
        this.statusById[closing.data.id] = 'viewed';
      } else {
        closing.setStatus(this.statusById[closing.data.id] === 'viewed' ? 'viewed' : 'unseen');
      }
    }
    return closing;
  };

  // 编程式收起（不视为用户点击，不上报探索）
  MemorySpace.prototype.closePanel = function () {
    this._close('program');
  };

  MemorySpace.prototype._close = function (source) {
    if (this.openId == null) return;
    var closing = this._closePanelInternal(true);
    if (closing) {
      this._announce('已收起「' + closing.data.title + '」，标记为已查看');
      if (this.options.onFragmentClose) {
        this.options.onFragmentClose(closing.data.raw, { id: closing.data.id, status: 'viewed' });
      }
      if (source === 'user' && this.options.exploreOn === 'close' && this.options.onExploreRequest) {
        this.options.onExploreRequest(closing.data.id, { trigger: 'close' });
      }
      if (this._returnFocusEl && this._returnFocusEl.isConnected) this._returnFocusEl.focus();
    }
    this._returnFocusEl = null;
    this._emitState();
  };

  MemorySpace.prototype.reset = function () {
    this._closePanelInternal(false);
    this.statusById = {};
    this.fragments.forEach(function (f) { f.setStatus('unseen'); });
    this._announce('所有碎片已重置为未查看');
    this._emitState();
  };

  MemorySpace.prototype.update = function (opts) {
    if (!opts) return;
    if (opts.theme && THEMES.indexOf(opts.theme) >= 0 && opts.theme !== this.options.theme) {
      this.root.classList.remove('ms--theme-' + this.options.theme);
      this.options.theme = opts.theme;
      this.root.classList.add('ms--theme-' + opts.theme);
    }
    if (opts.dust != null) {
      this.options.dust = clamp(opts.dust, 0, 80);
      this._renderDust();
    }
    if (opts.reduceMotion != null) {
      this.options.reduceMotion = !!opts.reduceMotion;
      this.root.classList.toggle('ms--still', this.options.reduceMotion);
    }
    if (opts.layout && (opts.layout === 'shelf' || opts.layout === 'scatter') && opts.layout !== this.options.layout) {
      this.root.classList.remove('ms--layout-' + this.options.layout);
      this.options.layout = opts.layout;
      this.root.classList.add('ms--layout-' + opts.layout);
      this._reposition();
    }
    if (opts.exploreOn && EXPLORE_ON.indexOf(opts.exploreOn) >= 0) {
      this.options.exploreOn = opts.exploreOn;
    }
    this._emitState();
  };

  MemorySpace.prototype._reposition = function () {
    var self = this;
    this.fragments.forEach(function (f, index) {
      var slot = self._slotFor(index, self.fragments.length, f.data);
      f.setPosition(slot.x, slot.y);
    });
  };

  MemorySpace.prototype.getState = function () {
    var self = this;
    return {
      theme: this.options.theme,
      layout: this.options.layout,
      reduceMotion: this.options.reduceMotion,
      exploreOn: this.options.exploreOn,
      openId: this.openId,
      exploredIds: Object.keys(this.exploredById),
      fragments: this.fragments.map(function (f) {
        return { id: f.data.id, kind: f.data.kind, title: f.data.title, status: f.status, explored: f.explored };
      })
    };
  };

  MemorySpace.prototype._announce = function (text) {
    this.liveEl.textContent = text;
  };

  MemorySpace.prototype._emitState = function () {
    if (this.options.onStateChange) this.options.onStateChange(this.getState());
  };

  MemorySpace.prototype.destroy = function () {
    if (this._destroyed) return;
    this._destroyed = true;
    this.fragments.forEach(function (f) { f.destroy(); });
    this.fragments = [];
    this.panelClose.removeEventListener('click', this._onCloseClick);
    this.root.removeEventListener('keydown', this._onKeydown);
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  };

  Afterimage.MemorySpace = MemorySpace;
})(typeof window !== 'undefined' ? window : globalThis);