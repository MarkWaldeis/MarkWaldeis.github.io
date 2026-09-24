'use strict';

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

class MovingPlat {
  constructor(cx, cy, axis, idx) {
    this.cx = (cx + 0.5) * TILE;
    this.cyTop = cy * TILE;
    this.axis = axis;
    this.amp = TILE * 2.5;
    this.period = 4.0;
    this.phase = idx * 0.9;
    this.w = 160; this.h = 14;
    this.t = 0;
    this.dx = 0; this.dy = 0;
    this.x = this.cx - this.w / 2;
    this.y = this.cyTop;
  }
  update(dt) {
    this.t += dt;
    const off = Math.sin((this.t / this.period) * Math.PI * 2 + this.phase) * this.amp;
    const nx = this.axis === 'x' ? this.cx - this.w / 2 + off : this.cx - this.w / 2;
    const ny = this.axis === 'y' ? this.cyTop - this.h / 2 + off : this.cyTop - this.h / 2;
    this.dx = nx - this.x; this.dy = ny - this.y;
    this.x = nx; this.y = ny;
  }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

class Coin {
  constructor(x, y) { this.x = x; this.y = y; this.taken = false; this.t = Math.random() * 6; }
  rect() { return { x: this.x - 10, y: this.y - 10, w: 20, h: 20 }; }
}

class Spring {
  constructor(cx, cy) {
    this.x = cx * TILE + 2; this.y = cy * TILE + 18;
    this.w = TILE - 4; this.h = 14;
    this.anim = 0;
  }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

class Checkpoint {
  constructor(cx, cy) {
    this.x = cx * TILE + TILE / 2; this.y = (cy + 1) * TILE;
    this.active = false; this.t = 0;
  }
  rect() { return { x: this.x - 14, y: this.y - 48, w: 28, h: 48 }; }
}

class Walker {
  constructor(cx, cy) {
    this.x = cx * TILE + 3; this.y = cy * TILE + 10;
    this.w = 26; this.h = 22;
    this.vx = 55; this.dir = 1;
    this.dead = false; this.squashT = 0;
    this.t = Math.random() * 6;
    this.gone = false;
  }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt, lvl) {
    this.t += dt;
    if (this.dead) {
      this.squashT += dt;
      if (this.squashT > 0.45) this.gone = true;
      return;
    }
    const T = TILE;
    const aheadX = this.dir > 0 ? this.x + this.w + 2 : this.x - 2;
    const wallAhead = lvl.solidAt(Math.floor(aheadX / T), Math.floor((this.y + this.h / 2) / T));
    const floorAhead = lvl.solidAt(Math.floor(aheadX / T), Math.floor((this.y + this.h + 4) / T)) ||
      lvl.tileChar(Math.floor(aheadX / T), Math.floor((this.y + this.h + 4) / T)) === '-';
    if (wallAhead || !floorAhead) this.dir *= -1;
    this.vx = 55 * this.dir;
    this.x += this.vx * dt;
    this.vy = (this.vy || 0) + GRAV * dt;
    let ny = this.y + this.vy * dt;
    if (this.vy > 0) {
      const footRow = Math.floor((ny + this.h) / T);
      const c1 = lvl.tileChar(Math.floor((this.x + 3) / T), footRow);
      const c2 = lvl.tileChar(Math.floor((this.x + this.w - 3) / T), footRow);
      if (lvl.isSolidChar(c1) || lvl.isSolidChar(c2) || c1 === '-' || c2 === '-') {
        ny = footRow * T - this.h; this.vy = 0;
      }
    }
    this.y = ny;
    if (this.y > lvl.hpx + 300) this.gone = true;
  }
}

class Flyer {
  constructor(cx, cy) {
    this.ax = (cx + 0.5) * TILE; this.ay = (cy + 0.5) * TILE;
    this.x = this.ax - 14; this.y = this.ay - 12;
    this.w = 28; this.h = 24;
    this.t = Math.random() * 6;
    this.dead = false; this.squashT = 0; this.gone = false;
  }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) {
    this.t += dt;
    if (this.dead) {
      this.squashT += dt;
      if (this.squashT > 0.4) this.gone = true;
      return;
    }
    this.x = this.ax - this.w / 2 + Math.sin(this.t * 1.7) * 26;
    this.y = this.ay - this.h / 2 + Math.sin(this.t * 2.6) * 34;
  }
}

