/*
 * Mutter Enhanced CD — Universal Media Player preview.
 *
 * This is not the original program and not a Windows emulator. It rebuilds the
 * window of Universal Media Player 0.30, the shell that shipped on the
 * enhanced-CD data session of the US edition of Mutter (2001), and presents the
 * session's own files: the album artwork, the Sonne music video (through a
 * labelled H.264 transcode; the original MPEG-1 stays a download), the track
 * list from AUTORUN.INF, the historical links, the toolbar and credits bitmaps
 * extracted from ump.exe, and the player's manual extracted from ReadThis.WRI.
 *
 * Everything loads from the preserved files; if a fetch fails the page falls
 * back to the same data inlined below and keeps working.
 */
(function () {
  'use strict';

  var CARD_BASE = 'assets/cards/2001-mutter-enhanced-cd/';
  var DISC_BASE = 'originals/2001-mutter-enhanced-cd/';

  // The disc's own AUTORUN.INF [SongID] section, in order.
  var FALLBACK_TRACKS = [
    'Mein Herz Brennt', 'Links 2 3 4', 'Sonne', 'Ich Will', 'Feuer Frei',
    'Mutter', 'Spieluhr', 'Zwitter', 'Rein Raus', 'Adios', 'Nebel'
  ];

  // The disc's own AUTORUN.INF [Links] section.
  var FALLBACK_LINKS = [
    { name: 'Rammstein.com', url: 'http://www.umusic.com/rammstein/mutter1' },
    { name: 'Republic Records', url: 'http://www.umusic.com/rammstein/mutter2' },
    { name: 'Universal Records', url: 'http://www.umusic.com/rammstein/mutter3' }
  ];

  // Everything the disc itself put under Images/ and PICTURES/, plus the
  // bitmaps rendered from the preserved ump.exe. Paged by Last/Next image.
  var IMAGES = [
    {
      url: DISC_BASE + 'Images/FrontLg.jpg',
      caption: 'Album front cover, large — Images/FrontLg.jpg from the disc.'
    },
    {
      url: DISC_BASE + 'Images/FrontMed.jpg',
      caption: 'Album front cover, medium — Images/FrontMed.jpg from the disc.'
    },
    {
      url: DISC_BASE + 'Images/FrontSm.jpg',
      caption: 'Album front cover, small — Images/FrontSm.jpg from the disc.'
    },
    {
      url: DISC_BASE + 'PICTURES/JACKET01.00J',
      caption: 'The “Enhanced CD” plate from PICTURES/JACKET01.00J (JPEG).'
    },
    {
      url: DISC_BASE + 'PICTURES/JACKET01.00S',
      caption: 'The “CD Extra” plate from PICTURES/JACKET01.00S; the disc stores it as a single-frame MPEG-1 still.'
    },
    {
      url: CARD_BASE + 'ump-toolbar.png',
      caption: 'The Universal Media Player toolbar, rendered from a bitmap inside the preserved ump.exe.'
    },
    {
      url: CARD_BASE + 'ump-about.png',
      caption: 'The About screen from ump.exe, naming Thinking Pictures Incorporated in New York.'
    },
    {
      url: CARD_BASE + 'setup-banner.png',
      caption: 'The InstallShield banner explaining the Universal Media Player installation.'
    }
  ];

  var PANEL_STATUS = {
    media: '',
    audio: 'Audio: eleven track entries from the disc; the audio session is not part of this data archive.',
    video: 'Video: Sonne — original MPEG-1, 352×240, 4:00; the player uses the labelled H.264 transcode.',
    connect: 'Connect: three historical 2001 web addresses, shown exactly as stored and not opened.',
    help: 'Help/Prefs: extracted player manual, credits and disc notes.'
  };

  var els = {
    window: document.getElementById('ump-window'),
    status: document.getElementById('ump-status'),
    tools: Array.prototype.slice.call(document.querySelectorAll('.ump-tool[data-panel]')),
    arrows: Array.prototype.slice.call(document.querySelectorAll('.ump-tool[data-image]')),
    panels: Array.prototype.slice.call(document.querySelectorAll('.ump-panel[data-panel-view]')),
    image: document.getElementById('ump-image'),
    imageCaption: document.getElementById('ump-image-caption'),
    tracks: document.getElementById('ump-tracks'),
    links: document.getElementById('ump-links'),
    video: document.getElementById('ump-video'),
    manual: document.getElementById('ump-manual'),
  };

  var state = {
    panel: 'media',
    album: 'Mutter',
    artist: 'Rammstein',
    tracks: FALLBACK_TRACKS.slice(),
    links: FALLBACK_LINKS.slice(),
    images: IMAGES,
    imageIndex: 0,
    videoStarted: false,
  };

  function setStatus(text) {
    if (els.status) els.status.textContent = text;
  }

  function panelStatus() {
    if (state.panel === 'media') {
      var entry = state.images[state.imageIndex];
      return 'Picture ' + (state.imageIndex + 1) + ' of ' + state.images.length +
        ' — ' + (entry ? entry.caption : '');
    }
    return PANEL_STATUS[state.panel] || '';
  }

  function showPanel(name) {
    var found = false;
    els.panels.forEach(function (panel) {
      var active = panel.getAttribute('data-panel-view') === name;
      panel.hidden = !active;
      if (active) found = true;
    });
    if (!found) name = 'media';
    state.panel = name;
    els.tools.forEach(function (tool) {
      var active = tool.getAttribute('data-panel') === name;
      tool.classList.toggle('is-active', active);
      tool.setAttribute('aria-pressed', String(active));
    });
    if (name === 'video' && els.video && !state.videoStarted) {
      state.videoStarted = true;
      // preload="none" keeps the 11 MB transcode off the wire until the
      // visitor actually opens the video panel.
      try { els.video.load(); } catch (error) { /* ignore */ }
    }
    setStatus(panelStatus());
  }

  function showImage(index) {
    var count = state.images.length;
    if (!count) return;
    state.imageIndex = ((index % count) + count) % count;
    var entry = state.images[state.imageIndex];
    if (els.image) {
      els.image.src = entry.url;
      els.image.alt = entry.caption;
    }
    if (els.imageCaption) els.imageCaption.textContent = entry.caption;
    if (state.panel === 'media') setStatus(panelStatus());
  }

  function nextImage() {
    showPanel('media');
    showImage(state.imageIndex + 1);
  }

  function prevImage() {
    showPanel('media');
    showImage(state.imageIndex - 1);
  }

  function renderTracks() {
    if (!els.tracks) return;
    els.tracks.replaceChildren();
    state.tracks.forEach(function (title, i) {
      var item = document.createElement('li');
      var number = document.createElement('span');
      number.className = 'ump-track-number';
      number.textContent = String(i + 1).padStart(2, '0');
      var name = document.createElement('span');
      name.className = 'ump-track-title';
      name.textContent = title;
      item.append(number, name);
      els.tracks.append(item);
    });
  }

  function renderLinks() {
    if (!els.links) return;
    els.links.replaceChildren();
    state.links.forEach(function (link) {
      var item = document.createElement('li');
      var name = document.createElement('span');
      name.className = 'ump-link-name';
      name.textContent = link.name;
      var url = document.createElement('span');
      url.className = 'ump-link-url';
      url.textContent = link.url;
      item.append(name, url);
      els.links.append(item);
    });
  }

  /**
   * Read the disc's AUTORUN.INF without interpreting far from its text form.
   * Only [AlbumCredits], [SongID] and [Links] are used.
   */
  function parseAutorun(text) {
    var result = { album: '', artist: '', tracks: [], links: [] };
    var section = '';
    text.split(/\r?\n/).forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line || line.charAt(0) === ';') return;
      var header = line.match(/^\[(.+)\]$/);
      if (header) {
        section = header[1].trim().toLowerCase();
        return;
      }
      var split = line.indexOf('=');
      if (split === -1) return;
      var key = line.slice(0, split).trim();
      var value = line.slice(split + 1).trim();
      if (!value) return;
      if (section === 'albumcredits') {
        if (key.toLowerCase() === 'albumname') result.album = value;
        if (key.toLowerCase() === 'artistname') result.artist = value;
      } else if (section === 'songid' && /^mutter\d+$/i.test(key)) {
        result.tracks.push({
          order: parseInt(key.replace(/\D+/g, ''), 10) || result.tracks.length + 1,
          title: value,
        });
      } else if (section === 'links') {
        result.links.push({ name: key, url: value });
      }
    });
    result.tracks.sort(function (a, b) { return a.order - b.order; });
    return result;
  }

  function fetchText(url) {
    return fetch(url, { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error(url + ' returned ' + response.status);
      return response.text();
    });
  }

  function applyAutorun(parsed) {
    if (!parsed) return;
    if (parsed.album) state.album = parsed.album;
    if (parsed.artist) state.artist = parsed.artist;
    if (parsed.tracks.length) state.tracks = parsed.tracks.map(function (track) { return track.title; });
    if (parsed.links.length) state.links = parsed.links;
  }

  function loadManual() {
    if (!els.manual) return;
    fetchText(CARD_BASE + 'readthis.txt').then(function (text) {
      els.manual.textContent = text;
    }).catch(function (error) {
      els.manual.textContent = 'The extracted manual could not be loaded (' + error.message +
        '). The original ReadThis.WRI is one of the card downloads.';
    });
  }

  function init() {
    // Render with the disc's own metadata first so the page is never empty,
    // then refresh from AUTORUN.INF when it is available.
    renderTracks();
    renderLinks();
    showImage(0);
    showPanel('media');
    setStatus('*Loading CD*');
    loadManual();

    els.tools.forEach(function (tool) {
      tool.addEventListener('click', function () {
        showPanel(tool.getAttribute('data-panel'));
      });
    });
    els.arrows.forEach(function (arrow) {
      arrow.addEventListener('click', function () {
        if (arrow.getAttribute('data-image') === 'next') nextImage();
        else prevImage();
      });
    });
    if (els.video) {
      els.video.addEventListener('play', function () {
        setStatus('Video: playing Sonne — browser transcode of the disc\u2019s MPEG-1.');
      });
      els.video.addEventListener('pause', function () {
        if (state.panel === 'video') setStatus('Video: paused.');
      });
    }

    showPanel('media');
    window.__mutterEcdPreview = {
      ready: true,
      discLoaded: false,
      panel: function () { return state.panel; },
      imageIndex: function () { return state.imageIndex; },
      imageCount: state.images.length,
      tracks: function () { return state.tracks.slice(); },
      links: function () { return state.links.slice(); },
      album: function () { return state.album; },
      artist: function () { return state.artist; },
      showPanel: showPanel,
      showImage: showImage,
      nextImage: nextImage,
      prevImage: prevImage,
    };

    fetchText(DISC_BASE + 'AUTORUN.INF').then(function (text) {
      applyAutorun(parseAutorun(text));
      renderTracks();
      renderLinks();
      setStatus(state.album + ' · ' + state.tracks.length + ' track entries · 1 video · CD Extra');
      window.__mutterEcdPreview.discLoaded = true;
    }).catch(function () {
      setStatus(state.album + ' · ' + state.tracks.length + ' track entries (AUTORUN.INF unavailable)');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
