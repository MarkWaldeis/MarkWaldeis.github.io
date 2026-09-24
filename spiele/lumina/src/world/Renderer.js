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

  render(engine) {
    const ctx = this.ctx;
    const state = engine.state;
    const camera = engine.camera;

    // Clear Canvas
    ctx.clearRect(0, 0, this.w, this.h);

    // 1. Draw Parallax Sky & Backdrops
    this.drawSky(state.zone, camera);

    // 2. Camera Translation & Shake
    ctx.save();
    const shakeOffset = camera.getShakeOffset();
    ctx.translate(-Math.round(camera.x) + shakeOffset.x, shakeOffset.y);

    // 3. World Elements
    this.drawDecorations(engine.level.decorations, camera);
    this.drawGeysers(engine.level.geysers, state.time);
    this.drawPlatforms(engine.level.platforms, camera);
    this.drawBouncePads(engine.level.bouncePads, state.time);
    this.drawCheckpoints(engine.level.checkpoints, state.time);
    this.drawGoal(engine.level.goal, state.time);
    this.drawCollectibles(engine.level.collectibles, camera);

    // 4. Entities
    this.drawEnemies(engine.enemies, camera);
    this.drawBoss(engine.boss, state.time);
    this.drawPlayer(engine.player, state.time);

    // 5. Particles & Bloom Lights
    this.drawParticles(engine.particles);

    ctx.restore();

    // 6. Modern Glass HUD
    if (state.mode === "playing") {
      this.drawHUD(engine);
    }
  }

  drawSky(zone, camera) {
    const ctx = this.ctx;
    const p = this.palettes[zone] || this.palettes[0];

    // Cosmic Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.h);
    skyGrad.addColorStop(0, p.skyTop);
    skyGrad.addColorStop(1, p.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.w, this.h);

    // Celestial Celestial Ring / Orb
    const orbX = zone === 2 ? 1040 : 960;
    const orbY = zone === 2 ? 130 : 100;
    const glow = ctx.createRadialGradient(orbX, orbY, 10, orbX, orbY, 140);
    glow.addColorStop(0, p.sun);
    glow.addColorStop(0.35, p.sun + "44");
    glow.addColorStop(1, p.sun + "00");
    ctx.fillStyle = glow;
    ctx.fillRect(orbX - 150, orbY - 150, 300, 300);

    // Planet Orb
    ctx.fillStyle = p.sun;
    ctx.beginPath();
    ctx.arc(orbX, orbY, 36, 0, this.TAU);
    ctx.fill();

    // Distant Parallax Mountain Horizons
    this.drawMountainLayer(p.far, 0.12, 450, 110, 780, camera);
    this.drawMountainLayer(p.mid, 0.22, 520, 85, 540, camera);
    this.drawMountainLayer(p.near, 0.35, 570, 65, 380, camera);
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

  drawDecorations(decorations, camera) {
    const ctx = this.ctx;
    for (const d of decorations) {
      if (d.x < camera.x - 100 || d.x > camera.x + this.w + 100) continue;

      ctx.save();
      ctx.translate(d.x, 610);
      ctx.scale(d.size, d.size);

      if (d.zone === 0) {
        // Neon Spore Mushroom
        ctx.fillStyle = d.variant === 1 ? "#00f2fe" : "#00f5a0";
        ctx.beginPath();
        ctx.arc(0, -22, 16, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#ffffff88";
        ctx.beginPath();
        ctx.arc(-5, -26, 3, 0, this.TAU);
        ctx.arc(6, -24, 2.5, 0, this.TAU);
        ctx.fill();
      } else if (d.zone === 1) {
        // Crystal Cluster Spire
        ctx.fillStyle = d.variant === 1 ? "#d946ef" : "#38bdf8";
        ctx.beginPath();
        ctx.moveTo(0, -45);
        ctx.lineTo(12, -10);
        ctx.lineTo(5, 0);
        ctx.lineTo(-8, -6);
        ctx.lineTo(-12, -28);
        ctx.closePath();
        ctx.fill();
      } else {
        // Celestial Rune Pylon
        ctx.fillStyle = "#ffd200";
        ctx.fillRect(-3, -50, 6, 50);
        ctx.fillStyle = "#ff9900";
        ctx.beginPath();
        ctx.arc(0, -56, 8, 0, this.TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawPlatforms(platforms, camera) {
    const ctx = this.ctx;
    for (const p of platforms) {
      if (p.x + p.w < camera.x - 50 || p.x > camera.x + this.w + 50) continue;

      ctx.save();
      if (p.style === "grove") {
        // Cyber-Grove Platform
        ctx.fillStyle = "#0c1d2e";
        this.drawRoundedRect(ctx, p.x, p.y, p.w, p.h, 10);
        ctx.fill();

        // Glowing Moss Top
        ctx.fillStyle = "#00f5a0";
        this.drawRoundedRect(ctx, p.x - 2, p.y - 4, p.w + 4, 10, 5);
        ctx.fill();

        ctx.fillStyle = "#00f2fe";
        ctx.fillRect(p.x + 8, p.y - 4, p.w - 16, 3);
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
      ctx.translate(cp.x, cp.y);

      // Pylon Body
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, -60, 12, 120);

      // Glowing Rune Beacon
      const glow = cp.active ? "#00f5a0" : "#64748b";
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(6, -65, cp.active ? 14 : 8, 0, this.TAU);
      ctx.fill();

      if (cp.active) {
        ctx.strokeStyle = "rgba(0, 245, 160, 0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(6, -65, 20 + Math.sin(time * 6) * 4, 0, this.TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawGoal(goal, time) {
    if (!goal) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(goal.x, goal.y);

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

    ctx.restore();
  }

  drawEnemies(enemySystem, camera) {
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
        // Bioluminescent Sprout
        ctx.fillStyle = "#00f5a0";
        ctx.beginPath();
        ctx.ellipse(0, 4, 18, 15, 0, 0, this.TAU);
        ctx.fill();

        ctx.fillStyle = "#00f2fe";
        ctx.beginPath();
        ctx.arc(-6, -10, 8, 0, this.TAU);
        ctx.arc(6, -10, 8, 0, this.TAU);
        ctx.fill();
      } else if (e.type === "crawler") {
        // Armored Shock-Crawler
        ctx.fillStyle = "#ff9900";
        ctx.beginPath();
        ctx.ellipse(0, 4, 22, 14, 0, 0, this.TAU);
        ctx.fill();

        ctx.fillStyle = "#ff3366";
        ctx.beginPath();
        ctx.arc(14, 0, 6, 0, this.TAU);
        ctx.fill();
      } else if (e.type === "wisp") {
        // Volt-Wisp
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#7dd3fc";
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, this.TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (e.type === "sentry") {
        // Shield-Knight
        ctx.fillStyle = "#334155";
        this.drawRoundedRect(ctx, -18, -25, 36, 50, 8);
        ctx.fill();

        // Energy Shield
        ctx.fillStyle = "rgba(0, 242, 254, 0.7)";
        ctx.fillRect(16, -20, 8, 40);
      } else if (e.type === "drone") {
        // Chrono-Drone
        ctx.fillStyle = "#475569";
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, this.TAU);
        ctx.fill();

        // Laser Eye
        ctx.fillStyle = "#ff3366";
        ctx.beginPath();
        ctx.arc(e.direction > 0 ? 8 : -8, 0, 6, 0, this.TAU);
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
      ctx.restore();
    }
  }

  drawBoss(boss, time) {
    if (!boss.alive && boss.dyingTimer <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(boss.x + boss.w / 2, boss.y + boss.h / 2);
    ctx.scale(boss.facing, 1);

    if (!boss.alive) {
      ctx.globalAlpha = LuminaMath.clamp(boss.dyingTimer / 1.8, 0, 1);
    }

    // Boss Core Body (Titan)
    ctx.fillStyle = "#1e1b4b";
    this.drawRoundedRect(ctx, -50, -50, 100, 100, 24);
    ctx.fill();

    // Glowing Overlord Crown
    ctx.fillStyle = boss.phase === 3 ? "#ff3366" : boss.phase === 2 ? "#d946ef" : "#ffd200";
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

    // Central Core Eye
    ctx.fillStyle = "#00f2fe";
    ctx.beginPath();
    ctx.arc(0, -10, 22, 0, this.TAU);
    ctx.fill();

    // Laser Sweep Beam
    if (boss.laserActive) {
      ctx.fillStyle = "rgba(255, 51, 102, 0.75)";
      ctx.fillRect(20, -15, 600, 24);
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

    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2 === 0) return;

    ctx.save();
    const sx = 1 + player.squash;
    const sy = 1 - player.squash;
    const runBob = player.grounded && Math.abs(player.vx) > 20 ? Math.sin(player.runCycle) * 3 : 0;

    ctx.translate(player.x + player.w / 2, player.y + player.h / 2 + Math.abs(runBob));
    ctx.scale(player.facing * sx, sy);

    // 1. Plasma Cape (Flowing back)
    ctx.fillStyle = "#00f2fe";
    ctx.beginPath();
    ctx.moveTo(-10, -12);
    ctx.quadraticCurveTo(-28 - Math.abs(player.vx) * 0.04, 0 + runBob, -38 - Math.abs(player.vx) * 0.06, 18);
    ctx.quadraticCurveTo(-18, 10, -6, 6);
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
    this.drawRoundedRect(ctx, -16, -20, 32, 44, 10);
    ctx.fill();

    // 4. Glowing Neon Visor Mask
    ctx.fillStyle = "#00f5a0";
    ctx.beginPath();
    ctx.ellipse(6, -14, 8, 4, 0, 0, this.TAU);
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
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, this.TAU);
        ctx.fill();
      }
      ctx.restore();
    }
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
