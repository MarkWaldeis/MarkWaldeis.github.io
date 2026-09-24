(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const WORLD_END = 17350;
  const GROUND_Y = 610;
  const TAU = Math.PI * 2;

  const screens = {
    title: document.querySelector("#title-screen"),
    pause: document.querySelector("#pause-screen"),
    gameover: document.querySelector("#gameover-screen"),
    victory: document.querySelector("#victory-screen")
  };
  const toast = document.querySelector("#toast");
  const soundButton = document.querySelector("#sound-button");

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const rand = (min, max) => min + Math.random() * (max - min);
  const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function roundedRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function starPath(c, x, y, outer, inner, points = 5, rotation = -Math.PI / 2) {
    c.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 ? inner : outer;
      const a = rotation + i * Math.PI / points;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
  }

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.enabled = true;
      this.nextNote = 0;
      this.step = 0;
    }
    start() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.16;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.nextNote = this.ctx.currentTime;
    }
    toggle() {
      this.enabled = !this.enabled;
      if (this.master) this.master.gain.setTargetAtTime(this.enabled ? 0.16 : 0, this.ctx.currentTime, 0.03);
      return this.enabled;
    }
    tone(freq, duration, type = "sine", volume = 0.3, slide = 0, delay = 0) {
      if (!this.ctx || !this.enabled) return;
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + duration);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + duration + 0.03);
    }
    noise(duration = 0.12, volume = 0.16) {
      if (!this.ctx || !this.enabled) return;
      const length = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(this.master);
      source.start();
    }
    sfx(name) {
      if (name === "jump") this.tone(260, .16, "square", .18, 170);
      if (name === "coin") { this.tone(780, .09, "sine", .2); this.tone(1120, .12, "sine", .15, 0, .07); }
      if (name === "stomp") { this.tone(130, .13, "square", .24, -50); this.noise(.08, .09); }
      if (name === "hurt") { this.tone(210, .3, "sawtooth", .2, -120); this.noise(.14, .11); }
      if (name === "heart") { [523, 659, 784].forEach((f, i) => this.tone(f, .2, "sine", .18, 0, i * .08)); }
      if (name === "star") { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, .3, "triangle", .2, 80, i * .09)); }
      if (name === "checkpoint") { [392, 523, 659].forEach((f, i) => this.tone(f, .25, "sine", .16, 0, i * .1)); }
      if (name === "boss") { this.tone(75, .7, "sawtooth", .28, -20); this.noise(.35, .12); }
      if (name === "win") { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, .55, "triangle", .2, 30, i * .14)); }
    }
    music(zone, active) {
      if (!this.ctx || !this.enabled || !active) return;
      const now = this.ctx.currentTime;
      const scales = [
        [261.6, 329.6, 392, 523.3, 392, 329.6, 293.7, 392],
        [220, 261.6, 329.6, 392, 329.6, 261.6, 196, 246.9],
        [174.6, 220, 261.6, 349.2, 261.6, 220, 164.8, 196]
      ];
      while (this.nextNote < now + .1) {
        const melody = scales[zone] || scales[0];
        const note = melody[this.step % melody.length];
        this.tone(note, .17, zone === 2 ? "triangle" : "sine", .055, 0, Math.max(0, this.nextNote - now));
        if (this.step % 2 === 0) this.tone(note / 2, .24, "triangle", .035, 0, Math.max(0, this.nextNote - now));
        this.nextNote += zone === 2 ? .28 : .34;
        this.step++;
      }
    }
  }

  const audio = new AudioEngine();

  const input = {
    left: false, right: false, jump: false, sprint: false,
    jumpPressed: false, jumpReleased: false
  };
  const keyMap = {
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ArrowUp: "jump", KeyW: "jump", Space: "jump",
    ShiftLeft: "sprint", ShiftRight: "sprint"
  };

  addEventListener("keydown", event => {
    if ((event.code === "Escape" || event.code === "KeyP") && state.mode !== "title" && state.mode !== "victory" && state.mode !== "gameover") {
      togglePause();
      event.preventDefault();
      return;
    }
    const action = keyMap[event.code];
    if (!action) return;
    if (action === "jump" && !input.jump) input.jumpPressed = true;
    input[action] = true;
    event.preventDefault();
  });
  addEventListener("keyup", event => {
    const action = keyMap[event.code];
    if (!action) return;
    if (action === "jump") input.jumpReleased = true;
    input[action] = false;
    event.preventDefault();
  });
  addEventListener("blur", () => {
    input.left = input.right = input.jump = input.sprint = false;
    if (state.mode === "playing") togglePause();
  });

  document.querySelectorAll("#touch-controls button").forEach(button => {
    const action = button.dataset.action;
    const press = event => {
      event.preventDefault();
      if (action === "jump" && !input.jump) input.jumpPressed = true;
      input[action] = true;
    };
    const release = event => {
      event.preventDefault();
      if (action === "jump") input.jumpReleased = true;
      input[action] = false;
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });

  const state = {
    mode: "title",
    time: 0,
    playTime: 0,
    camera: { x: 0, y: 0, shake: 0 },
    zone: 0,
    bossActive: false,
    bossDefeated: false,
    stars: 0,
    coins: 0,
    score: 0,
    lives: 3,
    checkpoint: { x: 130, y: 500 },
    platforms: [],
    enemies: [],
    pickups: [],
    checkpoints: [],
    particles: [],
    decorations: [],
    clouds: [],
    goal: null
  };

  const player = {
    x: 130, y: 500, w: 38, h: 54,
    vx: 0, vy: 0, facing: 1,
    grounded: false, coyote: 0, jumpBuffer: 0,
    health: 3, maxHealth: 3, invulnerable: 0,
    squash: 0, runCycle: 0, dustTimer: 0
  };

  function zoneAt(x) {
    if (x < 6200) return 0;
    if (x < 12400) return 1;
    return 2;
  }

  function addPlatform(x, y, w, h = 40, style = "grass") {
    state.platforms.push({ x, y, w, h, style });
  }

  function addEnemy(type, x, y, range = 120) {
    const sizes = {
      sprout: [42, 36], beetle: [48, 34], wisp: [42, 35], knight: [48, 58], boss: [112, 118]
    };
    const [w, h] = sizes[type];
    state.enemies.push({
      type, x, y: y - h, w, h, homeX: x, range,
      vx: type === "sprout" ? -55 : type === "beetle" ? -85 : -45,
      vy: 0, direction: -1, alive: true, dying: 0,
      phase: Math.random() * TAU, hp: type === "boss" ? 5 : 1,
      cooldown: 0, grounded: false, angry: false
    });
  }

  function addCoin(x, y) {
    state.pickups.push({ type: "coin", x, y, w: 24, h: 24, collected: false, phase: Math.random() * TAU });
  }

  function addCoinArc(x, y, count, spacing = 42, height = 60) {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? .5 : i / (count - 1);
      addCoin(x + i * spacing, y - Math.sin(t * Math.PI) * height);
    }
  }

  function addStar(x, y) {
    state.pickups.push({ type: "star", x, y, w: 36, h: 36, collected: false, phase: 0 });
  }

  function addHeart(x, y) {
    state.pickups.push({ type: "heart", x, y, w: 30, h: 28, collected: false, phase: 0 });
  }

  function buildLevel() {
    state.platforms = [];
    state.enemies = [];
    state.pickups = [];
    state.checkpoints = [];
    state.decorations = [];
    state.clouds = [];
    state.goal = { x: 17070, y: 468, w: 105, h: 142, open: false };

    const groundSegments = [
      [0, 1680, 610], [1765, 3140, 610], [3230, 4670, 610], [4760, 6120, 610],
      [6210, 7530, 610], [7620, 9160, 610], [9250, 10760, 610], [10855, 12320, 610],
      [12415, 13810, 610], [13905, 17350, 610]
    ];
    groundSegments.forEach(([start, end, y]) => addPlatform(start, y, end - start, 160, zoneAt(start) === 2 ? "fortress" : zoneAt(start) === 1 ? "moss" : "grass"));

    const platforms = [
      [520, 500, 180, "grass"], [820, 430, 150, "grass"], [1100, 520, 190, "grass"], [1390, 445, 150, "grass"],
      [1860, 510, 150, "grass"], [2110, 430, 190, "grass"], [2390, 350, 170, "grass"], [2700, 450, 210, "grass"],
      [3330, 500, 150, "grass"], [3600, 420, 170, "grass"], [3910, 500, 160, "grass"], [4230, 410, 230, "grass"],
      [4870, 500, 170, "grass"], [5170, 420, 160, "grass"], [5450, 340, 180, "grass"], [5770, 455, 170, "grass"],
      [6320, 500, 160, "moss"], [6600, 420, 190, "moss"], [6910, 330, 150, "moss"], [7200, 450, 170, "moss"],
      [7720, 515, 150, "moss"], [7970, 430, 160, "moss"], [8240, 350, 170, "moss"], [8530, 270, 180, "moss"], [8850, 410, 190, "moss"],
      [9360, 490, 170, "moss"], [9660, 400, 190, "moss"], [9990, 330, 170, "moss"], [10290, 445, 180, "moss"],
      [10950, 500, 160, "moss"], [11220, 415, 180, "moss"], [11520, 330, 180, "moss"], [11830, 410, 200, "moss"],
      [12520, 510, 170, "stone"], [12820, 430, 180, "stone"], [13130, 350, 180, "stone"], [13440, 455, 200, "stone"],
      [14030, 510, 180, "fortress"], [14320, 430, 180, "fortress"], [14610, 350, 180, "fortress"],
      [15000, 500, 190, "fortress"], [15300, 410, 170, "fortress"], [16380, 430, 180, "fortress"], [16660, 510, 170, "fortress"]
    ];
    platforms.forEach(([x, y, w, style]) => addPlatform(x, y, w, 34, style));

    // Small stepping stones make every gap fair without making the route trivial.
    [[1690, 555], [3155, 530], [4690, 550], [6140, 530], [7550, 550], [9180, 535], [10780, 550], [12340, 530], [13830, 550]].forEach(([x, y]) => addPlatform(x, y, 58, 24, zoneAt(x) === 2 ? "stone" : zoneAt(x) === 1 ? "moss" : "grass"));

    // Coins form a readable golden trail through the intended route.
    for (let x = 300; x < 16800; x += 300) {
      const zone = zoneAt(x);
      const y = zone === 0 ? 540 - Math.sin(x * .008) * 55 : zone === 1 ? 515 - Math.sin(x * .01) * 85 : 525 - Math.sin(x * .012) * 45;
      addCoin(x, y);
    }
    addCoinArc(795, 370, 6, 42, 70);
    addCoinArc(2070, 355, 6, 43, 80);
    addCoinArc(5360, 285, 7, 42, 75);
    addCoinArc(8130, 290, 7, 42, 80);
    addCoinArc(11150, 285, 7, 42, 75);
    addCoinArc(14200, 300, 7, 42, 70);

    addStar(2480, 292);
    addStar(5540, 282);
    addStar(8620, 212);
    addStar(11910, 352);
    addHeart(4030, 460);
    addHeart(9010, 360);
    addHeart(13220, 305);

    [
      ["sprout", 730, 610, 100], ["sprout", 1320, 610, 100], ["beetle", 1980, 610, 130],
      ["sprout", 2880, 610, 120], ["beetle", 3450, 610, 100], ["sprout", 4340, 410, 80],
      ["beetle", 5050, 610, 150], ["sprout", 5900, 610, 100],
      ["sprout", 6460, 610, 110], ["wisp", 6850, 390, 180], ["beetle", 7350, 610, 100],
      ["sprout", 7870, 610, 100], ["wisp", 8390, 315, 160], ["sprout", 8980, 610, 120],
      ["beetle", 9490, 610, 130], ["wisp", 10080, 310, 180], ["sprout", 10550, 610, 110],
      ["knight", 11100, 610, 130], ["wisp", 11650, 310, 150], ["knight", 12100, 610, 100],
      ["knight", 12650, 610, 120], ["wisp", 13220, 330, 160], ["knight", 13610, 610, 100],
      ["knight", 14220, 610, 120], ["knight", 14760, 610, 100]
    ].forEach(args => addEnemy(...args));

    state.checkpoints = [
      { x: 4600, y: 495, active: false, label: "Sonnenwiese geschafft" },
      { x: 10380, y: 495, active: false, label: "Nebelwald geschafft" },
      { x: 13970, y: 495, active: false, label: "Himmelsfestung erreicht" }
    ];

    for (let i = 0; i < 34; i++) {
      state.clouds.push({ x: i * 570 + rand(-150, 150), y: rand(70, 310), size: rand(.55, 1.4), depth: rand(.08, .28) });
    }
    for (let x = 250; x < WORLD_END; x += rand(180, 310)) {
      const zone = zoneAt(x);
      state.decorations.push({ x, zone, size: rand(.75, 1.25), variant: Math.floor(rand(0, 3)) });
    }
  }

  function resetGame() {
    buildLevel();
    Object.assign(state, {
      mode: "playing", time: 0, playTime: 0, zone: 0,
      bossActive: false, bossDefeated: false, stars: 0, coins: 0,
      score: 0, lives: 3, checkpoint: { x: 130, y: 500 }, particles: []
    });
    Object.assign(player, {
      x: 130, y: 500, vx: 0, vy: 0, facing: 1,
      grounded: false, coyote: 0, jumpBuffer: 0,
      health: 3, invulnerable: 0, squash: 0, runCycle: 0
    });
    state.camera.x = 0;
    state.camera.shake = 0;
    hideScreens();
    audio.start();
    showToast("Finde die fünf Sonnensterne!", 2300);
  }

  function hideScreens() {
    Object.values(screens).forEach(screen => {
      screen.classList.remove("active");
      screen.setAttribute("aria-hidden", "true");
    });
  }

  function showScreen(name) {
    hideScreens();
    screens[name].classList.add("active");
    screens[name].setAttribute("aria-hidden", "false");
  }

  let toastTimer = 0;
  function showToast(message, duration = 1700) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
  }

  function togglePause() {
    if (state.mode === "playing") {
      state.mode = "paused";
      showScreen("pause");
    } else if (state.mode === "paused") {
      state.mode = "playing";
      hideScreens();
      audio.start();
    }
  }

  function spawnParticles(x, y, color, count = 8, speed = 170, shape = "circle") {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, TAU);
      const velocity = rand(speed * .35, speed);
      state.particles.push({
        x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity - 30,
        life: rand(.35, .75), maxLife: .75, size: rand(3, 8), color, shape, gravity: shape === "spark" ? 80 : 420
      });
    }
  }

  function updatePlayer(dt) {
    if (player.invulnerable > 0) player.invulnerable -= dt;
    player.squash = lerp(player.squash, 0, Math.min(1, dt * 9));

    const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const maxSpeed = input.sprint ? 390 : 310;
    const acceleration = player.grounded ? 2300 : 1350;
    if (move !== 0) {
      player.vx += move * acceleration * dt;
      player.vx = clamp(player.vx, -maxSpeed, maxSpeed);
      player.facing = move;
    } else {
      const drag = player.grounded ? 1850 : 360;
      if (Math.abs(player.vx) <= drag * dt) player.vx = 0;
      else player.vx -= Math.sign(player.vx) * drag * dt;
    }

    if (player.grounded) player.coyote = .11;
    else player.coyote -= dt;
    if (input.jumpPressed) player.jumpBuffer = .13;
    else player.jumpBuffer -= dt;

    if (player.jumpBuffer > 0 && player.coyote > 0) {
      player.vy = -810;
      player.grounded = false;
      player.coyote = 0;
      player.jumpBuffer = 0;
      player.squash = -.14;
      audio.sfx("jump");
      spawnParticles(player.x + player.w / 2, player.y + player.h, "#e9d7a4", 5, 90);
    }
    if (input.jumpReleased && player.vy < -280) player.vy *= .48;

    player.vy = Math.min(player.vy + 2200 * dt, 1100);

    player.x += player.vx * dt;
    for (const p of state.platforms) {
      if (!rectsOverlap(player, p)) continue;
      if (player.vx > 0) player.x = p.x - player.w;
      else if (player.vx < 0) player.x = p.x + p.w;
      player.vx = 0;
    }

    const previousBottom = player.y + player.h;
    player.y += player.vy * dt;
    player.grounded = false;
    for (const p of state.platforms) {
      if (!rectsOverlap(player, p)) continue;
      if (player.vy >= 0 && previousBottom <= p.y + 8) {
        player.y = p.y - player.h;
        if (player.vy > 450) {
          player.squash = .22;
          state.camera.shake = Math.min(6, player.vy / 150);
          spawnParticles(player.x + player.w / 2, p.y, p.style === "fortress" ? "#9ca2b5" : "#d8c492", 7, 105);
        }
        player.vy = 0;
        player.grounded = true;
      } else if (player.vy < 0) {
        player.y = p.y + p.h;
        player.vy = 50;
      }
    }

    player.x = clamp(player.x, 0, WORLD_END - player.w);
    if (player.y > H + 240) loseHealth(true);

    player.runCycle += Math.abs(player.vx) * dt * .045;
    if (player.grounded && Math.abs(player.vx) > 130) {
      player.dustTimer -= dt;
      if (player.dustTimer <= 0) {
        player.dustTimer = .12;
        state.particles.push({ x: player.x + player.w / 2 - player.facing * 16, y: player.y + player.h - 3, vx: -player.facing * rand(25, 75), vy: rand(-35, -10), life: .35, maxLife: .35, size: rand(4, 8), color: "#e3d2a4", shape: "circle", gravity: -15 });
      }
    }

    input.jumpPressed = false;
    input.jumpReleased = false;
  }

  function enemyGroundCollision(enemy, dt) {
    const oldBottom = enemy.y + enemy.h;
    enemy.vy = Math.min(enemy.vy + 1800 * dt, 900);
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    enemy.grounded = false;
    for (const p of state.platforms) {
      if (!rectsOverlap(enemy, p)) continue;
      if (enemy.vy >= 0 && oldBottom <= p.y + 12) {
        enemy.y = p.y - enemy.h;
        enemy.vy = 0;
        enemy.grounded = true;
      } else if (enemy.vy < 0) {
        enemy.y = p.y + p.h;
        enemy.vy = 50;
      } else {
        enemy.vx *= -1;
        enemy.direction *= -1;
        enemy.x += enemy.vx * dt * 2;
      }
    }
  }

  function updateEnemies(dt) {
    for (const enemy of state.enemies) {
      if (!enemy.alive) {
        enemy.dying -= dt;
        continue;
      }
      if (Math.abs(enemy.x - player.x) > 1550 && enemy.type !== "boss") continue;
      enemy.phase += dt * 3;
      enemy.cooldown -= dt;

      if (enemy.type === "wisp") {
        enemy.x += enemy.vx * dt;
        enemy.y += Math.sin(enemy.phase * 1.7) * 45 * dt;
        if (Math.abs(enemy.x - enemy.homeX) > enemy.range) enemy.vx *= -1;
        enemy.direction = Math.sign(enemy.vx);
      } else if (enemy.type === "boss") {
        updateBoss(enemy, dt);
      } else {
        const distance = player.x - enemy.x;
        if (enemy.type === "beetle" && Math.abs(distance) < 310 && Math.abs(player.y - enemy.y) < 100) {
          enemy.angry = true;
          enemy.direction = Math.sign(distance) || 1;
          enemy.vx = enemy.direction * 170;
        } else if (enemy.type === "knight" && Math.abs(distance) < 380) {
          enemy.direction = Math.sign(distance) || 1;
          enemy.vx += enemy.direction * 220 * dt;
          enemy.vx = clamp(enemy.vx, -115, 115);
          if (enemy.grounded && enemy.cooldown <= 0 && Math.abs(distance) < 170) {
            enemy.vy = -520;
            enemy.cooldown = 1.7;
          }
        } else {
          const speed = enemy.type === "sprout" ? 55 : enemy.type === "beetle" ? 82 : 65;
          enemy.vx = enemy.direction * speed;
          if (Math.abs(enemy.x - enemy.homeX) > enemy.range) enemy.direction = enemy.x > enemy.homeX ? -1 : 1;
        }
        enemyGroundCollision(enemy, dt);
        if (enemy.y > H + 300) enemy.alive = false;
      }

      if (enemy.alive && rectsOverlap(player, enemy)) {
        const stomp = player.vy > 100 && player.y + player.h - enemy.y < Math.min(32, enemy.h * .55);
        if (stomp) stompEnemy(enemy);
        else loseHealth(false, enemy.x + enemy.w / 2);
      }
    }
    state.enemies = state.enemies.filter(e => e.alive || e.dying > 0);
  }

  function updateBoss(boss, dt) {
    const distance = player.x - boss.x;
    boss.direction = distance < 0 ? -1 : 1;
    if (boss.cooldown <= 0 && boss.grounded) {
      if (Math.abs(distance) > 260) {
        boss.vx = boss.direction * (boss.hp <= 2 ? 250 : 190);
        boss.cooldown = .85;
      } else {
        boss.vy = boss.hp <= 2 ? -780 : -680;
        boss.vx = boss.direction * 145;
        boss.cooldown = 1.25;
      }
    }
    if (boss.grounded && boss.cooldown < .35) boss.vx *= Math.pow(.02, dt);
    enemyGroundCollision(boss, dt);
    if (boss.x < 15000) { boss.x = 15000; boss.vx = Math.abs(boss.vx); }
    if (boss.x + boss.w > 16820) { boss.x = 16820 - boss.w; boss.vx = -Math.abs(boss.vx); }
    if (boss.grounded && Math.abs(boss.vy) < 1 && boss.cooldown > .8) {
      state.camera.shake = 9;
      spawnParticles(boss.x + boss.w / 2, boss.y + boss.h, "#8b789a", 10, 150);
    }
  }

  function stompEnemy(enemy) {
    player.vy = enemy.type === "boss" ? -690 : -560;
    player.squash = -.18;
    state.camera.shake = enemy.type === "boss" ? 13 : 6;
    audio.sfx("stomp");
    spawnParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.type === "boss" ? "#ffcf58" : "#baf077", enemy.type === "boss" ? 18 : 10, 220, "spark");
    if (enemy.type === "boss") {
      enemy.hp--;
      enemy.cooldown = .8;
      enemy.vx = -enemy.direction * 260;
      if (enemy.hp <= 0) defeatBoss(enemy);
      else showToast(`Schattenkönig: ${enemy.hp} Treffer übrig`, 1200);
    } else {
      enemy.alive = false;
      enemy.dying = .45;
      state.score += enemy.type === "knight" ? 250 : 100;
    }
  }

  function defeatBoss(boss) {
    boss.alive = false;
    boss.dying = 1.2;
    state.bossDefeated = true;
    state.bossActive = false;
    state.score += 2500;
    addStar(boss.x + boss.w / 2 - 18, boss.y - 30);
    state.goal.open = true;
    audio.sfx("win");
    showToast("Der Schattenkönig ist besiegt!", 2300);
    for (let i = 0; i < 5; i++) setTimeout(() => spawnParticles(boss.x + rand(0, boss.w), boss.y + rand(0, boss.h), i % 2 ? "#ffd85c" : "#84e7f5", 18, 280, "spark"), i * 130);
  }

  function loseHealth(fell, sourceX = player.x) {
    if (player.invulnerable > 0 || state.mode !== "playing") return;
    player.health--;
    player.invulnerable = 1.4;
    audio.sfx("hurt");
    state.camera.shake = 14;
    if (fell || player.health <= 0) {
      state.lives--;
      if (state.lives <= 0) {
        state.mode = "gameover";
        document.querySelector("#gameover-stats").textContent = `${state.stars}/5 Sterne · ${state.coins} Münzen · ${formatTime(state.playTime)}`;
        showScreen("gameover");
        return;
      }
      player.health = player.maxHealth;
      player.x = state.checkpoint.x;
      player.y = state.checkpoint.y;
      player.vx = 0;
      player.vy = 0;
      state.camera.x = clamp(player.x - 260, 0, WORLD_END - W);
      showToast(`Ein Lichtfunke verloren · ${state.lives} übrig`);
    } else {
      player.vx = player.x < sourceX ? -360 : 360;
      player.vy = -440;
    }
  }

  function updatePickups(dt) {
    for (const item of state.pickups) {
      if (item.collected) continue;
      item.phase += dt * 3.5;
      const hitbox = { x: item.x, y: item.y + Math.sin(item.phase) * 5, w: item.w, h: item.h };
      if (!rectsOverlap(player, hitbox)) continue;
      item.collected = true;
      if (item.type === "coin") {
        state.coins++;
        state.score += 25;
        audio.sfx("coin");
        spawnParticles(item.x + 12, item.y + 12, "#ffe566", 7, 130, "spark");
        if (state.coins % 25 === 0) {
          state.lives++;
          showToast("25 Münzen – ein Lichtfunke extra!");
        }
      } else if (item.type === "star") {
        state.stars++;
        state.score += 500;
        audio.sfx("star");
        spawnParticles(item.x + 18, item.y + 18, "#fff285", 20, 230, "spark");
        showToast(`Sonnenstern ${state.stars}/5`, 1900);
      } else if (item.type === "heart") {
        player.health = Math.min(player.maxHealth, player.health + 1);
        state.score += 100;
        audio.sfx("heart");
        spawnParticles(item.x + 15, item.y + 14, "#ff8297", 12, 150);
        showToast("Herz aufgefüllt");
      }
    }
  }

  function updateCheckpoints() {
    for (const cp of state.checkpoints) {
      if (!cp.active && player.x > cp.x) {
        cp.active = true;
        state.checkpoint = { x: cp.x + 40, y: 500 };
        audio.sfx("checkpoint");
        showToast(cp.label, 1900);
      }
    }
  }

  function updateBossTrigger() {
    if (!state.bossActive && !state.bossDefeated && player.x > 14950) {
      state.bossActive = true;
      addEnemy("boss", 16200, 610, 0);
      audio.sfx("boss");
      showToast("Schattenkönig Umbra", 2300);
    }
    if (state.bossActive) {
      player.x = clamp(player.x, 14920, 16830 - player.w);
    }
  }

  function updateGoal() {
    if (!state.goal || !rectsOverlap(player, state.goal)) return;
    if (!state.bossDefeated) {
      if (player.x > state.goal.x - 100) player.x = state.goal.x - player.w;
      showToast("Besiege zuerst den Schattenkönig");
      return;
    }
    if (state.stars < 5) {
      showToast(`Noch ${5 - state.stars} Sonnenstern${state.stars === 4 ? "" : "e"} fehlt`);
      return;
    }
    state.mode = "victory";
    state.score += Math.max(0, 5000 - Math.floor(state.playTime) * 5) + state.lives * 500;
    document.querySelector("#victory-stats").textContent = `${state.stars}/5 Sterne · ${state.coins} Münzen · ${formatTime(state.playTime)} · ${state.score.toLocaleString("de-DE")} Punkte`;
    showScreen("victory");
    audio.sfx("win");
  }

  function updateParticles(dt) {
    for (const p of state.particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(.3, dt);
    }
    state.particles = state.particles.filter(p => p.life > 0);
  }

  function updateCamera(dt) {
    let targetX = player.x - W * .35 + player.vx * .22;
    if (state.bossActive) targetX = clamp(targetX, 14880, 15600);
    state.camera.x = lerp(state.camera.x, clamp(targetX, 0, WORLD_END - W), 1 - Math.pow(.0005, dt));
    state.camera.shake = Math.max(0, state.camera.shake - 25 * dt);
  }

  function update(dt) {
    if (state.mode !== "playing") return;
    state.time += dt;
    state.playTime += dt;
    state.zone = zoneAt(player.x);
    updatePlayer(dt);
    updateEnemies(dt);
    updatePickups(dt);
    updateCheckpoints();
    updateBossTrigger();
    updateGoal();
    updateParticles(dt);
    updateCamera(dt);
    audio.music(state.zone, true);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const palettes = [
    { skyTop: "#65cce7", skyBottom: "#d8f3d0", sun: "#fff0a6", far: "#75b9a2", mid: "#478c72", near: "#2f6a55" },
    { skyTop: "#446f8f", skyBottom: "#9ac2ad", sun: "#d8f3d0", far: "#496e6e", mid: "#35575c", near: "#203f47" },
    { skyTop: "#39365f", skyBottom: "#d17c75", sun: "#ffd090", far: "#57506f", mid: "#3b3a59", near: "#292c48" }
  ];

  function drawBackground() {
    const p = palettes[state.zone];
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, p.skyTop);
    gradient.addColorStop(1, p.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const sunX = state.zone === 2 ? 1030 : 990;
    const sunY = state.zone === 2 ? 160 : 120;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 115);
    sunGlow.addColorStop(0, p.sun);
    sunGlow.addColorStop(.45, p.sun + "aa");
    sunGlow.addColorStop(1, p.sun + "00");
    ctx.fillStyle = sunGlow;
    ctx.fillRect(sunX - 120, sunY - 120, 240, 240);
    ctx.fillStyle = p.sun;
    ctx.beginPath(); ctx.arc(sunX, sunY, 50, 0, TAU); ctx.fill();

    for (const cloud of state.clouds) {
      const x = cloud.x - state.camera.x * cloud.depth;
      if (x < -220 || x > W + 220) continue;
      drawCloud(x, cloud.y, cloud.size, state.zone === 2 ? "#d8b5c0" : "#ffffff");
    }

    drawHillLayer(p.far, .12, 445, 115, 820);
    drawHillLayer(p.mid, .22, 515, 95, 570);
    drawHillLayer(p.near, .34, 570, 72, 390);

    if (state.zone === 1) drawForestSilhouettes();
    if (state.zone === 2) drawFortressSilhouette();
  }

  function drawCloud(x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = .42;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 10, 30, Math.PI, 0);
    ctx.arc(35, 0, 43, Math.PI, 0);
    ctx.arc(78, 12, 28, Math.PI, 0);
    ctx.lineTo(105, 25); ctx.lineTo(-30, 25); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawHillLayer(color, depth, baseY, amplitude, period) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    const offset = (state.camera.x * depth) % period;
    for (let x = -period; x <= W + period; x += period / 3) {
      const px = x - offset;
      const peak = baseY - amplitude * (.58 + .42 * Math.sin((x + state.camera.x * depth) * .007));
      ctx.quadraticCurveTo(px + period / 6, peak - amplitude, px + period / 3, baseY);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }

  function drawForestSilhouettes() {
    ctx.save();
    ctx.globalAlpha = .32;
    ctx.fillStyle = "#162f3d";
    const offset = (state.camera.x * .46) % 240;
    for (let x = -100 - offset; x < W + 150; x += 130) {
      const h = 180 + Math.sin(x * .05) * 45;
      ctx.fillRect(x - 10, H - h, 22, h);
      ctx.beginPath();
      ctx.arc(x, H - h, 65, 0, TAU);
      ctx.arc(x - 38, H - h + 35, 50, 0, TAU);
      ctx.arc(x + 40, H - h + 30, 55, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFortressSilhouette() {
    ctx.save();
    ctx.fillStyle = "#292b45aa";
    const offset = (state.camera.x * .28) % 560;
    for (let x = -offset - 300; x < W + 500; x += 560) {
      ctx.fillRect(x, 255, 270, 340);
      for (let i = 0; i < 5; i++) ctx.fillRect(x + i * 62, 225, 34, 48);
      ctx.fillRect(x + 80, 155, 105, 440);
      ctx.fillRect(x + 65, 140, 30, 45);
      ctx.fillRect(x + 115, 140, 30, 45);
      ctx.fillRect(x + 165, 140, 30, 45);
      ctx.fillStyle = "#efae6c55";
      for (let wx = x + 35; wx < x + 250; wx += 72) ctx.fillRect(wx, 330, 18, 35);
      ctx.fillStyle = "#292b45aa";
    }
    ctx.restore();
  }

  function drawDecorations() {
    for (const d of state.decorations) {
      if (d.x < state.camera.x - 120 || d.x > state.camera.x + W + 120) continue;
      if (d.zone === 0) drawBush(d.x, GROUND_Y, d.size, d.variant);
      else if (d.zone === 1) drawMushroomOrFern(d.x, GROUND_Y, d.size, d.variant);
      else drawBannerOrCrystal(d.x, GROUND_Y, d.size, d.variant);
    }
  }

  function drawBush(x, y, size, variant) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
    ctx.fillStyle = variant === 1 ? "#2f8e58" : "#3aa963";
    ctx.beginPath(); ctx.arc(-18, -10, 23, 0, TAU); ctx.arc(5, -20, 30, 0, TAU); ctx.arc(31, -8, 22, 0, TAU); ctx.fill();
    ctx.fillStyle = "#79cf72";
    ctx.beginPath(); ctx.arc(-3, -29, 9, 0, TAU); ctx.arc(22, -18, 7, 0, TAU); ctx.fill();
    if (variant === 2) { ctx.fillStyle = "#ffe26d"; ctx.beginPath(); ctx.arc(8, -16, 4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  function drawMushroomOrFern(x, y, size, variant) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
    if (variant === 0) {
      ctx.fillStyle = "#d8d2b1"; roundedRect(ctx, -5, -28, 10, 28, 5); ctx.fill();
      ctx.fillStyle = "#b76c82"; ctx.beginPath(); ctx.arc(0, -29, 18, Math.PI, 0); ctx.lineTo(18, -27); ctx.lineTo(-18, -27); ctx.fill();
      ctx.fillStyle = "#f3c4c5"; ctx.beginPath(); ctx.arc(-6, -34, 3, 0, TAU); ctx.arc(7, -30, 2.5, 0, TAU); ctx.fill();
    } else {
      ctx.strokeStyle = "#65a775"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-5, -31, 6, -56); ctx.stroke();
      ctx.fillStyle = "#65a775";
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(i % 2 ? 7 : -5, -12 - i * 10, 12, 5, i % 2 ? -.5 : .5, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }

  function drawBannerOrCrystal(x, y, size, variant) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
    if (variant === 1) {
      ctx.fillStyle = "#3e4161"; ctx.fillRect(-3, -75, 6, 75);
      ctx.fillStyle = "#a94764"; ctx.beginPath(); ctx.moveTo(3, -70); ctx.lineTo(38, -61); ctx.lineTo(3, -39); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f1bb5d"; starPath(ctx, 17, -55, 7, 3); ctx.fill();
    } else {
      ctx.fillStyle = "#72d2dc99"; ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(14, -17); ctx.lineTo(6, 0); ctx.lineTo(-10, -8); ctx.lineTo(-15, -31); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#c9fbf4aa"; ctx.beginPath(); ctx.moveTo(0, -45); ctx.lineTo(4, -18); ctx.lineTo(-5, -11); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawPlatforms() {
    for (const p of state.platforms) {
      if (p.x + p.w < state.camera.x - 30 || p.x > state.camera.x + W + 30) continue;
      if (p.style === "grass") drawGrassPlatform(p);
      else if (p.style === "moss") drawMossPlatform(p);
      else drawStonePlatform(p);
    }
  }

  function drawGrassPlatform(p) {
    ctx.fillStyle = "#735844"; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#5e453a";
    for (let x = p.x + 18; x < p.x + p.w; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, p.y + 20); ctx.lineTo(x + 18, p.y + 40); ctx.lineTo(x - 4, p.y + 65); ctx.fill();
    }
    ctx.fillStyle = "#3e9d5d"; roundedRect(ctx, p.x - 3, p.y - 7, p.w + 6, 18, 7); ctx.fill();
    ctx.fillStyle = "#79cd69"; roundedRect(ctx, p.x, p.y - 7, p.w, 8, 5); ctx.fill();
  }

  function drawMossPlatform(p) {
    ctx.fillStyle = "#45515a"; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#586772";
    for (let x = p.x + 8; x < p.x + p.w; x += 44) { ctx.fillRect(x, p.y + 18, 28, 3); ctx.fillRect(x + 20, p.y + 21, 3, 20); }
    ctx.fillStyle = "#3f7e5c"; roundedRect(ctx, p.x - 2, p.y - 6, p.w + 4, 15, 6); ctx.fill();
    ctx.fillStyle = "#75b56a"; ctx.fillRect(p.x + 4, p.y - 6, p.w - 8, 5);
    for (let x = p.x + 15; x < p.x + p.w; x += 58) { ctx.fillRect(x, p.y + 5, 4, 14 + (x % 10)); }
  }

  function drawStonePlatform(p) {
    ctx.fillStyle = p.style === "fortress" ? "#46475d" : "#626578"; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = p.style === "fortress" ? "#343548" : "#494d60"; ctx.lineWidth = 3;
    for (let y = p.y + 18; y < p.y + p.h; y += 30) {
      ctx.beginPath(); ctx.moveTo(p.x, y); ctx.lineTo(p.x + p.w, y); ctx.stroke();
    }
    for (let x = p.x + 30; x < p.x + p.w; x += 55) { ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + 18); ctx.stroke(); }
    ctx.fillStyle = p.style === "fortress" ? "#77778c" : "#878a9d"; ctx.fillRect(p.x, p.y - 5, p.w, 9);
  }

  function drawCheckpoints() {
    for (const cp of state.checkpoints) {
      ctx.fillStyle = "#5a493e"; ctx.fillRect(cp.x, cp.y - 40, 7, 115);
      const wave = Math.sin(state.time * 5 + cp.x) * 5;
      ctx.fillStyle = cp.active ? "#ffd85a" : "#768393";
      ctx.beginPath(); ctx.moveTo(cp.x + 7, cp.y - 38); ctx.quadraticCurveTo(cp.x + 38, cp.y - 30 + wave, cp.x + 61, cp.y - 20); ctx.lineTo(cp.x + 7, cp.y + 2); ctx.closePath(); ctx.fill();
      if (cp.active) { ctx.fillStyle = "#fff4a8"; starPath(ctx, cp.x + 29, cp.y - 18, 9, 4); ctx.fill(); }
    }
  }

  function drawGoal() {
    const g = state.goal;
    ctx.save(); ctx.translate(g.x, g.y);
    ctx.fillStyle = "#34384f"; roundedRect(ctx, 0, 0, g.w, g.h, 45); ctx.fill();
    ctx.fillStyle = g.open ? "#f6c95f" : "#171a2d"; roundedRect(ctx, 14, 17, g.w - 28, g.h - 17, 34); ctx.fill();
    if (g.open) {
      const glow = ctx.createRadialGradient(g.w / 2, 75, 5, g.w / 2, 75, 80);
      glow.addColorStop(0, "#fff9ccee"); glow.addColorStop(1, "#ffd45a00");
      ctx.fillStyle = glow; ctx.fillRect(-25, -5, g.w + 50, g.h + 20);
    }
    ctx.fillStyle = "#86879b"; ctx.fillRect(-10, 0, g.w + 20, 14);
    for (let i = 0; i < 4; i++) ctx.fillRect(-8 + i * 35, -18, 20, 25);
    ctx.restore();
  }

  function drawPickups() {
    for (const item of state.pickups) {
      if (item.collected || item.x < state.camera.x - 50 || item.x > state.camera.x + W + 50) continue;
      const bob = Math.sin(item.phase) * 5;
      ctx.save(); ctx.translate(item.x + item.w / 2, item.y + item.h / 2 + bob);
      if (item.type === "coin") {
        const scaleX = .25 + Math.abs(Math.cos(item.phase)) * .75;
        ctx.scale(scaleX, 1);
        ctx.fillStyle = "#ffc742"; ctx.beginPath(); ctx.ellipse(0, 0, 11, 14, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = "#fff09a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 6, 9, 0, 0, TAU); ctx.stroke();
      } else if (item.type === "star") {
        ctx.rotate(Math.sin(item.phase * .7) * .15);
        ctx.shadowColor = "#ffe36c"; ctx.shadowBlur = 20;
        ctx.fillStyle = "#ffd84f"; starPath(ctx, 0, 0, 20, 9); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = "#5d4931";
        ctx.beginPath(); ctx.arc(-6, -2, 2, 0, TAU); ctx.arc(6, -2, 2, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = "#ff6f85";
        ctx.beginPath(); ctx.moveTo(0, 13); ctx.bezierCurveTo(-23, -1, -15, -18, 0, -9); ctx.bezierCurveTo(15, -18, 23, -1, 0, 13); ctx.fill();
        ctx.fillStyle = "#ffb0b9"; ctx.beginPath(); ctx.arc(-6, -7, 3, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawEnemy(enemy) {
    if (enemy.x + enemy.w < state.camera.x - 100 || enemy.x > state.camera.x + W + 100) return;
    ctx.save();
    ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
    if (!enemy.alive) {
      const t = clamp(enemy.dying / .45, 0, 1);
      ctx.scale(1 + (1 - t) * .5, t);
      ctx.globalAlpha = t;
    }
    ctx.scale(enemy.direction || 1, 1);
    if (enemy.type === "sprout") drawSprout(enemy);
    else if (enemy.type === "beetle") drawBeetle(enemy);
    else if (enemy.type === "wisp") drawWisp(enemy);
    else if (enemy.type === "knight") drawKnight(enemy);
    else drawBoss(enemy);
    ctx.restore();
  }

  function drawSprout(e) {
    ctx.fillStyle = "#6abf5b"; ctx.beginPath(); ctx.ellipse(0, 5, 21, 17, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#458f4c"; ctx.beginPath(); ctx.ellipse(-8, -13, 13, 6, -.65, 0, TAU); ctx.ellipse(8, -13, 13, 6, .65, 0, TAU); ctx.fill();
    ctx.fillStyle = "#eaf6ce"; ctx.beginPath(); ctx.ellipse(-7, 1, 5, 7, 0, 0, TAU); ctx.ellipse(7, 1, 5, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#23333b"; ctx.beginPath(); ctx.arc(-6, 2, 2, 0, TAU); ctx.arc(8, 2, 2, 0, TAU); ctx.fill();
    ctx.fillStyle = "#31533d"; ctx.beginPath(); ctx.ellipse(-12, 19, 9, 4, 0, 0, TAU); ctx.ellipse(12, 19, 9, 4, 0, 0, TAU); ctx.fill();
  }

  function drawBeetle(e) {
    ctx.fillStyle = e.angry ? "#e35e55" : "#745ca0"; ctx.beginPath(); ctx.ellipse(0, 4, 23, 16, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#3d355c"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(0, 18); ctx.stroke();
    ctx.fillStyle = "#403752"; ctx.beginPath(); ctx.arc(17, 2, 11, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#2c293c"; ctx.lineWidth = 4;
    for (const y of [-2, 8]) { ctx.beginPath(); ctx.moveTo(-13, y); ctx.lineTo(-25, y + 7); ctx.moveTo(12, y); ctx.lineTo(25, y + 7); ctx.stroke(); }
    ctx.fillStyle = "#fff1cf"; ctx.beginPath(); ctx.arc(20, -1, 3, 0, TAU); ctx.fill();
  }

  function drawWisp(e) {
    ctx.globalAlpha = .9;
    ctx.shadowColor = "#8ee8ed"; ctx.shadowBlur = 18;
    ctx.fillStyle = "#9ae7dc"; ctx.beginPath(); ctx.ellipse(0, 0, 19, 16, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-13, 9); ctx.quadraticCurveTo(-8, 30, 0, 12); ctx.quadraticCurveTo(7, 30, 13, 7); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = "#294657"; ctx.beginPath(); ctx.arc(-6, -2, 2.5, 0, TAU); ctx.arc(6, -2, 2.5, 0, TAU); ctx.fill();
  }

  function drawKnight(e) {
    ctx.fillStyle = "#37394f"; roundedRect(ctx, -20, -13, 40, 42, 10); ctx.fill();
    ctx.fillStyle = "#777a91"; roundedRect(ctx, -22, -28, 44, 30, 13); ctx.fill();
    ctx.fillStyle = "#25283a"; ctx.fillRect(-18, -14, 36, 7);
    ctx.fillStyle = "#ef826c"; ctx.fillRect(e.direction > 0 ? 7 : -12, -13, 5, 4);
    ctx.fillStyle = "#bc5264"; ctx.beginPath(); ctx.moveTo(-11, -28); ctx.lineTo(-3, -46); ctx.lineTo(6, -28); ctx.fill();
    ctx.fillStyle = "#27293b"; ctx.fillRect(-17, 25, 13, 7); ctx.fillRect(5, 25, 13, 7);
    ctx.fillStyle = "#9fa2b4"; ctx.beginPath(); ctx.arc(24, 8, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#5f6277"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(24, 8, 8, 0, TAU); ctx.stroke();
  }

  function drawBoss(e) {
    const hurt = e.hp < 5 && Math.sin(state.time * 18) > .6;
    ctx.fillStyle = hurt ? "#b45f73" : "#352c4c"; roundedRect(ctx, -48, -40, 96, 96, 25); ctx.fill();
    ctx.fillStyle = "#564267"; ctx.beginPath(); ctx.arc(0, -42, 45, Math.PI, 0); ctx.lineTo(45, -19); ctx.lineTo(-45, -19); ctx.fill();
    ctx.fillStyle = "#222239"; ctx.beginPath(); ctx.moveTo(-42, -44); ctx.lineTo(-55, -76); ctx.lineTo(-19, -57); ctx.lineTo(0, -88); ctx.lineTo(20, -57); ctx.lineTo(55, -76); ctx.lineTo(43, -41); ctx.fill();
    ctx.fillStyle = "#ffd15a"; ctx.beginPath(); ctx.arc(0, -66, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = "#f2dfca"; ctx.beginPath(); ctx.ellipse(-18, -25, 10, 7, 0, 0, TAU); ctx.ellipse(18, -25, 10, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ef5f68"; ctx.beginPath(); ctx.arc(-15, -25, 4, 0, TAU); ctx.arc(21, -25, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = "#1d2034"; ctx.beginPath(); ctx.moveTo(-20, 13); ctx.quadraticCurveTo(0, 28, 22, 12); ctx.lineTo(14, 31); ctx.lineTo(-13, 31); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#24243b"; ctx.beginPath(); ctx.ellipse(-29, 57, 26, 10, 0, 0, TAU); ctx.ellipse(29, 57, 26, 10, 0, 0, TAU); ctx.fill();
  }

  function drawPlayer() {
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) return;
    const sx = 1 + player.squash;
    const sy = 1 - player.squash;
    const run = player.grounded && Math.abs(player.vx) > 20 ? Math.sin(player.runCycle) : 0;
    ctx.save();
    ctx.translate(player.x + player.w / 2, player.y + player.h / 2 + Math.abs(run) * 1.5);
    ctx.scale(player.facing * sx, sy);

    // Scarf trails opposite the movement and gives the hero a distinct silhouette.
    ctx.fillStyle = "#e85d4f";
    ctx.beginPath(); ctx.moveTo(-10, -8); ctx.quadraticCurveTo(-29 - Math.abs(player.vx) * .025, -3 + run * 3, -35 - Math.abs(player.vx) * .04, 8); ctx.quadraticCurveTo(-19, 5, -6, 4); ctx.fill();
    ctx.fillStyle = "#4e86a3"; roundedRect(ctx, -16, 3, 32, 27, 9); ctx.fill();
    ctx.fillStyle = "#39718f"; ctx.fillRect(-15, 20, 30, 10);

    ctx.fillStyle = "#f1c9a2"; ctx.beginPath(); ctx.ellipse(0, -11, 16, 19, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#e29c65"; ctx.beginPath(); ctx.arc(-15, -10, 4, 0, TAU); ctx.fill();

    ctx.fillStyle = "#f5c647";
    ctx.beginPath(); ctx.moveTo(-17, -19); ctx.quadraticCurveTo(-7, -38, 18, -26); ctx.quadraticCurveTo(7, -14, -18, -15); ctx.fill();
    ctx.fillStyle = "#d77c3f"; ctx.beginPath(); ctx.moveTo(-14, -22); ctx.quadraticCurveTo(-3, -31, 20, -23); ctx.lineTo(15, -17); ctx.quadraticCurveTo(-3, -24, -14, -17); ctx.fill();

    ctx.fillStyle = "#26384a"; ctx.beginPath(); ctx.ellipse(6, -10, 3, 5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#9c5b48"; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(6, -5, 5, .25, 1.5); ctx.stroke();

    ctx.strokeStyle = "#f1c9a2"; ctx.lineWidth = 7; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-12, 7); ctx.lineTo(-18 + run * 6, 18); ctx.moveTo(12, 7); ctx.lineTo(19 - run * 6, 17); ctx.stroke();
    ctx.strokeStyle = "#273d55"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-8, 27); ctx.lineTo(-10 + run * 7, 37); ctx.moveTo(8, 27); ctx.lineTo(10 - run * 7, 37); ctx.stroke();
    ctx.strokeStyle = "#e0a34c"; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-11 + run * 7, 38); ctx.lineTo(-18 + run * 7, 38); ctx.moveTo(11 - run * 7, 38); ctx.lineTo(18 - run * 7, 38); ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.save(); ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1); ctx.fillStyle = p.color; ctx.translate(p.x, p.y);
      if (p.shape === "spark") { ctx.rotate(state.time * 7 + p.x); starPath(ctx, 0, 0, p.size, p.size * .28, 4); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }

  function drawHUD() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#10283dcc"; roundedRect(ctx, 20, 18, 330, 66, 21); ctx.fill();
    ctx.strokeStyle = "#ffffff20"; ctx.lineWidth = 2; roundedRect(ctx, 20, 18, 330, 66, 21); ctx.stroke();

    for (let i = 0; i < player.maxHealth; i++) {
      const x = 48 + i * 35;
      ctx.fillStyle = i < player.health ? "#ff687e" : "#425265";
      ctx.beginPath(); ctx.moveTo(x, 61); ctx.bezierCurveTo(x - 18, 49, x - 11, 35, x, 43); ctx.bezierCurveTo(x + 11, 35, x + 18, 49, x, 61); ctx.fill();
    }

    ctx.fillStyle = "#ffd754"; starPath(ctx, 174, 51, 15, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "800 19px Nunito, sans-serif"; ctx.textBaseline = "middle"; ctx.fillText(`${state.stars}/5`, 195, 52);

    ctx.fillStyle = "#ffc342"; ctx.beginPath(); ctx.ellipse(257, 51, 10, 13, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(String(state.coins), 276, 52);

    ctx.fillStyle = "#10283dcc"; roundedRect(ctx, W / 2 - 155, 20, 310, 34, 17); ctx.fill();
    const progress = clamp(player.x / (WORLD_END - 250), 0, 1);
    const pg = ctx.createLinearGradient(W / 2 - 145, 0, W / 2 + 145, 0);
    pg.addColorStop(0, "#67d57a"); pg.addColorStop(.55, "#55c8dc"); pg.addColorStop(1, "#ffc95a");
    ctx.fillStyle = pg; roundedRect(ctx, W / 2 - 145, 30, 290 * progress, 14, 7); ctx.fill();
    ctx.fillStyle = "#ffffff26"; roundedRect(ctx, W / 2 - 145 + 290 * progress, 30, 290 * (1 - progress), 14, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(W / 2 - 145 + 290 * progress, 37, 8, 0, TAU); ctx.fill();

    ctx.fillStyle = "#10283dcc"; roundedRect(ctx, W - 198, 20, 110, 43, 17); ctx.fill();
    ctx.fillStyle = "#dff6ff"; ctx.font = "700 17px Nunito, sans-serif"; ctx.fillText(formatTime(state.playTime), W - 174, 42);

    if (state.bossActive) {
      const boss = state.enemies.find(e => e.type === "boss" && e.alive);
      if (boss) {
        ctx.fillStyle = "#18182bd9"; roundedRect(ctx, W / 2 - 210, H - 58, 420, 35, 15); ctx.fill();
        ctx.fillStyle = "#d65067"; roundedRect(ctx, W / 2 - 198, H - 46, 396 * (boss.hp / 5), 12, 6); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "800 13px Nunito, sans-serif"; ctx.textAlign = "center"; ctx.fillText("SCHATTENKÖNIG UMBRA", W / 2, H - 67); ctx.textAlign = "left";
      }
    }
    ctx.restore();
  }

  function render() {
    drawBackground();
    const shakeX = state.camera.shake ? rand(-state.camera.shake, state.camera.shake) : 0;
    const shakeY = state.camera.shake ? rand(-state.camera.shake * .45, state.camera.shake * .45) : 0;
    ctx.save();
    ctx.translate(-Math.round(state.camera.x) + shakeX, shakeY);
    drawDecorations();
    drawPlatforms();
    drawCheckpoints();
    drawGoal();
    drawPickups();
    for (const enemy of state.enemies) drawEnemy(enemy);
    drawPlayer();
    drawParticles();
    ctx.restore();
    if (state.mode !== "title") drawHUD();
  }

  document.querySelector("#start-button").addEventListener("click", resetGame);
  document.querySelector("#retry-button").addEventListener("click", resetGame);
  document.querySelector("#again-button").addEventListener("click", resetGame);
  document.querySelector("#restart-button").addEventListener("click", resetGame);
  document.querySelector("#resume-button").addEventListener("click", togglePause);
  soundButton.addEventListener("click", () => {
    audio.start();
    const enabled = audio.toggle();
    soundButton.textContent = enabled ? "♪" : "×";
    soundButton.setAttribute("aria-label", enabled ? "Ton ausschalten" : "Ton einschalten");
  });
  document.querySelector("#fullscreen-button").addEventListener("click", async () => {
    const shell = document.querySelector("#game-shell");
    try {
      if (!document.fullscreenElement) await shell.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) {
      showToast("Vollbild wird von diesem Browser nicht unterstützt");
    }
  });

  buildLevel();
  let last = performance.now();
  let accumulator = 0;
  const step = 1 / 120;
  function frame(now) {
    const elapsed = Math.min((now - last) / 1000, .05);
    last = now;
    accumulator += elapsed;
    while (accumulator >= step) {
      update(step);
      accumulator -= step;
    }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