class Boss {
  constructor(cx, cy, arenaL, arenaR) {
    this.x = cx * TILE; this.y = cy * TILE - 32;
    this.w = 52; this.h = 62;
    this.hp = 3; this.maxHp = 3;
    this.state = 'walk';
    this.stTimer = 0;
    this.dir = -1;
    this.invuln = 0;
    this.dead = false; this.gone = false;
    this.dyingT = 0;
    this.arenaL = arenaL; this.arenaR = arenaR;
    this.t = 0;
  }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt, lvl, player) {
    this.t += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.dead) {
      this.dyingT += dt;
      this.y += 60 * dt;
      if (this.dyingT > 1.4) this.gone = true;
      return;
    }
    const enraged = this.hp <= 1;
    this.stTimer += dt;
    if (this.state === 'walk') {
      this.dir = player.cx > this.cx ? 1 : -1;
      this.x += this.dir * (enraged ? 85 : 60) * dt;
      if (this.stTimer > (enraged ? 1.8 : 2.6)) { this.state = 'tele'; this.stTimer = 0; }
    } else if (this.state === 'tele') {
      if (this.stTimer > 0.5) { this.state = 'charge'; this.stTimer = 0; this.chargeDir = player.cx > this.cx ? 1 : -1; }
    } else if (this.state === 'charge') {
      this.x += this.chargeDir * (enraged ? 360 : 300) * dt;
      if (this.stTimer > 0.55) { this.state = 'walk'; this.stTimer = 0; }
    }
    this.x = Math.max(this.arenaL, Math.min(this.arenaR - this.w, this.x));
    this.vy = (this.vy || 0) + GRAV * dt;
    let ny = this.y + this.vy * dt;
    if (this.vy > 0) {
      const footRow = Math.floor((ny + this.h) / TILE);
      const c1 = lvl.tileChar(Math.floor((this.x + 6) / TILE), footRow);
      const c2 = lvl.tileChar(Math.floor((this.x + this.w - 6) / TILE), footRow);
      if (lvl.isSolidChar(c1) || lvl.isSolidChar(c2)) { ny = footRow * TILE - this.h; this.vy = 0; }
    }
    this.y = ny;
    if (enraged && Math.random() < dt * 8) FX.spark(this.cx, this.cy, '#ff5a2b');
  }
}

class Player {
  constructor() {
    this.w = 22; this.h = 30;
    this.reset(0, 0);
  }

  configure() {
    const c = getChar(Save.data.selChar);
    this.char = c;
    this.speed = c.speed;
    this.jumpPow = c.jump;
    this.maxHp = c.hp + Save.heartsBonus();
    this.maxJumps = c.jumps + (Save.hasUpgrade('doublejump') ? 1 : 0);
    this.canDash = c.ability === 'dash';
    this.glideOn = c.ability === 'glide';
    this.magnetR = (c.ability === 'magnet' || Save.hasUpgrade('magnet')) ? 95 : 0;
    this.shieldMax = Save.hasUpgrade('shield');
  }

  reset(x, y) {
    if (!this.char) this.configure();
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.grounded = false;
    this.coyote = 0; this.jumpBuf = 0; this.jumpCut = true;
    this.jumpsLeft = this.maxJumps;
    this.hp = this.maxHp;
    this.invuln = 0;
    this.dashT = 0; this.dashCD = 0; this.airDashUsed = false;
    this.shieldActive = this.shieldMax;
    this.ride = null;
    this.dead = false; this.deadT = 0;
    this.animT = 0; this.landSquash = 0;
    this.trailT = 0;
    this.prevBottom = y + this.h;
  }

