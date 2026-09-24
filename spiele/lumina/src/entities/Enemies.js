/* ==========================================================================
   LUMINA ENEMY SYSTEM - AI Behaviors, Projectiles & Stomp Mechanics
   ========================================================================== */

class LuminaEnemies {
  constructor() {
    this.list = [];
    this.projectiles = [];
  }

  clear() {
    this.list = [];
    this.projectiles = [];
  }

  add(type, x, y, range = 140) {
    const sizeTable = {
      sprout: [44, 38],
      crawler: [48, 36],
      wisp: [42, 42],
      sentry: [48, 62],
      drone: [46, 40]
    };
    const [w, h] = sizeTable[type] || [40, 40];

    this.list.push({
      type,
      x,
      y: y - h,
      w,
      h,
      homeX: x,
      range,
      vx: type === "crawler" ? -80 : type === "wisp" ? -50 : -60,
      vy: 0,
      direction: -1,
      alive: true,
      dyingTimer: 0,
      phase: Math.random() * Math.PI * 2,
      hp: type === "sentry" ? 2 : 1,
      cooldown: Math.random() * 1.5,
      grounded: false,
      chargeTimer: 0
    });
  }

  update(dt, player, engine) {
    // 1. Update Enemies
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];

      if (!e.alive) {
        e.dyingTimer -= dt;
        if (e.dyingTimer <= 0) {
          this.list.splice(i, 1);
        }
        continue;
      }

      // Distance optimization (don't tick offscreen far enemies)
      const distToPlayer = Math.abs(e.x - player.x);
      if (distToPlayer > 1800) continue;

      e.phase += dt * 3.5;
      if (e.cooldown > 0) e.cooldown -= dt;

      // Type-specific AI
      switch (e.type) {
        case "sprout":
          e.vx = e.direction * 65;
          if (Math.abs(e.x - e.homeX) > e.range) {
            e.direction = e.x > e.homeX ? -1 : 1;
          }
          this.applyGroundPhysics(e, dt, engine);
          break;

        case "crawler": {
          const distX = player.x - e.x;
          if (Math.abs(distX) < 320 && Math.abs(player.y - e.y) < 120) {
            e.direction = Math.sign(distX) || 1;
            e.vx = e.direction * 180; // Charge speed
          } else {
            e.vx = e.direction * 75;
            if (Math.abs(e.x - e.homeX) > e.range) {
              e.direction = e.x > e.homeX ? -1 : 1;
            }
          }
          this.applyGroundPhysics(e, dt, engine);
          break;
        }

        case "wisp":
          e.x += e.vx * dt;
          e.y += Math.sin(e.phase * 1.6) * 60 * dt;
          if (Math.abs(e.x - e.homeX) > e.range) {
            e.vx *= -1;
            e.direction = Math.sign(e.vx);
          }
          break;

        case "sentry": {
          const distX = player.x - e.x;
          if (Math.abs(distX) < 380) {
            e.direction = Math.sign(distX) || 1;
            e.vx += e.direction * 220 * dt;
            e.vx = LuminaMath.clamp(e.vx, -120, 120);

            // Armored Hop Attack
            if (e.grounded && e.cooldown <= 0 && Math.abs(distX) < 160) {
              e.vy = -540;
              e.cooldown = 2.0;
            }
          } else {
            e.vx = e.direction * 60;
            if (Math.abs(e.x - e.homeX) > e.range) {
              e.direction = e.x > e.homeX ? -1 : 1;
            }
          }
          this.applyGroundPhysics(e, dt, engine);
          break;
        }

        case "drone": {
          // Hover above and charge laser shots
          e.x += Math.sin(e.phase * 0.8) * 40 * dt;
          e.y += Math.cos(e.phase * 1.2) * 30 * dt;
          e.direction = player.x < e.x ? -1 : 1;

          if (distToPlayer < 480 && e.cooldown <= 0) {
            e.chargeTimer += dt;
            if (e.chargeTimer > 1.2) {
              // Fire energy projectile
              const angle = Math.atan2(player.y - e.y, player.x - e.x);
              this.projectiles.push({
                x: e.x + e.w / 2,
                y: e.y + e.h / 2,
                vx: Math.cos(angle) * 320,
                vy: Math.sin(angle) * 320,
                radius: 8,
                life: 3.5,
                color: "#ff3366"
              });
              engine.audio.playSFX("boss_laser");
              engine.particles.spawnBurst(e.x + e.w / 2, e.y + e.h / 2, "#ff3366", 6, 120);
              e.chargeTimer = 0;
              e.cooldown = 2.4;
            }
          } else {
            e.chargeTimer = 0;
          }
          break;
        }
      }

