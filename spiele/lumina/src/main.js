/* ==========================================================================
   LUMINA: CHRONICLES OF AETHER - CORE ENGINE & GAME MANAGER
   ========================================================================== */

class LuminaParticles {
  constructor() {
    this.list = [];
  }

  spawnBurst(x, y, color, count = 10, speed = 180, shape = "circle") {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const vel = LuminaMath.rand(speed * 0.4, speed);
      this.list.push({
        x,
        y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel - 20,
        life: LuminaMath.rand(0.3, 0.7),
        maxLife: 0.7,
        size: LuminaMath.rand(3, 8),
        color,
        shape,
        gravity: shape === "spark" ? 60 : 350
      });
    }
  }

  spawnDust(x, y, color = "#64d2ff") {
    this.list.push({
      x,
      y,
      vx: LuminaMath.rand(-30, 30),
      vy: LuminaMath.rand(-25, -10),
      life: 0.35,
      maxLife: 0.35,
      size: LuminaMath.rand(4, 7),
      color,
      shape: "circle",
      gravity: -10
    });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.4, dt);

      if (p.life <= 0) {
        this.list.splice(i, 1);
      }
    }
  }
}

class LuminaCamera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.shake = 0;
    this.targetX = 0;
  }

  addShake(amount) {
    this.shake = Math.min(18, this.shake + amount);
  }

  snapTo(x, y) {
    this.x = LuminaMath.clamp(x - 300, 0, 17500 - 1280);
    this.targetX = this.x;
  }

  getShakeOffset() {
    if (this.shake <= 0) return { x: 0, y: 0 };
    return {
      x: LuminaMath.rand(-this.shake, this.shake),
      y: LuminaMath.rand(-this.shake * 0.5, this.shake * 0.5)
    };
  }

  update(dt, player, engine) {
    let desiredX = player.x - 1280 * 0.35 + player.vx * 0.25;

    // Lock camera in boss arena
    if (engine.boss.active) {
      desiredX = LuminaMath.clamp(desiredX, 14900, 15650);
    }

    this.targetX = LuminaMath.clamp(desiredX, 0, engine.level.worldEnd - 1280);
    this.x = LuminaMath.lerp(this.x, this.targetX, 1 - Math.pow(0.0006, dt));
    this.shake = Math.max(0, this.shake - 28 * dt);
  }
}

class LuminaUI {
  constructor(engine) {
    this.engine = engine;
    this.screens = {
      title: document.getElementById("title-screen"),
      pause: document.getElementById("pause-screen"),
      gameover: document.getElementById("gameover-screen"),
      victory: document.getElementById("victory-screen"),
      achievements: document.getElementById("achievements-screen")
    };
    this.toastEl = document.getElementById("toast-container");
    this.toastText = document.getElementById("toast-text");
    this.toastTimer = null;

    this.achievements = [
      { id: "first_dash", title: "Lichtgeschwindigkeit", desc: "Führe deinen ersten Air-Dash aus", icon: "💨", unlocked: false },
      { id: "wall_master", title: "Akrobat", desc: "Vollführe einen Wall-Jump", icon: "🧗", unlocked: false },
      { id: "core_hunter", title: "Aether-Sucher", desc: "Finde alle 5 Aether-Kerne", icon: "✨", unlocked: false },
      { id: "boss_slayer", title: "Himmels-Bezwinger", desc: "Besiege Aetheris den Oberherrn", icon: "👑", unlocked: false }
    ];

    this.loadAchievements();
    this.bindEvents();
  }

