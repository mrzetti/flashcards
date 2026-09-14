/*
 * RAMMSTEIN screensaver sprite preview.
 *
 * This is not a Director emulator. It rebuilds the look of the 1999 Windows
 * screensaver from the sprites that were extracted out of the original
 * Director 6 movie: the screen frame, the RAMMSTEIN wordmark, the 21 lyric
 * plates and the frame sequences of the crosses and flames.
 *
 * The original movie runs two sprites ("red_cross"/"green_cross"/"burning_*"
 * film loops) that drift across the screen, plus shuffled "Tafeln" plates.
 * This preview runs the same two ideas as two alternating scene modes.
 */
(function () {
  'use strict';

  var SCENE_URL = 'assets/cards/1999-rst-screensaver/scene.json';
  var STAGE_WIDTH = 800;
  var STAGE_HEIGHT = 600;
  var INSET = 34;              // the rahmen32 border width in stage pixels
  var PLATE_MS = 7000;
  var CROSS_MS = 8000;
  var FRAME_MS = 85;

  var els = {
    stage: document.getElementById('screensaver-stage'),
    frame: document.getElementById('screensaver-frame'),
    plateA: document.getElementById('screensaver-plate-a'),
    plateB: document.getElementById('screensaver-plate-b'),
    sprites: document.getElementById('screensaver-sprites'),
    status: document.getElementById('screensaver-status'),
    pause: document.getElementById('screensaver-pause'),
    next: document.getElementById('screensaver-next'),
  };

  var base = new URL(SCENE_URL, document.baseURI);
  base.pathname = base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1);

  function spriteUrl(relative) {
    return new URL(relative, base).href;
  }

  function loadScene() {
    return fetch(SCENE_URL, { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('scene.json returned ' + response.status);
      return response.json();
    });
  }

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function start(scene) {
    var plateQueue = shuffle(scene.plates || []);
    var plateIndex = -1;
    var activePlate = 0;
    var plateVisibleUntil = 0;
    var sceneMode = 'cross';
    var modeUntil = performance.now() + CROSS_MS;

    if (scene.frame) {
      els.frame.src = spriteUrl(scene.frame);
      els.frame.hidden = false;
    }

    function nextPlate() {
      if (!plateQueue.length) return;
      plateIndex = (plateIndex + 1) % plateQueue.length;
      var image = activePlate === 0 ? els.plateB : els.plateA;
      var other = activePlate === 0 ? els.plateA : els.plateB;
      image.src = spriteUrl(plateQueue[plateIndex]);
      image.hidden = false;
      image.classList.add('is-visible');
      other.classList.remove('is-visible');
      activePlate = activePlate === 0 ? 1 : 0;
    }

    // Cross sprites: three drifting animation-frame sequences like the
    // original sprite 1 / sprite 2 puppets. Positions live in 800x600 stage
    // units and are converted to percentages so the stage can scale freely.
    var crosses = [];
    var crossDefs = [
      { frames: scene.flameFrames, w: 50, h: 92, scale: 1.35 },
      { frames: scene.greenFrames, w: 42, h: 42, scale: 2.0 },
      { frames: scene.redFrames, w: 50, h: 60, scale: 1.8 },
    ];
    crossDefs.forEach(function (definition, i) {
      var templates = definition.frames || [];
      if (!templates.length) return;
      var img = document.createElement('img');
      img.className = 'screensaver-sprite';
      img.alt = '';
      img.src = spriteUrl(templates[0]);
      els.sprites.append(img);
      var sprite = {
        el: img,
        frames: templates,
        frame: 0,
        x: INSET + 40 + Math.random() * (STAGE_WIDTH - INSET * 2 - 160),
        y: INSET + 40 + Math.random() * (STAGE_HEIGHT - INSET * 2 - 200),
        vx: (i % 2 === 0 ? 1 : -1) * (0.45 + Math.random() * 0.5) * definition.scale,
        vy: (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.5) * definition.scale,
        width: definition.w * definition.scale,
        height: definition.h * definition.scale,
      };
      sprite.el.style.width = (sprite.width / STAGE_WIDTH) * 100 + '%';
      crosses.push(sprite);
    });

    function place(sprite) {
      sprite.el.style.left = (sprite.x / STAGE_WIDTH) * 100 + '%';
      sprite.el.style.top = (sprite.y / STAGE_HEIGHT) * 100 + '%';
    }
    crosses.forEach(place);

    var paused = false;
    var lastFrame = performance.now();
    var frameAccumulator = 0;

    function tickFrame(now) {
      if (!paused) {
        var delta = Math.min(64, now - lastFrame);
        frameAccumulator += delta;
        if (frameAccumulator >= FRAME_MS) {
          frameAccumulator = 0;
          crosses.forEach(function (sprite) {
            sprite.frame = (sprite.frame + 1) % sprite.frames.length;
            sprite.el.src = spriteUrl(sprite.frames[sprite.frame]);
          });
        }
        var step = Math.min(3.2, delta / 16.7);
        crosses.forEach(function (sprite) {
          sprite.x += sprite.vx * step;
          sprite.y += sprite.vy * step;
          if (sprite.x < INSET) { sprite.x = INSET; sprite.vx = Math.abs(sprite.vx); }
          if (sprite.y < INSET) { sprite.y = INSET; sprite.vy = Math.abs(sprite.vy); }
          if (sprite.x + sprite.width > STAGE_WIDTH - INSET) {
            sprite.x = STAGE_WIDTH - INSET - sprite.width;
            sprite.vx = -Math.abs(sprite.vx);
          }
          if (sprite.y + sprite.height > STAGE_HEIGHT - INSET) {
            sprite.y = STAGE_HEIGHT - INSET - sprite.height;
            sprite.vy = -Math.abs(sprite.vy);
          }
          place(sprite);
        });

        if (sceneMode === 'plate' && now > plateVisibleUntil) {
          els.plateA.classList.remove('is-visible');
          els.plateB.classList.remove('is-visible');
          sceneMode = 'cross';
          modeUntil = now + CROSS_MS;
        } else if (sceneMode === 'cross' && now > modeUntil) {
          sceneMode = 'plate';
          nextPlate();
          plateVisibleUntil = now + PLATE_MS;
        }
      }
      lastFrame = now;
      window.requestAnimationFrame(tickFrame);
    }

    els.next.addEventListener('click', function () {
      sceneMode = 'plate';
      nextPlate();
      plateVisibleUntil = performance.now() + PLATE_MS;
    });
    els.pause.addEventListener('click', function () {
      paused = !paused;
      els.pause.textContent = paused ? 'Resume' : 'Pause';
      els.pause.setAttribute('aria-pressed', String(paused));
      els.stage.classList.toggle('is-paused', paused);
    });

    els.status.hidden = true;
    window.requestAnimationFrame(tickFrame);
    window.__screensaverPreview = { ready: true, scene: scene };
  }

  function fail(error) {
    if (!els.status) return;
    els.status.hidden = false;
    els.status.textContent = 'The sprite preview could not load: ' + (error && error.message ? error.message : 'unknown error');
    window.__screensaverPreview = { ready: false, error: String(error && error.message || error) };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      loadScene().then(start).catch(fail);
    }, { once: true });
  } else {
    loadScene().then(start).catch(fail);
  }
})();
