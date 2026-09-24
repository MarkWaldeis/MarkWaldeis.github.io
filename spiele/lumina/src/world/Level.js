/* ==========================================================================
   LUMINA LEVEL GENERATOR - 3 Seamless Biomes, Interactive Elements & Secrets
   ========================================================================== */

class LuminaLevel {
  constructor() {
    this.worldEnd = 17500;
    this.groundY = 610;
    this.platforms = [];
    this.collectibles = [];
    this.checkpoints = [];
    this.bouncePads = [];
    this.geysers = [];
    this.decorations = [];
    this.clouds = [];
    this.goal = null;
  }

  getZone(x) {
    if (x < 6000) return 0; // Bioluminescent Grove
    if (x < 12500) return 1; // Abyssal Crystal Caverns
    return 2; // Celestial Chrono-Citadel
  }

  build(engine) {
    this.platforms = [];
    this.collectibles = [];
    this.checkpoints = [];
    this.bouncePads = [];
    this.geysers = [];
    this.decorations = [];
    this.clouds = [];

    // 1. Ground Segments (with pits/chasms for platforming challenge)
    const groundSegments = [
      [0, 1700], [1820, 3200], [3350, 4800], [4950, 6100],
      [6250, 7600], [7750, 9300], [9450, 10900], [11050, 12400],
      [12550, 13900], [14050, 17500]
    ];

    groundSegments.forEach(([start, end]) => {
      const zone = this.getZone(start);
      const style = zone === 2 ? "citadel" : zone === 1 ? "crystal" : "grove";
      this.platforms.push({
        x: start,
        y: this.groundY,
        w: end - start,
        h: 160,
        style
      });
    });

    // 2. Multi-Tier Platforms & Wall-Jump Shafts
    const platformData = [
      // --- BIOME 1: GROVE (0 - 6,000) ---
      [500, 500, 180, "grove"], [800, 420, 160, "grove"], [1100, 510, 200, "grove"], [1400, 430, 160, "grove"],
      [1880, 490, 160, "grove"], [2140, 400, 180, "grove"], [2400, 310, 220, "grove"], [2720, 440, 200, "grove"],
      // Wall-jump vertical tower
      [3150, 350, 60, "grove"], [3280, 260, 60, "grove"], [3150, 170, 60, "grove"], [3320, 120, 220, "grove"],
      [3620, 490, 170, "grove"], [3920, 410, 190, "grove"], [4250, 330, 200, "grove"], [4550, 450, 180, "grove"],
      [5100, 480, 170, "grove"], [5380, 390, 190, "grove"], [5680, 300, 210, "grove"],

      // --- BIOME 2: CRYSTAL CAVERNS (6,000 - 12,500) ---
      [6350, 490, 180, "crystal"], [6650, 410, 200, "crystal"], [6980, 320, 180, "crystal"], [7300, 430, 190, "crystal"],
      [7800, 500, 170, "crystal"], [8080, 410, 180, "crystal"], [8360, 310, 190, "crystal"], [8680, 220, 240, "crystal"],
      // Underground Cavern Platforming
      [9380, 480, 190, "crystal"], [9700, 380, 200, "crystal"], [10050, 290, 200, "crystal"], [10380, 420, 200, "crystal"],
      [11050, 490, 180, "crystal"], [11350, 400, 200, "crystal"], [11680, 310, 220, "crystal"], [12000, 420, 220, "crystal"],

      // --- BIOME 3: CHRONO-CITADEL (12,500 - 17,500) ---
      [12600, 490, 200, "citadel"], [12920, 400, 200, "citadel"], [13250, 310, 220, "citadel"], [13600, 430, 220, "citadel"],
      [14150, 490, 200, "citadel"], [14480, 390, 220, "citadel"], [14800, 300, 220, "citadel"],
      // Boss Arena Side Platforms
      [15200, 480, 180, "citadel"], [15550, 380, 200, "citadel"], [16400, 380, 200, "citadel"], [16700, 480, 180, "citadel"]
    ];

    platformData.forEach(([x, y, w, style]) => {
      this.platforms.push({ x, y, w, h: 36, style });
    });

    // Stepping stones over pits
    const steppingStones = [
      [1730, 545], [3230, 530], [4840, 540], [6140, 530],
      [7640, 545], [9340, 530], [10940, 545], [12440, 530], [13940, 545]
    ];
    steppingStones.forEach(([x, y]) => {
      const zone = this.getZone(x);
      this.platforms.push({
        x,
        y,
        w: 64,
        h: 26,
        style: zone === 2 ? "citadel" : zone === 1 ? "crystal" : "grove"
      });
    });

    // 3. Bounce Pads (Bioluminescent Jump Mushrooms)
    this.bouncePads = [
      { x: 1320, y: 580, w: 46, h: 28, power: -940 },
      { x: 3050, y: 580, w: 46, h: 28, power: -1050 },
      { x: 5020, y: 580, w: 46, h: 28, power: -980 },
      { x: 7500, y: 580, w: 46, h: 28, power: -980 },
      { x: 10800, y: 580, w: 46, h: 28, power: -1050 },
      { x: 14700, y: 580, w: 46, h: 28, power: -1000 }
    ];

    // 4. Steam Geysers (Updraft wind currents)
    this.geysers = [
      { x: 6750, y: 610, w: 55, h: 260 },
      { x: 8850, y: 610, w: 55, h: 290 },
      { x: 11450, y: 610, w: 55, h: 280 }
    ];

    // 5. Collectibles: Chrono-Shards (Coin trails & arcs)
    for (let x = 260; x < 17200; x += 260) {
      const zone = this.getZone(x);
      const y = zone === 0 ? 530 - Math.sin(x * 0.008) * 60 : zone === 1 ? 505 - Math.sin(x * 0.01) * 80 : 515 - Math.sin(x * 0.012) * 50;
      this.addShard(x, y);
    }
    this.addShardArc(780, 360, 6, 44, 75);
    this.addShardArc(2080, 340, 6, 44, 85);
    this.addShardArc(3200, 100, 5, 42, 60);
    this.addShardArc(5350, 270, 7, 44, 80);
    this.addShardArc(8250, 260, 7, 44, 85);
    this.addShardArc(11250, 270, 7, 44, 80);
    this.addShardArc(14350, 280, 7, 44, 75);

    // 6. The 5 Ancient Aether Cores (Key Relics)
    this.addRelic(2480, 250, 1);
    this.addRelic(3400, 70, 2);
    this.addRelic(8780, 160, 3);
    this.addRelic(13350, 250, 4);
    // Core 5 is rewarded upon defeating Aetheris!

    // Health & Shield Pickups
    this.addPickup("heart", 4150, 460);
    this.addPickup("shield", 7100, 380);
    this.addPickup("heart", 9850, 340);
    this.addPickup("shield", 12800, 350);
    this.addPickup("heart", 14600, 340);

    // 7. Checkpoint Obelisks
    this.checkpoints = [
      { x: 4700, y: 490, active: false, label: "🌿 Biolumineszenter Hain gesichert" },
      { x: 10600, y: 490, active: false, label: "💎 Kristallhöhlen gemeistert" },
      { x: 14000, y: 490, active: false, label: "⚡ Himmels-Zitadelle betreten" }
    ];

    // 8. Goal: Celestial Archway Vault
    this.goal = {
      x: 17200,
      y: 440,
      w: 110,
      h: 170,
      open: false
    };

    // 9. Enemies Population
    engine.enemies.clear();
    const enemySpawns = [
      // Grove
      ["sprout", 740, 610, 110], ["sprout", 1250, 610, 100], ["crawler", 1950, 610, 140],
      ["sprout", 2850, 610, 120], ["drone", 3800, 420, 150], ["crawler", 4400, 330, 90],
      ["sprout", 5250, 610, 120], ["crawler", 5800, 610, 140],
      // Caverns
      ["crawler", 6500, 610, 130], ["wisp", 6900, 380, 170], ["sentry", 7450, 610, 120],
      ["wisp", 8450, 310, 160], ["crawler", 9100, 610, 130], ["drone", 9900, 360, 180],
      ["wisp", 10250, 320, 170], ["sentry", 11200, 610, 140], ["drone", 11800, 350, 160],
      // Citadel
      ["sentry", 12750, 610, 130], ["wisp", 13350, 320, 160], ["drone", 13750, 390, 180],
      ["sentry", 14350, 610, 140], ["sentry", 14850, 610, 120]
    ];
    enemySpawns.forEach(args => engine.enemies.add(...args));

    // 10. Atmospheric Clouds & Background Elements
    for (let i = 0; i < 40; i++) {
      this.clouds.push({
        x: i * 520 + LuminaMath.rand(-140, 140),
        y: LuminaMath.rand(60, 320),
        size: LuminaMath.rand(0.6, 1.5),
        depth: LuminaMath.rand(0.08, 0.28)
      });
    }

    // Foliage & Crystals Decor
    for (let x = 200; x < this.worldEnd; x += LuminaMath.rand(160, 300)) {
      this.decorations.push({
        x,
        zone: this.getZone(x),
        size: LuminaMath.rand(0.75, 1.3),
        variant: Math.floor(LuminaMath.rand(0, 3))
      });
    }
  }

