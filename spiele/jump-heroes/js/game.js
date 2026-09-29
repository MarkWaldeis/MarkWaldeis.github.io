'use strict';

class Level {
  constructor(def, idx) {
    this.def = def;
    this.idx = idx;
    this.w = def.w;
    this.h = def.h;
    this.wpx = def.w * TILE;
    this.hpx = def.h * TILE;
    this.themeObj = THEMES[def.theme];
    this.grid = def.grid.map(row => row.split(''));
    this.coins = [];
    this.enemies = [];
    this.movers = [];
    this.springs = [];
    this.checkpoints = [];
    this.spawn = { x: 64, y: 64 };
    this.goal = { x: 0, y: 0 };
    this.keyEnt = null;
    this.doorsOpen = false;
    this.crumbles = new Map();
    this.boss = null;
    this.bossAlive = false;
    this.bossDefeated = false;
    this.arena = null;
    this.time = 0;
    this.staticCanvas = null;

    let moverIdx = 0;
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        const ch = this.grid[r][c];
        const px = c * TILE, py = r * TILE;
        switch (ch) {
          case 'P':
            this.spawn = { x: px + 5, y: py + 2 };
            this.grid[r][c] = '.';
            break;
          case 'G':
            this.goal = { x: px + TILE / 2, y: py + TILE };
            this.grid[r][c] = '.';
            break;
          case 'o':
            this.coins.push(new Coin(px + TILE / 2, py + TILE / 2));
            this.grid[r][c] = '.';
            break;
          case 'E':
            this.enemies.push(new Walker(c, r));
            this.grid[r][c] = '.';
            break;
          case 'F':
            this.enemies.push(new Flyer(c, r));
            this.grid[r][c] = '.';
            break;
          case 'X': {
            const b = new Boss(c, r, Math.max(0, (c - 9) * TILE), Math.min(this.wpx, (c + 10) * TILE));
            b.y = (r + 1) * TILE - b.h;
            this.boss = b;
            this.bossAlive = true;
            this.arena = { l: b.arenaL, r: b.arenaR };
            this.enemies.push(b);
            this.grid[r][c] = '.';
            break;
          }
          case 's':
            this.springs.push(new Spring(c, r));
            this.grid[r][c] = '.';
            break;
          case 'C':
            this.checkpoints.push(new Checkpoint(c, r));
            this.grid[r][c] = '.';
            break;
          case 'K':
            this.keyEnt = { x: px + TILE / 2, y: py + TILE / 2, taken: false, t: 0 };
            this.grid[r][c] = '.';
            break;
          case 'M':
            this.movers.push(new MovingPlat(c, r, 'x', moverIdx++));
            this.grid[r][c] = '.';
            break;
          case 'V':
            this.movers.push(new MovingPlat(c, r, 'y', moverIdx++));
            this.grid[r][c] = '.';
            break;
        }
      }
    }
    this.checkpoints.sort((a, b) => a.x - b.x);

    // Oberkanten der Lava für Blubber-Partikel merken
    this.lavaTops = [];
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        if (this.grid[r][c] === '~' && this.tileChar(c, r - 1) !== '~') {
          this.lavaTops.push({ x: c * TILE + TILE / 2, y: r * TILE });
        }
      }
    }

    this.buildStatic();
  }

  // Alle unveränderlichen Tiles ('#', '-', '^') einmalig in eine Ebene zeichnen.
  // Pro Frame wird dann nur noch ein drawImage + die dynamischen Tiles ('B', 'D', '~') gerendert.
  buildStatic() {
    const cvs = document.createElement('canvas');
    cvs.width = this.wpx;
    cvs.height = this.hpx;
    const ctx = cvs.getContext('2d');
    const th = this.themeObj;
    const T = TILE;
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        const ch = this.grid[r][c];
        if (ch !== '#' && ch !== '-' && ch !== '^') continue;
        const x = c * T, y = r * T;
        if (ch === '#') {
          const openL = !this.isSolidChar(this.tileChar(c - 1, r), c - 1, r);
          const openR = !this.isSolidChar(this.tileChar(c + 1, r), c + 1, r);
          const openB = !this.isSolidChar(this.tileChar(c, r + 1), c, r + 1) && this.tileChar(c, r + 1) !== '-';
          const topOpen = !this.isSolidChar(this.tileChar(c, r - 1), c, r - 1) || this.tileChar(c, r - 1) === 'D';
          ctx.fillStyle = th.dirtDark;
          ctx.fillRect(x, y, T, T);
          ctx.fillStyle = th.dirt;
          ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
          // dezente Erdflecken (deterministisch)
          const fleck = (c * 7 + r * 13) % 5;
          if (fleck === 0) {
            ctx.fillStyle = th.dirtDark;
            ctx.fillRect(x + 8, y + 12, 6, 4);
          } else if (fleck === 2) {
            ctx.fillStyle = 'rgba(255,255,255,0.07)';
            ctx.fillRect(x + 18, y + 8, 5, 3);
          }
          if (((c * 11 + r * 5) % 7) === 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.fillRect(x + 20, y + 20, 4, 3);
          }
          if (openL) { ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(x, y, 3, T); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x + 3, y + 2, 2, T - 4); }
          if (openR) { ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(x + T - 3, y, 3, T); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x + T - 5, y + 2, 2, T - 4); }
          if (openB) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x + 2, y + T - 4, T - 4, 4); }
          if (topOpen) {
            ctx.fillStyle = th.topDark;
            ctx.fillRect(x, y, T, 12);
            ctx.fillStyle = th.top;
            ctx.fillRect(x, y, T, 8);
            // Grashalme auf der Oberkante
            ctx.strokeStyle = th.topDark;
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            const blades = 2 + ((c * 5 + r * 3) % 2);
            for (let b = 0; b < blades; b++) {
              const bx = x + 4 + ((c * 13 + b * 11 + r * 7) % 24);
              ctx.beginPath();
              ctx.moveTo(bx, y + 1);
              ctx.lineTo(bx + (((c + b) % 2) ? 2 : -1), y - 3 - ((c + b * 2) % 3));
              ctx.stroke();
            }
            if (th.icy) {
              ctx.fillStyle = 'rgba(255,255,255,0.65)';
              ctx.fillRect(x, y, T, 3);
              if (((c + r) % 3) === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.fillRect(x + 6, y + 8, 2, 4);
                ctx.fillRect(x + 22, y + 8, 2, 5);
              }
            } else if (th === THEMES.volcano) {
              // heiße Kanten am Vulkangestein
              if (((c * 3 + r) % 4) === 0) {
                ctx.fillStyle = 'rgba(255,110,50,0.35)';
                ctx.fillRect(x + 4, y + 8, T - 8, 2);
              }
            }
          }
        } else if (ch === '-') {
          ctx.fillStyle = th.dirtDark;
          Game.roundRect(ctx, x - 1, y + 2, T + 2, 12, 5);
          ctx.fill();
          ctx.fillStyle = th.top;
          Game.roundRect(ctx, x - 1, y, T + 2, 10, 5);
          ctx.fill();
          ctx.strokeStyle = th.topDark;
          ctx.lineWidth = 1.4;
          const bx = x + 6 + ((c * 9) % 16);
          ctx.beginPath();
          ctx.moveTo(bx, y + 1);
          ctx.lineTo(bx + 2, y - 3);
          ctx.stroke();
        } else if (ch === '^') {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(x, y + T - 5, T, 5);
          ctx.fillStyle = '#5a5f6a';
          ctx.fillRect(x, y + T - 8, T, 4);
          const spikeCol = th.icy ? '#dff4ff' : '#c8ccd8';
          const spikeDark = th.icy ? '#a8cbe0' : '#8e94a4';
          for (let i = 0; i < 2; i++) {
            const bx = x + i * 16;
            ctx.fillStyle = spikeCol;
            ctx.beginPath();
            ctx.moveTo(bx + 1, y + T - 4);
            ctx.lineTo(bx + 8, y + 6);
            ctx.lineTo(bx + 15, y + T - 4);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = spikeDark;
            ctx.beginPath();
            ctx.moveTo(bx + 8, y + 6);
            ctx.lineTo(bx + 15, y + T - 4);
            ctx.lineTo(bx + 8, y + T - 4);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
    this.staticCanvas = cvs;
  }

  tileChar(c, r) {
    if (r < 0 || r >= this.h) return '.';
    if (c < 0 || c >= this.w) return '#';
    return this.grid[r][c];
  }

  crumbleState(c, r) {
    const s = this.crumbles.get(c + ',' + r);
    return s ? s.state : 'idle';
  }

  isSolidChar(ch, c, r) {
    if (ch === '#') return true;
    if (ch === 'B') return this.crumbleState(c, r) !== 'gone';
    if (ch === 'D') return !this.doorsOpen;
    return false;
  }

  solidAt(c, r) {
    return this.isSolidChar(this.tileChar(c, r), c, r);
  }

  triggerCrumble(c, r) {
    if (this.tileChar(c, r) !== 'B') return;
    const k = c + ',' + r;
    let s = this.crumbles.get(k);
    if (!s) { this.crumbles.set(k, { state: 'shake', t: 0 }); Audio.sfx('stomp'); }
  }

  updateCrumbles(dt) {
    for (const [k, s] of this.crumbles) {
      s.t += dt;
      if (s.state === 'shake' && s.t > 0.85) { s.state = 'gone'; s.t = 0; }
      else if (s.state === 'gone' && s.t > 2.4) this.crumbles.delete(k);
    }
  }

  update(dt, player, input) {
    this.time += dt;
    this.updateCrumbles(dt);
    for (const m of this.movers) m.update(dt);
    player.update(dt, this, input);

    // Lava-Blubber an der Oberfläche
    if (this.lavaTops.length && Math.random() < dt * 6) {
      const camL = Game.cam.x - 40, camR = Game.cam.x + VIEW_W + 40;
      for (let tries = 0; tries < 5; tries++) {
        const lt = this.lavaTops[(Math.random() * this.lavaTops.length) | 0];
        if (lt.x > camL && lt.x < camR) {
          FX.spawn({
            x: lt.x + (Math.random() - 0.5) * 22, y: lt.y + 12,
            vx: (Math.random() - 0.5) * 26, vy: -(50 + Math.random() * 90),
            g: 320, life: 0.45 + Math.random() * 0.45,
            size: 2 + Math.random() * 3,
            color: Math.random() < 0.5 ? '#ffd23d' : '#ff7b39', type: 'circle'
          });
          break;
        }
      }
    }

    for (const c of this.coins) {
      if (c.taken) continue;
      c.t += dt;
      c.tw -= dt;
      if (c.tw <= 0) {
        c.tw = 1.6 + Math.random() * 2.8;
        if (Math.abs(c.x - (Game.cam.x + VIEW_W / 2)) < VIEW_W * 0.6) FX.twinkle(c.x + 5, c.y - 6);
      }
      if (aabb(player.rect(), c.rect())) {
        c.taken = true;
        Game.coinsRun++;
        Save.addCoins(COIN_VALUE);
        Audio.sfx('coin');
        FX.spark(c.x, c.y, '#ffd34d');
        FX.spark(c.x, c.y, '#fff3b0');
        UI.hudDirty = true;
      }
    }

    for (const cp of this.checkpoints) {
      if (!cp.active && aabb(player.rect(), cp.rect())) {
        cp.active = true;
        Game.cp = { x: cp.x - player.w / 2, y: cp.y - player.h - 1 };
        player.hp = player.maxHp;
        Audio.sfx('check');
        FX.ring(cp.x, cp.y - 30, '#8ee08e');
        UI.toast('Checkpoint!', 1200);
      }
      cp.t += dt;
    }

    if (this.keyEnt && !this.keyEnt.taken) {
      this.keyEnt.t += dt;
      const kr = { x: this.keyEnt.x - 12, y: this.keyEnt.y - 12, w: 24, h: 24 };
      if (aabb(player.rect(), kr)) {
        this.keyEnt.taken = true;
        this.doorsOpen = true;
        Audio.sfx('key');
        setTimeout(() => Audio.sfx('door'), 250);
        FX.spark(this.keyEnt.x, this.keyEnt.y, '#ffd34d');
        FX.confetti(this.keyEnt.x, this.keyEnt.y);
        UI.toast('Schlüssel gefunden – das Tor öffnet sich!', 2200);
      }
    }

    const gr = { x: this.goal.x - 18, y: this.goal.y - 100, w: 36, h: 104 };
    if (Game.state === 'play' && aabb(player.rect(), gr)) {
      Game.triggerWin();
    }
    if (Math.random() < dt * 2.4 && Math.abs(this.goal.x - (Game.cam.x + VIEW_W / 2)) < VIEW_W * 0.7) {
      FX.twinkle(this.goal.x + (Math.random() - 0.5) * 34, this.goal.y - 20 - Math.random() * 70);
    }

    for (const e of this.enemies) {
      e.update(dt, this, player);
      if (e.dead || e.gone || player.dead) continue;
      const er = e.rect();
      if (!aabb(player.rect(), er)) continue;
      const stomp = player.vy > 0 && player.prevBottom <= er.y + er.h * 0.55;
      if (e instanceof Boss) {
        if (stomp) {
          player.vy = input.jump ? -player.jumpPow * 0.95 : -360;
          if (e.invuln <= 0) {
            e.hp--;
            e.invuln = 1;
            Audio.sfx('bosshit');
            Game.hitstop = Math.max(Game.hitstop, 0.06);
            Game.cam.shake = 9;
            FX.pop(e.cx, e.cy, '#ff6b4a', 12);
            if (e.hp <= 0) {
              e.dead = true;
              this.bossAlive = false;
              this.bossDefeated = true;
              Audio.sfx('bossdie');
              FX.confetti(e.cx, e.cy);
              Game.cam.shake = 14;
              UI.toast('Boss besiegt!! Tor zum Ausgang ist frei!', 2600);
            } else {
              UI.toast('Treffer! Noch ' + e.hp + 'x auf den Kopf!', 1100);
            }
            UI.hudDirty = true;
          }
        } else {
          player.hurt(e.cx);
        }
      } else if (stomp) {
        e.dead = true;
        Audio.sfx('stomp');
        FX.pop(e.cx, e.cy, '#a06ad0', 10);
        Game.hitstop = Math.max(Game.hitstop, 0.05);
        player.vy = input.jump ? -player.jumpPow * 0.92 : -340;
        Game.cam.shake = Math.max(Game.cam.shake, 4);
      } else {
        player.hurt(e.cx);
      }
    }
    this.enemies = this.enemies.filter(e => !e.gone);

    if (this.bossAlive && this.arena && !player.dead) {
      player.x = Math.max(this.arena.l, Math.min(this.arena.r - player.w, player.x));
    }
  }
}

