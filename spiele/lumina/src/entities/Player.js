/* ==========================================================================
   LUMINA PLAYER CONTROLLER - Fluid Physics, Parkour Move-Set & Juice
   ========================================================================== */

class LuminaPlayer {
  constructor(x = 140, y = 500) {
    this.spawnX = x;
    this.spawnY = y;
    this.x = x;
    this.y = y;
    this.w = 36;
    this.h = 52;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1; // 1 = right, -1 = left

    // Stats
    this.health = 3;
    this.maxHealth = 3;
    this.invulnerable = 0;
    this.shieldActive = false;

    // Movement Timers & Flags
    this.grounded = false;
    this.coyoteTime = 0;
    this.jumpBuffer = 0;
    this.canDoubleJump = true;
    this.hasDoubleJumped = false;
    
    // Wall Slide & Wall Jump
    this.onWall = 0; // 0 = none, -1 = left wall, 1 = right wall
    this.wallSlideTimer = 0;

    // Dash
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDuration = 0.18;
    this.dashSpeed = 740;
    this.afterImages = [];

    // Ground Pound
    this.isPounding = false;

    // Visuals & Animation
    this.squash = 0;
    this.runCycle = 0;
    this.wingAnim = 0;
    this.dustTimer = 0;
    this.idleTime = 0;
    this.animT = 0;
    this.prevY = y;
    // Plasma cape — verlet-style trail points (world coords), anchored to the back
    this.capePoints = [
      { x: x + 18, y: y + 16 },
      { x: x + 10, y: y + 24 },
      { x: x + 4, y: y + 34 }
    ];
  }