  bindEvents() {
    document.getElementById("start-btn").addEventListener("click", () => this.engine.start());
    document.getElementById("resume-btn").addEventListener("click", () => this.engine.togglePause());
    document.getElementById("restart-btn").addEventListener("click", () => this.engine.start());
    document.getElementById("retry-btn").addEventListener("click", () => this.engine.start());
    document.getElementById("again-btn").addEventListener("click", () => this.engine.start());

    document.getElementById("sound-btn").addEventListener("click", () => {
      this.engine.audio.init();
      const enabled = this.engine.audio.toggle();
      document.getElementById("sound-btn").textContent = enabled ? "♪" : "×";
    });

    document.getElementById("fullscreen-btn").addEventListener("click", async () => {
      const shell = document.getElementById("game-shell");
      try {
        if (!document.fullscreenElement) await shell.requestFullscreen();
        else await document.exitFullscreen();
      } catch (_) {
        this.showToast("Vollbild nicht verfügbar");
      }
    });

    document.getElementById("achieve-btn").addEventListener("click", () => this.showAchievements());
    document.getElementById("close-achieve-btn").addEventListener("click", () => this.hideAchievements());
  }

  showScreen(name) {
    Object.values(this.screens).forEach(s => {
      s.classList.remove("active");
      s.setAttribute("aria-hidden", "true");
    });
    if (this.screens[name]) {
      this.screens[name].classList.add("active");
      this.screens[name].setAttribute("aria-hidden", "false");
    }
  }

  hideScreens() {
    Object.values(this.screens).forEach(s => {
      s.classList.remove("active");
      s.setAttribute("aria-hidden", "true");
    });
  }

