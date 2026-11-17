/* 余像 Afterimage · MemoryFragment 记忆碎片组件（零依赖，A 任务）
 * 用法见 README.md。仅负责单个碎片的展示与交互，不请求任何接口。
 */
(function (global) {
  'use strict';

  var KIND_LABELS = {
    photo: '照片',
    note: '纸条',
    ticket: '车票',
    clock: '钟表',
    cup: '杯子',
    keepsake: '纪念物'
  };

  var STATUS_META = {
    unseen: { label: '未查看', icon: '●' },
    open: { label: '阅读中', icon: '◐' },
    viewed: { label: '已查看', icon: '✓' }
  };

  var VISUALS = {
    photo:
      '<svg viewBox="0 0 100 116" role="img" aria-hidden="true" focusable="false">' +
      '<rect x="6" y="4" width="88" height="106" rx="4" fill="#f3e9d2"/>' +
      '<rect x="13" y="11" width="74" height="74" rx="2" fill="#1b2a4a"/>' +
      '<circle cx="66" cy="30" r="10" fill="#ffd98a"/>' +
      '<circle cx="62" cy="27" r="9" fill="#1b2a4a" opacity="0.35"/>' +
      '<path d="M13 66 L34 44 L50 60 L64 48 L87 70 L87 85 L13 85 Z" fill="#31517e"/>' +
      '<path d="M13 74 L30 60 L46 74 L60 64 L87 82 L87 85 L13 85 Z" fill="#22375c"/>' +
      '<rect x="22" y="94" width="56" height="4" rx="2" fill="#c9b98f"/>' +
      '<rect x="32" y="102" width="36" height="3" rx="1.5" fill="#d8cba6"/>' +
      '</svg>',
    note:
      '<svg viewBox="0 0 100 110" role="img" aria-hidden="true" focusable="false">' +
      '<path d="M14 6 H74 L88 22 V102 H14 Z" fill="#f5ecd7"/>' +
      '<path d="M74 6 L88 22 H74 Z" fill="#d9cba4"/>' +
      '<rect x="24" y="34" width="52" height="4" rx="2" fill="#8d7f5f"/>' +
      '<rect x="24" y="48" width="44" height="4" rx="2" fill="#a89a76"/>' +
      '<rect x="24" y="62" width="50" height="4" rx="2" fill="#a89a76"/>' +
      '<rect x="24" y="76" width="30" height="4" rx="2" fill="#a89a76"/>' +
      '<path d="M24 92 q6 -8 12 0 t12 0" stroke="#b3543f" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '</svg>',
    ticket:
      '<svg viewBox="0 0 120 74" role="img" aria-hidden="true" focusable="false">' +
      '<path d="M6 8 H114 V30 a7 7 0 0 0 0 14 V66 H6 V44 a7 7 0 0 0 0 -14 Z" fill="#e8b04b"/>' +
      '<line x1="88" y1="10" x2="88" y2="64" stroke="#8a5a1d" stroke-width="2" stroke-dasharray="4 4"/>' +
      '<rect x="14" y="16" width="42" height="6" rx="3" fill="#5c3a10"/>' +
      '<rect x="14" y="30" width="60" height="4" rx="2" fill="#8a5a1d"/>' +
      '<rect x="14" y="40" width="50" height="4" rx="2" fill="#8a5a1d"/>' +
      '<text x="14" y="60" font-size="12" font-family="Georgia, serif" fill="#5c3a10" font-weight="bold">17:42</text>' +
      '<text x="94" y="42" font-size="11" font-family="Georgia, serif" fill="#5c3a10" transform="rotate(90 98 38)">单程</text>' +
      '</svg>',
    clock:
      '<svg viewBox="0 0 100 100" role="img" aria-hidden="true" focusable="false">' +
      '<circle cx="50" cy="50" r="46" fill="#2a3550"/>' +
      '<circle cx="50" cy="50" r="40" fill="#f3e9d2"/>' +
      '<circle cx="50" cy="50" r="40" fill="none" stroke="#c9b98f" stroke-width="2"/>' +
      '<g stroke="#5c5340" stroke-width="3" stroke-linecap="round">' +
      '<line x1="50" y1="14" x2="50" y2="20"/><line x1="50" y1="80" x2="50" y2="86"/>' +
      '<line x1="14" y1="50" x2="20" y2="50"/><line x1="80" y1="50" x2="86" y2="50"/>' +
      '</g>' +
      '<line x1="50" y1="50" x2="50" y2="28" stroke="#3a3226" stroke-width="4" stroke-linecap="round" transform="rotate(252 50 50)"/>' +
      '<line x1="50" y1="50" x2="50" y2="34" stroke="#b3543f" stroke-width="5" stroke-linecap="round" transform="rotate(171 50 50)"/>' +
      '<circle cx="50" cy="50" r="4" fill="#3a3226"/>' +
      '</svg>',
    cup:
      '<svg viewBox="0 0 100 104" role="img" aria-hidden="true" focusable="false">' +
      '<path class="mf-steam" d="M38 22 q-5 -8 0 -14 q5 -6 0 -12" stroke="#9fb4d8" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7"/>' +
      '<path class="mf-steam mf-steam--b" d="M56 24 q-5 -8 0 -14 q5 -6 0 -12" stroke="#9fb4d8" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.5"/>' +
      '<path d="M22 34 H70 L66 88 a8 8 0 0 1 -8 8 H34 a8 8 0 0 1 -8 -8 Z" fill="#d8e2f2"/>' +
      '<path d="M70 42 h8 a10 10 0 0 1 0 24 h-10" fill="none" stroke="#d8e2f2" stroke-width="7"/>' +
      '<path d="M24 44 H68 L67 56 H25 Z" fill="#6fd6ff" opacity="0.55"/>' +
      '<ellipse cx="46" cy="34" rx="24" ry="5" fill="#b9c8e0"/>' +
      '<ellipse cx="46" cy="34" rx="19" ry="3.6" fill="#4a3b2a"/>' +
      '</svg>',
    keepsake:
      '<svg viewBox="0 0 100 100" role="img" aria-hidden="true" focusable="false">' +
      '<circle cx="50" cy="50" r="30" fill="#31517e"/>' +
      '<circle cx="50" cy="50" r="30" fill="none" stroke="#6fd6ff" stroke-width="2" opacity="0.7"/>' +
      '<path d="M50 30 L55 45 L70 50 L55 55 L50 70 L45 55 L30 50 L45 45 Z" fill="#ffd98a"/>' +
      '<circle cx="50" cy="50" r="42" fill="none" stroke="#6fd6ff" stroke-width="1.5" stroke-dasharray="3 7" opacity="0.5"/>' +
      '</svg>'
  };

  function normalize(data, index) {
    var d = data && typeof data === 'object' ? data : {};
    var kind = typeof d.kind === 'string' && VISUALS[d.kind] ? d.kind : 'keepsake';
    var title = typeof d.title === 'string' && d.title.trim() ? d.title.trim() : '未命名碎片';
    var content = typeof d.content === 'string' ? d.content : '';
    return {
      id: d.id != null && String(d.id) !== '' ? String(d.id) : 'fragment-' + index,
      kind: kind,
      title: title,
      content: content,
      position: d.position && isFinite(d.position.x) && isFinite(d.position.y)
        ? { x: Number(d.position.x), y: Number(d.position.y) }
        : null,
      raw: d
    };
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function MemoryFragment(options) {
    var opts = options || {};
    this.data = normalize(opts.data, opts.index || 0);
    this.status = STATUS_META[opts.status] ? opts.status : 'unseen';
    // explored 为「外部已探索」独立轴，与内部三态(unseen/open/viewed)互不覆盖
    this.explored = !!opts.explored;
    this.onActivate = typeof opts.onActivate === 'function' ? opts.onActivate : function () {};

    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'mf mf--' + this.data.kind;
    el.dataset.fragmentId = this.data.id;

    var visual = document.createElement('span');
    visual.className = 'mf-visual';
    visual.setAttribute('aria-hidden', 'true');
    visual.innerHTML = VISUALS[this.data.kind];

    var label = document.createElement('span');
    label.className = 'mf-label';
    label.textContent = this.data.title;

    var chip = document.createElement('span');
    chip.className = 'mf-chip';
    var chipIcon = document.createElement('span');
    chipIcon.className = 'mf-chip-icon';
    chipIcon.setAttribute('aria-hidden', 'true');
    var chipText = document.createElement('span');
    chipText.className = 'mf-chip-text';
    chip.appendChild(chipIcon);
    chip.appendChild(chipText);

    el.appendChild(visual);
    el.appendChild(label);
    el.appendChild(chip);

    var exploredBadge = document.createElement('span');
    exploredBadge.className = 'mf-explored';
    exploredBadge.setAttribute('aria-hidden', 'true');
    exploredBadge.textContent = '✓ 已探索';
    exploredBadge.hidden = true;
    el.appendChild(exploredBadge);

    this.el = el;
    this._chipIcon = chipIcon;
    this._chipText = chipText;
    this._label = label;
    this._visual = visual;
    this._exploredBadge = exploredBadge;

    this._onClick = function (event) {
      event.preventDefault();
      this.onActivate(this);
    }.bind(this);
    el.addEventListener('click', this._onClick);

    this._render();
  }

  MemoryFragment.prototype._render = function () {
    var meta = STATUS_META[this.status];
    var kindLabel = KIND_LABELS[this.data.kind] || KIND_LABELS.keepsake;
    this.el.classList.remove('mf--unseen', 'mf--open', 'mf--viewed');
    this.el.classList.add('mf--' + this.status);
    this.el.classList.toggle('mf--explored', this.explored);
    this.el.setAttribute('aria-expanded', this.status === 'open' ? 'true' : 'false');
    this.el.setAttribute('aria-label',
      this.data.title + '，' + kindLabel + '，' + meta.label +
      (this.explored ? '，外部已探索' : '') + '。按回车打开详情');
    this._chipIcon.textContent = meta.icon;
    this._chipText.textContent = meta.label;
    this._exploredBadge.hidden = !this.explored;
    this._label.textContent = this.data.title;
    this._label.title = this.data.title;
  };

  MemoryFragment.prototype.setStatus = function (status) {
    if (!STATUS_META[status] || status === this.status) return;
    this.status = status;
    this._render();
  };

  // 外部探索态：仅由外部持久化结果驱动（setExplored），不做乐观标记
  MemoryFragment.prototype.setExplored = function (explored) {
    var next = !!explored;
    if (next === this.explored) return;
    this.explored = next;
    this._render();
  };

  MemoryFragment.prototype.setPosition = function (x, y) {
    this.el.style.left = clamp(x, 6, 94) + '%';
    this.el.style.top = clamp(y, 10, 86) + '%';
  };

  MemoryFragment.prototype.update = function (data) {
    this.data = normalize(data, 0);
    this.el.classList.remove('mf--photo', 'mf--note', 'mf--ticket', 'mf--clock', 'mf--cup', 'mf--keepsake');
    this.el.classList.add('mf--' + this.data.kind);
    this.el.dataset.fragmentId = this.data.id;
    this._visual.innerHTML = VISUALS[this.data.kind];
    this._render();
  };

  MemoryFragment.prototype.destroy = function () {
    this.el.removeEventListener('click', this._onClick);
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  };

  global.Afterimage = global.Afterimage || {};
  global.Afterimage.MemoryFragment = MemoryFragment;
  global.Afterimage.FRAGMENT_KINDS = KIND_LABELS;
  global.Afterimage.FRAGMENT_STATUSES = STATUS_META;
})(typeof window !== 'undefined' ? window : globalThis);