  respawnAt(cp) {
    const keepShield = this.shieldMax;
    this.reset(cp.x, cp.y);
    this.shieldActive = keepShield;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  doJump(air, lvl) {
    this.vy = -this.jumpPow;
    this.grounded = false;
    this.coyote = 0; this.jumpBuf = 0; this.jumpCut = false;
    this.ride = null;
    if (air) {
      this.jumpsLeft--;
      FX.ring(this.cx, this.y + this.h, this.char.accent);
    } else {
      FX.dust(this.cx, this.y + this.h, 4);
    }
    Audio.sfx('jump');
  }

  hurt(srcX) {
    if (this.invuln > 0 || this.dead) return;
    if (this.shieldActive) {
      this.shieldActive = false;
      this.invuln = 1.2;
      Audio.sfx('shield');
      FX.ring(this.cx, this.cy, '#7ec4ff');
      return;
    }
    this.hp--;
    Audio.sfx('hurt');
    Game.flash = 0.4;
    Game.cam.shake = Math.max(Game.cam.shake, 8);
    FX.pop(this.cx, this.cy, '#ff6b6b', 8);
    if (this.hp <= 0) {
      this.die();
    } else {
      this.invuln = 1.5;
      const dir = this.cx < srcX ? -1 : 1;
      this.vx = dir * 180; this.vy = -300;
      this.ride = null;
    }
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deadT = 0;
    this.vy = -420;
    Audio.sfx('death');
    FX.pop(this.cx, this.cy, this.char.color, 16);
    Game.cam.shake = 10;
  }

  update(dt, lvl, input) {
    this.animT += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.dashCD > 0) this.dashCD -= dt;

    if (this.dead) {
      this.deadT += dt;
      this.vy += GRAV * dt;
      this.y += this.vy * dt;
      return;
    }

    if (this.ride) {
      const r = this.ride.rect();
      this.x += this.ride.dx;
      this.y += this.ride.dy;
      if (this.x + this.w < r.x - 2 || this.x > r.x + r.w + 2) this.ride = null;
    }

    for (const s of lvl.springs) {
      if (s.anim > 0) s.anim -= dt;
      if (aabb(this.rect(), s.rect()) && this.vy >= 0) {
        this.vy = -800;
        this.grounded = false;
        this.ride = null;
        this.jumpCut = true;
        this.jumpBuf = 0;
        this.coyote = 0;
        s.anim = 0.3;
        Audio.sfx('spring');
        FX.ring(s.x + s.w / 2, s.y, '#ffe27a');
      }
    }

    const icy = lvl.themeObj.icy && this.grounded;
    const acc = this.grounded ? (icy ? 750 : 2400) : 1700;
    const fric = this.grounded ? (icy ? 220 : 2300) : 350;
    const dirIn = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.facing * 520;
      this.vy = 0;
      if (Math.random() < dt * 40) FX.spark(this.cx, this.cy, '#c792ea');
    } else {
      if (dirIn !== 0) {
        this.vx += dirIn * acc * dt;
        this.vx = Math.max(-this.speed, Math.min(this.speed, this.vx));
        this.facing = dirIn;
      } else {
        const f = fric * dt;
        if (Math.abs(this.vx) <= f) this.vx = 0; else this.vx -= Math.sign(this.vx) * f;
      }
      this.vy += GRAV * dt;
      if (this.vy > MAXFALL) this.vy = MAXFALL;
      if (this.glideOn && !this.grounded && this.vy > 0 && input.jump) {
        this.vy = Math.min(this.vy, 115);
        if (Math.random() < dt * 20) FX.spark(this.cx, this.y + this.h, '#b8c6ff');
      }
    }

    if (this.grounded) {
      this.coyote = 0.09;
      this.jumpsLeft = this.maxJumps;
      this.airDashUsed = false;
    } else {
      this.coyote -= dt;
    }
    if (input.jumpP) this.jumpBuf = 0.12; else this.jumpBuf -= dt;

    if (this.jumpBuf > 0 && this.dashT <= 0) {
      if (this.coyote > 0) {
        this.doJump(false, lvl);
      } else if (this.jumpsLeft > 0 && this.maxJumps > 1) {
        this.doJump(true, lvl);
      }
    }
    if (!input.jump && this.vy < -260 && !this.jumpCut) {
      this.vy *= 0.42;
      this.jumpCut = true;
    }

