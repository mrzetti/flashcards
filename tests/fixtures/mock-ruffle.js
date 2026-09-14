/*
 * Mock Ruffle 0.6 build used by the browser tests.
 *
 * It mirrors the public API surface the player actually calls:
 *   window.RufflePlayer.newest().createPlayer() -> element with .ruffle()
 *   ruffle().load(options) / reload() / resume() / suspend() / volume
 *   loadedmetadata + loadeddata events
 *
 * Personalities are keyed by the `card` query parameter of the player page:
 *   broken -> load() rejects
 *   slow   -> metadata is delayed so the loading state is visible
 * `?ruffle=unsupported` leaves window.RufflePlayer undefined.
 *
 * The call log is available as window.__ruffleMock.calls.
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var card = params.get('card') || '';
  var mode = params.get('ruffle') || '';
  var calls = [];

  window.__ruffleMock = { card: card, mode: mode, calls: calls, version: '0.6.0-mock' };

  function record(entry) {
    calls.push(entry);
  }

  if (mode === 'unsupported' || mode === 'missing') {
    window.__ruffleMock.registered = false;
    return;
  }

  function bumpDestroyed() {
    try {
      var count = Number(window.localStorage.getItem('flashcards.mock.destroyed') || '0');
      window.localStorage.setItem('flashcards.mock.destroyed', String(count + 1));
    } catch (error) { /* storage disabled */ }
    record({ method: 'destroy' });
  }

  function createPlayer() {
    var element = document.createElement('div');
    element.className = 'mock-ruffle-player';
    element.tabIndex = 0;
    element.setAttribute('data-mock-player', card);

    var volume = 0.8;
    var loadedOptions = null;
    var metadataDispatching = false;

    function metadata() {
      metadataDispatching = true;
      element.dispatchEvent(new CustomEvent('loadedmetadata'));
      element.dispatchEvent(new CustomEvent('loadeddata'));
      metadataDispatching = false;
    }

    var api = {
      readyState: 0,
      metadata: { width: 640, height: 480 },
      isPlaying: false,
      suspended: false,
      fullscreenEnabled: true,
      isFullscreen: false,
      load: function (options) {
        loadedOptions = options;
        record({ method: 'load', options: JSON.parse(JSON.stringify(options)) });
        return new Promise(function (resolve, reject) {
          window.setTimeout(function () {
            if (card === 'broken') {
              reject(new Error('Mock Ruffle could not decode this card'));
              return;
            }
            api.isPlaying = true;
            resolve();
            window.setTimeout(function () {
              metadata();
            }, card === 'slow' ? 900 : 10);
          }, 5);
        });
      },
      reload: function () {
        record({ method: 'reload' });
        return new Promise(function (resolve) {
          window.setTimeout(function () {
            api.isPlaying = true;
            metadata();
            resolve();
          }, 10);
        });
      },
      resume: function () {
        record({ method: 'resume' });
        api.isPlaying = true;
        api.suspended = false;
      },
      suspend: function () {
        record({ method: 'suspend' });
        api.isPlaying = false;
        api.suspended = true;
      },
      requestFullscreen: function () {
        record({ method: 'requestFullscreen' });
      },
      exitFullscreen: function () {
        record({ method: 'exitFullscreen' });
      },
      setFullscreen: function (value) {
        record({ method: 'setFullscreen', value: Boolean(value) });
      },
      displayMessage: function (message) {
        record({ method: 'displayMessage', message: String(message) });
      },
      callExternalInterface: function () { return undefined; },
      get loadedOptions() { return loadedOptions; },
    };

    Object.defineProperty(api, 'volume', {
      get: function () { return volume; },
      set: function (value) {
        volume = value;
        record({ method: 'volume', value: value });
      },
    });

    element.ruffle = function () { return api; };
    element.__api = api;
    var nativeFocus = element.focus.bind(element);
    element.focus = function (options) {
      record({ method: 'focus', duringMetadata: metadataDispatching });
      return nativeFocus(options);
    };
    ['keydown', 'keyup'].forEach(function (type) {
      element.addEventListener(type, function (event) {
        record({
          method: 'key',
          type: type,
          code: event.code,
          key: event.key,
          keyCode: event.keyCode,
        });
      });
    });

    window.addEventListener('pagehide', bumpDestroyed);
    return element;
  }

  window.RufflePlayer = window.RufflePlayer || {};
  window.RufflePlayer.newest = function () {
    return { version: '0.6.0-mock', createPlayer: createPlayer };
  };
  window.__ruffleMock.registered = true;
})();
