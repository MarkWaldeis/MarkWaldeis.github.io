/* ==========================================================================
   LUMINA BOSS SYSTEM - Aetheris, The Celestial Overlord (3 Phases)
   ========================================================================== */

class LuminaBoss {
  constructor(x = 16200, y = 610) {
    this.x = x;
    this.y = y - 130;
    this.w = 120;
    this.h = 130;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.alive = false;
    this.active = false;
    this.defeated = false;

    this.maxHp = 6;
    this.hp = 6;
    this.phase = 1; // Phase 1 (HP 6-5), Phase 2 (HP 4-3), Phase 3 (HP 2-1)
    this.cooldown = 1.0;
    this.attackTimer = 0;
    this.currentAttack = "idle";
    this.laserAngle = 0;
    this.laserActive = false;
    this.grounded = false;
    this.dyingTimer = 0;
    this.animTime = 0;
    this.arenaLeft = 14950;
    this.arenaRight = 16850;
  }

  spawn(x = 16200, y = 610) {
    this.x = x;
    this.y = y - 130;
    this.vx = 0;
    this.vy = 0;
    this.hp = this.maxHp;
    this.phase = 1;
    this.alive = true;
    this.active = true;
    this.defeated = false;
    this.cooldown = 1.5;
    this.currentAttack = "idle";
  }

  update(dt, player, engine) {
    if (!this.alive) {
      if (this.dyingTimer > 0) {
        this.dyingTimer -= dt;
        if (Math.random() < 0.35) {
          engine.particles.spawnBurst(
            this.x + LuminaMath.rand(0, this.w),
            this.y + LuminaMath.rand(0, this.h),
            Math.random() < 0.5 ? "#00f2fe" : "#ffd200",
            12,
            240,
            "spark"
          );
        }
      }
      return;
    }

    this.animTime += dt * 4;
    this.facing = player.x < this.x + this.w / 2 ? -1 : 1;

    // Phase Transitions
    if (this.hp <= 2) this.phase = 3;
    else if (this.hp <= 4) this.phase = 2;
    else this.phase = 1;

    // AI Attack Cycle
    if (this.cooldown > 0) {
      this.cooldown -= dt;
    } else {
      this.decideNextAttack(player, engine);
    }

    // Process current attack
    this.processAttack(dt, player, engine);

    // Apply Gravity & Arena Limits
    this.vy = Math.min(this.vy + 2000 * dt, 1000);
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Floor collision
    if (this.y + this.h >= 610) {
      if (this.vy > 300) {
        // Heavy Ground Slam
        engine.camera.addShake(this.phase === 3 ? 14 : 9);
        engine.audio.playSFX("boss_slam");
        engine.particles.spawnBurst(this.x + this.w / 2, 610, "#9b51e0", 18, 260, "spark");
        
        // Phase 2/3: Shockwave on slam
        if (this.phase >= 2) {
          engine.enemies.projectiles.push(
            { x: this.x, y: 590, vx: -360, vy: 0, radius: 12, life: 1.6, color: "#9b51e0" },
            { x: this.x + this.w, y: 590, vx: 360, vy: 0, radius: 12, life: 1.6, color: "#9b51e0" }
          );
        }
      }
      this.y = 610 - this.h;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // Keep Boss inside Arena
    this.x = LuminaMath.clamp(this.x, this.arenaLeft, this.arenaRight - this.w);

    // Check collision with Player
    if (this.alive && LuminaMath.rectsOverlap(player, this)) {
      const isStomp = player.vy > 80 && (player.y + player.h - this.y < 45);
      if (isStomp) {
        this.takeDamage(player, engine);
      } else {
        player.takeDamage(1, engine);
      }
    }
  }

  decideNextAttack(player, engine) {
    const dist = Math.abs(player.x - (this.x + this.w / 2));
    const speedMult = this.phase === 3 ? 1.4 : this.phase === 2 ? 1.2 : 1.0;

    const attacks = ["charge", "jump_slam", "laser_sweep"];
    if (this.phase >= 2) attacks.push("summon_wisps");

    const choice = attacks[Math.floor(Math.random() * attacks.length)];
    this.currentAttack = choice;

    if (choice === "charge") {
      this.vx = this.facing * 340 * speedMult;
      this.cooldown = 1.6 / speedMult;
    } else if (choice === "jump_slam") {
      this.vy = -780 * (this.phase === 3 ? 1.15 : 1.0);
      this.vx = this.facing * 200 * speedMult;
      this.cooldown = 2.0 / speedMult;
    } else if (choice === "laser_sweep") {
      this.laserActive = true;
      this.attackTimer = 1.4;
      this.cooldown = 2.8 / speedMult;
      engine.audio.playSFX("boss_laser");
    } else if (choice === "summon_wisps") {
      engine.enemies.add("wisp", this.x - 80, 420);
      engine.enemies.add("wisp", this.x + this.w + 80, 420);
      this.cooldown = 3.2;
    }
  }

  processAttack(dt, player, engine) {
    if (this.currentAttack === "charge") {
      if (this.grounded && Math.random() < 0.3) {
        engine.particles.spawnDust(this.x + this.w / 2, this.y + this.h, "#9b51e0");
      }
    } else if (this.laserActive) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.laserActive = false;
      }
    }
  }

  takeDamage(player, engine) {
    player.vy = -680;
    player.canDoubleJump = true;
    player.squash = -0.25;

    this.hp--;
    engine.audio.playSFX("stomp");
    engine.camera.addShake(12);
    engine.hitStop(0.08);
    engine.particles.spawnBurst(this.x + this.w / 2, this.y + 20, "#ffd200", 22, 280, "spark");

    if (this.hp <= 0) {
      this.defeat(engine);
    } else {
      this.cooldown = 0.8;
      this.vx = -this.facing * 280;
      engine.ui.showToast(`👑 Aetheris: Noch ${this.hp} Treffer!`);
    }
  }

  defeat(engine) {
    this.alive = false;
    this.active = false;
    this.defeated = true;
    this.dyingTimer = 1.8;

    engine.audio.playSFX("victory");
    engine.camera.addShake(18);
    engine.ui.showToast("🌟 Aetheris wurde bezwungen! Die Zitadelle erstrahlt!");
    
    // Spawn 5th Aether Core
    engine.level.spawnFinalCore(this.x + this.w / 2, this.y - 20);
  }
}

// Global Export
window.LuminaBoss = LuminaBoss;