  showToast(message, duration = 2200) {
    this.toastText.textContent = message;
    this.toastEl.classList.add("visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove("visible"), duration);
  }

  unlockAchievement(id) {
    const a = this.achievements.find(item => item.id === id);
    if (a && !a.unlocked) {
      a.unlocked = true;
      this.saveAchievements();
      this.showToast(`🏆 Erfolg freigeschaltet: ${a.title}!`, 3000);
      this.engine.audio.playSFX("relic");
    }
  }

  loadAchievements() {
    try {
      const saved = localStorage.getItem("lumina_achievements");
      if (saved) {
        const ids = JSON.parse(saved);
        this.achievements.forEach(a => {
          if (ids.includes(a.id)) a.unlocked = true;
        });
      }
    } catch (_) {}
  }

  saveAchievements() {
    try {
      const unlockedIds = this.achievements.filter(a => a.unlocked).map(a => a.id);
      localStorage.setItem("lumina_achievements", JSON.stringify(unlockedIds));
    } catch (_) {}
  }

  showAchievements() {
    const list = document.getElementById("achievement-container");
    list.innerHTML = "";
    this.achievements.forEach(a => {
      const item = document.createElement("div");
      item.className = `achievement-item ${a.unlocked ? "unlocked" : ""}`;
      item.innerHTML = `
        <div class="achievement-icon">${a.icon}</div>
        <div>
          <strong style="color: ${a.unlocked ? "#00f5a0" : "#fff"}">${a.title}</strong>
          <p style="font-size: 0.8rem; color: var(--color-text-dim); margin-top: 2px;">${a.desc}</p>
        </div>
      `;
      list.appendChild(item);
    });
    this.showScreen("achievements");
  }

  hideAchievements() {
    if (this.engine.state.mode === "playing") this.hideScreens();
    else this.showScreen("title");
  }
}

class LuminaGame {
  constructor() {
    const canvas = document.getElementById("game-canvas");
    this.canvas = canvas;
    this.audio = new LuminaAudioEngine();
    this.input = new LuminaInput();
    this.particles = new LuminaParticles();
    this.camera = new LuminaCamera();
    this.player = new LuminaPlayer();
    this.enemies = new LuminaEnemies();
    this.boss = new LuminaBoss();
    this.level = new LuminaLevel();
    this.renderer = new LuminaRenderer(canvas);
    this.ui = new LuminaUI(this);

    this.state = {
      mode: "title",
      time: 0,
      playTime: 0,
      zone: 0,
      cores: 0,
      shards: 0,
      score: 0,
      lives: 3,
      comboCount: 0,
      currentCheckpoint: { x: 140, y: 500 }
    };

    this.freezeTime = 0;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.fixedStep = 1 / 120;

    // Build initial level for background display
    this.level.build(this);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  start() {
    this.audio.init();
    this.audio.setMuffled(false);

    this.level.build(this);
    this.player.reset(140, 500);
    this.boss.spawn(16250, 610);
    this.boss.active = false;
    this.boss.alive = false;

    Object.assign(this.state, {
      mode: "playing",
      time: 0,
      playTime: 0,
      zone: 0,
      cores: 0,
      shards: 0,
      score: 0,
      lives: 3,
      comboCount: 0,
      currentCheckpoint: { x: 140, y: 500 }
    });

    this.camera.snapTo(140, 500);
    this.ui.hideScreens();
    this.ui.showToast("⚡ Reise nach Aetheris begonnen!", 2400);
  }

  togglePause() {
    if (this.state.mode === "playing") {
      this.state.mode = "paused";
      this.audio.setMuffled(true);
      this.ui.showScreen("pause");
    } else if (this.state.mode === "paused") {
      this.state.mode = "playing";
      this.audio.setMuffled(false);
      this.ui.hideScreens();
    }
  }

  hitStop(duration = 0.05) {
    this.freezeTime = duration;
  }

  triggerGameOver() {
    this.state.mode = "gameover";
    this.audio.setMuffled(true);

    document.getElementById("go-cores").textContent = `${this.state.cores} / 5`;
    document.getElementById("go-shards").textContent = String(this.state.shards);
    document.getElementById("go-time").textContent = this.formatTime(this.state.playTime);
    document.getElementById("go-score").textContent = this.state.score.toLocaleString("de-DE");

    this.ui.showScreen("gameover");
  }

  triggerVictory() {
    this.state.mode = "victory";
    this.audio.setMuffled(true);
    this.audio.playSFX("victory");

    this.ui.unlockAchievement("boss_slayer");
    if (this.state.cores >= 5) this.ui.unlockAchievement("core_hunter");

    const timeBonus = Math.max(0, 8000 - Math.floor(this.state.playTime) * 10);
    this.state.score += timeBonus + this.state.lives * 1000;

    let rank = "B";
    if (this.state.score > 12000 && this.state.playTime < 240) rank = "S-RANG";
    else if (this.state.score > 8000) rank = "A-RANG";

    document.getElementById("vic-rank").textContent = rank;
    document.getElementById("vic-score").textContent = this.state.score.toLocaleString("de-DE");
    document.getElementById("vic-time").textContent = this.formatTime(this.state.playTime);
    document.getElementById("vic-shards").textContent = `${this.state.shards} Shards`;

    this.ui.showScreen("victory");
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  update(dt) {
    if (this.input.pressed.pause && this.state.mode !== "title") {
      this.togglePause();
      this.input.clearFrame();
      return;
    }

    if (this.state.mode !== "playing") {
      this.input.clearFrame();
      return;
    }

    // Achievements tracking
    if (this.player.isDashing) this.ui.unlockAchievement("first_dash");
    if (this.player.onWall !== 0) this.ui.unlockAchievement("wall_master");

    this.state.time += dt;
    this.state.playTime += dt;
    this.state.zone = this.level.getZone(this.player.x);

    // Entity updates
    this.player.update(dt, this.input, this);
    this.enemies.update(dt, this.player, this);
    this.boss.update(dt, this.player, this);
    this.level.update(dt, this.player, this);
    this.particles.update(dt);
    this.camera.update(dt, this.player, this);

    // BGM track updater
    this.audio.updateMusic(this.state.zone, this.boss.active);

    this.input.clearFrame();
  }

  loop(now) {
    const elapsed = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // Gamepad polling
    this.input.pollGamepad();

    // Hit-stop freeze logic
    if (this.freezeTime > 0) {
      this.freezeTime -= elapsed;
    } else {
      this.accumulator += elapsed;
      while (this.accumulator >= this.fixedStep) {
        this.update(this.fixedStep);
        this.accumulator -= this.fixedStep;
      }
    }

    this.renderer.render(this);
    requestAnimationFrame(this.loop);
  }
}

// Instantiate Game on Page Load
window.addEventListener("DOMContentLoaded", () => {
  window.luminaGameInstance = new LuminaGame();
});
