/* ============================================================
   jungle.js — Canvas-Atmosphäre: Glühwürmchen, Pollen, Blätter
   ============================================================ */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var backCanvas = document.getElementById("fx-back");
  var frontCanvas = document.getElementById("fx-front");
  var backCtx = backCanvas.getContext("2d");
  var frontCtx = frontCanvas.getContext("2d");

  var W = 0, H = 0, DPR = 1;
  var mouse = { x: 0.5, y: 0.5, px: -100, py: -100 };
  var fireflies = [], pollen = [], leaves = [], bursts = [];

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeGlowSprite(size, inner, outer) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.35, outer);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }
  var fireflySprite = makeGlowSprite(64, "rgba(255,240,170,1)", "rgba(255,190,60,0.35)");
  var pollenSprite = makeGlowSprite(32, "rgba(210,255,190,0.9)", "rgba(160,230,150,0.25)");
  var mistSprite = makeGlowSprite(256, "rgba(120,200,140,0.05)", "rgba(90,170,110,0.02)");

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    [backCanvas, frontCanvas].forEach(function (c) {
      c.width = W * DPR; c.height = H * DPR;
      c.getContext("2d").setTransform(DPR, 0, 0, DPR, 0, 0);
    });
  }

  var isSmall = function () { return W < 760; };
  var counts = function (n) { return reduced ? 0 : Math.round(n * (isSmall() ? 0.45 : 1)); };

  function spawnFirefly(init) {
    return {
      x: rand(0, W), y: rand(H * 0.25, H * 0.95),
      vx: rand(-8, 8), vy: rand(-6, 6),
      r: rand(1.2, 2.6),
      phase: rand(0, Math.PI * 2),
      blinkSpeed: rand(0.6, 1.6),
      drift: rand(0.4, 1.2)
    };
  }

  function spawnPollen(init) {
    return {
      x: rand(0, W), y: init ? rand(0, H) : -10,
      vx: rand(-4, 10), vy: rand(4, 14),
      r: rand(0.6, 1.8), alpha: rand(0.15, 0.5),
      sway: rand(0, Math.PI * 2)
    };
  }

  function spawnLeaf(init) {
    return {
      x: rand(0, W), y: init ? rand(0, H) : -30,
      vx: rand(6, 22), vy: rand(14, 30),
      size: rand(7, 15),
      rot: rand(0, Math.PI * 2),
      vr: rand(-1.4, 1.4),
      sway: rand(0, Math.PI * 2),
      swaySpeed: rand(0.8, 1.8),
      hue: rand(0, 1)
    };
  }

  function initParticles() {
    fireflies = []; pollen = []; leaves = [];
    var i, n;
    n = counts(34); for (i = 0; i < n; i++) fireflies.push(spawnFirefly(true));
    n = counts(50); for (i = 0; i < n; i++) pollen.push(spawnPollen(true));
    n = counts(9); for (i = 0; i < n; i++) leaves.push(spawnLeaf(true));
  }

  /* Blätter-Burst bei Klicks */
  function burst(x, y) {
    if (reduced) return;
    var i;
    for (i = 0; i < 14; i++) {
      var a = rand(0, Math.PI * 2), sp = rand(40, 190);
      bursts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        size: rand(3, 8), rot: rand(0, 6.28), vr: rand(-6, 6),
        life: 1, decay: rand(1.1, 2.0), warm: Math.random() < 0.6
      });
    }
  }

  function drawLeafShape(g, s, hue, warm) {
    g.beginPath();
    g.moveTo(0, -s);
    g.quadraticCurveTo(s * 0.9, -s * 0.2, 0, s);
    g.quadraticCurveTo(-s * 0.9, -s * 0.2, 0, -s);
    g.closePath();
    g.fillStyle = warm
      ? "rgba(214,158,64," + (0.75 * Math.max(0, arguments[3] || 1)) + ")"
      : "rgba(" + (60 + hue * 40 | 0) + "," + (130 + hue * 60 | 0) + ",70,0.8)";
    g.fill();
  }

  var last = 0;
  function frame(t) {
    var dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    var g;

    /* --- Hintergrund: Nebel + ferne Glühwürmchen --- */
    g = backCtx;
    g.clearRect(0, 0, W, H);
    var m0 = mistSprite;
    g.globalCompositeOperation = "lighter";
    var mistX1 = (W * 0.25) + Math.sin(t / 9000) * W * 0.1;
    var mistX2 = (W * 0.75) + Math.cos(t / 11000) * W * 0.12;
    g.drawImage(m0, mistX1 - 320, H * 0.62, 640, 360);
    g.drawImage(m0, mistX2 - 320, H * 0.5, 640, 360);
    var i, f, px, py, blink;
    for (i = 0; i < fireflies.length; i++) {
      f = fireflies[i];
      f.phase += dt * f.blinkSpeed;
      f.vx += Math.sin(t / 1300 + f.phase * 3) * 2 * dt;
      f.vy += Math.cos(t / 1700 + f.phase * 2) * 2 * dt;
      f.vx *= 0.995; f.vy *= 0.995;
      f.x += (f.vx + Math.sin(t / 900 + f.drift * 6) * 6) * dt;
      f.y += f.vy * dt;
      if (f.x < -20) f.x = W + 20; if (f.x > W + 20) f.x = -20;
      if (f.y < H * 0.15) f.y = H * 0.95; if (f.y > H + 20) f.y = H * 0.2;
      blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(f.phase * 2.2));
      px = f.x + (mouse.x - 0.5) * 14 * f.drift;
      py = f.y + (mouse.y - 0.5) * 10 * f.drift;
      g.globalAlpha = blink * 0.85;
      var s = f.r * 10;
      g.drawImage(fireflySprite, px - s / 2, py - s / 2, s, s);
    }

    /* --- Vordergrund: Pollen + Blätter + Bursts --- */
    g = frontCtx;
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = "lighter";
    for (i = 0; i < pollen.length; i++) {
      f = pollen[i];
      f.sway += dt * 1.4;
      f.x += (f.vx + Math.sin(f.sway) * 8) * dt;
      f.y += f.vy * dt;
      if (f.y > H + 12) { pollen[i] = spawnPollen(false); continue; }
      if (f.x > W + 12) f.x = -12;
      g.globalAlpha = f.alpha * (0.6 + 0.4 * Math.sin(f.sway * 2));
      var ps = f.r * 7;
      g.drawImage(pollenSprite, f.x - ps / 2, f.y - ps / 2, ps, ps);
    }
    g.globalCompositeOperation = "source-over";
    for (i = 0; i < leaves.length; i++) {
      f = leaves[i];
      f.sway += dt * f.swaySpeed;
      f.rot += f.vr * dt;
      f.x += (f.vx + Math.sin(f.sway) * 16) * dt;
      f.y += (f.vy + Math.cos(f.sway * 0.7) * 8) * dt;
      if (f.y > H + 30) { leaves[i] = spawnLeaf(false); continue; }
      if (f.x > W + 30) f.x = -30;
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.rot + Math.sin(f.sway) * 0.5);
      g.globalAlpha = 0.75;
      drawLeafShape(g, f.size, f.hue);
      g.restore();
    }
    for (i = bursts.length - 1; i >= 0; i--) {
      f = bursts[i];
      f.life -= dt * f.decay;
      if (f.life <= 0) { bursts.splice(i, 1); continue; }
      f.vy += 240 * dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.rot += f.vr * dt;
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.rot);
      g.globalAlpha = Math.max(0, f.life);
      drawLeafShape(g, f.size, 0, f.warm, f.life);
      g.restore();
    }
    g.globalAlpha = 1;

    requestAnimationFrame(frame);
  }

  window.addEventListener("mousemove", function (e) {
    mouse.x = e.clientX / W; mouse.y = e.clientY / H;
    mouse.px = e.clientX; mouse.py = e.clientY;
  }, { passive: true });

  window.addEventListener("resize", function () { resize(); initParticles(); });

  window.Jungle = {
    burst: burst,
    mouse: mouse,
    reduced: reduced,
    start: function () {
      resize();
      initParticles();
      if (!reduced) requestAnimationFrame(frame);
      else {
        /* statisches Standbild für reduzierte Bewegung */
        backCtx.clearRect(0, 0, W, H);
        frontCtx.clearRect(0, 0, W, H);
      }
    }
  };
})();
