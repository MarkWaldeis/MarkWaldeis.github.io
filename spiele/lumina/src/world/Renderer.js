/* ==========================================================================
   LUMINA CANVAS RENDERER - Parallax, Bloom Lights, Hero Graphics & Glass HUD
   ========================================================================== */

class LuminaRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.w = canvas.width;
    this.h = canvas.height;
    this.TAU = Math.PI * 2;

    this.palettes = [
      // Zone 0: Grove (Bioluminescent Neon & Forest Night)
      { skyTop: "#081226", skyBottom: "#132c44", far: "#0f3248", mid: "#094a4c", near: "#005c53", sun: "#00f2fe" },
      // Zone 1: Cavern (Abyssal Amethyst & Deep Cyan)
      { skyTop: "#120826", skyBottom: "#28154a", far: "#351a5c", mid: "#2c1c68", near: "#1b245e", sun: "#d946ef" },
      // Zone 2: Citadel (Celestial Gold & Violet Nebula)
      { skyTop: "#1a0f2e", skyBottom: "#431f4e", far: "#4a2456", mid: "#5b2658", near: "#3a194c", sun: "#ffd200" }
    ];
  }

  // --- Color helpers ----------------------------------------------------
  hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  lerpColor(a, b, t) {
    const ca = this.hexToRgb(a);
    const cb = this.hexToRgb(b);
    const r = Math.round(ca.r + (cb.r - ca.r) * t);
    const g = Math.round(ca.g + (cb.g - ca.g) * t);
    const bl = Math.round(ca.b + (cb.b - ca.b) * t);
    return `rgb(${r}, ${g}, ${bl})`;
  }

  // Accepts "#rrggbb" or "rgb(r, g, b)" and returns an rgba() string
  withAlpha(color, alpha) {
    if (color[0] === "#") {
      const c = this.hexToRgb(color);
      return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
    }
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }

  // Blend between the three biome palettes along the seamless zone axis
  getBlendedPalette(blend) {
    if (blend >= 2) return this.palettes[2];
    const i0 = blend <= 1 ? 0 : 1;
    const t = blend - i0;
    const A = this.palettes[i0];
    const B = this.palettes[i0 + 1];
    const out = {};
    for (const k of ["skyTop", "skyBottom", "far", "mid", "near", "sun"]) {
      out[k] = this.lerpColor(A[k], B[k], t);
    }
    return out;
  }

  render(engine) {
    const ctx = this.ctx;
    const state = engine.state;
    const camera = engine.camera;
    const level = engine.level;
    const time = state.time;

    // Seamless biome blending keyed on the camera's view center
    const blend = level.getZoneBlend(camera.x + this.w * 0.5);
    const pal = this.getBlendedPalette(blend);

    // Clear Canvas
    ctx.clearRect(0, 0, this.w, this.h);

    // 1. Parallax Sky, Stars, Orb, Clouds & Biome Atmosphere (screen space)
    this.drawSky(pal, blend, camera, time);
    this.drawClouds(level.clouds, pal, camera, time);
    this.drawBackAtmosphere(pal, blend, camera, time);

    // 2. Camera Translation & Shake
    ctx.save();
    const shakeOffset = camera.getShakeOffset();
    ctx.translate(-Math.round(camera.x) + shakeOffset.x, shakeOffset.y);

    // 3. World Elements
    this.drawPits(level.pits, camera, time);
    this.drawDecorations(level.decorations, camera, time);
    this.drawGeysers(level.geysers, time);
    this.drawPlatforms(level.platforms, camera, time);
    this.drawBouncePads(level.bouncePads, time);
    this.drawCheckpoints(level.checkpoints, time);
    this.drawGoal(level.goal, time, state.cores);
    this.drawCollectibles(level.collectibles, camera);

    // 4. Entities
    this.drawEnemies(engine.enemies, camera, time);
    this.drawBoss(engine.boss, time);
    this.drawPlayer(engine.player, time);

    // 5. Particles & Bloom Lights
    this.drawParticles(engine.particles);

    ctx.restore();

    // 6. Screen-space Foreground: cavern ceiling, vignette
    this.drawCaveCeiling(blend, camera, time);
    this.drawVignette(blend);

    // 7. Cinematic Biome Banner + Glass HUD
    if (state.mode === "playing" || state.mode === "paused") {
      this.drawZoneBanner(level);
    }
    if (state.mode === "playing") {
      this.drawHUD(engine);
    }
  }

  drawSky(pal, blend, camera, time) {
    const ctx = this.ctx;

    // Cosmic Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.h);
    skyGrad.addColorStop(0, pal.skyTop);
    skyGrad.addColorStop(1, pal.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.w, this.h);

    // Twinkling starfield (deterministic positions, cheap)
    for (let i = 0; i < 60; i++) {
      const sx = (i * 197.31) % this.w;
      const sy = (i * 89.77) % 390;
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 1.8 + i * 1.71));
      ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * tw})`;
      const s = i % 6 === 0 ? 2 : 1;
      ctx.fillRect(sx, sy, s, s);
    }

    // Celestial Ring / Orb (drifts upward-right toward the citadel)
    const citW = LuminaMath.clamp(blend - 1, 0, 1);
    const orbX = 960 + citW * 80;
    const orbY = 100 + citW * 30;
    const glow = ctx.createRadialGradient(orbX, orbY, 10, orbX, orbY, 150);
    glow.addColorStop(0, pal.sun);
    glow.addColorStop(0.35, this.withAlpha(pal.sun, 0.27));
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(orbX - 160, orbY - 160, 320, 320);

    // Planet Orb
    ctx.fillStyle = pal.sun;
    ctx.beginPath();
    ctx.arc(orbX, orbY, 36, 0, this.TAU);
    ctx.fill();

    // Citadel orbit ring
    if (citW > 0.05) {
      ctx.save();
      ctx.globalAlpha = citW * 0.8;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(orbX, orbY, 62, 16, -0.35, 0, this.TAU);
      ctx.stroke();
      ctx.restore();
    }

    // Distant Parallax Mountain Horizons
    this.drawMountainLayer(pal.far, 0.12, 450, 110, 780, camera);
    this.drawMountainLayer(pal.mid, 0.22, 520, 85, 540, camera);
    this.drawMountainLayer(pal.near, 0.35, 570, 65, 380, camera);
  }

  drawMountainLayer(color, depth, baseY, amplitude, period, camera) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, this.h);
    const offset = (camera.x * depth) % period;

    for (let x = -period; x <= this.w + period; x += period / 3) {
      const px = x - offset;
      const peak = baseY - amplitude * (0.6 + 0.4 * Math.sin((x + camera.x * depth) * 0.006));
      ctx.quadraticCurveTo(px + period / 6, peak - amplitude, px + period / 3, baseY);
    }
    ctx.lineTo(this.w, this.h);
    ctx.closePath();
    ctx.fill();
  }

  drawClouds(clouds, pal, camera, time) {
    const ctx = this.ctx;
    for (const c of clouds) {
      const px = c.x - camera.x * (0.15 + c.depth) + Math.sin(time * 0.12 + c.x * 0.01) * 10;
      if (px < -240 || px > this.w + 240) continue;

      ctx.save();
      ctx.translate(px, c.y);
      ctx.scale(c.size, c.size * 0.7);
      ctx.fillStyle = this.withAlpha(pal.near, 0.55);
      ctx.beginPath();
      ctx.arc(0, 0, 46, 0, this.TAU);
      ctx.arc(38, 8, 34, 0, this.TAU);
      ctx.arc(-40, 10, 30, 0, this.TAU);
      ctx.fill();
      // moonlit crown
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      ctx.beginPath();
      ctx.arc(-8, -14, 40, 0, this.TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // Biome flavor painted behind the world (screen space, parallaxed)
  drawBackAtmosphere(pal, blend, camera, time) {
    const ctx = this.ctx;
    const groveW = LuminaMath.clamp(1 - blend, 0, 1);
    const citadelW = LuminaMath.clamp(blend - 1, 0, 1);

    // GROVE: slanting god-rays through the canopy
    if (groveW > 0.02) {
      ctx.save();
      ctx.globalAlpha = 0.07 * groveW;
      ctx.fillStyle = "#a7f3d0";
      for (let i = 0; i < 4; i++) {
        const rx = (((i * 470 - camera.x * 0.28) % 1700) + 1700) % 1700 - 300;
        const wobble = Math.sin(time * 0.3 + i * 2.1) * 30;
        ctx.beginPath();
        ctx.moveTo(rx + wobble, -60);
        ctx.lineTo(rx + 90 + wobble, -60);
        ctx.lineTo(rx + 330 + wobble, this.h + 40);
        ctx.lineTo(rx + 190 + wobble, this.h + 40);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // CITADEL: aurora ribbons + floating spire silhouettes
    if (citadelW > 0.02) {
      ctx.save();
      ctx.globalAlpha = 0.1 * citadelW;
      for (let band = 0; band < 2; band++) {
        ctx.strokeStyle = band === 0 ? "#00f5a0" : "#d946ef";
        ctx.lineWidth = 26 - band * 8;
        ctx.beginPath();
        for (let x = 0; x <= this.w; x += 32) {
          const y = 90 + band * 64 + Math.sin((x + camera.x * 0.2) * 0.008 + time * 0.7 + band * 2) * 26;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Distant floating citadel towers with lit windows
      for (let i = 0; i < 5; i++) {
        const sx = (((i * 640 - camera.x * 0.34) % 2700) + 2700) % 2700 - 320;
        const baseY = 430 + (i % 3) * 60;
        const bob = Math.sin(time * 0.5 + i * 1.9) * 6;
        ctx.fillStyle = this.withAlpha(pal.far, 0.9);
        ctx.fillRect(sx, baseY - 120 + bob, 46, 120);
        ctx.beginPath();
        ctx.moveTo(sx - 8, baseY - 120 + bob);
        ctx.lineTo(sx + 23, baseY - 170 + bob);
        ctx.lineTo(sx + 54, baseY - 120 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255, 210, 0, 0.5)";
        for (let wIdx = 0; wIdx < 3; wIdx++) {
          ctx.fillRect(sx + 9 + wIdx * 13, baseY - 92 + bob, 4, 6);
        }
      }
      ctx.restore();
    }
  }

  // Foreground cavern ceiling with hanging glow crystals (caverns only)
  drawCaveCeiling(blend, camera, time) {
    const w = LuminaMath.clamp(1 - Math.abs(blend - 1), 0, 1);
    if (w <= 0.02) return;
    const ctx = this.ctx;
    const off = camera.x * 0.55;

    ctx.save();
    ctx.globalAlpha = w;

    // Jagged rock fringe hanging from the top of the screen
    ctx.fillStyle = "#0a0618";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= this.w + 40; x += 40) {
      const spike = 24 + 40 * (0.5 + 0.5 * Math.sin((x + off) * 0.021) * Math.sin((x + off) * 0.0073 + 2));
      ctx.lineTo(x + 20, spike);
      ctx.lineTo(x + 40, 0);
    }
    ctx.lineTo(this.w, 0);
    ctx.closePath();
    ctx.fill();

    // Hanging twinkling crystals
    for (let i = 0; i < 7; i++) {
      const cx = (((i * 233 - off) % 1400) + 1400) % 1400 - 60;
      const cy = 28 + 16 * Math.sin(i * 3.7);
      const tw = 0.5 + 0.5 * Math.sin(time * 3 + i * 2.4);
      ctx.fillStyle = `rgba(216, 180, 254, ${0.55 * w * tw})`;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 5, cy + 12);
      ctx.lineTo(cx, cy + 22);
      ctx.lineTo(cx - 5, cy + 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawVignette(blend) {
    const cavernW = LuminaMath.clamp(1 - Math.abs(blend - 1), 0, 1);
    const strength = 0.16 + cavernW * 0.22;
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.45, this.w / 2, this.h / 2, this.h * 0.95);
    g.addColorStop(0, "rgba(0, 0, 0, 0)");
    g.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  // Deadly chasms: dark abyss, pulsing warning rims, rising embers
  drawPits(pits, camera, time) {
    const ctx = this.ctx;
    const floorY = 610;
    for (const p of pits) {
      if (p.x + p.w < camera.x - 60 || p.x > camera.x + this.w + 60) continue;

      // Abyss body
      const g = ctx.createLinearGradient(0, floorY, 0, this.h);
      g.addColorStop(0, "rgba(6, 8, 20, 0.55)");
      g.addColorStop(1, "rgba(2, 0, 8, 0.95)");
      ctx.fillStyle = g;
      ctx.fillRect(p.x, floorY, p.w, this.h - floorY + 20);

      // Danger glow rising from the bottom
      const pulse = 0.2 + 0.1 * Math.sin(time * 3 + p.x * 0.05);
      const glow = ctx.createLinearGradient(0, this.h - 60, 0, this.h);
      glow.addColorStop(0, "rgba(255, 51, 102, 0)");
      glow.addColorStop(1, `rgba(255, 51, 102, ${pulse})`);
      ctx.fillStyle = glow;
      ctx.fillRect(p.x, this.h - 60, p.w, 60);

      // Warning rims on both lips of the chasm
      ctx.fillStyle = `rgba(255, 51, 102, ${0.5 + 0.35 * Math.sin(time * 5 + p.x)})`;
      ctx.fillRect(p.x - 3, floorY - 2, 7, 5);
      ctx.fillRect(p.x + p.w - 4, floorY - 2, 7, 5);

      // Rising danger embers
      for (let i = 0; i < 3; i++) {
        const ex = p.x + 12 + (i * (p.w - 24)) / 2 + Math.sin(time * 2 + i * 9 + p.x) * 6;
        const ey = this.h - ((time * 46 + i * 47 + p.x) % 100);
        const ea = 1 - (this.h - ey) / 110;
        if (ea > 0) {
          ctx.fillStyle = `rgba(255, 120, 90, ${ea * 0.6})`;
          ctx.fillRect(ex, ey, 3, 3);
        }
      }
    }
  }

  drawDecorations(decorations, camera, time) {
    const ctx = this.ctx;
    for (const d of decorations) {
      if (d.x < camera.x - 100 || d.x > camera.x + this.w + 100) continue;

      ctx.save();
      ctx.translate(d.x, 610);
      ctx.scale(d.size, d.size);

      if (d.zone === 0) {
        // Neon Spore Mushroom (gentle bob + glow halo)
        const bob = Math.sin(time * 2 + d.x * 0.1) * 2;
        ctx.fillStyle = "rgba(0, 245, 160, 0.12)";
        ctx.beginPath();
        ctx.arc(0, -22 + bob, 26, 0, this.TAU);
        ctx.fill();
        ctx.fillStyle = d.variant === 1 ? "#00f2fe" : "#00f5a0";
        ctx.beginPath();
        ctx.arc(0, -22 + bob, 16, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#0c1d2e";
        ctx.fillRect(-3, -22 + bob, 6, 22);
        ctx.fillStyle = "#ffffff88";
        ctx.beginPath();
        ctx.arc(-5, -26 + bob, 3, 0, this.TAU);
        ctx.arc(6, -24 + bob, 2.5, 0, this.TAU);
        ctx.fill();
      } else if (d.zone === 1) {
        // Crystal Cluster Spire (twinkling)
        const tw = 0.75 + 0.25 * Math.sin(time * 3 + d.x * 0.2);
        ctx.fillStyle = "rgba(168, 85, 247, 0.15)";
        ctx.beginPath();
        ctx.arc(0, -22, 30, 0, this.TAU);
        ctx.fill();
        ctx.globalAlpha = tw;
        ctx.fillStyle = d.variant === 1 ? "#d946ef" : "#38bdf8";
        ctx.beginPath();
        ctx.moveTo(0, -45);
        ctx.lineTo(12, -10);
        ctx.lineTo(5, 0);
        ctx.lineTo(-8, -6);
        ctx.lineTo(-12, -28);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.fillRect(-2, -38, 3, 3);
      } else {
        // Celestial Rune Pylon (rotating orbit ring)
        ctx.fillStyle = "#ffd200";
        ctx.fillRect(-3, -50, 6, 50);
        ctx.fillStyle = "#ff9900";
        ctx.beginPath();
        ctx.arc(0, -56, 8, 0, this.TAU);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 210, 0, 0.65)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -56, 13, time * 1.6 + d.x, time * 1.6 + d.x + Math.PI * 1.3);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawPlatforms(platforms, camera, time) {
    const ctx = this.ctx;
    for (const p of platforms) {
      if (p.x + p.w < camera.x - 50 || p.x > camera.x + this.w + 50) continue;

      ctx.save();
      if (p.style === "grove") {
        // Cyber-Grove Platform
        ctx.fillStyle = "#0c1d2e";
        this.drawRoundedRect(ctx, p.x, p.y, p.w, p.h, 10);
        ctx.fill();

        // Glowing Moss Top (soft pulse)
        ctx.fillStyle = "#00f5a0";
        this.drawRoundedRect(ctx, p.x - 2, p.y - 4, p.w + 4, 10, 5);
        ctx.fill();

        ctx.fillStyle = `rgba(0, 242, 254, ${0.7 + 0.3 * Math.sin(time * 2 + p.x * 0.04)})`;
        ctx.fillRect(p.x + 8, p.y - 4, p.w - 16, 3);

        // Swaying light-grass tufts
        ctx.strokeStyle = "#00f5a0";
        ctx.lineWidth = 2;
        for (let gx = p.x + 14; gx < p.x + p.w - 10; gx += 46) {
          const sway = Math.sin(time * 2.4 + gx * 0.1) * 2;
          ctx.beginPath();
          ctx.moveTo(gx, p.y - 4);
          ctx.lineTo(gx + sway, p.y - 13 - (gx % 3));
          ctx.stroke();
        }
      } else if (p.style === "crystal") {
        // Amethyst Crystal Platform
        ctx.fillStyle = "#1e1138";
        this.drawRoundedRect(ctx, p.x, p.y, p.w, p.h, 8);
        ctx.fill();

        // Crystal Edge Glow
        ctx.fillStyle = "#a855f7";
        ctx.fillRect(p.x, p.y - 3, p.w, 7);
        ctx.fillStyle = "#e879f9";
        ctx.fillRect(p.x + 6, p.y - 3, p.w - 12, 3);

        // Small shard spikes along the top edge
        for (let sx = p.x + 18; sx < p.x + p.w - 14; sx += 52) {
          const hgt = 8 + ((sx * 7) % 9);
          ctx.beginPath();
          ctx.moveTo(sx, p.y - 3);
          ctx.lineTo(sx + 5, p.y - 3 - hgt);
          ctx.lineTo(sx + 10, p.y - 3);
          ctx.closePath();
          ctx.fill();
        }

        // Inner energy pulse
        ctx.fillStyle = `rgba(168, 85, 247, ${0.22 + 0.2 * Math.sin(time * 2.2 + p.x * 0.04)})`;
        ctx.fillRect(p.x + 4, p.y + 10, p.w - 8, 4);
      } else {
        // Celestial Citadel Platform
        ctx.fillStyle = "#2a1e38";
        this.drawRoundedRect(ctx, p.x, p.y, p.w, p.h, 12);
        ctx.fill();

        // Golden Neon Inlay
        ctx.fillStyle = "#ffd200";
        ctx.fillRect(p.x, p.y - 3, p.w, 8);
        ctx.fillStyle = "#fff";
        ctx.fillRect(p.x + 10, p.y - 3, p.w - 20, 2);

        // Chrono-rune glyphs
        ctx.fillStyle = `rgba(255, 210, 0, ${0.45 + 0.3 * Math.sin(time * 3 + p.x * 0.06)})`;
        for (let rx = p.x + 20; rx < p.x + p.w - 16; rx += 60) {
          ctx.fillRect(rx, p.y + 12, 8, 3);
          ctx.fillRect(rx + 2.5, p.y + 8, 3, 11);
        }
      }
      ctx.restore();
    }
  }

  drawBouncePads(bouncePads, time) {
    const ctx = this.ctx;
    for (const b of bouncePads) {
      const pulse = Math.sin(time * 6) * 3;
      ctx.save();
      ctx.translate(b.x + b.w / 2, b.y + b.h);

      // Base
      ctx.fillStyle = "#122a44";
      ctx.fillRect(-16, -14, 32, 14);

      // Springy Cap
      ctx.fillStyle = "#00f5a0";
      ctx.beginPath();
      ctx.ellipse(0, -18 + pulse, 22, 10, 0, 0, this.TAU);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(0, -20 + pulse, 12, 5, 0, 0, this.TAU);
      ctx.fill();

      // Upward hint sparkles so players notice the launch pad
      for (let i = 0; i < 2; i++) {
        const sy = -34 - ((time * 40 + i * 30 + b.x) % 40);
        ctx.fillStyle = `rgba(0, 245, 160, ${0.6 - (-34 - sy) / 70})`;
        ctx.fillRect(-8 + i * 16, sy, 3, 6);
      }

      ctx.restore();
    }
  }

  drawGeysers(geysers, time) {
    const ctx = this.ctx;
    for (const g of geysers) {
      ctx.save();
      const wave = Math.sin(time * 8 + g.x) * 8;
      const grad = ctx.createLinearGradient(0, g.y, 0, g.y - g.h);
      grad.addColorStop(0, "rgba(56, 189, 248, 0.45)");
      grad.addColorStop(1, "rgba(56, 189, 248, 0.0)");

      ctx.fillStyle = grad;
      ctx.fillRect(g.x + wave, g.y - g.h, g.w, g.h);

      // Wind stream lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const streamX = g.x + 10 + i * 16 + wave;
        const streamY = g.y - ((time * 240 + i * 80) % g.h);
        ctx.beginPath();
        ctx.moveTo(streamX, streamY);
        ctx.lineTo(streamX, streamY - 25);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawCollectibles(collectibles, camera) {
    const ctx = this.ctx;
    for (const item of collectibles) {
      if (item.collected || item.x < camera.x - 40 || item.x > camera.x + this.w + 40) continue;

      const bob = Math.sin(item.phase) * 6;
      ctx.save();
      ctx.translate(item.x + item.w / 2, item.y + item.h / 2 + bob);

      if (item.type === "shard") {
        // Chrono-Shard (Spinning Diamond Crystal)
        const spin = Math.cos(item.phase);
        ctx.scale(Math.abs(spin) * 0.75 + 0.25, 1);
        ctx.fillStyle = "#ffd200";
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, 0);
        ctx.lineTo(0, 12);
        ctx.lineTo(-10, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(5, 0);
        ctx.lineTo(0, 8);
        ctx.lineTo(-5, 0);
        ctx.closePath();
        ctx.fill();
      } else if (item.type === "relic") {
        // Ancient Aether Core (Glowing Star with Orbiting Rings)
        ctx.shadowColor = "#00f2fe";
        ctx.shadowBlur = 24;

        ctx.rotate(item.phase * 0.5);
        ctx.fillStyle = "#00f2fe";
        this.drawStarPath(ctx, 0, 0, 18, 8, 6);
        ctx.fill();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, this.TAU);
        ctx.stroke();

        ctx.shadowBlur = 0;
      } else if (item.type === "heart") {
        // Cyber Heart
        ctx.fillStyle = "#ff3366";
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.bezierCurveTo(-18, 0, -14, -14, 0, -6);
        ctx.bezierCurveTo(14, -14, 18, 0, 0, 12);
        ctx.fill();
      } else if (item.type === "shield") {
        // Shield Orb
        ctx.fillStyle = "rgba(0, 242, 254, 0.4)";
        ctx.strokeStyle = "#00f2fe";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, this.TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawCheckpoints(checkpoints, time) {
    const ctx = this.ctx;
    for (const cp of checkpoints) {
      ctx.save();
      ctx.translate(cp.x, cp.y); // cp.y = ground line

      // Rising light pillar once activated
      if (cp.active) {
        const beam = ctx.createLinearGradient(0, -440, 0, -110);
        beam.addColorStop(0, "rgba(0, 245, 160, 0)");
        beam.addColorStop(1, `rgba(0, 245, 160, ${0.2 + 0.08 * Math.sin(time * 4)})`);
        ctx.fillStyle = beam;
        ctx.fillRect(-8, -440, 30, 330);
      }

      // Obelisk body standing on the ground
      ctx.fillStyle = "#1e293b";
      this.drawRoundedRect(ctx, 0, -110, 14, 110, 4);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(-5, -8, 24, 8);

      // Rune etchings
      ctx.fillStyle = cp.active ? "rgba(0, 245, 160, 0.85)" : "rgba(100, 116, 139, 0.6)";
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(4, -96 + i * 26, 6, 3);
      }

      // Glowing Rune Beacon
      const glow = cp.active ? "#00f5a0" : "#64748b";
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(7, -122, cp.active ? 13 : 8, 0, this.TAU);
      ctx.fill();

      if (cp.active) {
        ctx.strokeStyle = "rgba(0, 245, 160, 0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(7, -122, 20 + Math.sin(time * 6) * 4, 0, this.TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawGoal(goal, time, cores) {
    if (!goal) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(goal.x, goal.y);

    // 5 Aether-Core sockets glowing above the arch
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < cores ? "#00f2fe" : "rgba(255, 255, 255, 0.18)";
      this.drawStarPath(ctx, 18 + i * 19, -16, 7, 3.4, 5);
      ctx.fill();
    }

    // Archway Frame
    ctx.fillStyle = "#1a1c2e";
    this.drawRoundedRect(ctx, 0, 0, goal.w, goal.h, 40);
    ctx.fill();

    // Portal Vortex
    const vortexGrad = ctx.createRadialGradient(goal.w / 2, goal.h / 2, 5, goal.w / 2, goal.h / 2, 70);
    vortexGrad.addColorStop(0, goal.open ? "#ffd200" : "#0f172a");
    vortexGrad.addColorStop(0.7, goal.open ? "#00f2fe" : "#1e293b");
    vortexGrad.addColorStop(1, "transparent");

    ctx.fillStyle = vortexGrad;
    this.drawRoundedRect(ctx, 12, 16, goal.w - 24, goal.h - 24, 30);
    ctx.fill();

    // Rotating energy arcs once the seal is open
    if (goal.open) {
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(0, 242, 254, ${0.55 - i * 0.13})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(goal.w / 2, goal.h / 2, 18 + i * 15, time * (1 + i * 0.35), time * (1 + i * 0.35) + Math.PI * 1.25);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawEnemies(enemySystem, camera, time) {
    const ctx = this.ctx;
    for (const e of enemySystem.list) {
      if (e.x + e.w < camera.x - 80 || e.x > camera.x + this.w + 80) continue;

      ctx.save();
      ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
      ctx.scale(e.direction || 1, 1);

      if (!e.alive) {
        const t = LuminaMath.clamp(e.dyingTimer / 0.45, 0, 1);
        ctx.scale(1 + (1 - t) * 0.6, t);
        ctx.globalAlpha = t;
      }

      if (e.type === "sprout") {
        // Bioluminescent Sprout (breathing squash + shuffle)
        const sq = 1 + Math.sin(e.phase) * 0.07;
        ctx.scale(1 / sq, sq);
        ctx.fillStyle = "#00f5a0";
        ctx.beginPath();
        ctx.ellipse(0, 4, 18, 15, 0, 0, this.TAU);
        ctx.fill();

        ctx.fillStyle = "#00f2fe";
        ctx.beginPath();
        ctx.arc(-6, -10, 8, 0, this.TAU);
        ctx.arc(6, -10, 8, 0, this.TAU);
        ctx.fill();
        // glowing eyes
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(-6, -10, 2.5, 0, this.TAU);
        ctx.arc(6, -10, 2.5, 0, this.TAU);
        ctx.fill();
      } else if (e.type === "crawler") {
        // Armored Shock-Crawler (ticking legs, hot eye when charging)
        ctx.strokeStyle = "#b45309";
        ctx.lineWidth = 3;
        for (let i = -1; i <= 1; i++) {
          const legSwing = Math.sin(e.phase * 3 + i * 1.3) * 4;
          ctx.beginPath();
          ctx.moveTo(i * 10, 8);
          ctx.lineTo(i * 10 + legSwing, 18);
          ctx.stroke();
        }
        ctx.fillStyle = "#ff9900";
        ctx.beginPath();
        ctx.ellipse(0, 4, 22, 14, 0, 0, this.TAU);
        ctx.fill();

        const charging = Math.abs(e.vx) > 100;
        ctx.fillStyle = charging ? "#ff3366" : "#ff8899";
        ctx.beginPath();
        ctx.arc(14, 0, charging ? 7 : 6, 0, this.TAU);
        ctx.fill();
      } else if (e.type === "wisp") {
        // Volt-Wisp (pulsing orb + orbiting spark)
        const pulseR = 18 + Math.sin(e.phase * 2) * 2.5;
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#7dd3fc";
        ctx.beginPath();
        ctx.arc(0, 0, pulseR, 0, this.TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, this.TAU);
        ctx.fill();
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.arc(Math.cos(e.phase * 2.4) * 24, Math.sin(e.phase * 2.4) * 24, 3.5, 0, this.TAU);
        ctx.fill();
      } else if (e.type === "sentry") {
        // Shield-Knight
        ctx.fillStyle = "#334155";
        this.drawRoundedRect(ctx, -18, -25, 36, 50, 8);
        ctx.fill();
        ctx.fillStyle = "#ffd200";
        ctx.fillRect(-12, -18, 8, 4); // visor slit

        // Energy Shield (shimmering)
        ctx.fillStyle = `rgba(0, 242, 254, ${0.55 + 0.25 * Math.sin(e.phase * 2)})`;
        ctx.fillRect(16, -20, 8, 40);
        ctx.strokeStyle = "rgba(0, 242, 254, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(16, -20, 8, 40);
      } else if (e.type === "drone") {
        // Chrono-Drone (spinning rotor + laser charge telegraph)
        const ct = LuminaMath.clamp(e.chargeTimer / 1.2, 0, 1);
        if (ct > 0.02) {
          ctx.fillStyle = `rgba(255, 51, 102, ${0.28 * ct})`;
          ctx.beginPath();
          ctx.arc(0, 0, 20 + ct * 18, 0, this.TAU);
          ctx.fill();
        }
        ctx.fillStyle = "#475569";
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, this.TAU);
        ctx.fill();

        // Rotor blur
        ctx.strokeStyle = "rgba(148, 163, 184, 0.7)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, -20, 16, 4, Math.sin(e.phase * 6) * 0.35, 0, this.TAU);
        ctx.stroke();

        // Laser Eye — flares brighter while charging
        ctx.fillStyle = ct > 0.5 ? "#ffccd5" : "#ff3366";
        ctx.beginPath();
        ctx.arc(e.direction > 0 ? 8 : -8, 0, 6 + ct * 2, 0, this.TAU);
        ctx.fill();
      }

      ctx.restore();
    }

    // Render Projectiles
    for (const p of enemySystem.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, this.TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 0.4, 0, this.TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  drawBoss(boss, time) {
    if (!boss.alive && boss.dyingTimer <= 0) return;
    const ctx = this.ctx;

    // Jump-Slam landing telegraph — marked before the boss transform
    if (boss.alive && boss.currentAttack === "jump_slam" && !boss.grounded) {
      ctx.save();
      ctx.translate(boss.slamTargetX, 610);
      const pulse = 0.55 + 0.35 * Math.sin(time * 10);
      ctx.fillStyle = `rgba(155, 81, 224, ${0.22 * pulse})`;
      ctx.beginPath();
      ctx.ellipse(0, -4, 92, 13, 0, 0, this.TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(217, 70, 239, ${0.85 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -4, 92, 13, 0, 0, this.TAU);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    const bob = boss.alive ? Math.sin(boss.animTime * 0.5) * 4 : 0;
    ctx.translate(boss.x + boss.w / 2, boss.y + boss.h / 2 + bob);
    ctx.scale(boss.facing, 1);

    if (!boss.alive) {
      ctx.globalAlpha = LuminaMath.clamp(boss.dyingTimer / 1.8, 0, 1);
    }

    // Phase aura (intensifies as the fight escalates)
    const auraColor = boss.phase === 3 ? "#ff3366" : boss.phase === 2 ? "#d946ef" : "#ffd200";
    ctx.fillStyle = this.withAlpha(auraColor, 0.09 + 0.04 * Math.sin(time * 6));
    ctx.beginPath();
    ctx.arc(0, 0, 80 + Math.sin(time * 4) * 5, 0, this.TAU);
    ctx.fill();

    // Boss Core Body (Titan)
    ctx.fillStyle = "#1e1b4b";
    this.drawRoundedRect(ctx, -50, -50, 100, 100, 24);
    ctx.fill();

    // Glowing Overlord Crown
    ctx.fillStyle = auraColor;
    ctx.beginPath();
    ctx.moveTo(-45, -50);
    ctx.lineTo(-60, -85);
    ctx.lineTo(-20, -65);
    ctx.lineTo(0, -95);
    ctx.lineTo(20, -65);
    ctx.lineTo(60, -85);
    ctx.lineTo(45, -50);
    ctx.closePath();
    ctx.fill();

    // Central Core Eye with tracking pupil
    ctx.fillStyle = "#00f2fe";
    ctx.beginPath();
    ctx.arc(0, -10, 22, 0, this.TAU);
    ctx.fill();
    ctx.fillStyle = "#081226";
    ctx.beginPath();
    ctx.arc(6, -10, 10, 0, this.TAU);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(9, -13, 3, 0, this.TAU);
    ctx.fill();

    // Laser Sweep: warning telegraph -> live layered beam
    if (boss.laserActive && boss.laserWarn) {
      // Blinking dashed aim line along the future beam path
      const blink = 0.35 + 0.3 * Math.sin(time * 30);
      ctx.strokeStyle = `rgba(255, 51, 102, ${blink})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.moveTo(24, -3);
      ctx.lineTo(620, -3);
      ctx.stroke();
      ctx.setLineDash([]);

      // Charging flare inside the eye
      ctx.fillStyle = `rgba(255, 51, 102, ${0.45 + 0.3 * Math.sin(time * 30)})`;
      ctx.beginPath();
      ctx.arc(0, -10, 15 + Math.sin(time * 30) * 3, 0, this.TAU);
      ctx.fill();
    } else if (boss.laserActive) {
      // Live beam: outer glow -> hot core -> white center
      ctx.fillStyle = "rgba(255, 51, 102, 0.25)";
      ctx.fillRect(20, -29, 600, 52);
      ctx.fillStyle = "rgba(255, 51, 102, 0.8)";
      ctx.fillRect(20, -19, 600, 32);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(20, -6, 600, 6);

      // Muzzle flare
      ctx.fillStyle = "#ff3366";
      ctx.beginPath();
      ctx.arc(24, -3, 15 + Math.sin(time * 40) * 3, 0, this.TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  drawPlayer(player, time) {
    const ctx = this.ctx;

    // Ghost After-Images from Dash
    for (const ghost of player.afterImages) {
      ctx.save();
      ctx.translate(ghost.x + player.w / 2, ghost.y + player.h / 2);
      ctx.scale(ghost.facing, 1);
      ctx.globalAlpha = ghost.alpha * 0.5;
      ctx.fillStyle = "#00f2fe";
      this.drawRoundedRect(ctx, -16, -24, 32, 48, 12);
      ctx.fill();
      ctx.restore();
    }

    // Plasma Cape — verlet ribbon in world space, drawn behind the hero
    const cape = player.capePoints;
    if (cape && cape.length >= 3) {
      const ax = player.x + player.w / 2 - player.facing * 10;
      const ay = player.y + 14;
      ctx.save();
      ctx.fillStyle = "rgba(0, 242, 254, 0.75)";
      ctx.beginPath();
      ctx.moveTo(ax, ay - 3);
      for (const p of cape) ctx.lineTo(p.x, p.y - 3);
      for (let i = cape.length - 1; i >= 0; i--) ctx.lineTo(cape[i].x, cape[i].y + 4);
      ctx.lineTo(ax, ay + 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2 === 0) return;

    ctx.save();
    const running = player.grounded && Math.abs(player.vx) > 20;
    const sx = 1 + player.squash + (player.isDashing ? 0.22 : 0);
    const sy = 1 - player.squash - (player.isDashing ? 0.1 : 0);
    const runBob = running ? Math.sin(player.runCycle) * 3 : 0;
    const breathe = !running && player.grounded && !player.isPounding
      ? Math.sin(player.idleTime * 2.4) * 0.035 : 0;
    const lean = player.grounded ? player.vx * 0.00035 : player.vx * 0.00016;
    const sliding = player.onWall !== 0 && !player.grounded;
    const wallLean = sliding ? (player.onWall === player.facing ? 0.14 : -0.04) : 0;

    ctx.translate(player.x + player.w / 2, player.y + player.h / 2 + Math.abs(runBob));
    ctx.rotate(lean + wallLean * player.facing);
    ctx.scale(player.facing * sx, sy * (1 + breathe));

    // 1. Legs (stride when running, tucked in the air)
    const stride = running ? Math.sin(player.runCycle) * 6 : 0;
    const airTuck = player.grounded ? 0 : 5;
    ctx.fillStyle = "#0b1224";
    this.drawRoundedRect(ctx, -12 + stride * 0.6, 14 - airTuck, 9, 15, 4);
    ctx.fill();
    this.drawRoundedRect(ctx, 3 - stride * 0.6, 14 - (running ? Math.max(0, -stride) : airTuck), 9, 15, 4);
    ctx.fill();

    // 2. Light Wings (Double Jump Flare)
    if (player.wingAnim > 0) {
      ctx.save();
      ctx.globalAlpha = player.wingAnim;
      ctx.fillStyle = "#64d2ff";
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(-40, -45);
      ctx.lineTo(-20, -15);
      ctx.lineTo(0, 0);
      ctx.fill();
      ctx.restore();
    }

    // 3. Cyber Armor Suit
    ctx.fillStyle = "#0f172a";
    this.drawRoundedRect(ctx, -16, -20, 32, 42, 10);
    ctx.fill();

    // Chest core light
    ctx.fillStyle = "#00f2fe";
    ctx.beginPath();
    ctx.arc(4, -4, 3.5, 0, this.TAU);
    ctx.fill();

    // 4. Helmet + Glowing Neon Visor
    ctx.fillStyle = "#16213b";
    ctx.beginPath();
    ctx.arc(3, -20, 13, 0, this.TAU);
    ctx.fill();
    ctx.fillStyle = "#00f5a0";
    ctx.beginPath();
    ctx.ellipse(8, -21, 8, 4.5, 0, 0, this.TAU);
    ctx.fill();

    // Antenna with signal tip
    ctx.strokeStyle = "#00f2fe";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -31);
    ctx.lineTo(-9, -40);
    ctx.stroke();
    ctx.fillStyle = "#00f2fe";
    ctx.beginPath();
    ctx.arc(-9, -41, 2.5, 0, this.TAU);
    ctx.fill();

    // 5. Shield Bubble
    if (player.shieldActive) {
      ctx.strokeStyle = "#00f2fe";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 34 + Math.sin(time * 8) * 3, 0, this.TAU);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawParticles(particleSystem) {
    const ctx = this.ctx;
    for (const p of particleSystem.list) {
      ctx.save();
      ctx.globalAlpha = LuminaMath.clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);

      if (p.shape === "spark") {
        this.drawStarPath(ctx, 0, 0, p.size, p.size * 0.3, 4);
        ctx.fill();
      } else if (p.shape === "mote") {
        // Soft ambient mote: colored halo + bright core (no shadowBlur — cheap)
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, this.TAU);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.45, 0, this.TAU);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, this.TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Cinematic letterbox banner when crossing into a new biome
  drawZoneBanner(level) {
    const b = level.banner;
    if (!b || b.t <= 0) return;
    const ctx = this.ctx;
    const t = b.t / b.max; // 1 -> 0
    const alpha = t > 0.85 ? (1 - t) / 0.15 : t < 0.22 ? t / 0.22 : 1;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = LuminaMath.clamp(alpha, 0, 1);

    const cy = this.h * 0.3;
    ctx.fillStyle = "rgba(4, 6, 15, 0.62)";
    ctx.fillRect(0, cy - 62, this.w, 124);
    ctx.fillStyle = "rgba(0, 242, 254, 0.65)";
    ctx.fillRect(0, cy - 62, this.w, 2);
    ctx.fillRect(0, cy + 60, this.w, 2);

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 44px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(b.text, this.w / 2, cy + 8);

    ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
    ctx.font = "500 18px 'Outfit', sans-serif";
    ctx.fillText(b.sub, this.w / 2, cy + 40);
    ctx.textAlign = "left";
    ctx.restore();
  }

  drawHUD(engine) {
    const ctx = this.ctx;
    const player = engine.player;
    const state = engine.state;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 1. Top Left: Apple Liquid Glass Player Status Card
    ctx.fillStyle = "rgba(12, 18, 38, 0.75)";
    this.drawRoundedRect(ctx, 24, 20, 340, 68, 22);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1.5;
    this.drawRoundedRect(ctx, 24, 20, 340, 68, 22);
    ctx.stroke();

    // Health Hearts
    for (let i = 0; i < player.maxHealth; i++) {
      const hx = 52 + i * 36;
      ctx.fillStyle = i < player.health ? "#ff3366" : "rgba(255, 255, 255, 0.2)";
      ctx.beginPath();
      ctx.arc(hx, 52, 11, 0, this.TAU);
      ctx.fill();
    }

    // 5 Aether Relic Core Badges
    for (let i = 0; i < 5; i++) {
      const cx = 175 + i * 22;
      ctx.fillStyle = i < state.cores ? "#00f2fe" : "rgba(255, 255, 255, 0.15)";
      this.drawStarPath(ctx, cx, 52, 8, 4, 5);
      ctx.fill();
    }

    // Shard Counter
    ctx.fillStyle = "#ffd200";
    ctx.font = "700 18px 'Outfit', sans-serif";
    ctx.fillText(`💎 ${state.shards}`, 295, 58);

    // 1b. Lives (Funken) mini-card + Dash cooldown pip
    ctx.fillStyle = "rgba(12, 18, 38, 0.75)";
    this.drawRoundedRect(ctx, 24, 96, 168, 30, 15);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    this.drawRoundedRect(ctx, 24, 96, 168, 30, 15);
    ctx.stroke();

    const shownLives = Math.min(state.lives, 5);
    for (let i = 0; i < shownLives; i++) {
      ctx.fillStyle = "#64d2ff";
      this.drawStarPath(ctx, 44 + i * 22, 111, 7, 3, 4);
      ctx.fill();
    }
    if (state.lives > 5) {
      ctx.fillStyle = "#64d2ff";
      ctx.font = "700 13px 'Outfit', sans-serif";
      ctx.fillText(`×${state.lives}`, 44 + 5 * 22, 116);
    }

    // Dash pip: fills up as the cooldown recovers
    const frac = 1 - LuminaMath.clamp(player.dashCooldown / 0.55, 0, 1);
    const dashReady = player.dashCooldown <= 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(176, 111, 10, 0, this.TAU);
    ctx.stroke();
    ctx.fillStyle = dashReady ? "#00f2fe" : "rgba(0, 242, 254, 0.4)";
    ctx.beginPath();
    ctx.moveTo(176, 111);
    ctx.arc(176, 111, 8, -Math.PI / 2, -Math.PI / 2 + frac * this.TAU);
    ctx.closePath();
    ctx.fill();

    // 2. Top Center: Progress Bar across the 3 Biomes
    const barW = 320;
    const barX = this.w / 2 - barW / 2;
    ctx.fillStyle = "rgba(12, 18, 38, 0.75)";
    this.drawRoundedRect(ctx, barX, 20, barW, 36, 18);
    ctx.fill();

    const progress = LuminaMath.clamp(player.x / engine.level.worldEnd, 0, 1);
    const progGrad = ctx.createLinearGradient(barX + 8, 0, barX + barW - 8, 0);
    progGrad.addColorStop(0, "#00f5a0");
    progGrad.addColorStop(0.5, "#00f2fe");
    progGrad.addColorStop(1, "#ffd200");

    ctx.fillStyle = progGrad;
    this.drawRoundedRect(ctx, barX + 8, 28, (barW - 16) * progress, 20, 10);
    ctx.fill();

    // Current biome label under the progress bar
    const zoneNames = ["Biolumineszenter Hain", "Kristallhöhlen", "Himmels-Zitadelle"];
    ctx.fillStyle = "rgba(226, 232, 240, 0.75)";
    ctx.font = "600 12px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(zoneNames[state.zone] || zoneNames[0], this.w / 2, 72);
    ctx.textAlign = "left";

    // 3. Boss Health Bar (during battle)
    if (engine.boss.active) {
      const bossBarW = 440;
      const bossBarX = this.w / 2 - bossBarW / 2;
      ctx.fillStyle = "rgba(18, 8, 38, 0.85)";
      this.drawRoundedRect(ctx, bossBarX, this.h - 60, bossBarW, 36, 18);
      ctx.fill();

      const hpPercent = LuminaMath.clamp(engine.boss.hp / engine.boss.maxHp, 0, 1);
      ctx.fillStyle = "#ff3366";
      this.drawRoundedRect(ctx, bossBarX + 6, this.h - 54, (bossBarW - 12) * hpPercent, 24, 12);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = "800 14px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`⚔️ AETHERIS (PHASE ${engine.boss.phase}/3)`, this.w / 2, this.h - 38);
      ctx.textAlign = "left";
    }

    ctx.restore();
  }

  drawRoundedRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  drawStarPath(ctx, x, y, outer, inner, points = 5) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 ? inner : outer;
      const a = -Math.PI / 2 + (i * Math.PI) / points;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
}

// Global Export
window.LuminaRenderer = LuminaRenderer;