    if (input.dashP && this.canDash && this.dashCD <= 0 && !(this.airDashUsed && !this.grounded)) {
      this.dashT = 0.17;
      this.dashCD = 0.75;
      if (!this.grounded) this.airDashUsed = true;
      Audio.sfx('spring');
      FX.ring(this.cx, this.cy, '#c792ea');
    }

    const T = TILE;
    this.prevBottom = this.y + this.h;

    let nx = this.x + this.vx * dt;
    if (this.vx > 0) {
      const edgeCol = Math.floor((nx + this.w) / T);
      const r0 = Math.floor((this.y + 2) / T), r1 = Math.floor((this.y + this.h - 2) / T);
      for (let r = r0; r <= r1; r++) {
        if (lvl.solidAt(edgeCol, r)) { nx = edgeCol * T - this.w - 0.01; this.vx = 0; break; }
      }
    } else if (this.vx < 0) {
      const edgeCol = Math.floor(nx / T);
      const r0 = Math.floor((this.y + 2) / T), r1 = Math.floor((this.y + this.h - 2) / T);
      for (let r = r0; r <= r1; r++) {
        if (lvl.solidAt(edgeCol, r)) { nx = (edgeCol + 1) * T + 0.01; this.vx = 0; break; }
      }
    }
    this.x = Math.max(0, Math.min(lvl.wpx - this.w, nx));

    const wasGrounded = this.grounded;
    this.grounded = false;
    let ny = this.y + this.vy * dt;
    if (this.vy >= 0) {
      const botRow = Math.floor((ny + this.h) / T);
      const c0 = Math.floor((this.x + 2) / T), c1 = Math.floor((this.x + this.w - 2) / T);
      let landRow = -1, onB = false;
      for (let c = c0; c <= c1; c++) {
        const ch = lvl.tileChar(c, botRow);
        const solid = lvl.isSolidChar(ch, c, botRow);
        const oneway = ch === '-' && this.prevBottom <= botRow * T + 8;
        if (solid || oneway) {
          if (landRow < 0 || botRow < landRow) { landRow = botRow; onB = ch === 'B'; }
        }
      }
      if (landRow >= 0 && ny + this.h > landRow * T) {
        ny = landRow * T - this.h;
        this.vy = 0;
        this.grounded = true;
        if (!wasGrounded) {
          this.landSquash = 0.18;
          FX.dust(this.cx, ny + this.h, 5);
        }
        if (onB) {
          for (let c = c0; c <= c1; c++) lvl.triggerCrumble(c, landRow);
        }
      }
    } else {
      const topRow = Math.floor(ny / T);
      const c0 = Math.floor((this.x + 2) / T), c1 = Math.floor((this.x + this.w - 2) / T);
      for (let c = c0; c <= c1; c++) {
        if (lvl.solidAt(c, topRow)) { ny = (topRow + 1) * T + 0.01; this.vy = 0; break; }
      }
    }
    this.y = ny;

    if (this.grounded) {
      for (const m of lvl.movers) {
        const r = m.rect();
        if (this.x + this.w > r.x + 2 && this.x < r.x + r.w - 2 &&
            Math.abs(this.y + this.h - r.y) < 6) {
          this.ride = m;
          this.y = r.y - this.h;
          break;
        }
      }
    } else if (this.vy > 0) {
      for (const m of lvl.movers) {
        const r = m.rect();
        if (this.x + this.w > r.x && this.x < r.x + r.w &&
            this.prevBottom <= r.y + 8 && this.y + this.h >= r.y) {
          this.y = r.y - this.h;
          this.vy = 0;
          this.grounded = true;
          this.ride = m;
          if (!wasGrounded) { this.landSquash = 0.15; FX.dust(this.cx, r.y, 4); }
          break;
        }
      }
    }

