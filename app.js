/*
 * Flashcards desktop shell.
 *
 * This file has two halves:
 *   1. Pure helper functions (clamping, catalog sanitising, message validation).
 *      They are exported through `module.exports` so unit tests can exercise
 *      them without a DOM.
 *   2. The browser-only desktop: windows, Explorer catalog, taskbar and the
 *      single-slot Ruffle player window. The DOM half runs only when a
 *      `document` exists.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Constants
   * ------------------------------------------------------------------ */

  var WINDOW_MIN_WIDTH = 320;
  var WINDOW_MIN_HEIGHT = 220;
  var COMPACT_BREAKPOINT = 760;
  var PLAYER_START_TIMEOUT = 45000;
  var CASCADE_STEP = 26;

  var PLAYER_MESSAGE_TYPES = ['hello', 'status', 'state', 'error', 'request-close'];
  var PLAYER_STATES = ['loading', 'ready', 'playing', 'paused', 'error', 'unsupported'];

  /* ------------------------------------------------------------------ *
   * Pure helpers
   * ------------------------------------------------------------------ */

  function clamp(value, min, max) {
    var number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(Math.max(number, min), max);
  }

  function asTrimmedString(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
  }

  function positiveInt(value, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return fallback;
    return Math.round(number);
  }

  /**
   * Keep a window inside the desktop area. In compact (phone) layouts the
   * window always fills the whole area.
   */
  function clampWindowBounds(bounds, area, options) {
    var opts = options || {};
    var compact = Boolean(opts.compact);
    var areaWidth = Math.max(1, Math.floor(Number(area.width) || 1));
    var areaHeight = Math.max(1, Math.floor(Number(area.height) || 1));
    if (compact) {
      return { x: 0, y: 0, width: areaWidth, height: areaHeight, compact: true };
    }
    var minWidth = Math.min(opts.minWidth == null ? WINDOW_MIN_WIDTH : opts.minWidth, areaWidth);
    var minHeight = Math.min(opts.minHeight == null ? WINDOW_MIN_HEIGHT : opts.minHeight, areaHeight);
    var source = bounds || {};
    var width = clamp(source.width == null ? areaWidth : source.width, minWidth, areaWidth);
    var height = clamp(source.height == null ? areaHeight : source.height, minHeight, areaHeight);
    var x = clamp(source.x == null ? 0 : source.x, 0, Math.max(0, areaWidth - width));
    var y = clamp(source.y == null ? 0 : source.y, 0, Math.max(0, areaHeight - height));
    return { x: x, y: y, width: width, height: height, compact: false };
  }

  function formatClock(date) {
    var value = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(value.getTime())) return '--:--';
    var hours = value.getHours();
    var hour12 = hours % 12 === 0 ? 12 : hours % 12;
    var minutes = String(value.getMinutes()).padStart(2, '0');
    return hour12 + ':' + minutes + ' ' + (hours < 12 ? 'AM' : 'PM');
  }

  function formatFullDate(date) {
    var value = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(value.getTime())) return '';
    try {
      return value.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      }) + ' ' + formatClock(value);
    } catch (error) {
      return value.toString();
    }
  }

  /**
   * Map a catalog status string onto one short, explicit category:
   *   verified/playable -> Playable
   *   partial/limited   -> Partial
   *   unverified/not runtime-verified -> Unverified
   *   unsupported/broken -> Unsupported
   * Anything unknown keeps its full raw text for the details pane.
   * "unverified" must be tested before "verified" so it can never be counted
   * as a verified/playable card.
   */
  function normalizeStatus(raw) {
    var value = asTrimmedString(raw);
    var lower = value.toLowerCase();
    if (!lower) {
      return { key: 'unknown', label: 'Unknown', tone: 'unknown', raw: value };
    }
    if (/(unverified|not\s+runtime[\s-]*verified|not\s+verified|runtime[\s-]*verification\s+pending|nicht\s+verifiziert)/.test(lower)) {
      return { key: 'unverified', label: 'Unverified', tone: 'unverified', raw: value };
    }
    // A declared partial result often explains a missing companion afterwards.
    // That explanation must not turn the entire card into Unsupported.
    if (/^partial\b/.test(lower)) {
      return { key: 'partial', label: 'Partial', tone: 'partial', raw: value };
    }
    if (/(unsupported|broken|does\s+not\s+(run|work)|fails|fail|error|missing|removed|unavailable|incompatible)/.test(lower)) {
      return { key: 'unsupported', label: 'Unsupported', tone: 'unsupported', raw: value };
    }
    if (/(partial|partially|partly|limited|incomplete|glitches|with\s+caveats)/.test(lower)) {
      return { key: 'partial', label: 'Partial', tone: 'partial', raw: value };
    }
    if (/(verified|playable|plays|play|works|working|ready|fine|ok)/.test(lower)) {
      return { key: 'playable', label: 'Playable', tone: 'playable', raw: value };
    }
    return { key: 'unknown', label: 'Unknown', tone: 'unknown', raw: value };
  }

  function cardSearchText(card) {
    var parts = [
      card.id, card.title, card.year, card.description, card.instructions, card.notes,
      card.status ? card.status.label : '',
      card.status ? card.status.raw : '',
    ];
    (card.controls || []).forEach(function (entry) {
      if (entry && entry.label) parts.push(entry.label);
      if (entry && entry.code) parts.push(entry.code);
    });
    if (card.kind === 'artifact') parts.push('artifact download preservation');
    if (card.kind === 'embed') parts.push('browser game embedded emulator');
    (card.downloads || []).forEach(function (entry) {
      if (entry && entry.label) parts.push(entry.label);
      if (entry && entry.meta) parts.push(entry.meta);
    });
    (card.gallery || []).forEach(function (entry) {
      if (entry && entry.caption) parts.push(entry.caption);
    });
    return parts.join(' ').toLowerCase();
  }

  function matchesSearch(card, query) {
    var terms = asTrimmedString(query).toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    if (!card) return false;
    var haystack = cardSearchText(card);
    return terms.every(function (term) { return haystack.indexOf(term) !== -1; });
  }

  function filterCards(cards, options) {
    var opts = options || {};
    var query = opts.query || '';
    var filter = opts.filter || 'all';
    var list = Array.isArray(cards) ? cards : [];
    return list.filter(function (card) {
      if (!card) return false;
      if (filter !== 'all' && card.status.key !== filter) return false;
      return matchesSearch(card, query);
    });
  }

  function keyDefinition(code) {
    if (!code) return null;
    var known = {
      ArrowLeft: { code: 'ArrowLeft', keyCode: 37, key: 'ArrowLeft', label: '\u2190 Left' },
      ArrowUp: { code: 'ArrowUp', keyCode: 38, key: 'ArrowUp', label: '\u2191 Up' },
      ArrowRight: { code: 'ArrowRight', keyCode: 39, key: 'ArrowRight', label: 'Right \u2192' },
      ArrowDown: { code: 'ArrowDown', keyCode: 40, key: 'ArrowDown', label: '\u2193 Down' },
      Space: { code: 'Space', keyCode: 32, key: ' ', label: 'Space' },
      Enter: { code: 'Enter', keyCode: 13, key: 'Enter', label: 'Enter' },
      ShiftLeft: { code: 'ShiftLeft', keyCode: 16, key: 'Shift', label: 'Shift' },
      ControlLeft: { code: 'ControlLeft', keyCode: 17, key: 'Control', label: 'Ctrl' },
      AltLeft: { code: 'AltLeft', keyCode: 18, key: 'Alt', label: 'Alt' },
      Tab: { code: 'Tab', keyCode: 9, key: 'Tab', label: 'Tab' },
      Escape: { code: 'Escape', keyCode: 27, key: 'Escape', label: 'Esc' },
      Backspace: { code: 'Backspace', keyCode: 8, key: 'Backspace', label: 'Backspace' },
    };
    if (known[code]) return known[code];
    var letter = /^Key([A-Z])$/.exec(code);
    if (letter) {
      var upper = letter[1];
      return { code: code, keyCode: upper.charCodeAt(0), key: upper.toLowerCase(), label: upper };
    }
    var digit = /^Digit([0-9])$/.exec(code);
    if (digit) {
      return { code: code, keyCode: digit[1].charCodeAt(0), key: digit[1], label: digit[1] };
    }
    return null;
  }

  var KEY_ALIASES = {
    arrowleft: 'ArrowLeft', leftarrow: 'ArrowLeft', left: 'ArrowLeft', '\u2190': 'ArrowLeft',
    arrowright: 'ArrowRight', rightarrow: 'ArrowRight', right: 'ArrowRight', '\u2192': 'ArrowRight',
    arrowup: 'ArrowUp', uparrow: 'ArrowUp', up: 'ArrowUp', '\u2191': 'ArrowUp',
    arrowdown: 'ArrowDown', downarrow: 'ArrowDown', down: 'ArrowDown', '\u2193': 'ArrowDown',
    space: 'Space', spacebar: 'Space', ' ': 'Space',
    enter: 'Enter', return: 'Enter',
    shift: 'ShiftLeft', ctrl: 'ControlLeft', control: 'ControlLeft', alt: 'AltLeft',
    tab: 'Tab', esc: 'Escape', escape: 'Escape', backspace: 'Backspace',
  };

  function mapControlTerm(term) {
    var text = asTrimmedString(term).toLowerCase();
    if (!text) return [];
    if (KEY_ALIASES[text]) {
      var definition = keyDefinition(KEY_ALIASES[text]);
      return definition ? [definition] : [];
    }
    if (text.indexOf('arrow') !== -1) {
      return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].map(keyDefinition).filter(Boolean);
    }
    var letter = /^(?:key\s*)?([a-z])$/.exec(text);
    if (letter) {
      var letterDefinition = keyDefinition('Key' + letter[1].toUpperCase());
      return letterDefinition ? [letterDefinition] : [];
    }
    var digit = /^(?:digit\s*|number\s*)?([0-9])$/.exec(text);
    if (digit) {
      var digitDefinition = keyDefinition('Digit' + digit[1]);
      return digitDefinition ? [digitDefinition] : [];
    }
    return [];
  }

  /**
   * Turn the catalog `controls` value (array of strings and/or objects) into
   * normalised entries. Entries with a `code` are keyboard keys that can be
   * mapped onto touch buttons; mouse-only entries are preserved for display.
   */
  function expandControls(raw) {
    var entries = [];
    function push(entry) {
      if (!entry) return;
      if (entry.code) {
        var duplicate = entries.some(function (existing) { return existing.code === entry.code; });
        if (duplicate) return;
      }
      entries.push(entry);
    }
    function visit(item) {
      if (item == null) return;
      if (Array.isArray(item)) {
        item.forEach(visit);
        return;
      }
      if (typeof item === 'object') {
        var candidate = item.key || item.code || item.button || item.control || item.name || '';
        var label = asTrimmedString(item.label || item.name || candidate);
        var definitions = mapControlTerm(candidate);
        if (definitions.length) {
          definitions.forEach(function (definition) {
            push({
              code: definition.code,
              keyCode: definition.keyCode,
              key: definition.key,
              label: label || definition.label,
              mouse: false,
              unknown: false,
            });
          });
        } else {
          push({ code: null, keyCode: 0, key: '', label: label || 'Control', mouse: false, unknown: true });
        }
        return;
      }
      var text = asTrimmedString(item);
      if (!text) return;
      var mapped = mapControlTerm(text);
      if (mapped.length) {
        mapped.forEach(function (definition) {
          push({
            code: definition.code,
            keyCode: definition.keyCode,
            key: definition.key,
            label: definition.label,
            mouse: false,
            unknown: false,
          });
        });
        return;
      }
      if (/mouse|click|pointer|drag|tap|touch/i.test(text)) {
        push({ code: null, keyCode: 0, key: '', label: text, mouse: true, unknown: false });
        return;
      }
      push({ code: null, keyCode: 0, key: '', label: text, mouse: false, unknown: true });
    }
    visit(raw);
    return entries;
  }

  function keyboardControls(entries) {
    return (entries || []).filter(function (entry) { return Boolean(entry && entry.code); });
  }

  function keyEventInit(entryOrCode) {
    var entry = typeof entryOrCode === 'string' ? keyDefinition(entryOrCode) : entryOrCode;
    if (!entry || !entry.code) return null;
    return {
      key: entry.key || entry.code,
      code: entry.code,
      keyCode: entry.keyCode,
      which: entry.keyCode,
      bubbles: true,
      cancelable: true,
    };
  }

  function sanitizeDownloadList(raw) {
    if (!Array.isArray(raw)) return [];
    var list = [];
    raw.slice(0, 40).forEach(function (item) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      var label = asTrimmedString(item.label || item.title);
      var url = asTrimmedString(item.url);
      if (!label || !url) return;
      list.push({
        label: label,
        url: url,
        meta: asTrimmedString(item.meta || item.note),
      });
    });
    return list;
  }

  function sanitizeGallery(raw) {
    if (!Array.isArray(raw)) return [];
    var list = [];
    raw.slice(0, 80).forEach(function (item) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      var url = asTrimmedString(item.url || item.src);
      if (!url) return;
      list.push({
        url: url,
        caption: asTrimmedString(item.caption || item.title),
      });
    });
    return list;
  }

  function sanitizeCard(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    var id = asTrimmedString(raw.id);
    if (!id) return null;
    var controls = expandControls(raw.controls);
    var status = normalizeStatus(raw.status);
    var swf = asTrimmedString(raw.swf);
    var rawKind = asTrimmedString(raw.kind);
    var kind = rawKind === 'artifact' || rawKind === 'embed' ? rawKind : 'flash';
    return {
      id: id,
      title: asTrimmedString(raw.title) || id,
      kind: kind,
      swf: swf,
      url: kind === 'embed' ? asTrimmedString(raw.url || raw.embed) : '',
      preview: asTrimmedString(raw.preview),
      downloads: sanitizeDownloadList(raw.downloads),
      gallery: sanitizeGallery(raw.gallery),
      galleryTitle: asTrimmedString(raw.galleryTitle),
      galleryHint: asTrimmedString(raw.galleryHint),
      thumbnail: asTrimmedString(raw.thumbnail),
      base: asTrimmedString(raw.base),
      width: positiveInt(raw.width, 640),
      height: positiveInt(raw.height, 480),
      year: asTrimmedString(raw.year),
      description: asTrimmedString(raw.description),
      instructions: asTrimmedString(raw.instructions),
      controls: controls,
      keyboardControls: keyboardControls(controls),
      status: status,
      notes: asTrimmedString(raw.notes),
      fileMissing: kind === 'flash' && !swf,
    };
  }

  function sanitizeCatalog(raw) {
    var list = raw && typeof raw === 'object' && Array.isArray(raw.cards) ? raw.cards : [];
    var cards = [];
    var seen = Object.create(null);
    list.forEach(function (item) {
      var card = sanitizeCard(item);
      if (!card || seen[card.id]) return;
      seen[card.id] = true;
      cards.push(card);
    });
    return { cards: cards };
  }

  function resolveUrl(value, base, options) {
    var opts = options || {};
    var text = asTrimmedString(value);
    if (!text) return '';
    var origin = base || (typeof location !== 'undefined' ? location.href : 'https://flashcards.invalid/');
    try {
      var url = new URL(text, origin);
      var allowed = ['http:', 'https:'];
      if (opts.allowFile !== false) allowed.push('file:');
      if (opts.allowData) allowed.push('data:');
      if (allowed.indexOf(url.protocol) === -1) return '';
      return url.href;
    } catch (error) {
      return '';
    }
  }

  /**
   * Resolve an embedded browser-game URL. Unlike ordinary assets, an embed
   * must be an absolute or page-relative http(s) address: file:// and data:
   * pages cannot be framed or cross-origin isolated.
   */
  function resolveEmbedUrl(value, base) {
    var url = resolveUrl(value, base, { allowFile: false });
    if (!url) return '';
    try {
      var protocol = new URL(url).protocol;
      if (protocol !== 'http:' && protocol !== 'https:') return '';
      return url;
    } catch (error) {
      return '';
    }
  }

  /**
   * Resolve a card asset (thumbnail etc.) against the page base, honouring an
   * optional per-card `base` directory override when a catalog provides one.
   */
  function cardAssetUrl(card, value, base, options) {
    var fallback = base || (typeof document !== 'undefined' ? document.baseURI : undefined);
    var origin = fallback;
    if (card && card.base) {
      var override = resolveUrl(card.base, fallback);
      if (override) origin = override;
    }
    return resolveUrl(value, origin, options);
  }

  /**
   * Size and centre the initial Explorer window on large desktops while
   * keeping the desktop icon column clear and staying responsive on smaller
   * screens. The caller still clamps the result to the real desktop area.
   */
  function explorerBounds(area) {
    var margin = 24;
    var iconGuard = 120;
    var width = Math.min(1100, Math.max(320, area.width - margin * 2));
    var height = Math.min(720, Math.max(220, area.height - margin * 2));
    var x = Math.round((area.width - width) / 2);
    var y = Math.round((area.height - height) / 2);
    if (x < iconGuard && area.width - width - iconGuard - margin > 0) {
      x = iconGuard;
      width = Math.min(width, area.width - x - margin);
    }
    if (y < margin) y = margin;
    return { x: x, y: y, width: width, height: height };
  }

  function validatePlayerMessage(data, context) {
    var expected = context || {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    if (data.channel !== 'flashcards-player') return null;
    if (typeof data.type !== 'string' || PLAYER_MESSAGE_TYPES.indexOf(data.type) === -1) return null;
    if (expected.instance != null && data.instance != null && String(data.instance) !== String(expected.instance)) {
      return null;
    }
    if (expected.cardId && data.cardId !== expected.cardId) return null;
    var message = { type: data.type };
    if (data.instance != null) message.instance = String(data.instance);
    if (typeof data.cardId === 'string') message.cardId = data.cardId;
    if (data.type === 'status') {
      if (typeof data.state !== 'string' || PLAYER_STATES.indexOf(data.state) === -1) return null;
      message.state = data.state;
      message.detail = asTrimmedString(data.detail).slice(0, 300);
    } else if (data.type === 'error') {
      message.state = PLAYER_STATES.indexOf(data.state) === -1 ? 'error' : data.state;
      message.message = asTrimmedString(data.message).slice(0, 500) || 'The card could not start.';
    } else if (data.type === 'state') {
      message.playing = Boolean(data.playing);
      message.muted = Boolean(data.muted);
      message.volume = clamp(Number(data.volume), 0, 1);
    }
    return message;
  }

  /* ------------------------------------------------------------------ *
   * Browser-only desktop
   * ------------------------------------------------------------------ */

  function initDesktop() {
    var state = {
      windows: new Map(),
      order: [],
      zCounter: 20,
      windowSeq: 0,
      activeId: null,
      cascade: 0,
      player: {
        windowId: null,
        frame: null,
        card: null,
        instance: 0,
        status: 'idle',
        lastStatus: 'idle',
        timeout: 0,
        playing: false,
        muted: false,
        volume: 0.8,
        resumeAfterRestore: false,
        statusEl: null,
        cardEl: null,
        dotEl: null,
        holderEl: null,
      },
      explorer: {
        windowId: null,
        selectedId: null,
        query: '',
        filter: 'all',
        history: [],
        historyIndex: -1,
        deepLinkHandled: false,
        els: null,
      },
      catalog: { status: 'loading', cards: [], error: '' },
    };

    var els = {
      desktop: document.getElementById('desktop'),
      windowLayer: document.getElementById('window-layer'),
      taskButtons: document.getElementById('task-buttons'),
      startButton: document.getElementById('start-button'),
      startMenu: document.getElementById('start-menu'),
      clock: document.getElementById('clock'),
      announcer: document.getElementById('announcer'),
      shutdown: document.getElementById('shutdown'),
    };

    var api = {
      clamp: clamp,
      clampWindowBounds: clampWindowBounds,
      formatClock: formatClock,
      formatFullDate: formatFullDate,
      normalizeStatus: normalizeStatus,
      matchesSearch: matchesSearch,
      filterCards: filterCards,
      expandControls: expandControls,
      keyboardControls: keyboardControls,
      keyEventInit: keyEventInit,
      keyDefinition: keyDefinition,
      sanitizeCard: sanitizeCard,
      sanitizeCatalog: sanitizeCatalog,
      sanitizeDownloadList: sanitizeDownloadList,
      sanitizeGallery: sanitizeGallery,
      resolveUrl: resolveUrl,
      resolveEmbedUrl: resolveEmbedUrl,
      validatePlayerMessage: validatePlayerMessage,
      cardAssetUrl: cardAssetUrl,
      explorerBounds: explorerBounds,
      WINDOW_MIN_WIDTH: WINDOW_MIN_WIDTH,
      WINDOW_MIN_HEIGHT: WINDOW_MIN_HEIGHT,
      COMPACT_BREAKPOINT: COMPACT_BREAKPOINT,
    };

    /* ---------------- generic helpers ---------------- */

    function announce(text) {
      if (!text) return;
      els.announcer.textContent = '';
      window.setTimeout(function () { els.announcer.textContent = text; }, 30);
    }

    function desktopArea() {
      var rect = els.desktop.getBoundingClientRect();
      return {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      };
    }

    function isCompactLayout() {
      return window.innerWidth <= COMPACT_BREAKPOINT;
    }

    function element(tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    }

    function findCard(id) {
      if (!id) return null;
      return state.catalog.cards.find(function (card) { return card.id === id; }) || null;
    }

    /* ---------------- clock ---------------- */

    function updateClock() {
      var now = new Date();
      els.clock.textContent = formatClock(now);
      var full = formatFullDate(now);
      els.clock.title = full;
      els.clock.setAttribute('aria-label', 'Clock: ' + full);
    }

    /* ---------------- start menu ---------------- */

    function setStartMenu(open) {
      els.startMenu.hidden = !open;
      els.startButton.setAttribute('aria-expanded', String(open));
      if (open) {
        var first = els.startMenu.querySelector('[role="menuitem"]');
        if (first) first.focus();
      }
    }

    function startMenuIsOpen() {
      return !els.startMenu.hidden;
    }

    els.startButton.addEventListener('click', function () {
      setStartMenu(!startMenuIsOpen());
    });

    document.addEventListener('pointerdown', function (event) {
      if (!startMenuIsOpen()) return;
      if (els.startMenu.contains(event.target)) return;
      if (els.startButton.contains(event.target)) return;
      setStartMenu(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && startMenuIsOpen()) {
        setStartMenu(false);
        els.startButton.focus();
      }
    });

    /* ---------------- window manager ---------------- */

    function applyBounds(record) {
      var bounds = record.bounds;
      record.el.style.left = bounds.x + 'px';
      record.el.style.top = bounds.y + 'px';
      record.el.style.width = bounds.width + 'px';
      record.el.style.height = bounds.height + 'px';
    }

    function setTaskButtonState(record) {
      if (!record.taskButton) return;
      var active = state.activeId === record.id && !record.minimized;
      record.taskButton.setAttribute('aria-pressed', String(active));
    }

    function focusWindow(id) {
      var record = state.windows.get(id);
      if (!record) return;
      if (record.minimized) {
        restoreWindow(record);
        return;
      }
      state.activeId = id;
      state.zCounter += 1;
      record.el.style.zIndex = String(state.zCounter);
      state.windows.forEach(function (other) {
        other.el.classList.toggle('window--active', other.id === id);
        setTaskButtonState(other);
      });
    }

    function createWindow(options) {
      var id = options.id || 'window-' + (++state.windowSeq);
      var area = desktopArea();
      var compact = isCompactLayout();
      state.cascade = (state.cascade + 1) % 6;
      var offset = state.cascade * CASCADE_STEP;
      var requested = options.bounds || {};
      var bounds = clampWindowBounds({
        width: requested.width == null ? 780 : requested.width,
        height: requested.height == null ? 520 : requested.height,
        x: requested.x == null ? 26 + offset : requested.x,
        y: requested.y == null ? 18 + offset : requested.y,
      }, area, { compact: compact });

      var el = element('section', 'window');
      el.dataset.windowId = id;
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'false');
      el.setAttribute('aria-label', options.title);
      el.tabIndex = -1;

      var titlebar = element('header', 'window-titlebar');
      var icon = element('span', 'window-title-icon ' + (options.icon || 'icon-catalog'));
      icon.setAttribute('aria-hidden', 'true');
      var title = element('h2', 'window-title', options.title);
      title.id = id + '-title';
      var buttons = element('div', 'window-buttons');

      function makeWindowButton(action, label, glyphClass) {
        var button = element('button', 'window-button ' + action);
        button.type = 'button';
        button.setAttribute('aria-label', label);
        button.dataset.windowAction = action;
        var glyph = element('span', 'glyph ' + glyphClass);
        glyph.setAttribute('aria-hidden', 'true');
        button.append(glyph);
        return button;
      }

      var minimize = makeWindowButton('minimize', 'Minimize ' + options.title, 'glyph-minimize');
      var maximize = makeWindowButton('maximize', 'Maximize ' + options.title, 'glyph-maximize');
      var close = makeWindowButton('close', 'Close ' + options.title, 'glyph-close');
      if (options.minimizable === false) minimize.disabled = true;
      if (options.maximizable === false || compact) maximize.disabled = true;
      buttons.append(minimize, maximize, close);
      titlebar.append(icon, title, buttons);

      var body = element('div', 'window-body');
      el.append(titlebar, body);

      var record = {
        id: id,
        el: el,
        body: body,
        titleEl: title,
        options: options || {},
        bounds: bounds,
        restoreBounds: Object.assign({}, bounds),
        minimized: false,
        maximized: compact,
        compact: compact,
        taskButton: null,
        onClose: options.onClose || null,
        onMinimize: options.onMinimize || null,
        onRestore: options.onRestore || null,
      };

      if (compact) {
        el.classList.add('window--compact', 'window--maximized');
      }

      if (options.content) body.append(options.content);

      ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'].forEach(function (dir) {
        var handle = element('div', 'resize-handle');
        handle.dataset.dir = dir;
        handle.addEventListener('pointerdown', function (event) {
          beginResize(record, dir, event);
        });
        el.append(handle);
      });

      titlebar.addEventListener('pointerdown', function (event) {
        if (event.target.closest('.window-button')) return;
        beginDrag(record, event);
      });
      titlebar.addEventListener('dblclick', function (event) {
        if (event.target.closest('.window-button')) return;
        toggleMaximize(record);
      });

      el.addEventListener('pointerdown', function () {
        focusWindow(id);
      });

      el.querySelectorAll('[data-window-action]').forEach(function (button) {
        button.addEventListener('click', function (event) {
          event.stopPropagation();
          var action = button.dataset.windowAction;
          if (action === 'minimize') minimizeWindow(record);
          else if (action === 'maximize') toggleMaximize(record);
          else if (action === 'close') closeWindow(record);
        });
      });

      if (options.resizable === false) {
        el.querySelectorAll('.resize-handle').forEach(function (handle) { handle.remove(); });
      }

      state.windows.set(id, record);
      state.order.push(id);
      addTaskButton(record);
      els.windowLayer.append(el);
      applyBounds(record);
      focusWindow(id);
      announce(options.title + ' opened.');
      return record;
    }

    function addTaskButton(record) {
      var button = element('button', 'task-button');
      button.type = 'button';
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', record.options.title);
      var icon = element('span', 'window-title-icon ' + (record.options.icon || 'icon-catalog'));
      icon.setAttribute('aria-hidden', 'true');
      var label = element('span', 'task-button-label', record.options.title);
      button.append(icon, label);
      button.addEventListener('click', function () {
        if (record.minimized) {
          restoreWindow(record);
        } else if (state.activeId === record.id) {
          minimizeWindow(record);
        } else {
          focusWindow(record.id);
        }
      });
      record.taskButton = button;
      els.taskButtons.append(button);
    }

    function updateTaskButtonTitle(record) {
      if (!record.taskButton) return;
      record.taskButton.setAttribute('aria-label', record.options.title);
      var label = record.taskButton.querySelector('.task-button-label');
      if (label) label.textContent = record.options.title;
    }

    function setWindowTitle(record, text) {
      record.options.title = text;
      record.titleEl.textContent = text;
      record.el.setAttribute('aria-label', text);
      var min = record.el.querySelector('.window-button.minimize');
      var max = record.el.querySelector('.window-button.maximize');
      var close = record.el.querySelector('.window-button.close');
      if (min) min.setAttribute('aria-label', 'Minimize ' + text);
      if (max) max.setAttribute('aria-label', (record.maximized ? 'Restore ' : 'Maximize ') + text);
      if (close) close.setAttribute('aria-label', 'Close ' + text);
      updateTaskButtonTitle(record);
    }

    function beginDrag(record, event) {
      if (record.compact || record.maximized) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      var startX = event.clientX;
      var startY = event.clientY;
      var startBounds = Object.assign({}, record.bounds);
      var titlebar = event.currentTarget;
      if (titlebar.setPointerCapture) titlebar.setPointerCapture(event.pointerId);

      function move(moveEvent) {
        var area = desktopArea();
        record.bounds = clampWindowBounds({
          x: startBounds.x + (moveEvent.clientX - startX),
          y: startBounds.y + (moveEvent.clientY - startY),
          width: startBounds.width,
          height: startBounds.height,
        }, area);
        applyBounds(record);
      }
      function finish() {
        titlebar.removeEventListener('pointermove', move);
        titlebar.removeEventListener('pointerup', finish);
        titlebar.removeEventListener('pointercancel', finish);
      }
      titlebar.addEventListener('pointermove', move);
      titlebar.addEventListener('pointerup', finish);
      titlebar.addEventListener('pointercancel', finish);
    }

    function beginResize(record, dir, event) {
      if (record.compact || record.maximized || record.options.resizable === false) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      var handle = event.currentTarget;
      var startX = event.clientX;
      var startY = event.clientY;
      var startBounds = Object.assign({}, record.bounds);
      if (handle.setPointerCapture) handle.setPointerCapture(event.pointerId);

      function move(moveEvent) {
        var area = desktopArea();
        var minWidth = Math.min(WINDOW_MIN_WIDTH, area.width);
        var minHeight = Math.min(WINDOW_MIN_HEIGHT, area.height);
        var dx = moveEvent.clientX - startX;
        var dy = moveEvent.clientY - startY;
        var next = {
          x: startBounds.x,
          y: startBounds.y,
          width: startBounds.width,
          height: startBounds.height,
        };
        if (dir.indexOf('e') !== -1) next.width = startBounds.width + dx;
        if (dir.indexOf('s') !== -1) next.height = startBounds.height + dy;
        if (dir.indexOf('w') !== -1) {
          next.width = startBounds.width - dx;
          next.x = startBounds.x + dx;
          if (next.width < minWidth) {
            next.width = minWidth;
            next.x = startBounds.x + startBounds.width - minWidth;
          }
        }
        if (dir.indexOf('n') !== -1) {
          next.height = startBounds.height - dy;
          next.y = startBounds.y + dy;
          if (next.height < minHeight) {
            next.height = minHeight;
            next.y = startBounds.y + startBounds.height - minHeight;
          }
        }
        record.bounds = clampWindowBounds(next, area);
        applyBounds(record);
      }
      function finish() {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', finish);
        handle.removeEventListener('pointercancel', finish);
      }
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', finish);
      handle.addEventListener('pointercancel', finish);
    }

    function minimizeWindow(record) {
      if (record.minimized) return;
      record.minimized = true;
      record.el.classList.add('window--minimized');
      record.el.setAttribute('aria-hidden', 'true');
      if (record.taskButton) record.taskButton.setAttribute('aria-pressed', 'false');
      if (state.activeId === record.id) {
        state.activeId = null;
        var next = state.order.slice().reverse().find(function (id) {
          var other = state.windows.get(id);
          return other && !other.minimized;
        });
        if (next) focusWindow(next);
      }
      if (record.onMinimize) record.onMinimize(record);
      announce(record.options.title + ' minimized.');
    }

    function restoreWindow(record) {
      if (!record.minimized) {
        focusWindow(record.id);
        return;
      }
      record.minimized = false;
      record.el.classList.remove('window--minimized');
      record.el.removeAttribute('aria-hidden');
      focusWindow(record.id);
      if (record.onRestore) record.onRestore(record);
      announce(record.options.title + ' restored.');
    }

    function toggleMaximize(record) {
      if (record.compact) return;
      if (record.maximized) {
        record.maximized = false;
        record.bounds = clampWindowBounds(record.restoreBounds, desktopArea());
      } else {
        record.restoreBounds = Object.assign({}, record.bounds);
        record.maximized = true;
        record.bounds = clampWindowBounds({ x: 0, y: 0, width: 1e6, height: 1e6 }, desktopArea());
      }
      record.el.classList.toggle('window--maximized', record.maximized);
      var maxButton = record.el.querySelector('.window-button.maximize');
      if (maxButton) {
        maxButton.setAttribute('aria-label', (record.maximized ? 'Restore ' : 'Maximize ') + record.options.title);
        var glyph = maxButton.querySelector('.glyph');
        if (glyph) glyph.className = 'glyph ' + (record.maximized ? 'glyph-restore' : 'glyph-maximize');
      }
      applyBounds(record);
      focusWindow(record.id);
    }

    function closeWindow(record) {
      if (record.onClose) record.onClose(record);
      if (state.player.windowId === record.id) {
        destroyPlayerFrame('close');
        state.player.windowId = null;
      }
      record.el.remove();
      if (record.taskButton) record.taskButton.remove();
      state.windows.delete(record.id);
      state.order = state.order.filter(function (id) { return id !== record.id; });
      if (state.activeId === record.id) {
        state.activeId = null;
        var next = state.order.slice().reverse().find(function (id) {
          var other = state.windows.get(id);
          return other && !other.minimized;
        });
        if (next) focusWindow(next);
      }
      announce(record.options.title + ' closed.');
    }

    function closeAllWindows() {
      state.windows.forEach(function (record) { closeWindow(record); });
    }

    function reflowWindows() {
      var compact = isCompactLayout();
      var area = desktopArea();
      state.windows.forEach(function (record) {
        if (compact) {
          if (!record.compact) {
            if (!record.maximized) record.restoreBounds = Object.assign({}, record.bounds);
            record.compact = true;
            record.maximized = false;
            record.el.classList.add('window--compact', 'window--maximized');
          }
          setMaximizeEnabled(record, false);
          record.bounds = clampWindowBounds(record.bounds, area, { compact: true });
        } else if (record.compact) {
          record.compact = false;
          record.el.classList.remove('window--compact', 'window--maximized');
          setMaximizeEnabled(record, record.options.maximizable !== false);
          record.bounds = clampWindowBounds(record.restoreBounds, area);
        } else {
          record.bounds = clampWindowBounds(record.bounds, area);
        }
        applyBounds(record);
      });
    }

    function setMaximizeEnabled(record, enabled) {
      var button = record.el.querySelector('.window-button.maximize');
      if (!button) return;
      button.disabled = !enabled;
      if (!enabled) {
        var glyph = button.querySelector('.glyph');
        if (glyph) glyph.className = 'glyph glyph-maximize';
        button.setAttribute('aria-label', 'Maximize ' + record.options.title);
      }
    }

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(reflowWindows, 120);
    });

    /* ---------------- Explorer catalog ---------------- */

    function buildExplorerContent() {
      var root = element('div', 'explorer');
      root.id = 'explorer';
      var toolbar = element('div', 'explorer-toolbar');

      function toolbarButton(label, glyph, className) {
        var button = element('button', 'toolbar-button' + (className ? ' ' + className : ''));
        button.type = 'button';
        button.title = label;
        var glyphEl = element('span', 'toolbar-glyph', glyph);
        glyphEl.setAttribute('aria-hidden', 'true');
        var text = element('span', 'toolbar-label', label);
        button.append(glyphEl, text);
        return button;
      }

      var back = toolbarButton('Back', '\u25c0', 'explorer-back');
      var forward = toolbarButton('Forward', '\u25b6', 'explorer-forward');
      var up = toolbarButton('Up', '\u25b2', 'explorer-up');
      var address = element('div', 'address-bar');
      var addressLabel = element('span', 'address-label', 'Address');
      var addressField = element('span', 'address-field');
      var addressIcon = element('span', 'address-icon icon-catalog');
      addressIcon.setAttribute('aria-hidden', 'true');
      var addressText = element('span', 'address-text', 'RammWiki \\ Flashcards');
      addressField.append(addressIcon, addressText);
      address.append(addressLabel, addressField);

      var searchBox = element('div', 'search-box');
      var searchLabel = element('label', 'sr-only', 'Search cards');
      searchLabel.htmlFor = 'card-search';
      var search = element('input', 'card-search');
      search.id = 'card-search';
      search.type = 'search';
      search.placeholder = 'Search cards';
      search.autocomplete = 'off';
      var searchGlyph = element('span', 'search-glyph icon-search');
      searchGlyph.setAttribute('aria-hidden', 'true');
      searchBox.append(searchLabel, search, searchGlyph);

      toolbar.append(back, forward, up, address, searchBox);

      var main = element('div', 'explorer-main');
      var content = element('section', 'explorer-content');
      content.setAttribute('aria-label', 'Card catalog');
      var grid = element('div', 'cards-grid');
      grid.setAttribute('role', 'listbox');
      grid.setAttribute('aria-label', 'Flashcards');
      var explorerStatus = element('div', 'explorer-status', 'Loading the catalog\u2026');
      explorerStatus.setAttribute('role', 'status');
      content.append(grid, explorerStatus);

      var details = element('aside', 'details-pane');
      details.setAttribute('aria-label', 'Card details');
      var detailsHeader = element('div', 'details-header', 'Details');
      var detailsContent = element('div', 'details-content');
      detailsContent.append(element('p', 'details-empty', 'Select a card to see its description, instructions and launch button.'));
      details.append(detailsHeader, detailsContent);

      var statusbar = element('div', 'explorer-statusbar');
      var countEl = element('span', '', '0 cards');
      countEl.id = 'status-count';
      var selectionEl = element('span', '', 'No card selected');
      selectionEl.id = 'status-selection';
      var playerEl = element('span', '', '');
      playerEl.id = 'status-player';
      statusbar.append(countEl, selectionEl, playerEl);

      main.append(content, details);
      root.append(toolbar, main, statusbar);

      var explorer = {
        root: root,
        grid: grid,
        status: explorerStatus,
        details: detailsContent,
        search: search,
        countEl: countEl,
        selectionEl: selectionEl,
        playerEl: playerEl,
        back: back,
        forward: forward,
        up: up,
        addressText: addressText,
      };
      state.explorer.els = explorer;

      back.addEventListener('click', function () { navigateHistory(-1); });
      forward.addEventListener('click', function () { navigateHistory(1); });
      up.addEventListener('click', function () {
        state.explorer.query = '';
        state.explorer.filter = 'all';
        search.value = '';
        renderExplorer();
        search.focus();
      });

      search.addEventListener('input', function () {
        state.explorer.query = search.value;
        renderExplorer();
      });
      search.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        search.value = '';
        state.explorer.query = '';
        renderExplorer();
      });

      grid.addEventListener('keydown', function (event) {
        var tiles = Array.prototype.slice.call(grid.querySelectorAll('.card-tile'));
        if (!tiles.length) return;
        var current = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.card-tile') : null;
        var index = tiles.indexOf(current);
        if (index === -1) index = 0;
        var columns = 3;
        try {
          columns = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
        } catch (error) { /* keep default */ }
        var next = null;
        if (event.key === 'ArrowRight') next = Math.min(tiles.length - 1, index + 1);
        else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1);
        else if (event.key === 'ArrowDown') next = Math.min(tiles.length - 1, index + columns);
        else if (event.key === 'ArrowUp') next = Math.max(0, index - columns);
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tiles.length - 1;
        else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          var activeCard = current && current.dataset.cardId;
          if (!activeCard) return;
          if (state.explorer.selectedId === activeCard) {
            var card = findCard(activeCard);
            if (card) launchCard(card);
          } else {
            selectCard(activeCard, { scroll: false, source: 'keyboard' });
          }
          return;
        } else {
          return;
        }
        event.preventDefault();
        var target = tiles[next];
        if (target) {
          selectCard(target.dataset.cardId, { scroll: false, source: 'keyboard' });
          target.focus();
        }
      });

      return root;
    }

    function tileLabel(card) {
      var bits = [card.title];
      if (card.year) bits.push(card.year);
      bits.push('status ' + card.status.label + (card.status.raw && card.status.raw !== card.status.label ? ', ' + card.status.raw : ''));
      bits.push('Press Enter to show details, then Enter again to launch. Use the Launch button to play.');
      return bits.join('. ');
    }

    function buildTile(card, selected) {
      var tile = element('div', 'card-tile');
      tile.dataset.cardId = card.id;
      tile.setAttribute('role', 'option');
      tile.setAttribute('aria-selected', String(Boolean(selected)));
      tile.tabIndex = selected ? 0 : -1;
      tile.setAttribute('aria-label', tileLabel(card));

      var thumb = element('div', 'tile-thumb');
      var imageUrl = cardAssetUrl(card, card.thumbnail, document.baseURI, { allowData: true });
      if (imageUrl) {
        var img = document.createElement('img');
        img.src = imageUrl;
        img.alt = '';
        img.loading = 'lazy';
        img.addEventListener('error', function () {
          img.remove();
          var fallback = element('div', 'tile-fallback', (card.title.charAt(0) || '?').toUpperCase());
          fallback.setAttribute('aria-hidden', 'true');
          thumb.prepend(fallback);
        });
        thumb.append(img);
      } else {
        var placeholder = element('div', 'tile-fallback', (card.title.charAt(0) || '?').toUpperCase());
        placeholder.setAttribute('aria-hidden', 'true');
        thumb.append(placeholder);
      }
      var badge = element('span', 'status-badge', card.status.label || card.status.key);
      badge.dataset.tone = card.status.tone;
      if (card.status.raw) badge.title = card.status.raw;
      thumb.append(badge);

      var body = element('div', 'tile-body');
      body.append(element('span', 'tile-title', card.title));
      var metaBits = [];
      if (card.kind === 'artifact') metaBits.push('Archived artifact');
      else if (card.kind === 'embed') metaBits.push('Browser game');
      if (card.year) metaBits.push(card.year);
      if (card.width && card.height) metaBits.push(card.width + '\u00d7' + card.height);
      body.append(element('span', 'tile-meta', metaBits.join(' \u00b7 ') || 'Flash card'));

      tile.append(thumb, body);

      var launch = element('button', 'tile-launch', '\u25b6');
      launch.type = 'button';
      launch.setAttribute('aria-label', 'Launch ' + card.title);
      launch.addEventListener('click', function (event) {
        event.stopPropagation();
        selectCard(card.id, { scroll: false, source: 'launch' });
        launchCard(card);
      });
      tile.append(launch);

      tile.addEventListener('click', function () {
        selectCard(card.id, { scroll: false, source: 'pointer' });
      });
      tile.addEventListener('dblclick', function () {
        selectCard(card.id, { scroll: false, source: 'pointer' });
        launchCard(card);
      });
      return tile;
    }

    function renderTiles() {
      var explorer = state.explorer;
      if (!explorer.els) return [];
      var filtered = filterCards(state.catalog.cards, {
        query: explorer.query,
        filter: explorer.filter,
      });
      var fragment = document.createDocumentFragment();
      filtered.forEach(function (card) {
        fragment.append(buildTile(card, card.id === explorer.selectedId));
      });
      explorer.els.grid.replaceChildren(fragment);
      explorer.els.grid.setAttribute('aria-label', 'Flashcards (' + filtered.length + ')');
      return filtered;
    }

    function renderCounts() {
      if (!state.explorer.els) return;
      state.explorer.els.countEl.textContent = state.catalog.cards.length + (state.catalog.cards.length === 1 ? ' card' : ' cards');
    }

    function setExplorerStatus(text, tone) {
      if (!state.explorer.els) return;
      state.explorer.els.status.textContent = text;
      if (tone) state.explorer.els.status.dataset.tone = tone;
      else delete state.explorer.els.status.dataset.tone;
    }

    function renderDetails() {
      if (!state.explorer.els) return;
      var container = state.explorer.els.details;
      var card = findCard(state.explorer.selectedId);
      container.replaceChildren();
      state.explorer.els.selectionEl.textContent = card ? 'Selected: ' + card.title : 'No card selected';

      if (!card) {
        container.append(element('p', 'details-empty', 'Select a card to see its description, instructions and launch button.'));
        return;
      }

      container.append(element('h3', 'details-title', card.title));
      var imageUrl = cardAssetUrl(card, card.thumbnail, document.baseURI, { allowData: true });
      if (imageUrl) {
        var img = document.createElement('img');
        img.className = 'details-thumb';
        img.src = imageUrl;
        img.alt = 'Thumbnail for ' + card.title;
        img.addEventListener('error', function () { img.replaceWith(placeholderThumb(card)); });
        container.append(img);
      } else {
        container.append(placeholderThumb(card));
      }

      var badge = element('span', 'details-status', card.status.label || card.status.key);
      badge.dataset.tone = card.status.tone;
      if (card.status.raw) badge.title = card.status.raw;
      container.append(badge);

      var meta = element('dl', 'details-meta');
      function metaRow(label, value) {
        if (!value) return;
        meta.append(element('dt', '', label), element('dd', '', value));
      }
      var embedUrl = card.kind === 'embed' ? resolveEmbedUrl(card.url, document.baseURI) : '';
      metaRow('Year', card.year);
      metaRow('Size', card.width + ' \u00d7 ' + card.height);
      metaRow('Card ID', card.id);
      if (card.kind === 'artifact') {
        var bundleBits = [];
        if (card.downloads.length) bundleBits.push(card.downloads.length + (card.downloads.length === 1 ? ' download' : ' downloads'));
        if (card.gallery.length) bundleBits.push(card.gallery.length + (card.gallery.length === 1 ? ' gallery image' : ' gallery images'));
        metaRow('Bundle', bundleBits.join(' \u00b7 ') || 'Archived artifact');
      } else if (card.kind === 'embed') {
        var embedHost = '';
        if (embedUrl) {
          try { embedHost = new URL(embedUrl).host; } catch (error) { embedHost = ''; }
        }
        metaRow('Host', embedHost || 'External browser game');
      } else {
        metaRow('File', card.swf || 'Not listed');
      }
      metaRow('Status', card.status.raw || card.status.label);
      container.append(meta);

      if (card.status.key === 'partial') {
        container.append(element('p', 'details-warning', 'The catalog marks this card as partially supported. Some behaviour may be limited.'));
      }
      if (card.status.key === 'unverified') {
        container.append(element('p', 'details-warning', 'This card has not been runtime-verified yet. It may play, but nobody has confirmed it end to end.'));
      }
      if (card.status.key === 'unsupported') {
        container.append(element('p', 'details-warning', 'This card is marked as unsupported. It may still start; Ruffle will report a problem if it cannot run the file.'));
      }
      if (card.fileMissing) {
        container.append(element('p', 'details-warning', 'No SWF file is listed for this card, so the Launch button is disabled.'));
      }
      if (card.kind === 'embed' && !embedUrl) {
        container.append(element('p', 'details-warning', 'No game URL is listed for this card, so the Launch button is disabled.'));
      }

      if (card.description) {
        var description = element('div', 'details-section');
        description.append(element('h4', '', 'Description'), element('p', '', card.description));
        container.append(description);
      }
      if (card.instructions) {
        var instructions = element('div', 'details-section');
        instructions.append(element('h4', '', 'How to play'), element('p', '', card.instructions));
        container.append(instructions);
      }
      var controlsSection = element('div', 'details-section');
      controlsSection.append(element('h4', '', 'Controls'));
      var chips = element('div', 'details-chips');
      if (card.controls.length) {
        card.controls.forEach(function (control) {
          chips.append(element('span', 'control-chip', control.label || control.code || 'Control'));
        });
      } else {
        chips.append(element('span', 'control-chip', 'Mouse or touchscreen'));
      }
      controlsSection.append(chips);
      if (card.keyboardControls.length && card.kind !== 'embed') {
        controlsSection.append(element('p', 'hint', 'A touch keyboard with these keys appears in the player on touch devices.'));
      }
      container.append(controlsSection);

      if (card.notes) {
        var notes = element('div', 'details-section');
        notes.append(element('h4', '', 'Notes'), element('p', '', card.notes));
        container.append(notes);
      }

      if (card.kind === 'artifact' && card.downloads.length) {
        var filesSection = element('div', 'details-section');
        filesSection.append(element('h4', '', 'Downloads'));
        filesSection.append(buildDownloadList(card.downloads));
        container.append(filesSection);
      }

      var actions = element('div', 'details-actions');
      var artifact = card.kind === 'artifact';
      var embed = card.kind === 'embed';
      var launch = element('button', 'rw-button primary',
        artifact ? 'Open files & preview' : embed ? 'Launch game' : 'Launch card');
      launch.type = 'button';
      launch.disabled = embed ? !embedUrl : (!artifact && !card.swf);
      launch.setAttribute('aria-label', artifact
        ? 'Open files and preview for ' + card.title
        : embed ? 'Launch ' + card.title + ' in the desktop' : 'Launch ' + card.title);
      launch.addEventListener('click', function () { launchCard(card); });
      actions.append(launch);
      actions.append(element('p', 'hint', artifact
        ? 'The sprite preview and every download open in one window. Nothing starts automatically.'
        : embed
          ? 'The original game runs on its own site in this window. Nothing downloads until you choose Load game there.'
          : 'Cards never autoplay from a link. Launching closes any other player first so only one card uses audio at a time.'));
      container.append(actions);
    }

    function placeholderThumb(card) {
      var wrap = element('div', 'tile-fallback', (card.title.charAt(0) || '?').toUpperCase());
      wrap.classList.add('details-thumb');
      wrap.setAttribute('aria-hidden', 'true');
      return wrap;
    }

    function buildDownloadList(downloads) {
      var list = element('ul', 'download-list');
      (downloads || []).forEach(function (entry) {
        var href = resolveUrl(entry.url, document.baseURI);
        if (!href) return;
        var item = element('li', 'download-item');
        var link = document.createElement('a');
        link.className = 'download-link';
        link.href = href;
        link.setAttribute('download', '');
        link.textContent = entry.label;
        item.append(link);
        if (entry.meta) item.append(element('span', 'download-meta', entry.meta));
        list.append(item);
      });
      return list;
    }

    function renderExplorer() {
      if (!state.explorer.els) return;
      renderCounts();
      var filtered = renderTiles();
      renderDetails();
      updateHistoryButtons();
      if (state.catalog.status === 'loading') {
        setExplorerStatus('Loading the catalog\u2026', 'info');
      } else if (state.catalog.status === 'error') {
        setExplorerStatus(state.catalog.error || 'The catalog could not be loaded.', 'error');
      } else if (!state.catalog.cards.length) {
        setExplorerStatus('The catalog contains no cards yet.', 'error');
      } else if (!filtered.length) {
        setExplorerStatus('No cards match this search or filter.', 'info');
      } else {
        var suffix = state.explorer.query ? ' matching \u201c' + state.explorer.query + '\u201d' : '';
        setExplorerStatus('Showing ' + filtered.length + ' of ' + state.catalog.cards.length + ' cards' + suffix + '.', 'info');
      }
    }

    function selectCard(id, options) {
      var opts = options || {};
      var card = findCard(id);
      if (!card) return;
      state.explorer.selectedId = id;
      if (opts.source === 'pointer' || opts.source === 'keyboard' || opts.source === 'launch' || opts.source === 'history') {
        var history = state.explorer.history;
        if (history[state.explorer.historyIndex] !== id) {
          history.splice(state.explorer.historyIndex + 1);
          history.push(id);
          state.explorer.historyIndex = history.length - 1;
        }
      }
      renderExplorer();
      if (opts.scroll && state.explorer.els) {
        var tile = state.explorer.els.grid.querySelector('[data-card-id="' + cssEscape(id) + '"]');
        if (tile) {
          tile.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          tile.focus({ preventScroll: true });
        }
      }
      if (opts.updateUrl !== false) updateAddress(id);
    }

    function cssEscape(value) {
      if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
      return String(value).replace(/["\\]/g, '\\$&');
    }

    function navigateHistory(direction) {
      var historyList = state.explorer.history;
      var next = state.explorer.historyIndex + direction;
      if (next < 0 || next >= historyList.length) return;
      state.explorer.historyIndex = next;
      selectCard(historyList[next], { scroll: true, updateUrl: true, source: 'history' });
    }

    function updateHistoryButtons() {
      if (!state.explorer.els) return;
      state.explorer.els.back.disabled = state.explorer.historyIndex <= 0;
      state.explorer.els.forward.disabled = state.explorer.historyIndex >= state.explorer.history.length - 1;
    }

    function updateAddress(cardId) {
      try {
        var url = new URL(location.href);
        if (cardId) url.searchParams.set('card', cardId);
        else url.searchParams.delete('card');
        history.replaceState({ card: cardId || null }, '', url);
      } catch (error) { /* file:// and other opaque origins */ }
    }

    function openExplorer(options) {
      var opts = options || {};
      if (state.explorer.windowId && state.windows.has(state.explorer.windowId)) {
        var existing = state.windows.get(state.explorer.windowId);
        restoreWindow(existing);
        if (opts.selectCardId) selectCard(opts.selectCardId, { scroll: true });
        if (opts.focusSearch && state.explorer.els) state.explorer.els.search.focus();
        return existing;
      }
      var content = buildExplorerContent();
      var record = createWindow({
        id: 'explorer',
        kind: 'explorer',
        icon: 'icon-catalog',
        title: 'RammWiki Flashcards',
        // Centre the catalog on large desktops (about 1100x720) while keeping
        // the desktop icon column clear; smaller screens stay responsive.
        bounds: explorerBounds(desktopArea()),
        content: content,
      });
      state.explorer.windowId = record.id;
      record.onClose = function () { state.explorer.windowId = null; };
      renderExplorer();
      if (opts.selectCardId) selectCard(opts.selectCardId, { scroll: true });
      if (opts.focusSearch && state.explorer.els) state.explorer.els.search.focus();
      return record;
    }

    async function loadCatalog() {
      state.catalog.status = 'loading';
      state.catalog.error = '';
      renderExplorer();
      try {
        var response = await fetch('catalog.json', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('The catalog request failed (HTTP ' + response.status + ').');
        }
        var data = await response.json();
        var catalog = sanitizeCatalog(data);
        if (!catalog.cards.length) {
          throw new Error('The catalog does not contain any cards yet.');
        }
        state.catalog = { status: 'ready', cards: catalog.cards, error: '' };
      } catch (error) {
        var message = error && error.message ? error.message : 'The catalog could not be loaded.';
        if (state.catalog.cards.length) {
          state.catalog.status = 'ready';
        } else {
          state.catalog = {
            status: 'error',
            cards: [],
            error: message + ' Check that catalog.json sits next to index.html, then choose Retry.',
          };
        }
      }
      renderExplorer();
      updateHistoryButtons();
      handleDeepLink();
      updateExplorerPlayerStatus();
      if (state.catalog.status === 'error') {
        var retry = element('button', 'rw-button', 'Retry');
        retry.type = 'button';
        retry.addEventListener('click', function () { loadCatalog(); });
        var statusEl = state.explorer.els && state.explorer.els.status;
        if (statusEl) {
          statusEl.append(' ');
          statusEl.append(retry);
        }
      }
    }

    function handleDeepLink() {
      if (state.explorer.deepLinkHandled || state.catalog.status !== 'ready') return;
      var id = null;
      try {
        id = new URLSearchParams(location.search).get('card');
      } catch (error) { id = null; }
      if (!id) return;
      state.explorer.deepLinkHandled = true;
      openExplorer();
      var card = findCard(id);
      if (card) {
        selectCard(card.id, { scroll: true, updateUrl: false, source: 'deep-link' });
        setExplorerStatus('\u201c' + card.title + '\u201d is selected from the link. Choose Launch card to start it \u2014 cards never autoplay.', 'info');
        announce('Card ' + card.title + ' selected from the link. Choose Launch card to play it.');
      } else {
        setExplorerStatus('No card with the id \u201c' + id + '\u201d was found in the catalog.', 'error');
        announce('The linked card was not found.');
      }
    }

    window.addEventListener('popstate', function () {
      var id = null;
      try { id = new URLSearchParams(location.search).get('card'); } catch (error) { id = null; }
      if (id && findCard(id)) selectCard(id, { scroll: true, updateUrl: false, source: 'history' });
    });

    /* ---------------- player window ---------------- */

    function buildPlayerWindowContent() {
      var root = element('div', 'player-window-body');
      var statusbar = element('div', 'sr-only');
      var dot = element('span', 'player-status-dot');
      dot.dataset.state = 'idle';
      var status = element('span', '', 'No card is playing.');
      status.id = 'player-window-status';
      status.setAttribute('role', 'status');
      var card = element('span', '', '');
      card.id = 'player-window-card';
      statusbar.append(dot, status, card);
      var holder = element('div', 'player-stage-holder');
      root.append(statusbar, holder);
      state.player.dotEl = dot;
      state.player.statusEl = status;
      state.player.cardEl = card;
      state.player.holderEl = holder;
      return root;
    }

    function setPlayerStatus(kind, text) {
      var player = state.player;
      player.status = kind;
      if (kind !== 'paused') player.lastStatus = kind;
      if (player.dotEl) player.dotEl.dataset.state = kind;
      if (player.statusEl) player.statusEl.textContent = text;
      updateExplorerPlayerStatus();
    }

    function updateExplorerPlayerStatus() {
      if (!state.explorer.els) return;
      var player = state.player;
      if (!player.card || !player.frame) {
        state.explorer.els.playerEl.textContent = '';
        return;
      }
      var labels = {
        loading: 'Loading: ',
        ready: 'Playing: ',
        playing: 'Playing: ',
        paused: 'Paused: ',
        error: 'Player error: ',
        unsupported: 'Unsupported: ',
      };
      state.explorer.els.playerEl.textContent = (labels[player.status] || '') + player.card.title +
        (player.muted ? ' (muted)' : '');
    }

    function destroyPlayerFrame(reason) {
      var player = state.player;
      if (player.timeout) {
        window.clearTimeout(player.timeout);
        player.timeout = 0;
      }
      if (player.frame) {
        player.frame.remove();
        player.frame = null;
      }
      player.playing = false;
      player.resumeAfterRestore = false;
      if (reason === 'switch') {
        player.status = 'loading';
      } else if (reason === 'close') {
        player.status = 'idle';
        player.card = null;
        if (player.statusEl) player.statusEl.textContent = 'No card is playing.';
        if (player.dotEl) player.dotEl.dataset.state = 'idle';
        if (player.cardEl) player.cardEl.textContent = '';
      }
      updateExplorerPlayerStatus();
    }

    function openPlayerWindow(card) {
      var player = state.player;
      if (player.statusEl && player.windowId && state.windows.has(player.windowId)) {
        // Switching cards: release the old iframe before creating the new one.
        destroyPlayerFrame('switch');
      }
      player.instance += 1;
      var instance = player.instance;
      player.card = card;
      player.muted = false;
      player.playing = false;
      player.resumeAfterRestore = false;
      setPlayerStatus('loading', 'Starting Ruffle for \u201c' + card.title + '\u201d\u2026');

      var record = player.windowId ? state.windows.get(player.windowId) : null;
      if (!record) {
        var content = buildPlayerWindowContent();
        var area = desktopArea();
        var width = Math.min(820, Math.max(320, area.width - 80));
        var height = Math.min(600, Math.max(220, area.height - 80));
        record = createWindow({
          id: 'player',
          kind: 'player',
          icon: 'icon-play',
          title: card.title + ' \u2014 RammWiki Player',
          bounds: {
            width: width,
            height: height,
            x: Math.round((area.width - width) / 2 + 40),
            y: Math.round((area.height - height) / 2 + 28),
          },
          content: content,
        });
        record.onClose = function () { destroyPlayerFrame('close'); state.player.windowId = null; };
        record.onMinimize = function () {
          if (!state.player.frame) return;
          state.player.resumeAfterRestore = state.player.playing;
          postToPlayer('pause');
          setPlayerStatus('paused', state.player.resumeAfterRestore ? 'Paused while minimized.' : 'Minimized.');
        };
        record.onRestore = function () {
          if (!state.player.frame) return;
          if (state.player.resumeAfterRestore) {
            postToPlayer('resume');
            setPlayerStatus('playing', 'Resumed after restoring the window.');
          } else {
            postToPlayer('focus');
            var last = state.player.lastStatus;
            if (last === 'error' || last === 'unsupported') {
              setPlayerStatus(last, 'Restored. The card is still ' + (last === 'error' ? 'reporting an error.' : 'unsupported.'));
            } else {
              setPlayerStatus(state.player.playing ? 'playing' : 'ready', 'Restored.');
            }
          }
          state.player.resumeAfterRestore = false;
        };
        player.windowId = record.id;
      } else {
        restoreWindow(record);
        setWindowTitle(record, card.title + ' \u2014 RammWiki Player');
        record.options.icon = 'icon-play';
      }
      if (player.cardEl) player.cardEl.textContent = card.year ? 'Year ' + card.year : '';

      var frame = document.createElement('iframe');
      frame.className = 'player-frame';
      frame.title = 'Flashcard player: ' + card.title;
      frame.setAttribute('allow', 'fullscreen; autoplay; encrypted-media');
      frame.setAttribute('allowfullscreen', '');
      frame.setAttribute('referrerpolicy', 'same-origin');
      var params = new URLSearchParams();
      params.set('card', card.id);
      params.set('instance', String(instance));
      frame.src = 'player.html?' + params.toString();
      frame.addEventListener('load', function () {
        if (state.player.instance !== instance) return;
        setPlayerStatus('loading', 'Player loaded. Waiting for Ruffle to start \u201c' + card.title + '\u201d\u2026');
      });
      player.holderEl.replaceChildren(frame);
      player.frame = frame;
      player.timeout = window.setTimeout(function () {
        if (state.player.instance !== instance || state.player.status !== 'loading') return;
        setPlayerStatus('error', 'The player did not respond in time. Close this window and launch the card again.');
        announce('The player did not respond in time.');
      }, PLAYER_START_TIMEOUT);

      focusWindow(record.id);
      announce('Launching ' + card.title + '. Any previous player was closed.');
    }

    function launchCard(card) {
      if (!card) return;
      if (card.kind === 'embed') {
        openEmbedWindow(card);
        return;
      }
      if (card.kind === 'artifact') {
        openArtifactWindow(card);
        return;
      }
      if (!card.swf) {
        setExplorerStatus('\u201c' + card.title + '\u201d has no SWF file listed, so it cannot be played.', 'error');
        announce(card.title + ' cannot be played because no SWF file is listed.');
        return;
      }
      openPlayerWindow(card);
    }

    function buildArtifactContent(card) {
      var content = element('div', 'artifact-content');
      var previewUrl = card.preview ? resolveUrl(card.preview, document.baseURI) : '';
      if (previewUrl) {
        var preview = element('div', 'artifact-preview');
        var frame = document.createElement('iframe');
        frame.className = 'artifact-frame';
        frame.title = card.title + ' preview';
        frame.setAttribute('allow', 'autoplay');
        frame.src = previewUrl;
        preview.append(frame);
        content.append(preview);
      }

      var files = element('section', 'artifact-section');
      files.append(element('h3', 'artifact-heading', 'Downloads'));
      files.append(element('p', 'artifact-hint', 'Everything extracted from the original archive; see the card notes for what each file is.'));
      files.append(buildDownloadList(card.downloads));
      content.append(files);

      if (card.gallery.length) {
        var gallerySection = element('section', 'artifact-section');
        gallerySection.append(element('h3', 'artifact-heading', card.galleryTitle || 'Extracted files'));
        gallerySection.append(element('p', 'artifact-hint',
          card.galleryHint || 'Original assets extracted from the archive; the preview above uses the same files.'));
        var grid = element('div', 'artifact-gallery');
        card.gallery.forEach(function (entry) {
          var url = resolveUrl(entry.url, document.baseURI, { allowData: true });
          if (!url) return;
          var figure = element('figure', 'gallery-item');
          var img = document.createElement('img');
          img.src = url;
          img.alt = entry.caption || '';
          img.loading = 'lazy';
          figure.append(img);
          if (entry.caption) figure.append(element('figcaption', '', entry.caption));
          grid.append(figure);
        });
        gallerySection.append(grid);
        content.append(gallerySection);
      }
      return content;
    }

    function openArtifactWindow(card) {
      var id = 'artifact';
      var existing = state.windows.get(id);
      if (existing) {
        restoreWindow(existing);
        setWindowTitle(existing, card.title + ' \u2014 Files & Preview');
        existing.body.replaceChildren(buildArtifactContent(card));
        focusWindow(id);
        return existing;
      }
      var area = desktopArea();
      var width = Math.min(980, Math.max(320, area.width - 60));
      var height = Math.min(760, Math.max(220, area.height - 60));
      var record = createWindow({
        id: id,
        kind: 'artifact',
        icon: 'icon-catalog',
        title: card.title + ' \u2014 Files & Preview',
        bounds: {
          width: width,
          height: height,
          x: Math.round((area.width - width) / 2),
          y: Math.round((area.height - height) / 2),
        },
        content: buildArtifactContent(card),
      });
      record.onClose = function () { record.body.replaceChildren(); };
      announce('Opened ' + card.title + ' files and preview.');
      return record;
    }

    /* ---------------- browser-game embed window ---------------- */

    function embedHost(card) {
      var url = resolveEmbedUrl(card.url, document.baseURI);
      if (!url) return '';
      try { return new URL(url).host; } catch (error) { return ''; }
    }

    function buildEmbedContent(card) {
      var content = element('div', 'embed-content');
      var frame = document.createElement('iframe');
      frame.className = 'embed-frame';
      frame.title = card.title + ' \u2014 browser game';
      // `cross-origin-isolated` lets the game page keep SharedArrayBuffer; the
      // game host must send matching COOP/COEP and a same-site CORP header.
      frame.setAttribute('allow', 'autoplay; fullscreen; cross-origin-isolated');
      frame.setAttribute('allowfullscreen', '');
      frame.src = resolveEmbedUrl(card.url, document.baseURI);
      content.append(frame);

      var note = 'Original game hosted at ' + (embedHost(card) || 'its own site') +
        '. Nothing downloads until Load game is chosen there.';
      if (typeof window.crossOriginIsolated === 'boolean' && !window.crossOriginIsolated) {
        note += ' This page is not cross-origin isolated, so the game may offer a separate link instead.';
      }
      content.append(element('p', 'embed-note', note));
      return content;
    }

    function openEmbedWindow(card) {
      var url = resolveEmbedUrl(card.url, document.baseURI);
      if (!url) {
        setExplorerStatus('\u201c' + card.title + '\u201d has no game URL listed, so it cannot be launched.', 'error');
        announce(card.title + ' cannot be launched because no game URL is listed.');
        return null;
      }
      var id = 'embed';
      var existing = state.windows.get(id);
      if (existing) {
        restoreWindow(existing);
        if (existing.options.cardId !== card.id) {
          // Switching games: release the running emulator before the next one.
          setWindowTitle(existing, card.title + ' \u2014 Browser game');
          existing.body.replaceChildren(buildEmbedContent(card));
          existing.options.cardId = card.id;
          announce('Opened ' + card.title + '. The previous browser game was closed.');
        }
        focusWindow(id);
        return existing;
      }
      var area = desktopArea();
      var width = Math.min(980, Math.max(320, area.width - 60));
      var height = Math.min(760, Math.max(220, area.height - 60));
      var record = createWindow({
        id: id,
        kind: 'embed',
        icon: 'icon-play',
        cardId: card.id,
        title: card.title + ' \u2014 Browser game',
        bounds: {
          width: width,
          height: height,
          x: Math.round((area.width - width) / 2),
          y: Math.round((area.height - height) / 2),
        },
        content: buildEmbedContent(card),
      });
      record.onClose = function () { record.body.replaceChildren(); };
      announce('Opened ' + card.title + ' in the desktop.');
      return record;
    }

    function postToPlayer(type, value) {
      var player = state.player;
      if (!player.frame || !player.frame.contentWindow) return false;
      var targetOrigin = location.origin === 'null' || !location.origin ? '*' : location.origin;
      var message = { channel: 'flashcards-host', type: type, instance: String(player.instance) };
      if (value !== undefined) message.value = value;
      player.frame.contentWindow.postMessage(message, targetOrigin);
      return true;
    }

    function handlePlayerMessage(message) {
      var player = state.player;
      if (!player.card) return;
      if (player.timeout) {
        // The player is alive; the child's own metadata timeout covers slow cards.
        window.clearTimeout(player.timeout);
        player.timeout = 0;
      }
      if (message.type === 'hello') {
        setPlayerStatus('loading', 'Player connected. Starting \u201c' + player.card.title + '\u201d\u2026');
        return;
      }
      if (message.type === 'status') {
        if (message.state === 'loading') {
          setPlayerStatus('loading', message.detail || 'Loading \u201c' + player.card.title + '\u201d\u2026');
        } else if (message.state === 'ready' || message.state === 'playing') {
          var record = state.windows.get(player.windowId);
          if (record && record.minimized) {
            // The card finished loading while minimized: stay paused and
            // remember that restoring should resume it.
            player.playing = false;
            player.resumeAfterRestore = true;
            postToPlayer('pause');
            setPlayerStatus('paused', 'Paused while minimized.');
          } else {
            player.playing = true;
            setPlayerStatus('playing', (player.muted ? 'Muted: ' : 'Playing: ') + player.card.title);
            if (record && player.frame) {
              player.frame.focus({ preventScroll: true });
              postToPlayer('focus');
            }
          }
        } else if (message.state === 'paused') {
          player.playing = false;
          var pausedRecord = state.windows.get(player.windowId);
          // While minimized the host already explains the pause; do not
          // overwrite it with the child's acknowledgement.
          if (!(pausedRecord && pausedRecord.minimized)) {
            setPlayerStatus('paused', 'Paused: ' + player.card.title);
          }
        } else if (message.state === 'error') {
          player.playing = false;
          setPlayerStatus('error', 'Player error: ' + player.card.title);
          announce('The card could not start.');
        } else if (message.state === 'unsupported') {
          player.playing = false;
          setPlayerStatus('unsupported', 'Ruffle is unavailable for ' + player.card.title + '.');
          announce('This browser cannot run Ruffle.');
        }
        return;
      }
      if (message.type === 'state') {
        player.playing = message.playing;
        player.muted = message.muted;
        player.volume = message.volume;
        if (player.status === 'playing' || player.status === 'ready') {
          setPlayerStatus('playing', (message.muted ? 'Muted: ' : 'Playing: ') + player.card.title);
        }
        updateExplorerPlayerStatus();
        return;
      }
      if (message.type === 'error') {
        player.playing = false;
        setPlayerStatus(message.state === 'unsupported' ? 'unsupported' : 'error',
          message.state === 'unsupported'
            ? 'Ruffle is unavailable for ' + player.card.title + '.'
            : 'Player error: ' + message.message);
        announce(message.state === 'unsupported' ? 'Ruffle is unavailable.' : 'Player error. ' + message.message);
        return;
      }
      if (message.type === 'request-close') {
        var playerRecord = state.windows.get(player.windowId);
        if (playerRecord) closeWindow(playerRecord);
      }
    }

    window.addEventListener('message', function (event) {
      var player = state.player;
      if (!player.frame || event.source !== player.frame.contentWindow) return;
      if (location.origin && location.origin !== 'null' && event.origin !== location.origin) return;
      var message = validatePlayerMessage(event.data, {
        instance: player.instance,
        cardId: player.card ? player.card.id : null,
      });
      if (!message) return;
      handlePlayerMessage(message);
    });

    /* ---------------- help window ---------------- */

    function openHelpWindow() {
      if (state.windows.has('help')) {
        restoreWindow(state.windows.get('help'));
        return;
      }
      var content = element('div', 'help-content');
      content.innerHTML =
        '<h3>Play cards safely</h3>' +
        '<p>Cards only start when you choose <strong>Launch card</strong> (or the play button on a tile). Links such as <code>?card=id</code> select a card and show its details, but they never autoplay. This keeps surprise audio away and gives you control.</p>' +
        '<p>Only one player runs at a time. Launching another card closes the previous player completely, which stops its sound and frees its memory. Closing the player window does the same.</p>' +
        '<p>A preserved <strong>browser game</strong> card opens in its own single window. Its emulator does not download anything until you choose <strong>Load game</strong> on the game page, and closing that window releases the game.</p>' +
        '<h3>Windows</h3>' +
        '<ul>' +
        '<li>Drag a title bar to move a window; drag any edge or corner to resize it. Windows stay inside the desktop.</li>' +
        '<li><strong>Minimize</strong> pauses the card and sends it to the taskbar. <strong>Restore</strong> resumes it only if it was playing when you minimized; a card you paused yourself stays paused.</li>' +
        '<li>On phones and small screens every window opens full size and the taskbar switches between them.</li>' +
        '</ul>' +
        '<h3>Player controls</h3>' +
        '<ul>' +
        '<li><strong>Volume</strong> and <strong>Mute</strong> change the sound for the current card. Mute remembers your level and restores it.</li>' +
        '<li><strong>Restart</strong> reloads the card from the beginning.</li>' +
        '<li><strong>Fullscreen</strong> expands the player; press <kbd>Esc</kbd> or the button again to leave fullscreen.</li>' +
        '<li>Click the stage to give Ruffle keyboard focus. On touch devices, cards that use keys show a touch keyboard with only the buttons that card needs.</li>' +
        '</ul>' +
        '<h3>When something goes wrong</h3>' +
        '<ul>' +
        '<li><strong>Loading</strong> means Ruffle is fetching the card. Large cards can take a moment.</li>' +
        '<li>A red <strong>error</strong> panel explains a card that could not start, with a Try again button.</li>' +
        '<li>An <strong>unsupported</strong> panel appears when Ruffle cannot run in this browser, for example if the self-hosted files are missing or WebAssembly is disabled.</li>' +
        '</ul>' +
        '<h3>Preservation notes</h3>' +
        '<p>The catalog, thumbnails and SWF files stay in their original form. Ruffle is the open-source Flash player and is self-hosted next to these pages for RammWiki, so no plugin and no third-party service is required.</p>';
      var record = createWindow({
        id: 'help',
        kind: 'help',
        icon: 'icon-help',
        title: 'Help and About',
        bounds: { width: 620, height: 520, x: 220, y: 90 },
        content: content,
      });
      return record;
    }

    /* ---------------- shell actions ---------------- */

    function randomCard() {
      var pool = state.catalog.cards.filter(function (card) {
        return card.swf || (card.kind === 'embed' && resolveEmbedUrl(card.url, document.baseURI));
      });
      if (!pool.length) {
        openExplorer();
        setExplorerStatus('The catalog is still loading or contains no playable cards.', 'error');
        return;
      }
      var card = pool[Math.floor(Math.random() * pool.length)];
      openExplorer({ selectCardId: card.id });
      launchCard(card);
    }

    function handleShellAction(action) {
      if (action === 'all-cards') openExplorer();
      else if (action === 'search') openExplorer({ focusSearch: true });
      else if (action === 'random') randomCard();
      else if (action === 'help') openHelpWindow();
      else if (action === 'close-windows') closeAllWindows();
      else if (action === 'shutdown') els.shutdown.hidden = false;
    }

    document.addEventListener('click', function (event) {
      var target = event.target.closest ? event.target.closest('[data-action]') : null;
      if (!target) return;
      if (els.startMenu.contains(target)) setStartMenu(false);
      handleShellAction(target.dataset.action);
    });

    document.getElementById('quick-cards').addEventListener('click', function () { openExplorer(); });
    document.getElementById('quick-help').addEventListener('click', function () { openHelpWindow(); });

    document.getElementById('shutdown-cancel').addEventListener('click', function () {
      els.shutdown.hidden = true;
    });
    document.getElementById('shutdown-restart').addEventListener('click', function () {
      destroyPlayerFrame('close');
      location.reload();
    });

    /* ---------------- boot ---------------- */

    updateClock();
    window.setInterval(updateClock, 1000);

    openExplorer();
    loadCatalog();

    window.FlashcardsCore = api;
    window.FlashcardsDesktop = {
      get windows() {
        return Array.from(state.windows.values()).map(function (record) {
          return {
            id: record.id,
            title: record.options.title,
            minimized: record.minimized,
            maximized: record.maximized,
            bounds: Object.assign({}, record.bounds),
          };
        });
      },
      get player() {
        return {
          cardId: state.player.card ? state.player.card.id : null,
          instance: state.player.instance,
          status: state.player.status,
          playing: state.player.playing,
          muted: state.player.muted,
          volume: state.player.volume,
          frameCount: document.querySelectorAll('.player-stage-holder iframe').length,
        };
      },
      get catalogStatus() { return state.catalog.status; },
      get selectedId() { return state.explorer.selectedId; },
      launch: function (id) {
        var card = findCard(id);
        if (card) launchCard(card);
      },
      select: function (id) { selectCard(id, { scroll: true }); },
      openExplorer: openExplorer,
      closeAll: closeAllWindows,
    };
  }

  var exported = {
    clamp: clamp,
    clampWindowBounds: clampWindowBounds,
    formatClock: formatClock,
    formatFullDate: formatFullDate,
    normalizeStatus: normalizeStatus,
    matchesSearch: matchesSearch,
    filterCards: filterCards,
    expandControls: expandControls,
    keyboardControls: keyboardControls,
    keyDefinition: keyDefinition,
    keyEventInit: keyEventInit,
    sanitizeCard: sanitizeCard,
    sanitizeCatalog: sanitizeCatalog,
    sanitizeDownloadList: sanitizeDownloadList,
    sanitizeGallery: sanitizeGallery,
    resolveUrl: resolveUrl,
    resolveEmbedUrl: resolveEmbedUrl,
    validatePlayerMessage: validatePlayerMessage,
    cardAssetUrl: cardAssetUrl,
    explorerBounds: explorerBounds,
    WINDOW_MIN_WIDTH: WINDOW_MIN_WIDTH,
    WINDOW_MIN_HEIGHT: WINDOW_MIN_HEIGHT,
    COMPACT_BREAKPOINT: COMPACT_BREAKPOINT,
    PLAYER_START_TIMEOUT: PLAYER_START_TIMEOUT,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = exported;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDesktop, { once: true });
    } else {
      initDesktop();
    }
  }
})();