  addShard(x, y) {
    this.collectibles.push({
      type: "shard",
      x,
      y,
      w: 24,
      h: 24,
      collected: false,
      phase: Math.random() * Math.PI * 2
    });
  }

  addShardArc(x, y, count, spacing = 44, height = 70) {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      this.addShard(x + i * spacing, y - Math.sin(t * Math.PI) * height);
    }
  }

  addRelic(x, y, id) {
    this.collectibles.push({
      type: "relic",
      id,
      x,
      y,
      w: 36,
      h: 36,
      collected: false,
      phase: 0
    });
  }

  addPickup(type, x, y) {
    this.collectibles.push({
      type,
      x,
      y,
      w: 30,
      h: 30,
      collected: false,
      phase: 0
    });
  }

  spawnFinalCore(x, y) {
    this.addRelic(x, y, 5);
    if (this.goal) {
      this.goal.open = true;
    }
  }

  update(dt, player, engine) {
    // 1. Interactive Bounce Pads
    for (const b of this.bouncePads) {
      if (LuminaMath.rectsOverlap(player, b) && player.vy > 0) {
        player.vy = b.power;
        player.canDoubleJump = true;
        player.squash = -0.3;
        engine.audio.playSFX("bumper");
        engine.camera.addShake(6);
        engine.particles.spawnBurst(b.x + b.w / 2, b.y, "#00f5a0", 14, 200, "spark");
      }
    }

    // 2. Interactive Steam Geysers
    for (const g of this.geysers) {
      if (LuminaMath.rectsOverlap(player, g)) {
        player.vy = Math.min(player.vy - 1600 * dt, -450);
        player.canDoubleJump = true;
        if (Math.random() < 0.3) {
          engine.audio.playSFX("geyser");
          engine.particles.spawnDust(player.x + player.w / 2, player.y + player.h, "#4facfe");
        }
      }
    }

    // 3. Collectibles Update
    for (const item of this.collectibles) {
      if (item.collected) continue;
      item.phase += dt * 4;

      const hitbox = {
        x: item.x,
        y: item.y + Math.sin(item.phase) * 6,
        w: item.w,
        h: item.h
      };

      if (!LuminaMath.rectsOverlap(player, hitbox)) continue;

      item.collected = true;

      if (item.type === "shard") {
        engine.state.shards++;
        engine.state.score += 30;
        engine.audio.playSFX("shard");
        engine.particles.spawnBurst(item.x + 12, item.y + 12, "#ffd200", 8, 140, "spark");

        // Bonus extra life every 30 shards
        if (engine.state.shards % 30 === 0) {
          engine.state.lives++;
          engine.ui.showToast("💎 30 Shards gesammelt · +1 Extra-Leben!");
        }
      } else if (item.type === "relic") {
        engine.state.cores++;
        engine.state.score += 1000;
        engine.audio.playSFX("relic");
        engine.particles.spawnBurst(item.x + 18, item.y + 18, "#00f2fe", 24, 260, "spark");
        engine.ui.showToast(`✨ Aether-Kern ${engine.state.cores} / 5 geborgen!`);
      } else if (item.type === "heart") {
        player.health = Math.min(player.maxHealth, player.health + 1);
        engine.state.score += 150;
        engine.audio.playSFX("shard");
        engine.particles.spawnBurst(item.x + 15, item.y + 15, "#ff3366", 14, 160);
        engine.ui.showToast("❤️ Lebensenergie wiederhergestellt");
      } else if (item.type === "shield") {
        player.shieldActive = true;
        engine.state.score += 200;
        engine.audio.playSFX("double_jump");
        engine.particles.spawnBurst(item.x + 15, item.y + 15, "#00f2fe", 16, 180, "spark");
        engine.ui.showToast("🛡️ Schutzbarriere aktiviert!");
      }
    }

    // 4. Checkpoints Update
    for (const cp of this.checkpoints) {
      if (!cp.active && player.x > cp.x) {
        cp.active = true;
        engine.state.currentCheckpoint = { x: cp.x + 40, y: 500 };
        engine.audio.playSFX("checkpoint");
        engine.particles.spawnBurst(cp.x + 20, cp.y - 20, "#00f5a0", 20, 240, "spark");
        engine.ui.showToast(cp.label);
      }
    }

    // 5. Boss Trigger at Citadel Arena
    if (!engine.boss.active && !engine.boss.defeated && player.x > 15000) {
      engine.boss.spawn(16250, 610);
      engine.audio.playSFX("boss_slam");
      engine.ui.showToast("⚔️ AETHERIS - Der Himmels-Oberherr erwacht!");
    }
    if (engine.boss.active) {
      // Lock player inside Arena
      player.x = LuminaMath.clamp(player.x, 14950, 16850 - player.w);
    }

    // 6. Goal Archway Trigger
    if (this.goal && LuminaMath.rectsOverlap(player, this.goal)) {
      if (!engine.boss.defeated) {
        if (player.x > this.goal.x - 80) player.x = this.goal.x - player.w;
        engine.ui.showToast("⚠️ Das Siegel öffnet sich erst nach Aetheris' Niederlage!");
        return;
      }
      if (engine.state.cores < 5) {
        engine.ui.showToast(`⚠️ Es fehlen noch ${5 - engine.state.cores} Aether-Kerne!`);
        return;
      }
      engine.triggerVictory();
    }
  }
}

// Global Export
window.LuminaLevel = LuminaLevel;