const Input = {
  left: false, right: false, down: false, jump: false, jumpP: false, dashP: false
};

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump'
};

const Game = {
  canvas: null,
  ctx: null,
  state: 'boot',
  levelIdx: 0,
  level: null,
  player: new Player(),
  cam: { x: 0, y: 0, shake: 0 },
  flash: 0,
  coinsRun: 0,
  deaths: 0,
  time: 0,
  cp: null,
  winStats: null,
  menuCamX: 0,
  weather: [],
  vignette: null,
  hitstop: 0,
  menuHero: null,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.bindInput();
    this.vignette = this.makeVignette();
    this.state = 'menu';
    Audio.applyVolumes();
    Audio.playMusic('menu');
    UI.show('main');
    if (!window.__AUTOTEST__) {
      let last = performance.now();
      const loop = (now) => {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 0.1) dt = 0.1;
        this.step(dt);
        this.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  },

  bindInput() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') return;
      const k = KEYMAP[e.code];
      if (k) {
        if (k === 'jump' && !Input.jump && !e.repeat) Input.jumpP = true;
        Input[k] = true;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      }
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyX' || e.code === 'KeyJ') && !e.repeat) {
        Input.dashP = true;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (!e.repeat) this.handlePauseKey();
      }
    });
    document.addEventListener('keyup', (e) => {
      const k = KEYMAP[e.code];
      if (k) Input[k] = false;
    });
    window.addEventListener('blur', () => {
      Input.left = Input.right = Input.down = Input.jump = false;
    });
    this.bindTouch();
  },

  bindTouch() {
    const bind = (id, down, up) => {
      const el = document.getElementById(id);
      if (!el) return;
      const d = (e) => { e.preventDefault(); down(); };
      const u = (e) => { e.preventDefault(); up(); };
      el.addEventListener('pointerdown', d);
      el.addEventListener('pointerup', u);
      el.addEventListener('pointerleave', u);
      el.addEventListener('pointercancel', u);
    };
    bind('touch-left', () => { Input.left = true; }, () => { Input.left = false; });
    bind('touch-right', () => { Input.right = true; }, () => { Input.right = false; });
    bind('touch-jump', () => { if (!Input.jump) Input.jumpP = true; Input.jump = true; }, () => { Input.jump = false; });
    bind('touch-dash', () => { Input.dashP = true; }, () => {});
  },

  handlePauseKey() {
    if (this.state === 'play') this.setPaused(true);
    else if (this.state === 'paused') this.setPaused(false);
    else if (['levels', 'chars', 'shop', 'settings', 'credits'].includes(UI.current)) UI.show('main');
  },

  setPaused(p) {
    if (p && this.state === 'play') {
      this.state = 'paused';
      UI.showOverlay('pause');
    } else if (!p && this.state === 'paused') {
      this.state = 'play';
      UI.hideOverlays();
    }
  },

  startLevel(i, opts = {}) {
    this.levelIdx = i;
    this.level = new Level(LEVELS[i], i);
    this.player.configure();
    this.cp = { x: this.level.spawn.x, y: this.level.spawn.y };
    this.player.reset(this.level.spawn.x, this.level.spawn.y);
    this.player.shieldActive = Save.hasUpgrade('shield');
    this.coinsRun = 0;
    this.deaths = 0;
    this.time = 0;
    this.flash = 0;
    this.cam.shake = 0;
    FX.clear();
    this.snapCamera();
    this.weather = [];
    this.hitstop = 0;
    Input.jumpP = false;
    Input.dashP = false;
    this.state = 'play';
    UI.enterGame();
    Audio.playMusic(this.level.def.theme === 'green' ? 'green' : this.level.def.theme === 'ice' ? 'ice' : 'volcano');
    if (!opts.silent) {
      UI.toast(LEVELS[i].name + ' – ' + LEVELS[i].hint, 3200);
    }
    UI.hudDirty = true;
  },

  quitToMenu() {
    this.state = 'menu';
    this.level = null;
    FX.clear();
    UI.show('main');
    Audio.playMusic('menu');
  },

  restartLevel() {
    UI.hideOverlays();
    this.startLevel(this.levelIdx);
  },

  snapCamera() {
    const tx = this.player.cx - VIEW_W / 2;
    const ty = this.player.cy - VIEW_H * 0.6;
    this.cam.x = this.clampCam(tx, this.level.wpx, VIEW_W);
    this.cam.y = this.clampCam(ty, this.level.hpx, VIEW_H);
  },

  clampCam(v, worldSize, viewSize) {
    if (worldSize <= viewSize) return (worldSize - viewSize) / 2;
    return Math.max(0, Math.min(worldSize - viewSize, v));
  },

  doRespawn() {
    this.deaths++;
    this.player.respawnAt(this.cp);
    this.flash = 0.35;
    this.snapCamera();
    UI.hudDirty = true;
  },

  triggerWin() {
    if (this.state !== 'play') return;
    this.state = 'win';
    const lvl = this.level;
    const total = lvl.coins.length;
    let got = 0;
    for (const c of lvl.coins) if (c.taken) got++;
    const pct = total > 0 ? got / total : 1;
    const stars = 1 + (pct >= 0.8 ? 1 : 0) + (this.deaths <= 2 ? 1 : 0);
    const oldStars = Save.getStars(this.levelIdx);
    let bonus = 0;
    if (stars >= 2 && oldStars < 2) bonus += 25;
    if (stars >= 3 && oldStars < 3) bonus += 75;
    if (bonus > 0) Save.addCoins(bonus);
    Save.setStars(this.levelIdx, stars);
    Save.flush();
    this.winStats = {
      stars, pct, got, total,
      coins: this.coinsRun * COIN_VALUE,
      deaths: this.deaths,
      time: this.time,
      bonus,
      hasNext: this.levelIdx + 1 < LEVELS.length
    };
    Audio.sfx('win');
    FX.confetti(this.player.cx, this.player.cy - 20);
    UI.showWin(this.winStats, this.levelIdx);
  },

  step(dt) {
    if (this.state === 'menu') {
      this.menuCamX += 42 * dt;
      this.updateWeather(dt, THEMES.green);
      FX.update(dt);
      this.updateMenuHero(dt);
      Input.jumpP = false;
      Input.dashP = false;
      return;
    }
    if (this.state === 'paused') {
      Input.jumpP = false;
      Input.dashP = false;
      return;
    }
    if (!this.level) return;

    if (this.state === 'play') {
      if (this.hitstop > 0) {
        this.hitstop -= dt;
      } else {
        this.time += dt;
        this.level.update(dt, this.player, Input);
        if (this.player.dead && this.player.deadT > 1.05) this.doRespawn();
      }
    } else if (this.state === 'win') {
      this.player.animT += dt;
      FX.update(dt);
    }

    this.updateWeather(dt, this.level.themeObj);
    FX.update(dt);

    const p = this.player;
    const tx = p.cx - VIEW_W / 2 + p.facing * 46;
    // leichter Blick nach unten bei schnellem Fall, nach oben beim Sprung
    const lookY = Math.max(-36, Math.min(54, p.vy * 0.055));
    const ty = p.cy - VIEW_H * 0.58 + lookY;
    const f = Math.min(1, dt * 8);
    this.cam.x += (this.clampCam(tx, this.level.wpx, VIEW_W) - this.cam.x) * f;
    this.cam.y += (this.clampCam(ty, this.level.hpx, VIEW_H) - this.cam.y) * f;
    if (this.cam.shake > 0) this.cam.shake = Math.max(0, this.cam.shake - dt * 26);
    if (this.flash > 0) this.flash -= dt;

    UI.updateHUD();
    Input.jumpP = false;
    Input.dashP = false;
  },

  updateWeather(dt, theme) {
    const kind = theme.weather;
    const target = kind === 'embers' ? 34 : 44;
    while (this.weather.length < target) {
      this.weather.push({
        x: Math.random() * (VIEW_W + 200) - 100,
        y: kind === 'embers' ? VIEW_H + 20 : -20,
        sp: 20 + Math.random() * 46,
        sz: 2 + Math.random() * 3.5,
        ph: Math.random() * 7,
        t: 0
      });
    }
    for (const w of this.weather) {
      w.t += dt;
      if (kind === 'embers') {
        w.y -= w.sp * dt;
        w.x += Math.sin(w.t * 2 + w.ph) * 24 * dt;
        if (w.y < -20) { w.y = VIEW_H + 20; w.x = Math.random() * (VIEW_W + 200) - 100; }
      } else {
        w.y += w.sp * dt;
        w.x += Math.sin(w.t * 1.6 + w.ph) * 30 * dt + (kind === 'leaves' ? 22 * dt : 0);
        if (w.y > VIEW_H + 20) { w.y = -20; w.x = Math.random() * (VIEW_W + 200) - 100; }
      }
    }
  },

  // Kleiner Held, der im Menü über die Wiese hüpft (zeigt den gewählten Charakter)
  updateMenuHero(dt) {
    if (!this.menuHero) {
      this.menuHero = new Player();
      this.menuHero.configure();
      this.menuHero.shieldActive = false;
      this.menuHero.jumpTimer = 1.6;
      this.menuHero.y = VIEW_H - 44 - this.menuHero.h;
      this.menuHero.grounded = true;
    }
    const h = this.menuHero;
    if (h.char.id !== Save.data.selChar) { h.configure(); h.shieldActive = false; }
    const groundY = VIEW_H - 44;
    h.shadowFloor = groundY;
    h.animT += dt;
    h.facing = 1;
    h.vx = 150;
    h.x = this.menuCamX + VIEW_W * 0.30 - h.w / 2;
    if (h.grounded) {
      if (h.landSquash > 0) h.landSquash -= dt;
      h.jumpTimer -= dt;
      if (h.jumpTimer <= 0) {
        h.jumpTimer = 2.4 + Math.random() * 2.2;
        h.grounded = false;
        h.vy = -390;
        FX.dust(h.cx, h.y + h.h, 3);
      }
    } else {
      h.vy += GRAV * dt;
      h.y += h.vy * dt;
      if (h.y + h.h >= groundY) {
        h.y = groundY - h.h;
        h.vy = 0;
        h.grounded = true;
        h.landSquash = 0.2;
        FX.dust(h.cx, groundY, 4);
      }
    }
  },

  makeVignette() {
    const c = document.createElement('canvas');
    c.width = VIEW_W; c.height = VIEW_H;
    const g = c.getContext('2d');
    const rad = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
    rad.addColorStop(0, 'rgba(0,0,0,0)');
    rad.addColorStop(1, 'rgba(0,0,0,0.32)');
    g.fillStyle = rad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    return c;
  },

  render() {
    const ctx = this.ctx;
    const inGame = this.level && this.state !== 'menu';
    const theme = inGame ? this.level.themeObj : THEMES.green;
    const camX = inGame ? this.cam.x : this.menuCamX;
    const camY = inGame ? this.cam.y : 0;

    let shx = 0, shy = 0;
    if (this.cam.shake > 0) {
      shx = (Math.random() - 0.5) * this.cam.shake;
      shy = (Math.random() - 0.5) * this.cam.shake;
    }

    ctx.save();
    ctx.translate(shx, shy);
    this.drawBackground(ctx, theme, camX, inGame ? camY : 0);
    if (inGame) {
      this.drawTiles(ctx, theme, camX, camY);
      this.drawDecor(ctx, camX, camY);
      for (const m of this.level.movers) this.drawMover(ctx, m, camX, camY);
      for (const c of this.level.coins) if (!c.taken) this.drawCoin(ctx, c, camX, camY);
      if (this.level.keyEnt && !this.level.keyEnt.taken) this.drawKey(ctx, this.level.keyEnt, camX, camY);
      for (const e of this.level.enemies) this.drawEnemy(ctx, e, camX, camY);
      const p = this.player;
      const blink = p.invuln > 0 && Math.floor(p.invuln * 11) % 2 === 0;
      if (!blink && !(p.dead && p.deadT > 0.35)) this.drawPlayer(ctx, p, camX, camY);
      FX.draw(ctx, camX, camY);
    } else {
      this.drawMenuGround(ctx, camX);
      if (this.menuHero) this.drawPlayer(ctx, this.menuHero, camX, 0);
      FX.draw(ctx, camX, camY);
    }
    ctx.restore();

    this.drawWeather(ctx, theme);
    ctx.drawImage(this.vignette, 0, 0);
    if (this.flash > 0) {
      ctx.fillStyle = 'rgba(255,40,40,' + (this.flash * 0.9) + ')';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  },

  drawBackground(ctx, theme, camX, camY) {
    if (!theme._sky) {
      const g = this.ctx.createLinearGradient(0, 0, 0, VIEW_H);
      g.addColorStop(0, theme.skyTop);
      g.addColorStop(1, theme.skyBot);
      theme._sky = g;
    }
    ctx.fillStyle = theme._sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const sunX = VIEW_W * 0.78 - (camX * 0.03) % (VIEW_W * 1.6);
    if (theme === THEMES.volcano) {
      ctx.fillStyle = 'rgba(255,120,60,0.25)';
      ctx.beginPath(); ctx.arc(VIEW_W * 0.78, VIEW_H * 0.3, 90, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffcf6e';
      ctx.beginPath(); ctx.arc(VIEW_W * 0.78, VIEW_H * 0.3, 42, 0, 7); ctx.fill();
      // Vulkan-Silhouette mit glühendem Krater
      const vx = VIEW_W * 0.5 - ((camX * 0.15) % (VIEW_W * 1.8));
      ctx.fillStyle = '#22102a';
      ctx.beginPath();
      ctx.moveTo(vx - 260, VIEW_H);
      ctx.lineTo(vx - 70, VIEW_H * 0.36);
      ctx.lineTo(vx + 70, VIEW_H * 0.36);
      ctx.lineTo(vx + 260, VIEW_H);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,110,50,0.85)';
      ctx.beginPath();
      ctx.moveTo(vx - 70, VIEW_H * 0.36);
      ctx.lineTo(vx - 46, VIEW_H * 0.415);
      ctx.lineTo(vx - 18, VIEW_H * 0.38);
      ctx.lineTo(vx + 8, VIEW_H * 0.42);
      ctx.lineTo(vx + 38, VIEW_H * 0.375);
      ctx.lineTo(vx + 70, VIEW_H * 0.36);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,240,0.9)';
      ctx.beginPath(); ctx.arc(sunX, VIEW_H * 0.2, 34, 0, 7); ctx.fill();
      if (theme === THEMES.ice) {
        // sanfte Aurora-Bänder
        ctx.save();
        ctx.globalAlpha = 0.16;
        for (let i = 0; i < 2; i++) {
          const ay = 60 + i * 46 + Math.sin(camX * 0.002 + i * 2) * 14;
          const ag = ctx.createLinearGradient(0, ay, 0, ay + 60);
          ag.addColorStop(0, i === 0 ? '#8fffcf' : '#b48cff');
          ag.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = ag;
          ctx.beginPath();
          ctx.moveTo(0, ay);
          for (let x = 0; x <= VIEW_W; x += 40) {
            ctx.lineTo(x, ay + Math.sin(x * 0.008 + camX * 0.004 + i * 3) * 18);
          }
          ctx.lineTo(VIEW_W, ay + 60);
          ctx.lineTo(0, ay + 60);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.fillStyle = theme === THEMES.ice ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 4; i++) {
        const cx2 = ((i * 337 + 80 - camX * 0.12) % (VIEW_W + 260)) - 130;
        const cy2 = 60 + (i % 2) * 46;
        ctx.beginPath();
        ctx.ellipse(cx2, cy2, 52, 17, 0, 0, 7);
        ctx.ellipse(cx2 + 34, cy2 - 8, 34, 13, 0, 0, 7);
        ctx.fill();
      }
      // zweite, schnellere Wolkenschicht
      ctx.fillStyle = theme === THEMES.ice ? 'rgba(230,242,255,0.4)' : 'rgba(255,255,255,0.22)';
      for (let i = 0; i < 3; i++) {
        const cx3 = ((i * 449 + 300 - camX * 0.24) % (VIEW_W + 300)) - 150;
        const cy3 = 130 + (i % 2) * 52;
        ctx.beginPath();
        ctx.ellipse(cx3, cy3, 34, 11, 0, 0, 7);
        ctx.ellipse(cx3 + 24, cy3 - 6, 22, 9, 0, 0, 7);
        ctx.fill();
      }
    }
    // ferne Bergkette (nicht im Vulkan – dort zeichnet der Schlot selbst)
    if (theme !== THEMES.volcano) {
      this.drawMountains(ctx, theme === THEMES.ice ? '#b6d3ec' : '#90cba9', camX * 0.12, VIEW_H * 0.66, 132, 300);
    }
    this.drawHills(ctx, theme.hillFar, camX * 0.25, 46, VIEW_H * 0.62, 1.7);
    this.drawHills(ctx, theme.hillNear, camX * 0.5, 62, VIEW_H * 0.74, 3.1);
    this.drawSilhouettes(ctx, theme, camX, camY || 0);
  },

  // Bergketten mit Schneekappen, sehr langsamer Parallax
  drawMountains(ctx, color, offset, baseY, peakH, spacing) {
    const i0 = Math.floor(offset / spacing) - 1;
    const i1 = i0 + Math.ceil(VIEW_W / spacing) + 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-spacing, VIEW_H);
    const peaks = [];
    for (let i = i0; i <= i1; i++) {
      const px = i * spacing - offset;
      const hv = peakH * (0.6 + (((i * 2654435761) >>> 0) % 1000) / 1000 * 0.75);
      peaks.push({ px, h: hv });
      ctx.lineTo(px - spacing * 0.5, baseY);
      ctx.lineTo(px, baseY - hv);
      ctx.lineTo(px + spacing * 0.5, baseY);
    }
    ctx.lineTo(VIEW_W + spacing, VIEW_H);
    ctx.closePath();
    ctx.fill();
    // Schneekappen
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const pk of peaks) {
      ctx.beginPath();
      ctx.moveTo(pk.px - pk.h * 0.18, baseY - pk.h * 0.82);
      ctx.lineTo(pk.px, baseY - pk.h);
      ctx.lineTo(pk.px + pk.h * 0.18, baseY - pk.h * 0.82);
      ctx.lineTo(pk.px + pk.h * 0.1, baseY - pk.h * 0.78);
      ctx.lineTo(pk.px, baseY - pk.h * 0.83);
      ctx.lineTo(pk.px - pk.h * 0.09, baseY - pk.h * 0.77);
      ctx.closePath();
      ctx.fill();
    }
  },

  // Vordergrund-Silhouetten (Bäume, Tannen, Felsen) zwischen Hügeln und Tiles
  drawSilhouettes(ctx, theme, camX, camY) {
    const par = 0.68;
    const spacing = 168;
    const off = camX * par;
    const i0 = Math.floor(off / spacing) - 1;
    const i1 = Math.ceil((off + VIEW_W) / spacing) + 1;
    const baseY = VIEW_H - 14 - camY * 0.12;
    const hash = (i, s) => {
      let h = (i * 2654435761 + s * 97) >>> 0;
      h = ((h ^ (h >> 13)) * 1103515245) >>> 0;
      return ((h ^ (h >> 16)) >>> 0) / 4294967296;
    };
    for (let i = i0; i <= i1; i++) {
      const x = i * spacing - off + hash(i, 3) * 90;
      const kind = hash(i, 7);
      const sc = 0.75 + hash(i, 11) * 0.6;
      ctx.save();
      ctx.translate(x, baseY);
      ctx.scale(sc, sc);
      if (theme === THEMES.green) {
        if (kind < 0.62) {
          // Baum: Stamm + zwei Kronen-Kugeln
          ctx.fillStyle = '#3d7a4a';
          ctx.fillRect(-4, -34, 8, 34);
          ctx.fillStyle = '#4f9e5c';
          ctx.beginPath();
          ctx.arc(-8, -40, 20, 0, 7);
          ctx.arc(10, -46, 17, 0, 7);
          ctx.arc(0, -58, 15, 0, 7);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.beginPath();
          ctx.arc(-12, -52, 10, 0, 7);
          ctx.fill();
        } else {
          // Busch
          ctx.fillStyle = '#4f9e5c';
          ctx.beginPath();
          ctx.arc(0, -10, 16, Math.PI, 0);
          ctx.arc(18, -8, 12, Math.PI, 0);
          ctx.arc(-16, -8, 11, Math.PI, 0);
          ctx.fill();
        }
      } else if (theme === THEMES.ice) {
        if (kind < 0.6) {
          // Tanne
          ctx.fillStyle = '#5f86a8';
          ctx.fillRect(-3, -12, 6, 12);
          ctx.fillStyle = '#7fa8cc';
          for (let k = 0; k < 3; k++) {
            const w = 26 - k * 7, ty = -12 - k * 16;
            ctx.beginPath();
            ctx.moveTo(-w / 2, ty);
            ctx.lineTo(0, ty - 18);
            ctx.lineTo(w / 2, ty);
            ctx.closePath();
            ctx.fill();
          }
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.beginPath();
          ctx.moveTo(-8, -58);
          ctx.lineTo(0, -62);
          ctx.lineTo(8, -58);
          ctx.lineTo(0, -54);
          ctx.closePath();
          ctx.fill();
        } else {
          // Eiskristall
          ctx.fillStyle = 'rgba(190,225,255,0.75)';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(8, -34);
          ctx.lineTo(14, 0);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(14, 0);
          ctx.lineTo(24, -22);
          ctx.lineTo(30, 0);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // Vulkan: Felsnadeln
        ctx.fillStyle = '#241028';
        ctx.beginPath();
        ctx.moveTo(-22, 0);
        ctx.lineTo(-10, -46 * sc - 10);
        ctx.lineTo(-2, -30);
        ctx.lineTo(8, -58 * sc);
        ctx.lineTo(16, -20);
        ctx.lineTo(24, 0);
        ctx.closePath();
        ctx.fill();
        if (kind > 0.55) {
          ctx.fillStyle = 'rgba(255,110,50,0.5)';
          ctx.beginPath();
          ctx.moveTo(2, -20);
          ctx.lineTo(8, -58 * sc);
          ctx.lineTo(11, -26);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }
  },

  drawMenuGround(ctx, camX) {
    const th = THEMES.green;
    const y0 = VIEW_H - 46;
    ctx.fillStyle = th.dirtDark;
    ctx.fillRect(0, y0, VIEW_W, 46);
    ctx.fillStyle = th.dirt;
    ctx.fillRect(0, y0 + 4, VIEW_W, 42);
    ctx.fillStyle = th.topDark;
    ctx.fillRect(0, y0, VIEW_W, 12);
    ctx.fillStyle = th.top;
    ctx.fillRect(0, y0, VIEW_W, 8);
    // Grashalme + Blumen im Takt der Scrollbewegung
    ctx.strokeStyle = th.topDark;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    const step = 34;
    const i0 = Math.floor(camX / step) - 1;
    for (let i = i0; i < i0 + VIEW_W / step + 2; i++) {
      const x = i * step - camX;
      const h = ((i * 37) % 10 + 10) % 10;
      for (let b = 0; b < 3; b++) {
        const bx = x + ((h * 9 + b * 11) % 26);
        ctx.beginPath();
        ctx.moveTo(bx, y0 + 1);
        ctx.lineTo(bx + (b % 2 ? 2 : -1), y0 - 3 - (b % 2) * 2);
        ctx.stroke();
      }
      if (h === 3) {
        ctx.fillStyle = '#ff8ac2';
        ctx.beginPath(); ctx.arc(x + 15, y0 - 4, 2.6, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x + 15, y0 - 4, 1.1, 0, 7); ctx.fill();
      } else if (h === 7) {
        ctx.fillStyle = '#ffd34d';
        ctx.beginPath(); ctx.arc(x + 20, y0 - 3.4, 2.2, 0, 7); ctx.fill();
      }
    }
  },

  // Erste tragende Fläche unter (x..x+w) ab footY — für Bodenschatten
  groundShadowY(x, w, footY, lvl) {
    const T = TILE;
    const r0 = Math.max(0, Math.floor((footY - 1) / T));
    const r1 = Math.min(lvl.h - 1, r0 + 9);
    const c0 = Math.floor(x / T), c1 = Math.floor((x + w) / T);
    let best = -1;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const ch = lvl.tileChar(c, r);
        if (lvl.isSolidChar(ch, c, r) || ch === '-') { best = r * T; break; }
      }
      if (best >= 0) break;
    }
    for (const m of lvl.movers) {
      const r = m.rect();
      if (x + w > r.x && x < r.x + r.w && r.y >= footY - 2 && (best < 0 || r.y < best)) best = r.y;
    }
    return best;
  },

  drawHills(ctx, color, offset, amp, baseY, seed) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    for (let x = 0; x <= VIEW_W; x += 16) {
      const wx = x + offset;
      const y = baseY - amp - Math.sin(wx * 0.004 + seed) * amp - Math.sin(wx * 0.0113 + seed * 2) * amp * 0.35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.closePath();
    ctx.fill();
  },

  drawTiles(ctx, th, camX, camY) {
    const T = TILE;
    const lvl = this.level;
    // Statische Ebene als ein Bild (im Level-Constructor vorgerendert)
    if (lvl.staticCanvas) {
      ctx.drawImage(lvl.staticCanvas, camX, camY, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    }
    // Nur dynamische Tiles pro Frame: 'B' (bröckelt), 'D' (Tor), '~' (Lava)
    const c0 = Math.max(0, Math.floor(camX / T) - 1);
    const c1 = Math.min(lvl.w - 1, Math.ceil((camX + VIEW_W) / T) + 1);
    const r0 = Math.max(0, Math.floor(camY / T) - 1);
    const r1 = Math.min(lvl.h - 1, Math.ceil((camY + VIEW_H) / T) + 1);
    const lavaG = {}, doorG = {};
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const ch = lvl.grid[r][c];
        if (ch !== 'B' && ch !== 'D' && ch !== '~') continue;
        const x = c * T - camX, y = r * T - camY;
        if (ch === '~') {
          const surf = Math.sin(lvl.time * 3 + c * 0.9) * 3;
          let lg = lavaG[r];
          if (!lg) {
            lg = ctx.createLinearGradient(0, y, 0, y + T);
            lg.addColorStop(0, th.lavaGlow);
            lg.addColorStop(0.4, th.lava);
            lg.addColorStop(1, '#a8231a');
            lavaG[r] = lg;
          }
          ctx.fillStyle = lg;
          ctx.fillRect(x, y + 4 + surf, T, T - 4 - surf);
          ctx.fillStyle = th.lavaGlow;
          ctx.fillRect(x, y + 3 + surf, T, 3);
          // dunkle Schollen auf der Lava
          if (((c * 7 + r * 3) % 6) === 0) {
            ctx.fillStyle = 'rgba(60,10,20,0.55)';
            ctx.fillRect(x + 8, y + 9 + surf, 11, 5);
          }
        } else if (ch === 'B') {
          const st = lvl.crumbleState(c, r);
          if (st === 'gone') continue;
          let jx = 0, jy = 0;
          if (st === 'shake') { jx = (Math.random() - 0.5) * 4; jy = (Math.random() - 0.5) * 4; }
          ctx.fillStyle = th.dirtDark;
          ctx.fillRect(x + jx, y + jy, T, T);
          ctx.fillStyle = th.dirt;
          ctx.fillRect(x + 2 + jx, y + 2 + jy, T - 4, T - 4);
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x + 6 + jx, y + 4 + jy); ctx.lineTo(x + 14 + jx, y + 16 + jy); ctx.lineTo(x + 10 + jx, y + 28 + jy);
          ctx.moveTo(x + 20 + jx, y + 6 + jy); ctx.lineTo(x + 18 + jx, y + 18 + jy); ctx.lineTo(x + 25 + jx, y + 27 + jy);
          ctx.stroke();
        } else if (ch === 'D') {
          const open = lvl.doorsOpen;
          ctx.save();
          ctx.globalAlpha = open ? 0.22 : 0.9;
          let dg = doorG[r];
          if (!dg) {
            dg = ctx.createLinearGradient(0, y, 0, y + T);
            dg.addColorStop(0, '#9fd0ff');
            dg.addColorStop(1, '#4a7dd8');
            doorG[r] = dg;
          }
          ctx.fillStyle = dg;
          ctx.fillRect(x + 3, y, T - 6, T);
          ctx.globalAlpha = open ? 0.15 : 0.5;
          ctx.fillStyle = '#ffffff';
          const sh = Math.sin(lvl.time * 4 + r) * 4;
          ctx.fillRect(x + 8 + sh, y + 4, 4, T - 8);
          ctx.restore();
        }
      }
    }
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  drawDecor(ctx, camX, camY) {
    const lvl = this.level;
    for (const cp of lvl.checkpoints) {
      const x = cp.x - camX, y = cp.y - camY;
      if (x < -60 || x > VIEW_W + 60) continue;
      ctx.fillStyle = '#7a7f8a';
      ctx.fillRect(x - 2, y - 48, 4, 48);
      const wave = Math.sin(cp.t * 5) * 3;
      ctx.fillStyle = cp.active ? '#57d977' : '#aab2bd';
      ctx.beginPath();
      ctx.moveTo(x + 2, y - 46);
      ctx.lineTo(x + 24 + wave, y - 39);
      ctx.lineTo(x + 2, y - 30);
      ctx.closePath();
      ctx.fill();
      if (cp.active) {
        ctx.strokeStyle = 'rgba(87,217,119,' + (0.4 + Math.sin(cp.t * 4) * 0.2) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y - 24, 16 + Math.sin(cp.t * 4) * 2, 0, 7);
        ctx.stroke();
      }
    }
    const gx = lvl.goal.x - camX, gy = lvl.goal.y - camY;
    if (gx > -80 && gx < VIEW_W + 80) {
      ctx.fillStyle = '#cfd4dc';
      ctx.fillRect(gx - 3, gy - 108, 6, 108);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.arc(gx, gy - 112, 7, 0, 7); ctx.fill();
      const t = lvl.time;
      const fw = Math.sin(t * 4) * 5;
      const fg = ctx.createLinearGradient(gx, gy - 100, gx + 44, gy - 60);
      fg.addColorStop(0, '#ff6b6b');
      fg.addColorStop(1, '#ffd34d');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(gx + 3, gy - 102);
      ctx.quadraticCurveTo(gx + 26, gy - 96 + fw, gx + 46 + fw, gy - 88);
      ctx.quadraticCurveTo(gx + 26, gy - 80 + fw, gx + 3, gy - 70);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,211,77,' + (0.35 + Math.sin(t * 3) * 0.15) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(gx, gy - 50, 34 + Math.sin(t * 2.4) * 3, 0, 7);
      ctx.stroke();
    }
    for (const s of lvl.springs) {
      const x = s.x - camX, y = s.y - camY;
      if (x < -40 || x > VIEW_W + 40) continue;
      const comp = s.anim > 0 ? 6 : 0;
      ctx.strokeStyle = '#8a8f9a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const yy = y + 12 - i * ((12 - comp) / 3);
        ctx.moveTo(x + 3, yy);
        ctx.lineTo(x + s.w - 3, yy - 4);
      }
      ctx.stroke();
      ctx.fillStyle = '#ff6b6b';
      this.roundRect(ctx, x - 2, y - comp, s.w + 4, 8, 3);
      ctx.fill();
      ctx.fillStyle = '#5a5f6a';
      ctx.fillRect(x, y + 11, s.w, 3);
    }
  },

  drawCoin(ctx, c, camX, camY) {
    const x = c.x - camX, y = c.y - camY;
    if (x < -30 || x > VIEW_W + 30) return;
    const wob = Math.abs(Math.cos(c.t * 4));
    const bob = Math.sin(c.t * 3) * 3;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = '#c9930a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10 * Math.max(0.25, wob), 10, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.ellipse(-1, -1, 7.5 * Math.max(0.2, wob), 7.5, 0, 0, 7);
    ctx.fill();
    ctx.restore();
  },

  drawKey(ctx, k, camX, camY) {
    const x = k.x - camX + Math.sin(k.t * 2) * 4;
    const y = k.y - camY + Math.sin(k.t * 3) * 5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(k.t * 2) * 0.3);
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-5, 0, 6, 0, 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1, 0); ctx.lineTo(13, 0);
    ctx.moveTo(9, 0); ctx.lineTo(9, 5);
    ctx.moveTo(13, 0); ctx.lineTo(13, 5);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,211,77,' + (0.3 + Math.sin(k.t * 5) * 0.15) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, 7);
    ctx.stroke();
  },

  drawMover(ctx, m, camX, camY) {
    const r = m.rect();
    const x = r.x - camX, y = r.y - camY;
    if (x < -140 || x > VIEW_W + 140) return;
    ctx.fillStyle = '#3a3f4a';
    this.roundRect(ctx, x, y, r.w, r.h, 6);
    ctx.fill();
    ctx.fillStyle = '#7a8494';
    this.roundRect(ctx, x, y, r.w, 7, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(x + 6, y + 4, 4, 4);
    ctx.fillRect(x + r.w - 10, y + 4, 4, 4);
    ctx.strokeStyle = 'rgba(122,132,148,0.4)';
    ctx.lineWidth = 2;
    const dirArrow = m.axis === 'x';
    ctx.beginPath();
    if (dirArrow) { ctx.moveTo(x + r.w / 2 - 8, y + r.h + 6); ctx.lineTo(x + r.w / 2 + 8, y + r.h + 6); }
    else { ctx.moveTo(x + r.w / 2, y + r.h + 2); ctx.lineTo(x + r.w / 2, y + r.h + 10); }
    ctx.stroke();
  },

  drawEnemy(ctx, e, camX, camY) {
    const x = e.x - camX, y = e.y - camY;
    if (x < -160 || x > VIEW_W + 160) return;
    // weicher Schatten unter dem Gegner
    if (!e.dead && this.level) {
      const gy = this.groundShadowY(e.x + 3, e.w - 6, e.y + e.h, this.level);
      if (gy >= 0) {
        const d = gy - (e.y + e.h);
        const a = Math.max(0, Math.min(0.22, 0.28 - d / 320));
        if (a > 0.02) {
          ctx.fillStyle = 'rgba(8,12,26,' + a.toFixed(3) + ')';
          const rw = Math.max(6, e.w * 0.42 - d * 0.02);
          ctx.beginPath();
          ctx.ellipse(x + e.w / 2, gy - camY + 2, rw, rw * 0.3, 0, 0, 7);
          ctx.fill();
        }
      }
    }
    ctx.save();
    if (e instanceof Boss) {
      const flashWhite = e.state === 'tele' && Math.floor(e.stTimer * 12) % 2 === 0;
      const hurtFlick = e.invuln > 0 && Math.floor(e.invuln * 12) % 2 === 0;
      ctx.translate(x + e.w / 2, y + e.h);
      const breathe = Math.sin(e.t * 3) * 0.04;
      ctx.scale(1 + breathe, 1 - breathe);
      ctx.fillStyle = flashWhite ? '#ffffff' : '#8a2d2d';
      this.roundRect(ctx, -e.w / 2, -e.h, e.w, e.h, 14);
      ctx.fill();
      ctx.fillStyle = flashWhite ? '#ffffff' : '#5e1f1f';
      ctx.fillRect(-e.w / 2, -e.h * 0.45, e.w, e.h * 0.2);
      ctx.fillStyle = flashWhite ? '#ffffff' : '#6e2525';
      ctx.beginPath();
      ctx.moveTo(-e.w / 2 + 4, -e.h + 6);
      ctx.lineTo(-e.w / 2 - 4, -e.h - 16);
      ctx.lineTo(-e.w / 2 + 14, -e.h + 2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(e.w / 2 - 4, -e.h + 6);
      ctx.lineTo(e.w / 2 + 4, -e.h - 16);
      ctx.lineTo(e.w / 2 - 14, -e.h + 2);
      ctx.closePath();
      ctx.fill();
      if (!hurtFlick) {
        ctx.fillStyle = '#ffe27a';
        const ex = e.dir > 0 ? 8 : -8;
        ctx.beginPath();
        ctx.arc(ex - 7, -e.h + 20, 5, 0, 7);
        ctx.arc(ex + 7, -e.h + 20, 5, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#301010';
        ctx.beginPath();
        ctx.arc(ex - 7 + e.dir * 2, -e.h + 20, 2.4, 0, 7);
        ctx.arc(ex + 7 + e.dir * 2, -e.h + 20, 2.4, 0, 7);
        ctx.fill();
      }
      ctx.fillStyle = '#301010';
      ctx.fillRect(-12, -e.h * 0.32, 24, 4);
      // glühende Risse im Boss-Panzer
      if (!flashWhite && !e.dead) {
        ctx.strokeStyle = 'rgba(255,110,50,' + (0.55 + Math.sin(e.t * 5) * 0.2).toFixed(2) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-e.w / 2 + 9, -e.h * 0.66);
        ctx.lineTo(-e.w / 2 + 16, -e.h * 0.52);
        ctx.lineTo(-e.w / 2 + 11, -e.h * 0.4);
        ctx.moveTo(e.w / 2 - 13, -e.h * 0.72);
        ctx.lineTo(e.w / 2 - 19, -e.h * 0.56);
        ctx.stroke();
      }
    } else if (e instanceof Flyer) {
      const flap = e.dead ? 0 : Math.sin(e.t * 14) * 10;
      ctx.globalAlpha = e.dead ? Math.max(0, 1 - e.squashT / 0.4) : 1;
      if (!e.dead) {
        // kleine Fühler
        ctx.strokeStyle = '#5a3fa8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x + e.w * 0.32, y + 3);
        ctx.quadraticCurveTo(x + e.w * 0.2, y - 6, x + e.w * 0.15, y - 8);
        ctx.moveTo(x + e.w * 0.68, y + 3);
        ctx.quadraticCurveTo(x + e.w * 0.8, y - 6, x + e.w * 0.85, y - 8);
        ctx.stroke();
        ctx.fillStyle = '#c79bf0';
        ctx.beginPath();
        ctx.arc(x + e.w * 0.15, y - 8, 2, 0, 7);
        ctx.arc(x + e.w * 0.85, y - 8, 2, 0, 7);
        ctx.fill();
      }
      ctx.fillStyle = e.dead ? '#777' : '#7a5ad0';
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 8);
      ctx.lineTo(x - 10, y + 2 - flap);
      ctx.lineTo(x + 4, y + 16);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + e.w - 4, y + 8);
      ctx.lineTo(x + e.w + 10, y + 2 - flap);
      ctx.lineTo(x + e.w - 4, y + 16);
      ctx.closePath();
      ctx.fill();
      if (e.dead) {
        ctx.fillStyle = '#777';
        ctx.fillRect(x, y + e.h - 8, e.w, 8);
      } else {
        ctx.fillStyle = '#7a5ad0';
        this.roundRect(ctx, x, y, e.w, e.h, 11);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x + 9, y + 9, 4.4, 0, 7);
        ctx.arc(x + e.w - 9, y + 9, 4.4, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#301a4a';
        ctx.beginPath();
        ctx.arc(x + 9, y + 10, 2, 0, 7);
        ctx.arc(x + e.w - 9, y + 10, 2, 0, 7);
        ctx.fill();
      }
    } else {
      if (e.dead) {
        ctx.globalAlpha = Math.max(0, 1 - e.squashT / 0.45);
        ctx.fillStyle = '#777';
        ctx.fillRect(x, y + e.h - 7, e.w, 7);
      } else {
        // trippelnde Füßchen
        const fstep = Math.sin(e.t * 9) * 2.5;
        ctx.fillStyle = '#6f45a8';
        ctx.fillRect(x + 2, y + e.h - 4 - Math.max(0, fstep), 8, 4);
        ctx.fillRect(x + e.w - 10, y + e.h - 4 - Math.max(0, -fstep), 8, 4);
        const squish = Math.sin(e.t * 9) * 1.5;
        ctx.fillStyle = '#a06ad0';
        this.roundRect(ctx, x, y + squish / 2, e.w, e.h - squish, 9);
        ctx.fill();
        ctx.fillStyle = '#c79bf0';
        this.roundRect(ctx, x + 4, y + 4 + squish / 2, e.w - 8, 7, 4);
        ctx.fill();
        const ed = e.dir > 0 ? 3 : -3;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x + 8 + ed, y + 9, 4, 0, 7);
        ctx.arc(x + e.w - 8 + ed, y + 9, 4, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#2a1440';
        ctx.beginPath();
        ctx.arc(x + 8 + ed + e.dir, y + 9.5, 1.8, 0, 7);
        ctx.arc(x + e.w - 8 + ed + e.dir, y + 9.5, 1.8, 0, 7);
        ctx.fill();
        ctx.strokeStyle = '#2a1440';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 16); ctx.lineTo(x + 11, y + 15);
        ctx.moveTo(x + e.w - 11, y + 15); ctx.lineTo(x + e.w - 5, y + 16);
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  drawPlayer(ctx, p, camX, camY) {
    const x = p.cx - camX, yFoot = p.y + p.h - camY;
    const ch = p.char;
    const moving = Math.abs(p.vx) > 40;
    let sx = 1, sy = 1;
    if (p.landSquash > 0) { sx = 1.22; sy = 0.76; }
    else if (!p.grounded) {
      if (p.vy < -60) { sx = 0.92; sy = 1.1; }
      else if (p.vy > 200) { sx = 0.95; sy = 1.06; }
    }
    const bob = moving && p.grounded ? Math.abs(Math.sin(p.animT * 13)) * 2.5 : 0;

    // Bodenschatten – zeigt den Landepunkt an
    if (!p.dead) {
      const gy = (p.shadowFloor != null) ? p.shadowFloor
        : (this.level ? this.groundShadowY(p.x + 4, p.w - 8, p.y + p.h, this.level) : -1);
      if (gy >= 0) {
        const d = gy - (p.y + p.h);
        const a = Math.max(0, 0.3 - d / 340);
        if (a > 0.02) {
          ctx.fillStyle = 'rgba(8,12,26,' + a.toFixed(3) + ')';
          const rw = Math.max(7, 14 - d * 0.026);
          ctx.beginPath();
          ctx.ellipse(x, gy - camY + 2, rw, rw * 0.3, 0, 0, 7);
          ctx.fill();
        }
      }
    }

    ctx.save();
    ctx.translate(x, yFoot);
    if (p.dead) ctx.rotate(p.deadT * 6);
    // leicht unterschiedliche Körpergrößen je Held
    const bs = ch.id === 'rocco' ? 1.12 : ch.id === 'kira' ? 0.95 : ch.id === 'lina' ? 0.98 : 1;
    ctx.scale(p.facing * sx * bs, sy * bs);
    ctx.translate(0, -bob);

    const legSwing = moving && p.grounded ? Math.sin(p.animT * 13) * 5 : 0;
    const airPose = !p.grounded ? 2.2 : 0;
    const liftA = Math.max(0, legSwing * 0.6) + airPose;
    const liftB = Math.max(0, -legSwing * 0.6) + (p.grounded ? 0 : 0.5);
    // Beine + Schuhe in Akzentfarbe des Helden
    ctx.fillStyle = shadeColor(ch.color, 0.5);
    ctx.fillRect(-8, -8 + liftA, 6, Math.max(1, 8 - liftA));
    ctx.fillRect(2, -8 + liftB, 6, Math.max(1, 8 - liftB));
    ctx.fillStyle = ch.accent;
    ctx.fillRect(-10, -4 + liftA, 9, Math.max(1, 4 - liftA));
    ctx.fillRect(1, -4 + liftB, 9, Math.max(1, 4 - liftB));

    // hinterer Arm (schwingt gegenläufig)
    const armSwing = moving && p.grounded ? Math.sin(p.animT * 13) * 2.6 : (!p.grounded ? -3 : Math.sin(p.animT * 2.2) * 0.9);
    ctx.fillStyle = shadeColor(ch.color, 0.72);
    ctx.beginPath();
    ctx.ellipse(-12, -17 - armSwing, 4, 6.5, 0.3, 0, 7);
    ctx.fill();

    ctx.fillStyle = ch.color;
    this.roundRect(ctx, -13, -32, 26, 27, 9);
    ctx.fill();

    // vorderer Arm
    ctx.fillStyle = shadeColor(ch.color, 0.82);
    ctx.beginPath();
    ctx.ellipse(12, -17 + armSwing, 4, 6.5, -0.3, 0, 7);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-1, -14, 8, 9, 0, 0, 7);
    ctx.fill();

    const blinkOn = (p.animT % 3.4) < 0.13;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(4, -23, 4.6, blinkOn ? 1 : 5, 0, 0, 7);
    ctx.ellipse(12, -23, 4.2, blinkOn ? 1 : 5, 0, 0, 7);
    ctx.fill();
    if (!blinkOn) {
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(5.4, -23, 2.2, 0, 7);
      ctx.arc(13.2, -23, 2, 0, 7);
      ctx.fill();
    }
    // kleiner Mund
    ctx.strokeStyle = 'rgba(40,25,15,0.75)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(8, -16.5, 3.2, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();

    if (ch.id === 'blitz') {
      ctx.fillStyle = ch.accent;
      ctx.beginPath();
      ctx.arc(0, -30, 12, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-2, -33, 16, 4);
    } else if (ch.id === 'lina') {
      ctx.fillStyle = '#ff8ac2';
      ctx.beginPath();
      ctx.moveTo(-13, -30); ctx.lineTo(-21, -34); ctx.lineTo(-19, -25);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.arc(-16, -30, 3.4, 0, 7);
      ctx.fill();
    } else if (ch.id === 'rocco') {
      ctx.fillStyle = '#9aa2ae';
      ctx.beginPath();
      ctx.arc(0, -29, 13, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#5f6670';
      ctx.fillRect(-13, -31, 26, 4);
      ctx.fillStyle = '#d7dde5';
      [[-8, -34], [0, -37], [8, -34]].forEach(([bx, by]) => {
        ctx.beginPath(); ctx.arc(bx, by, 1.8, 0, 7); ctx.fill();
      });
    } else if (ch.id === 'kira') {
      ctx.fillStyle = ch.accent;
      ctx.fillRect(-13, -29, 26, 5);
      const wav = Math.sin(p.animT * 8) * 4;
      ctx.beginPath();
      ctx.moveTo(-12, -27);
      ctx.quadraticCurveTo(-24, -22 + wav, -30, -12 + wav);
      ctx.lineTo(-24, -10 + wav);
      ctx.quadraticCurveTo(-18, -20, -12, -23);
      ctx.closePath();
      ctx.fill();
    } else if (ch.id === 'volt') {
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -32); ctx.lineTo(0, -40);
      ctx.stroke();
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.arc(0, -42, 3.4, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#ff5a2b';
      ctx.fillRect(8, -25, 6, 3);
    } else if (ch.id === 'nyx') {
      ctx.fillStyle = 'rgba(184,198,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(-10, -6);
      ctx.quadraticCurveTo(-16, 4 + Math.sin(p.animT * 6) * 3, -4, 8);
      ctx.quadraticCurveTo(4, 4, 10, -6);
      ctx.closePath();
      ctx.fill();
    }

    if (p.shieldActive) {
      ctx.strokeStyle = 'rgba(126,196,255,' + (0.55 + Math.sin(p.animT * 5) * 0.2) + ')';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -18, 24, 0, 7);
      ctx.stroke();
    }
    ctx.restore();
  },

  drawPlayerPortrait(ctx, char) {
    const rr = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    const g = ctx.createLinearGradient(0, -40, 0, 4);
    g.addColorStop(0, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-30, -44, 60, 48);
    const bs = char.id === 'rocco' ? 1.12 : char.id === 'kira' ? 0.95 : char.id === 'lina' ? 0.98 : 1;
    ctx.scale(bs, bs);
    ctx.fillStyle = shadeColor(char.color, 0.5);
    ctx.fillRect(-8, -8, 6, 8);
    ctx.fillRect(2, -8, 6, 8);
    ctx.fillStyle = char.accent;
    ctx.fillRect(-10, -4, 9, 4);
    ctx.fillRect(1, -4, 9, 4);
    ctx.fillStyle = shadeColor(char.color, 0.72);
    ctx.beginPath();
    ctx.ellipse(-12, -17, 4, 6.5, 0.3, 0, 7);
    ctx.fill();
    ctx.fillStyle = char.color;
    rr(-13, -32, 26, 27, 9);
    ctx.fill();
    ctx.fillStyle = shadeColor(char.color, 0.82);
    ctx.beginPath();
    ctx.ellipse(12, -17, 4, 6.5, -0.3, 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-1, -14, 8, 9, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(4, -23, 4.6, 5, 0, 0, 7);
    ctx.ellipse(12, -23, 4.2, 5, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(5.4, -23, 2.2, 0, 7);
    ctx.arc(13.2, -23, 2, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,25,15,0.75)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(8, -16.5, 3.2, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
    if (char.id === 'blitz') {
      ctx.fillStyle = char.accent;
      ctx.beginPath();
      ctx.arc(0, -30, 12, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-2, -33, 16, 4);
    } else if (char.id === 'lina') {
      ctx.fillStyle = '#ff8ac2';
      ctx.beginPath();
      ctx.moveTo(-13, -30); ctx.lineTo(-21, -34); ctx.lineTo(-19, -25);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.arc(-16, -30, 3.4, 0, 7);
      ctx.fill();
    } else if (char.id === 'rocco') {
      ctx.fillStyle = '#9aa2ae';
      ctx.beginPath();
      ctx.arc(0, -29, 13, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#5f6670';
      ctx.fillRect(-13, -31, 26, 4);
    } else if (char.id === 'kira') {
      ctx.fillStyle = char.accent;
      ctx.fillRect(-13, -29, 26, 5);
      ctx.beginPath();
      ctx.moveTo(-12, -27);
      ctx.quadraticCurveTo(-24, -22, -30, -12);
      ctx.lineTo(-24, -10);
      ctx.quadraticCurveTo(-18, -20, -12, -23);
      ctx.closePath();
      ctx.fill();
    } else if (char.id === 'volt') {
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -32); ctx.lineTo(0, -40);
      ctx.stroke();
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.arc(0, -42, 3.4, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#ff5a2b';
      ctx.fillRect(8, -25, 6, 3);
    } else if (char.id === 'nyx') {
      ctx.fillStyle = 'rgba(184,198,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(-10, -6);
      ctx.quadraticCurveTo(-16, 4, -4, 8);
      ctx.quadraticCurveTo(4, 4, 10, -6);
      ctx.closePath();
      ctx.fill();
    }
  },

  drawWeather(ctx, theme) {
    const kind = theme.weather;
    for (const w of this.weather) {
      if (kind === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.sz, 0, 7);
        ctx.fill();
      } else if (kind === 'leaves') {
        ctx.save();
        ctx.translate(w.x, w.y);
        ctx.rotate(w.t * 2 + w.ph);
        ctx.fillStyle = ['rgba(80,160,60,0.7)', 'rgba(160,200,60,0.7)', 'rgba(230,170,60,0.7)'][w.ph % 3 | 0];
        ctx.beginPath();
        ctx.ellipse(0, 0, w.sz + 1.5, w.sz * 0.55, 0, 0, 7);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(255,' + (120 + ((w.ph * 30) | 0) % 80) + ',60,' + (0.35 + Math.sin(w.t * 4 + w.ph) * 0.25) + ')';
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.sz, 0, 7);
        ctx.fill();
      }
    }
  }
};

window.__game = { Game, Input, LEVELS, Save, FX, Level };
