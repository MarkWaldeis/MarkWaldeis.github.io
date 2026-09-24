/* ============================================================
   tiger.js — Verhaltens-Engine: Der Tiger lebt in der Website
   Wandert · pausiert · dreht sich · sprintet auf Klicks
   ============================================================ */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var video = document.getElementById("tiger");
  var shadow = document.getElementById("tigerShadow");
  video.removeAttribute("poster");

  var W = 0, H = 0;
  var mouse = { x: 0.5, y: 0.5 };

  /* Zustand */
  var x = 0.5;            /* Position 0..1 (Bildschirmbreite) */
  var depth = 0.8;        /* 0 = weit weg, 1 = ganz nah */
  var targetX = 0.5, targetDepth = 0.8;
  var anchor = { x: 0.5, depth: 0.8 };
  var dir = 1, dirSmooth = 1;
  var speedFactor = 1;    /* 0 = steht */
  var state = "wander";   /* wander | idle | dash */
  var stateUntil = 0;
  var retargetAt = 0;
  var bobPhase = 0;
  var pulseT = 0;
  var now = 0;

  var lastFilter = "";

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function resize() { W = window.innerWidth; H = window.innerHeight; }

  function retarget() {
    targetX = clamp(anchor.x + rand(-0.13, 0.13), 0.06, 0.94);
    targetDepth = clamp(anchor.depth + rand(-0.09, 0.09), 0.28, 1);
    if (Math.random() < 0.28) {
      state = "idle";
      stateUntil = now + rand(700, 1700);
      speedFactor = 0;
    } else {
      state = "wander";
      speedFactor = rand(0.75, 1.25);
    }
    retargetAt = now + rand(2400, 5200);
  }

  function baseWidth() {
    return clamp(W * 0.34, 250, 760);
  }

  function render(dt) {
    var scale = 0.42 + 0.58 * depth;
    var w = baseWidth() * scale;
    var bottomPx = H * lerp(0.145, 0.045, depth);

    /* Puls (Tiger rufen) */
    var pulse = 1;
    if (pulseT > 0) {
      pulseT = Math.max(0, pulseT - dt);
      pulse = 1 + Math.sin((1 - pulseT / 0.6) * Math.PI) * 0.06;
    }

    var bob = Math.sin(bobPhase) * (1.5 + speedFactor * 4.5);
    var parX = (mouse.x - 0.5) * 12 * depth;
    var parY = (mouse.y - 0.5) * 7 * depth;

    video.style.width = w + "px";
    video.style.bottom = bottomPx + "px";
    video.style.transform =
      "translate3d(" + (x * W - w / 2 + parX).toFixed(1) + "px, " + (parY + bob * 0.4).toFixed(1) + "px, 0)" +
      " scaleX(" + dirSmooth.toFixed(3) + ") scale(" + pulse + ")";

    var blur = depth < 0.55 ? Math.round((0.55 - depth) * 7) : 0;
    var bright = (0.72 + 0.28 * depth).toFixed(2);
    var filter = (blur > 0 ? "blur(" + blur + "px) " : "") + "brightness(" + bright + ")";
    if (filter !== lastFilter) { video.style.filter = filter; lastFilter = filter; }

    var shScale = 1 + bob * 0.012 * speedFactor;
    shadow.style.transform =
      "translate3d(" + (x * W - w * 0.44 + parX).toFixed(1) + "px, " + (parY * 0.5).toFixed(1) + "px, 0) scale(" + shScale.toFixed(3) + ")";
    shadow.style.width = w * 0.82 + "px";
    shadow.style.opacity = (0.35 + depth * 0.45).toFixed(2);
  }

  var last = 0;
  function frame(t) {
    now = t;
    var dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;

    /* Zielverfolgung */
    var dx = targetX - x;
    var dDepth = targetDepth - depth;

    if (state === "dash") {
      speedFactor = 3.1;
      if (t > stateUntil || Math.abs(dx) < 0.012) {
        state = "wander";
        speedFactor = rand(0.8, 1.1);
        retargetAt = t + rand(1800, 3600);
      }
    } else if (state === "idle") {
      speedFactor = 0;
      if (t > stateUntil) { state = "wander"; speedFactor = rand(0.75, 1.2); }
    } else if (t > retargetAt || Math.abs(dx) < 0.008) {
      retarget();
    }

    /* Cursor-Nähe: vorsichtiges Anhalten */
    var cursorNear = Math.abs(mouse.x - x) < 0.09 && mouse.y > 0.55;
    var caution = cursorNear && state === "wander" ? 0.45 : 1;

    var maxStep = 0.062 * speedFactor * caution * dt;
    var step = clamp(dx, -maxStep, maxStep);
    x = clamp(x + step, 0.05, 0.95);
    depth = clamp(depth + clamp(dDepth, -0.035 * dt * 3, 0.035 * dt * 3), 0.28, 1);

    /* Richtung */
    if (Math.abs(dx) > 0.006) dir = dx > 0 ? 1 : -1;
    dirSmooth = lerp(dirSmooth, dir, 1 - Math.exp(-6 * dt));

    /* Gang-Bobbing */
    var speedNorm = Math.min(1, speedFactor / 1.3);
    bobPhase += dt * (5.5 + speedNorm * 7);

    render(dt);
    requestAnimationFrame(frame);
  }

  /* Cursor-Nähe: der Tiger wird vorsichtig */
  window.addEventListener("mousemove", function (e) {
    mouse.x = e.clientX / W; mouse.y = e.clientY / H;
  }, { passive: true });

  window.addEventListener("resize", resize);

  window.Tiger = {
    setAnchor: function (ax, ad) {
      anchor.x = clamp(ax, 0.05, 0.95);
      anchor.depth = clamp(ad, 0.28, 1);
      if (state !== "dash") {
        targetX = clamp(anchor.x + rand(-0.1, 0.1), 0.06, 0.94);
        targetDepth = clamp(anchor.depth + rand(-0.06, 0.06), 0.28, 1);
      }
    },
    dashTo: function (fx) {
      if (reduced) return;
      targetX = clamp(fx, 0.08, 0.92);
      targetDepth = clamp(Math.max(depth, 0.8), 0.28, 1);
      state = "dash";
      stateUntil = now + 1600;
      speedFactor = 3.1;
    },
    pulse: function () { pulseT = 0.6; },
    start: function () {
      resize();
      /* Aktive Sektion beim Start direkt bestimmen (IO feuert erst später) */
      var mid = window.innerHeight * 0.5;
      document.querySelectorAll(".section[data-tiger]").forEach(function (s) {
        var r = s.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) {
          var t = s.getAttribute("data-tiger").split(",");
          anchor.x = parseFloat(t[0]); anchor.depth = parseFloat(t[1]);
        }
      });
      x = anchor.x;
      depth = anchor.depth;
      if (reduced) {
        video.pause();
        render(0.016);
        return;
      }
      /* Autoplay-Absicherung */
      var tryPlay = function () { var p = video.play(); if (p && p.catch) p.catch(function () {}); };
      if (video.readyState >= 2) tryPlay();
      else video.addEventListener("loadeddata", tryPlay, { once: true });
      document.addEventListener("click", function onFirst() {
        tryPlay();
        document.removeEventListener("click", onFirst);
      });
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) video.pause();
        else tryPlay();
      });
      retarget();
      requestAnimationFrame(frame);
    }
  };
})();