    const hx0 = Math.floor((this.x + 5) / T), hx1 = Math.floor((this.x + this.w - 5) / T);
    const hy0 = Math.floor((this.y + 4) / T), hy1 = Math.floor((this.y + this.h - 2) / T);
    for (let cy2 = hy0; cy2 <= hy1; cy2++) {
      for (let cx2 = hx0; cx2 <= hx1; cx2++) {
        const ch = lvl.tileChar(cx2, cy2);
        if (ch === '^') this.hurt((cx2 + 0.5) * T);
        else if (ch === '~') {
          this.hurt((cx2 + 0.5) * T);
          if (!this.dead) { this.vy = -580; this.ride = null; }
        }
      }
    }

    if (!this.dead && this.y > lvl.hpx + 48) this.die();

    if (this.landSquash > 0) this.landSquash -= dt;
    if (this.magnetR > 0) {
      for (const c of lvl.coins) {
        if (c.taken) continue;
        const dx = this.cx - c.x, dy = this.cy - c.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < this.magnetR * this.magnetR) {
          const d = Math.sqrt(d2) || 1;
          c.x += (dx / d) * 260 * dt;
          c.y += (dy / d) * 260 * dt;
        }
      }
    }

    const moving = Math.abs(this.vx) > 40 && this.grounded;
    const trailColor = getTrail(Save.data.trail).color;
    this.trailT -= dt;
    if ((moving || !this.grounded) && trailColor !== '#ffffff' && this.trailT <= 0) {
      this.trailT = 0.035;
      FX.trail(this.cx, this.cy, trailColor);
    }
  }
}

const FX = {
  arr: [],
  spawn(p) { if (this.arr.length < 500) this.arr.push(Object.assign({ t: 0, g: 0, rot: 0, vr: 0 }, p)); },
  dust(x, y, n) {
    for (let i = 0; i < n; i++) this.spawn({
      x: x + (Math.random() - 0.5) * 14, y, vx: (Math.random() - 0.5) * 70,
      vy: -Math.random() * 50, life: 0.4, size: 3 + Math.random() * 3,
      color: 'rgba(255,255,255,0.55)', type: 'circle'
    });
  },
  spark(x, y, color) {
    this.spawn({
      x, y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120,
      life: 0.35, size: 2 + Math.random() * 2, color, type: 'circle'
    });
  },
  pop(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 140;
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 400,
        life: 0.6 + Math.random() * 0.3, size: 3 + Math.random() * 3,
        color, type: 'rect', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12
      });
    }
  },
  ring(x, y, color) {
    this.spawn({ x, y, life: 0.35, size: 6, color, type: 'ring' });
  },
  confetti(x, y) {
    const colors = ['#ffd34d', '#ff6b6b', '#7ec4ff', '#8ee08e', '#c792ea', '#ffab5e'];
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, sp = 100 + Math.random() * 260;
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 150, g: 500,
        life: 1 + Math.random() * 0.7, size: 3 + Math.random() * 4,
        color: colors[(Math.random() * colors.length) | 0],
        type: 'rect', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14
      });
    }
  },
  trail(x, y, color) {
    this.spawn({ x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 10, vx: 0, vy: -20, life: 0.4, size: 4, color, type: 'traildot' });
  },
  update(dt) {
    const arr = this.arr;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.t += dt;
      if (p.t >= p.life) { arr.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += (p.vr || 0) * dt;
    }
  },
  draw(ctx, camX, camY) {
    for (const p of this.arr) {
      const a = 1 - p.t / p.life;
      ctx.save();
      ctx.globalAlpha = a;
      if (p.type === 'rect') {
        ctx.translate(p.x - camX, p.y - camY);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else if (p.type === 'circle' || p.type === 'traildot') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x - camX, p.y - camY, p.size * (p.type === 'traildot' ? a : 1), 0, 7);
        ctx.fill();
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * a;
        ctx.beginPath();
        ctx.arc(p.x - camX, p.y - camY, p.size + (1 - a) * 26, 0, 7);
        ctx.stroke();
      }
      ctx.restore();
    }
  },
  clear() { this.arr.length = 0; }
};