  reset(x = this.spawnX, y = this.spawnY) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.health = this.maxHealth;
    this.invulnerable = 0;
    this.grounded = false;
    this.canDoubleJump = true;
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.isPounding = false;
    this.onWall = 0;
    this.jumpBuffer = 0;
    this.coyoteTime = 0;
    this.idleTime = 0;
    this.animT = 0;
    this.prevY = y;
    this.squash = 0;
    this.runCycle = 0;
    this.wingAnim = 0;
    this.dustTimer = 0;
    this.hasDoubleJumped = false;
    this.shieldActive = false;
    this.afterImages = [];
    this.capePoints = [
      { x: x + 18, y: y + 16 },
      { x: x + 10, y: y + 24 },
      { x: x + 4, y: y + 34 }
    ];
  }

  update(dt, input, engine) {
    if (this.invulnerable > 0) this.invulnerable -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    this.squash = LuminaMath.lerp(this.squash, 0, Math.min(1, dt * 10));
    if (this.wingAnim > 0) this.wingAnim -= dt * 3;

    // 1. Dash State Handling
    if (this.isDashing) {
      this.dashTimer -= dt;
      this.vy = 0; // Freeze gravity during dash
      this.vx = this.facing * this.dashSpeed;

      // Spawn Ghost After-Images
      if (Math.random() < 0.65) {
        this.afterImages.push({
          x: this.x,
          y: this.y,
          facing: this.facing,
          alpha: 0.7,
          squash: this.squash
        });
      }

      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.vx *= 0.6;
      }
    } else {
      // Normal Horizontal Movement
      const move = (input.keys.right ? 1 : 0) - (input.keys.left ? 1 : 0);
      const maxSpeed = 340;
      const accel = this.grounded ? 2600 : 1600;
      const friction = this.grounded ? 2100 : 450;

      if (move !== 0 && !this.isPounding) {
        this.vx += move * accel * dt;
        this.vx = LuminaMath.clamp(this.vx, -maxSpeed, maxSpeed);
        this.facing = move;
      } else {
        if (Math.abs(this.vx) <= friction * dt) this.vx = 0;
        else this.vx -= Math.sign(this.vx) * friction * dt;
      }

      // Air Dash Trigger
      if (input.pressed.dash && this.dashCooldown <= 0 && !this.isDashing) {
        this.isDashing = true;
        this.dashTimer = this.dashDuration;
        this.dashCooldown = 0.55;
        this.isPounding = false;
        this.squash = 0.3;
        engine.audio.playSFX("dash");
        engine.camera.addShake(4);
        engine.particles.spawnBurst(this.x + this.w / 2, this.y + this.h / 2, "#00f2fe", 12, 220, "spark");
      }

      // Ground Pound Trigger
      if (input.pressed.down && !this.grounded && !this.isPounding && !this.isDashing) {
        this.isPounding = true;
        this.vx = 0;
        this.vy = 880;
        this.squash = -0.3;
        engine.audio.playSFX("jump");
        engine.particles.spawnBurst(this.x + this.w / 2, this.y + this.h, "#ffd200", 8, 140);
      }

      // 2. Jumping Logic (Coyote Time + Buffering + Double Jump + Wall Jump)
      if (this.grounded) {
        this.coyoteTime = 0.12;
        this.canDoubleJump = true;
        this.hasDoubleJumped = false;
        // Touching ground refreshes the air-dash almost instantly
        this.dashCooldown = Math.min(this.dashCooldown, 0.08);
      } else {
        this.coyoteTime -= dt;
      }

      if (input.pressed.jump) {
        this.jumpBuffer = 0.14;
      } else {
        this.jumpBuffer -= dt;
      }

      // Normal Jump / Coyote Jump
      if (this.jumpBuffer > 0 && this.coyoteTime > 0 && !this.isPounding) {
        this.vy = -820;
        this.grounded = false;
        this.coyoteTime = 0;
        this.jumpBuffer = 0;
        this.squash = -0.22;
        engine.audio.playSFX("jump");
        engine.particles.spawnBurst(this.x + this.w / 2, this.y + this.h, "#64d2ff", 7, 120);
      }
      // Wall Jump
      else if (this.jumpBuffer > 0 && this.onWall !== 0 && !this.grounded) {
        this.vy = -760;
        this.vx = -this.onWall * 440;
        this.facing = -this.onWall;
        this.jumpBuffer = 0;
        this.canDoubleJump = true;
        this.squash = -0.25;
        engine.audio.playSFX("wall_jump");
        engine.particles.spawnBurst(this.x + (this.onWall === -1 ? 0 : this.w), this.y + this.h / 2, "#00f5a0", 10, 160);
      }
      // Double Jump
      else if (this.jumpBuffer > 0 && this.canDoubleJump && !this.grounded && !this.isPounding) {
        this.vy = -750;
        this.canDoubleJump = false;
        this.hasDoubleJumped = true;
        this.jumpBuffer = 0;
        this.wingAnim = 1.0;
        this.squash = -0.25;
        engine.audio.playSFX("double_jump");
        engine.camera.addShake(3);
        engine.particles.spawnBurst(this.x + this.w / 2, this.y + this.h / 2 + 10, "#00f2fe", 16, 200, "spark");
      }

      // Variable Jump Height (Cut jump short on key release).
      // Ignored when a new press edge lands in the same step — a stale release
      // from the previous press must not clip the fresh jump.
      if (input.released.jump && !input.pressed.jump && this.vy < -260) {
        this.vy *= 0.45;
      }

      // Gravity Application — floaty apex + snappier fall on early release
      let gravity = this.isPounding ? 3200 : 2100;
      if (!this.isPounding) {
        if (this.vy < 0 && !input.keys.jump) gravity *= 1.5;
        else if (Math.abs(this.vy) < 170 && input.keys.jump) gravity *= 0.62; // apex float
      }
      this.vy = Math.min(this.vy + gravity * dt, 1150);

      // Wall Slide Friction
      if (this.onWall !== 0 && !this.grounded && this.vy > 0) {
        this.vy = Math.min(this.vy, 130);
        this.canDoubleJump = true; // Refresh double jump on wall slide
        if (Math.random() < 0.25) {
          engine.particles.spawnDust(this.x + (this.onWall === -1 ? 0 : this.w), this.y + this.h * 0.7, "#64d2ff");
        }
        if (Math.random() < 0.06) engine.audio.playSFX("wall_slide");
      }
    }

    // 3. Move & Horizontal Collision
    this.x += this.vx * dt;
    this.onWall = 0;
    this.handleHorizontalCollision(engine);

    // 4. Move & Vertical Collision
    this.prevY = this.y;
    this.y += this.vy * dt;
    this.grounded = false;
    this.handleVerticalCollision(engine);

    // 5. Bounds & Pit Check
    this.x = LuminaMath.clamp(this.x, 0, engine.level.worldEnd - this.w);
    if (this.y > 880) {
      this.takeDamage(1, engine, true);
    }

    // 6. Running Animation & Dust
    this.runCycle += Math.abs(this.vx) * dt * 0.045;
    if (this.grounded && Math.abs(this.vx) < 30) this.idleTime += dt;
    else this.idleTime = 0;
    if (this.grounded && Math.abs(this.vx) > 140) {
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = 0.11;
        engine.particles.spawnDust(this.x + this.w / 2 - this.facing * 14, this.y + this.h, "#64d2ff");
      }
    }

    // 7. Update Ghost After-Images
    if (this.afterImages.length > 14) this.afterImages.splice(0, this.afterImages.length - 14);
    for (let i = this.afterImages.length - 1; i >= 0; i--) {
      const img = this.afterImages[i];
      img.alpha -= dt * 3.5;
      if (img.alpha <= 0) this.afterImages.splice(i, 1);
    }

    // 8. Plasma Cape Verlet (anchor at back shoulder, segments chase with flutter)
    this.animT += dt;
    const anchorX = this.x + this.w / 2 - this.facing * 10;
    const anchorY = this.y + 14;
    const wind = Math.sin(this.animT * 7) * 6 + Math.sin(this.animT * 3.1) * 4;
    const drag = Math.min(1, dt * 16);
    let px = anchorX, py = anchorY;
    for (let i = 0; i < this.capePoints.length; i++) {
      const p = this.capePoints[i];
      // Target: trail behind the player, sagging down, fluttering with speed
      const tx = px - this.facing * (10 + Math.abs(this.vx) * 0.02) + (i > 0 ? wind * 0.35 : 0);
      const ty = py + 9 + Math.min(40, Math.abs(this.vy) * 0.02) + (i > 0 ? wind * 0.2 : 0);
      p.x += (tx - p.x) * drag;
      p.y += (ty - p.y) * drag;
      px = p.x;
      py = p.y;
    }
  }

  handleHorizontalCollision(engine) {
    for (const p of engine.level.platforms) {
      if (!LuminaMath.rectsOverlap(this, p)) continue;
      if (this.vx > 0) {
        this.x = p.x - this.w;
        this.onWall = 1;
      } else if (this.vx < 0) {
        this.x = p.x + p.w;
        this.onWall = -1;
      }
      this.vx = 0;
    }
  }

  handleVerticalCollision(engine) {
    // Use the actual pre-integration bottom edge (dt-exact, no hardcoded step)
    const prevBottom = this.prevY + this.h;
    for (const p of engine.level.platforms) {
      if (!LuminaMath.rectsOverlap(this, p)) continue;

      if (this.vy >= 0 && prevBottom <= p.y + 14) {
        this.y = p.y - this.h;
        
        // Ground Landing Juice
        if (this.vy > 400 || this.isPounding) {
          this.squash = this.isPounding ? 0.35 : 0.22;
          const shakeVal = this.isPounding ? 8 : Math.min(6, this.vy / 140);
          engine.camera.addShake(shakeVal);
          engine.particles.spawnBurst(this.x + this.w / 2, p.y, "#00f2fe", this.isPounding ? 18 : 8, this.isPounding ? 260 : 120);
          
          if (this.isPounding) {
            engine.audio.playSFX("ground_pound");
            // Ground pound shockwave hits nearby enemies
            engine.enemies.triggerShockwave(this.x + this.w / 2, this.y + this.h, 160);
          }
        }

        this.vy = 0;
        this.grounded = true;
        this.isPounding = false;
      } else if (this.vy < 0) {
        this.y = p.y + p.h;
        this.vy = 40;
      }
    }
  }

  takeDamage(amount, engine, fell = false) {
    if (this.invulnerable > 0 && !fell) return;

    if (this.shieldActive) {
      this.shieldActive = false;
      this.invulnerable = 1.2;
      engine.audio.playSFX("hurt");
      engine.camera.addShake(8);
      engine.ui.showToast("🛡️ Schild absorbiert Treffer!");
      return;
    }

    this.health -= amount;
    this.invulnerable = 1.5;
    engine.audio.playSFX("hurt");
    engine.camera.addShake(12);

    if (fell || this.health <= 0) {
      engine.state.lives--;
      if (engine.state.lives <= 0) {
        engine.triggerGameOver();
        return;
      }
      this.health = this.maxHealth;
      this.x = engine.state.currentCheckpoint.x;
      this.y = engine.state.currentCheckpoint.y;
      this.vx = 0;
      this.vy = 0;
      this.isPounding = false;
      this.isDashing = false;
      this.dashTimer = 0;
      this.onWall = 0;
      this.afterImages.length = 0;
      engine.particles.spawnBurst(this.x + this.w / 2, this.y + this.h / 2, "#64d2ff", 16, 200, "spark");
      engine.camera.snapTo(this.x, this.y);
      engine.ui.showToast(`⚡ Funke verloren · ${engine.state.lives} übrig`);
    } else {
      this.vy = -380;
      this.vx = -this.facing * 320;
    }
  }
}

// Math Utility Helpers
window.LuminaMath = {
  clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (min, max) => min + Math.random() * (max - min),
  rectsOverlap: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
};

// Global Export
window.LuminaPlayer = LuminaPlayer;