      // Check Player Collision
      if (e.alive && LuminaMath.rectsOverlap(player, e)) {
        // Stomp condition (falling on top of enemy)
        const isStomp = player.vy > 80 && (player.y + player.h - e.y < Math.min(34, e.h * 0.6));
        const isDashingHit = player.isDashing;

        // Sentry front shield block logic
        const shieldBlocked = (e.type === "sentry") && !isStomp && (player.facing !== e.direction);

        if (isStomp || isDashingHit) {
          this.stompEnemy(e, player, engine);
        } else if (shieldBlocked) {
          // Bounce off shield with metallic spark
          player.vx = -player.facing * 380;
          player.vy = -280;
          engine.audio.playSFX("wall_jump");
          engine.camera.addShake(4);
          engine.particles.spawnBurst(e.x + (e.direction === -1 ? 0 : e.w), e.y + e.h / 2, "#00f2fe", 12, 180);
          engine.ui.showToast("🛡️ Schild blockiert Frontalangriffe!");
        } else {
          player.takeDamage(1, engine);
        }
      }
    }

    // 2. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Particle trail
      if (Math.random() < 0.4) {
        engine.particles.spawnDust(p.x, p.y, p.color);
      }

      // Player hit check
      const playerHitBox = { x: p.x - p.radius, y: p.y - p.radius, w: p.radius * 2, h: p.radius * 2 };
      if (LuminaMath.rectsOverlap(player, playerHitBox)) {
        if (player.isDashing) {
          // Dash parries or destroys projectile
          engine.particles.spawnBurst(p.x, p.y, "#00f5a0", 10, 160, "spark");
          engine.audio.playSFX("shard");
          this.projectiles.splice(i, 1);
          continue;
        } else {
          player.takeDamage(1, engine);
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  applyGroundPhysics(e, dt, engine) {
    const oldBottom = e.y + e.h;
    e.vy = Math.min(e.vy + 1800 * dt, 900);
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.grounded = false;

    for (const p of engine.level.platforms) {
      if (!LuminaMath.rectsOverlap(e, p)) continue;

      if (e.vy >= 0 && oldBottom <= p.y + 14) {
        e.y = p.y - e.h;
        e.vy = 0;
        e.grounded = true;
      } else if (e.vy < 0) {
        e.y = p.y + p.h;
        e.vy = 40;
      } else {
        // Wall turn around
        e.vx *= -1;
        e.direction *= -1;
      }
    }
  }

  stompEnemy(e, player, engine) {
    player.vy = -620; // Rebound bounce
    player.canDoubleJump = true;
    player.squash = -0.22;
    
    engine.audio.playSFX("stomp");
    engine.camera.addShake(6);
    engine.hitStop(0.045); // Juicy freeze-frame

    engine.particles.spawnBurst(e.x + e.w / 2, e.y + e.h / 2, "#00f5a0", 14, 220, "spark");

    e.hp--;
    if (e.hp <= 0) {
      e.alive = false;
      e.dyingTimer = 0.45;
      engine.state.score += e.type === "sentry" ? 350 : 150;
      engine.state.comboCount++;
    } else {
      e.cooldown = 0.6;
      e.vx = -e.direction * 180;
    }
  }

  triggerShockwave(x, y, radius = 160) {
    for (const e of this.list) {
      if (!e.alive) continue;
      const dist = Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y);
      if (dist <= radius) {
        e.hp--;
        if (e.hp <= 0) {
          e.alive = false;
          e.dyingTimer = 0.4;
        } else {
          e.vy = -340;
        }
      }
    }
  }
}

// Global Export
window.LuminaEnemies = LuminaEnemies;
