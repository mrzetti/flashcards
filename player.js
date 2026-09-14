/*
 * Flashcards player page (loaded inside the player window iframe).
 *
 * The player reads `?card=<id>` plus an `instance` token, loads the matching
 * entry from catalog.json, and runs the SWF through the self-hosted Ruffle
 * build. Lifecycle state is reported to the host window through validated
 * `postMessage` messages; commands from the host are validated the same way.
 *
 * Pure helpers are exported through `module.exports` for unit tests.
 */
(function () {
  'use strict';

  var DEFAULT_VOLUME = 0.8;
  var VOLUME_STORAGE_KEY = 'flashcards.player.volume';
  var METADATA_TIMEOUT = 90000;
  var HOST_MESSAGE_TYPES = ['pause', 'resume', 'mute', 'unmute', 'volume', 'restart', 'focus'];

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

  function readCardId(search) {
    try {
      var params = new URLSearchParams(search || '');
      var id = params.get('card');
      return id ? id.trim() : '';
    } catch (error) {
      return '';
    }
  }

  function ruffleAvailable(win) {
    if (!win || !win.RufflePlayer) return false;
    if (typeof win.RufflePlayer.newest !== 'function') return false;
    try {
      return Boolean(win.RufflePlayer.newest());
    } catch (error) {
      return false;
    }
  }

  function supportsWebAssembly(win) {
    return Boolean(win && typeof win.WebAssembly === 'object' && win.WebAssembly !== null);
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

  function resolveAssetUrl(value, base) {
    var text = asTrimmedString(value);
    if (!text) return '';
    try {
      var url = new URL(text, base || (typeof location !== 'undefined' ? location.href : 'https://flashcards.invalid/'));
      if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'file:') {
        return url.href;
      }
    } catch (error) { /* invalid URL */ }
    return '';
  }

  function pickCard(rawCatalog, id) {
    if (!rawCatalog || !Array.isArray(rawCatalog.cards) || !id) return null;
    var wanted = String(id);
    var raw = rawCatalog.cards.find(function (card) {
      return card && typeof card === 'object' && String(card.id) === wanted;
    });
    if (!raw) return null;
    return {
      id: String(raw.id),
      title: asTrimmedString(raw.title) || String(raw.id),
      swf: asTrimmedString(raw.swf),
      year: raw.year == null ? '' : asTrimmedString(raw.year),
      description: asTrimmedString(raw.description),
      instructions: asTrimmedString(raw.instructions),
      notes: asTrimmedString(raw.notes),
      status: asTrimmedString(raw.status),
      base: asTrimmedString(raw.base),
      controls: expandControls(raw.controls),
    };
  }

  /**
   * Optional catalog base override support: a per-card `base` field wins,
   * then a `?base=` URL parameter, then the player document itself. SWF
   * companions are then resolved against the card's own directory.
   */
  function cardFileBase(card, parameterBase, documentBase) {
    var override = card && card.base ? resolveAssetUrl(card.base, documentBase) : '';
    if (override) return override;
    var parameter = parameterBase ? resolveAssetUrl(parameterBase, documentBase) : '';
    if (parameter) return parameter;
    return documentBase || (typeof document !== 'undefined' ? document.baseURI : '');
  }

  function validateHostMessage(data, context) {
    var expected = context || {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    if (data.channel !== 'flashcards-host') return null;
    if (typeof data.type !== 'string' || HOST_MESSAGE_TYPES.indexOf(data.type) === -1) return null;
    if (expected.instance != null && expected.instance !== '' && data.instance != null &&
        String(data.instance) !== String(expected.instance)) {
      return null;
    }
    if (data.type === 'volume') {
      var value = Number(data.value);
      if (!Number.isFinite(value)) return null;
      return { type: 'volume', value: clamp(value, 0, 1) };
    }
    return { type: data.type };
  }

  function describeError(error) {
    if (error == null) return 'Unknown error.';
    if (typeof error === 'string') return error;
    if (typeof error.message === 'string' && error.message) return error.message;
    return String(error);
  }

  function sentence(text) {
    var value = describeError(text);
    return /[.!?]$/.test(value) ? value : value + '.';
  }

  /* ------------------------------------------------------------------ *
   * Browser-only player
   * ------------------------------------------------------------------ */

  function bootPlayer() {
    var els = {
      title: document.getElementById('player-title'),
      year: document.getElementById('player-year'),
      stage: document.getElementById('stage'),
      stageWrap: document.getElementById('stage-wrap'),
      loadingPanel: document.getElementById('loading-panel'),
      loadingTitle: document.getElementById('loading-title'),
      loadingDetail: document.getElementById('loading-detail'),
      errorPanel: document.getElementById('error-panel'),
      errorTitle: document.getElementById('error-title'),
      errorMessage: document.getElementById('error-message'),
      retry: document.getElementById('retry-button'),
      errorClose: document.getElementById('error-close'),
      startPanel: document.getElementById('start-panel'),
      startTitle: document.getElementById('start-title'),
      startDetail: document.getElementById('start-detail'),
      startButton: document.getElementById('start-card-button'),
      startClose: document.getElementById('start-close'),
      unsupportedPanel: document.getElementById('unsupported-panel'),
      unsupportedMessage: document.getElementById('unsupported-message'),
      unsupportedClose: document.getElementById('unsupported-close'),
      touch: document.getElementById('touch-controls'),
      touchToggle: document.getElementById('touch-toggle'),
      mute: document.getElementById('mute-button'),
      volume: document.getElementById('volume'),
      volumeValue: document.getElementById('volume-value'),
      restart: document.getElementById('restart-button'),
      fullscreen: document.getElementById('fullscreen-button'),
      status: document.getElementById('toolbar-status'),
    };

    var cardId = readCardId(location.search);
    var instance = '';
    var baseParam = '';
    var embedded = Boolean(window.parent && window.parent !== window);
    document.querySelector('.player-header').hidden = embedded;
    try {
      var search = new URLSearchParams(location.search);
      instance = search.get('instance') || '';
      baseParam = search.get('base') || '';
    } catch (error) {
      instance = '';
      baseParam = '';
    }

    var state = {
      card: null,
      element: null,
      ruffle: null,
      playing: false,
      muted: false,
      volume: readStoredVolume(),
      metadataSeen: false,
      metadataTimer: 0,
      embedded: embedded,
      pointers: new Map(),
      held: new Map(),
      touchKeys: [],
    };

    function post(type, extra) {
      if (!embedded) return;
      var message = {
        channel: 'flashcards-player',
        type: type,
        instance: instance,
        cardId: state.card ? state.card.id : cardId,
      };
      if (extra) {
        Object.keys(extra).forEach(function (key) { message[key] = extra[key]; });
      }
      var targetOrigin = location.origin && location.origin !== 'null' ? location.origin : '*';
      window.parent.postMessage(message, targetOrigin);
    }

    function setStatus(text) {
      els.status.textContent = text;
    }

    function setPanel(panel) {
      els.loadingPanel.hidden = panel !== 'loading';
      els.startPanel.hidden = panel !== 'start';
      els.errorPanel.hidden = panel !== 'error';
      els.unsupportedPanel.hidden = panel !== 'unsupported';
    }

    function showLoading(title, detail) {
      els.loadingTitle.textContent = title;
      els.loadingDetail.textContent = detail;
      setPanel('loading');
      setStatus(title);
    }

    /**
     * Pick the shorter of description/instructions for the always-visible
     * line; the full text for both fields stays in the collapsible details.
     */
    function pickConciseText(card) {
      var instruction = card.instructions;
      var description = card.description;
      if (instruction && description) {
        return instruction.length <= description.length ? instruction : description;
      }
      return instruction || description || '';
    }

    function truncate(text, max) {
      return text.length > max ? text.slice(0, max - 1) + '\u2026' : text;
    }

    /**
     * Standalone visits (player.html?card=... opened directly) get an explicit
     * Start card gate. Embedded launches come from the desktop's own Launch
     * button, which is already an explicit user action.
     */
    function showStartGate(card) {
      els.startTitle.textContent = card.title;
      var concise = pickConciseText(card);
      els.startDetail.textContent = concise
        ? truncate(concise, 260)
        : 'This card starts only when you choose Start card.';
      setPanel('start');
      setStatus('Ready to start');
    }

    function showError(title, message, options) {
      var opts = options || {};
      els.errorTitle.textContent = title;
      els.errorMessage.textContent = message;
      els.retry.hidden = opts.retry === false;
      setPanel('error');
      setStatus('Error');
      post('error', { state: 'error', message: title + ' \u2014 ' + message });
    }

    function showUnsupported(message) {
      els.unsupportedMessage.textContent = message;
      setPanel('unsupported');
      setStatus('Unsupported');
      post('status', { state: 'unsupported', detail: message });
    }

    function focusRuffle() {
      if (!state.element) return;
      try {
        state.element.focus({ preventScroll: true });
      } catch (error) {
        try { state.element.focus(); } catch (innerError) { /* not focusable */ }
      }
    }

    function applyVolume() {
      if (state.ruffle) {
        try {
          state.ruffle.volume = state.muted ? 0 : state.volume;
        } catch (error) { /* the instance may still be starting */ }
      }
      var percent = Math.round(state.volume * 100);
      els.volume.value = String(percent);
      els.volumeValue.value = percent + '%';
      els.volumeValue.textContent = percent + '%';
      els.mute.setAttribute('aria-pressed', String(state.muted));
      els.mute.textContent = state.muted ? 'Unmute' : 'Mute';
      els.mute.setAttribute('aria-label', state.muted ? 'Unmute sound' : 'Mute sound');
      els.volume.setAttribute('aria-label', 'Volume: ' + percent + ' percent');
      updateMediaControls();
    }

    function updateMediaControls() {
      els.restart.disabled = !state.element;
      els.fullscreen.disabled = !state.element;
    }

    function postState() {
      post('state', { playing: state.playing, muted: state.muted, volume: state.volume });
    }

    function setVolume(value) {
      state.volume = clamp(value, 0, 1);
      state.muted = false;
      storeVolume(state.volume);
      applyVolume();
      setStatus(state.playing ? 'Playing' : 'Ready');
      postState();
    }

    function setMuted(muted) {
      state.muted = Boolean(muted);
      if (!state.muted && state.volume === 0) state.volume = DEFAULT_VOLUME;
      storeVolume(state.volume);
      applyVolume();
      setStatus(state.muted ? 'Playing (muted)' : (state.playing ? 'Playing' : 'Ready'));
      postState();
    }

    function suspend() {
      if (state.ruffle && typeof state.ruffle.suspend === 'function') {
        try { state.ruffle.suspend(); } catch (error) { /* ignore */ }
      }
      state.playing = false;
      setStatus('Paused');
      post('status', { state: 'paused' });
      postState();
    }

    function resume() {
      if (state.ruffle && typeof state.ruffle.resume === 'function') {
        try { state.ruffle.resume(); } catch (error) { /* ignore */ }
      }
      if (!state.metadataSeen) return;
      state.playing = true;
      setStatus(state.muted ? 'Playing (muted)' : 'Playing');
      post('status', { state: 'playing' });
      postState();
    }

    function clearMetadataTimer() {
      if (state.metadataTimer) {
        window.clearTimeout(state.metadataTimer);
        state.metadataTimer = 0;
      }
    }

    function armMetadataTimer() {
      clearMetadataTimer();
      state.metadataTimer = window.setTimeout(function () {
        if (state.metadataSeen) return;
        showError(
          'The card did not start',
          'Ruffle loaded, but the card did not report any metadata within 90 seconds. The file may be damaged or may use a feature Ruffle does not support yet.',
          { retry: true }
        );
      }, METADATA_TIMEOUT);
    }

    function onMetadata() {
      if (state.metadataSeen) return;
      state.metadataSeen = true;
      clearMetadataTimer();
      state.playing = true;
      setPanel(null);
      applyVolume();
      setStatus(state.muted ? 'Playing (muted)' : 'Playing');
      post('status', { state: 'ready', detail: '' });
      postState();
      // Ruffle 0.6.0 is still initializing its keyboard listener while this
      // metadata event is dispatched. Synchronous focus here leaves real keys
      // disconnected even though the element appears focused (Benzin reproducer).
      window.setTimeout(focusRuffle, 0);
    }

    function destroyElement() {
      clearMetadataTimer();
      if (state.element) {
        state.element.remove();
        state.element = null;
        state.ruffle = null;
      }
      updateMediaControls();
    }

    /* ---------------- touch keyboard ---------------- */

    function sendKey(code, down) {
      if (!state.element) return;
      var entry = state.touchKeys.find(function (item) { return item.code === code; }) || keyDefinition(code);
      var init = keyEventInit(entry);
      if (!init) return;
      // Ruffle only processes synthetic key events while the player element
      // has focus, so focus before dispatching a press.
      if (down) focusRuffle();
      state.element.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', init));
    }

    function releaseTouchKey(code) {
      if (!state.held.has(code)) return;
      state.held.delete(code);
      var button = els.touch.querySelector('[data-key="' + cssEscape(code) + '"]');
      if (button) button.classList.remove('held');
      sendKey(code, false);
    }

    function releaseAllTouchKeys() {
      state.pointers.clear();
      Array.from(state.held.keys()).forEach(releaseTouchKey);
    }

    function setTouchVisible(visible) {
      releaseAllTouchKeys();
      els.touch.hidden = !visible;
      els.touchToggle.setAttribute('aria-pressed', String(visible));
      state.touchVisible = visible;
    }

    function buildTouchControls() {
      var keys = (state.card ? state.card.controls : []).filter(function (entry) { return entry.code; });
      state.touchKeys = keys;
      els.touch.replaceChildren();
      if (!keys.length) {
        els.touchToggle.hidden = true;
        setTouchVisible(false);
        return;
      }
      els.touchToggle.hidden = false;
      keys.forEach(function (entry) {
        var button = document.createElement('button');
        button.type = 'button';
        button.dataset.key = entry.code;
        button.textContent = entry.label || entry.code;
        button.setAttribute('aria-label', (entry.label || entry.code) + ' key');
        button.addEventListener('pointerdown', function (event) {
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          event.preventDefault();
          if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
          if (!state.pointers.has(event.pointerId)) {
            state.pointers.set(event.pointerId, entry.code);
            if (!state.held.has(entry.code)) {
              state.held.set(entry.code, true);
              button.classList.add('held');
              sendKey(entry.code, true);
            }
          }
        });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (type) {
          button.addEventListener(type, function (event) {
            event.preventDefault();
            var code = state.pointers.get(event.pointerId);
            if (!code) return;
            state.pointers.delete(event.pointerId);
            var stillHeld = Array.from(state.pointers.values()).indexOf(code) !== -1;
            if (!stillHeld) releaseTouchKey(code);
          });
        });
        button.addEventListener('contextmenu', function (event) { event.preventDefault(); });
        var keyboardHeld = false;
        function releaseKeyboardKey(event) {
          if (event.key !== ' ' && event.key !== 'Enter') return;
          window.removeEventListener('keyup', releaseKeyboardKey, true);
          keyboardHeld = false;
          releaseTouchKey(entry.code);
        }
        button.addEventListener('keydown', function (event) {
          if (event.key !== ' ' && event.key !== 'Enter') return;
          event.preventDefault();
          if (!state.held.has(entry.code)) {
            state.held.set(entry.code, true);
            button.classList.add('held');
            keyboardHeld = true;
            // sendKey() moves focus to the player, so release on a window
            // keyup instead of relying on the button keeping focus.
            window.addEventListener('keyup', releaseKeyboardKey, true);
            sendKey(entry.code, true);
          }
        });
        button.addEventListener('keyup', function (event) {
          if (event.key !== ' ' && event.key !== 'Enter') return;
          event.preventDefault();
          releaseTouchKey(entry.code);
        });
        button.addEventListener('blur', function () {
          // A pointer or keyboard hold owns the key until it is released:
          // moving focus into Ruffle must not cut a held control short.
          if (keyboardHeld) return;
          if (Array.from(state.pointers.values()).indexOf(entry.code) !== -1) return;
          releaseTouchKey(entry.code);
        });
        els.touch.append(button);
      });
      var coarse = navigator.maxTouchPoints > 0 ||
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      setTouchVisible(Boolean(coarse));
      els.touchToggle.addEventListener('click', function () {
        setTouchVisible(els.touch.hidden);
      });
      window.addEventListener('blur', releaseAllTouchKeys);
      window.addEventListener('pagehide', releaseAllTouchKeys);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) releaseAllTouchKeys();
      });
    }

    function cssEscape(value) {
      if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
      return String(value).replace(/["\\]/g, '\\$&');
    }

    /* ---------------- controls ---------------- */

    function closePlayer() {
      if (embedded) post('request-close');
      else location.assign('index.html');
    }

    function fallbackRuffleFullscreen() {
      if (state.ruffle && typeof state.ruffle.requestFullscreen === 'function') {
        try {
          state.ruffle.requestFullscreen();
          return;
        } catch (error) { /* fall through */ }
      }
      setStatus('Fullscreen is not available in this browser.');
    }

    function toggleFullscreen() {
      var root = document.documentElement;
      if (document.fullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
        return;
      }
      if (root.requestFullscreen) {
        root.requestFullscreen().catch(function () { fallbackRuffleFullscreen(); });
      } else {
        fallbackRuffleFullscreen();
      }
    }

    /* ---------------- ruffle lifecycle ---------------- */

    function applyCardChrome(card) {
      document.title = card.title + ' \u2014 Flashcards player';
      els.title.textContent = card.title;
      els.year.textContent = card.year ? 'Year ' + card.year : '';

    }

    function startRuffle(card) {
      var player;
      try {
        player = window.RufflePlayer.newest().createPlayer();
      } catch (error) {
        showUnsupported('Ruffle could not create a player in this browser: ' + describeError(error));
        return;
      }
      state.element = player;
      state.ruffle = player.ruffle();
      updateMediaControls();
      els.stage.replaceChildren(player);
      player.addEventListener('loadedmetadata', onMetadata);
      player.addEventListener('loadeddata', onMetadata);
      applyVolume();
      armMetadataTimer();

      var fileBase = cardFileBase(card, baseParam, document.baseURI);
      var swfUrl = resolveAssetUrl(card.swf, fileBase);
      if (!swfUrl) {
        showError('The card address is not valid', 'The SWF path \u201c' + card.swf + '\u201d could not be resolved.', { retry: false });
        return;
      }
      // Keep each card's relative companion requests (images, XML, audio) next
      // to its own SWF instead of resolving them against the site root.
      var swfDirectory = fileBase;
      try {
        swfDirectory = new URL('.', swfUrl).href;
      } catch (error) { /* keep the catalog base */ }

      setPanel('loading');
      setStatus('Loading the card\u2026');
      post('status', { state: 'loading', detail: 'Ruffle is loading the card.' });

      var loadPromise;
      try {
        loadPromise = state.ruffle.load({
          url: swfUrl,
          base: swfDirectory,
          autoplay: 'on',
          unmuteOverlay: 'visible',
          backgroundColor: '#000000',
          letterbox: 'on',
          // This card sets noScale internally, clipping its menus on small stages.
          scale: 'showAll',
          forceScale: card.id === '2005-keine-lust',
          allowScriptAccess: false,
          openUrlMode: 'confirm',
          upgradeToHttps: true,
          warnOnUnsupportedContent: true,
        });
      } catch (error) {
        clearMetadataTimer();
        showError('The card could not start', describeError(error), { retry: true });
        return;
      }
      Promise.resolve(loadPromise).then(function () {
        applyVolume();
        if (state.metadataSeen) return;
        // Ruffle 0.6 picks this SVG label from navigator.languages; its longer
        // translations are clipped by the SVG bounds.
        var unmuteText = player.shadowRoot && player.shadowRoot.querySelector('#unmute-text');
        if (unmuteText) unmuteText.textContent = 'Click to unmute';
      }).catch(function (error) {
        clearMetadataTimer();
        if (state.metadataSeen) return;
        showError(
          'The card could not start',
          sentence(error) + ' The file may use a feature Ruffle does not support yet.',
          { retry: true }
        );
      });
    }

    function restart() {
      if (!state.ruffle || !state.card) return;
      state.metadataSeen = false;
      state.playing = false;
      setStatus('Restarting\u2026');
      post('status', { state: 'loading', detail: 'Restarting the card.' });
      armMetadataTimer();
      Promise.resolve(state.ruffle.reload()).catch(function (error) {
        clearMetadataTimer();
        showError('The card could not restart', describeError(error), { retry: true });
      });
    }

    function attempt() {
      destroyElement();
      state.metadataSeen = false;
      state.playing = false;
      showLoading('Loading card\u2026', 'Reading the card catalog.');
      post('status', { state: 'loading', detail: 'Reading the card catalog.' });

      if (!cardId) {
        showError('No card was specified', 'Open a card from the catalog or add ?card=id to this player address.', { retry: false });
        return;
      }

      fetch('catalog.json', { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      }).then(function (rawCatalog) {
        var card = pickCard(rawCatalog, cardId);
        if (!card) {
          showError('Card not found', 'The catalog has no card with the id \u201c' + cardId + '\u201d.', { retry: true });
          return;
        }
        state.card = card;
        applyCardChrome(card);
        buildTouchControls();
        if (!card.swf) {
          showError('No SWF file listed', 'The catalog entry for \u201c' + card.title + '\u201d does not list an SWF file.', { retry: false });
          return;
        }
        if (!supportsWebAssembly(window)) {
          showUnsupported('This browser does not provide WebAssembly, which Ruffle needs. Use a current version of Firefox, Chrome, Edge or Safari.');
          return;
        }
        if (!ruffleAvailable(window)) {
          showUnsupported('The self-hosted Ruffle script at assets/ruffle/ruffle.js did not load, or this browser blocked it. Make sure the assets/ruffle folder was copied next to these pages, then reload.');
          return;
        }
        if (embedded) {
          startRuffle(card);
        } else {
          // Standalone visits get an explicit gate; no autoplay without a click.
          showStartGate(card);
        }
      }).catch(function (error) {
        showError(
          'The catalog could not be loaded',
          'catalog.json could not be read (' + describeError(error) + '). Check that it sits next to player.html.',
          { retry: true }
        );
      });
    }

    function handleHostMessage(message) {
      if (message.type === 'pause') suspend();
      else if (message.type === 'resume') resume();
      else if (message.type === 'mute') setMuted(true);
      else if (message.type === 'unmute') setMuted(false);
      else if (message.type === 'volume') setVolume(message.value);
      else if (message.type === 'restart') restart();
      else if (message.type === 'focus') focusRuffle();
    }

    /* ---------------- wiring ---------------- */

    els.retry.addEventListener('click', attempt);
    els.errorClose.addEventListener('click', closePlayer);
    els.unsupportedClose.addEventListener('click', closePlayer);
    els.startClose.addEventListener('click', closePlayer);
    els.startButton.addEventListener('click', function () {
      if (state.card) startRuffle(state.card);
    });
    els.restart.addEventListener('click', restart);
    els.fullscreen.addEventListener('click', toggleFullscreen);
    els.mute.addEventListener('click', function () { setMuted(!state.muted); });
    els.volume.addEventListener('input', function () { setVolume(Number(els.volume.value) / 100); });
    els.stageWrap.addEventListener('pointerdown', function () { focusRuffle(); });
    document.addEventListener('fullscreenchange', function () {
      var active = Boolean(document.fullscreenElement);
      els.fullscreen.textContent = active ? 'Exit fullscreen' : 'Fullscreen';
      els.fullscreen.setAttribute('aria-pressed', String(active));
    });

    if (!embedded) {
      els.errorClose.textContent = 'Back to catalog';
      els.unsupportedClose.textContent = 'Back to catalog';
    }

    window.addEventListener('message', function (event) {
      if (!embedded) return;
      if (event.source !== window.parent) return;
      if (location.origin && location.origin !== 'null' && event.origin !== location.origin) return;
      var message = validateHostMessage(event.data, { instance: instance });
      if (!message) return;
      handleHostMessage(message);
    });

    applyVolume();
    post('hello', {});
    attempt();

    window.FlashcardsPlayer = {
      get state() {
        return {
          cardId: state.card ? state.card.id : null,
          playing: state.playing,
          muted: state.muted,
          volume: state.volume,
          metadataSeen: state.metadataSeen,
          embedded: state.embedded,
          awaitingStart: !els.startPanel.hidden,
          touchVisible: state.touchVisible,
          touchKeys: state.touchKeys.map(function (entry) { return entry.code; }),
        };
      },
      retry: attempt,
      suspend: suspend,
      resume: resume,
    };
  }

  function readStoredVolume(storage) {
    try {
      var store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
      if (!store) return DEFAULT_VOLUME;
      var raw = store.getItem(VOLUME_STORAGE_KEY);
      if (raw == null || raw === '') return DEFAULT_VOLUME;
      var value = Number(raw);
      if (Number.isFinite(value) && value >= 0 && value <= 1) return value;
    } catch (error) { /* storage disabled */ }
    return DEFAULT_VOLUME;
  }

  function storeVolume(value) {
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(clamp(value, 0, 1)));
    } catch (error) { /* storage disabled */ }
  }

  var exported = {
    clamp: clamp,
    readCardId: readCardId,
    ruffleAvailable: ruffleAvailable,
    supportsWebAssembly: supportsWebAssembly,
    keyDefinition: keyDefinition,
    expandControls: expandControls,
    keyEventInit: keyEventInit,
    pickCard: pickCard,
    validateHostMessage: validateHostMessage,
    resolveAssetUrl: resolveAssetUrl,
    cardFileBase: cardFileBase,
    describeError: describeError,
    sentence: sentence,
    readStoredVolume: readStoredVolume,
    DEFAULT_VOLUME: DEFAULT_VOLUME,
    METADATA_TIMEOUT: METADATA_TIMEOUT,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = exported;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootPlayer, { once: true });
    } else {
      bootPlayer();
    }
  }
})();
