'use strict';

const UI = {
  current: 'main',
  hudDirty: true,
  toastTimer: null,

  $(id) { return document.getElementById(id); },

  show(name) {
    this.current = name;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const scr = this.$('screen-' + name);
    if (scr) scr.classList.add('active');
    const inMenu = name !== 'game';
    document.body.classList.toggle('in-menu', inMenu);
    document.body.classList.toggle('in-game', !inMenu);
    if (name === 'levels') this.refreshLevels();
    if (name === 'chars') this.refreshChars();
    if (name === 'shop') this.refreshShop();
    if (name === 'settings') this.refreshSettings();
  },

  enterGame() {
    this.show('game');
    this.hideOverlays();
    this.$('hud').classList.remove('hidden');
    this.updateHUD(true);
    const bossbar = this.$('bossbar');
    if (Game.level.bossAlive) {
      bossbar.classList.remove('hidden');
      this.$('bossname').textContent = 'VULKANWÄCHTER';
    } else {
      bossbar.classList.add('hidden');
    }
  },

  showOverlay(name) {
    this.hideOverlays();
    this.$('overlay-' + name).classList.remove('hidden');
  },

  hideOverlays() {
    ['pause', 'win'].forEach(n => this.$('overlay-' + n).classList.add('hidden'));
  },

  toast(msg, ms = 2000) {
    const t = this.$('toast');
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('visible'), ms);
  },

  modal(msg, onYes) {
    const m = this.$('modal');
    this.$('modal-msg').textContent = msg;
    m.classList.remove('hidden');
    const yes = this.$('modal-yes');
    const no = this.$('modal-no');
    const cleanup = () => {
      m.classList.add('hidden');
      yes.onclick = null;
      no.onclick = null;
    };
    yes.onclick = () => { cleanup(); onYes(); };
    no.onclick = cleanup;
  },

  fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
  },

  updateHUD(force = false) {
    if (!force && !this.hudDirty) return;
    this.hudDirty = false;
    if (!Game.level) return;
    const p = Game.player;
    let hearts = '';
    for (let i = 0; i < p.maxHp; i++) {
      hearts += '<span class="heart' + (i < p.hp ? '' : ' empty') + '"></span>';
    }
    this.$('hud-hearts').innerHTML = hearts;
    const shield = document.getElementById('hud-shield');
    shield.style.display = p.shieldActive ? 'inline-block' : 'none';
    this.$('hud-coins').textContent = Save.data.wallet + '  (+' + Game.coinsRun * COIN_VALUE + ')';
    this.$('hud-level').textContent = (Game.levelIdx + 1) + ' · ' + LEVELS[Game.levelIdx].name;
    this.$('hud-time').textContent = this.fmtTime(Game.time);
    if (Game.level.boss && Game.level.enemies.includes(Game.level.boss)) {
      const b = Game.level.boss;
      this.$('bossbar').classList.remove('hidden');
      this.$('bossbar-fill').style.width = Math.max(0, (b.hp / b.maxHp) * 100) + '%';
    } else if (Game.level.arena) {
      this.$('bossbar').classList.add('hidden');
    }
  },

  walletChips() {
    return '<div class="wallet-chip"><span class="coin-dot"></span>' + Save.data.wallet + '</div>';
  },

  refreshLevels() {
    const grid = this.$('level-grid');
    grid.innerHTML = '';
    let lastWorld = null;
    LEVELS.forEach((lvl, i) => {
      if (lvl.world !== lastWorld) {
        lastWorld = lvl.world;
        const h = document.createElement('div');
        h.className = 'world-header';
        h.textContent = lvl.world;
        grid.appendChild(h);
      }
      const unlocked = Save.unlocked(i);
      const stars = Save.getStars(i);
      const btn = document.createElement('button');
      btn.className = 'level-card' + (unlocked ? '' : ' locked') + (stars > 0 ? ' done' : '');
      btn.innerHTML = unlocked
        ? '<div class="lc-num">' + (i + 1) + '</div><div class="lc-name">' + lvl.name + '</div><div class="lc-stars">' + this.starsHTML(stars) + '</div>'
        : '<div class="lc-num">?</div><div class="lc-name">Gesperrt</div><div class="lc-stars"></div>';
      if (unlocked) {
        btn.onclick = () => { Audio.sfx('click'); Game.startLevel(i); };
      } else {
        btn.onclick = () => { Audio.sfx('deny'); this.toast('Level noch gesperrt – schließt Level ' + i + ' ab!', 1800); };
      }
      grid.appendChild(btn);
    });
    this.$('levels-wallet').innerHTML = this.walletChips();
  },

  starsHTML(n) {
    let s = '';
    for (let i = 0; i < 3; i++) s += '<span class="star' + (i < n ? ' earned' : '') + '">★</span>';
    return s;
  },

  portraitCanvas(char, size = 96) {
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    cv.className = 'portrait';
    const ctx = cv.getContext('2d');
    ctx.save();
    ctx.translate(size / 2, size * 0.88);
    ctx.scale(size / 60, size / 60);
    Game.drawPlayerPortrait(ctx, char);
    ctx.restore();
    return cv;
  },

  refreshChars() {
    const grid = this.$('char-grid');
    grid.innerHTML = '';
    for (const c of CHARS) {
      const owned = Save.data.ownedChars.includes(c.id);
      const selected = Save.data.selChar === c.id;
      const card = document.createElement('div');
      card.className = 'card char-card' + (selected ? ' selected' : '');
      const info = document.createElement('div');
      info.className = 'card-info';
      const stats =
        '<div class="statrow"><span>Tempo</span><span class="statbar">' + bar(c.speed, 160, 280) + '</span></div>' +
        '<div class="statrow"><span>Sprung</span><span class="statbar">' + bar(c.jump, 380, 560) + '</span></div>' +
        '<div class="statrow"><span>Herzen</span><span class="statbar">' + heartsBar(c.hp) + '</span></div>' +
        '<div class="statrow"><span>Sprünge</span><span class="statbar">' + c.jumps + (c.jumps > 1 ? '+' : '') + '</span></div>';
      info.innerHTML =
        '<div class="char-title">' + c.title + '</div>' +
        '<h3>' + c.name + '</h3>' +
        '<p class="char-desc">' + c.desc + '</p>' +
        stats;
      const left = document.createElement('div');
      left.className = 'card-left';
      left.appendChild(this.portraitCanvas(c));
      const priceTag = owned
        ? (selected ? '<div class="tag sel">Ausgewählt</div>' : '<div class="tag own">Bereit</div>')
        : '<div class="tag price"><span class="coin-dot"></span>' + c.price + '</div>';
      left.insertAdjacentHTML('beforeend', priceTag);
      const action = document.createElement('button');
      action.className = 'btn btn-small' + (owned ? ' btn-primary' : '');
      if (owned) {
        action.textContent = selected ? 'Aktiv' : 'Auswählen';
        action.disabled = selected;
        action.onclick = () => { Audio.sfx('click'); Save.equipChar(c.id); this.refreshChars(); };
      } else {
        action.textContent = 'Kaufen';
        action.onclick = () => {
          if (Save.buyChar(c.id)) {
            Audio.sfx('buy');
            Save.equipChar(c.id);
            this.toast(c.name + ' freigeschaltet!', 2000);
          } else {
            Audio.sfx('deny');
            this.toast('Nicht genug Münzen! (' + c.price + ' benötigt)', 2000);
          }
          this.refreshChars();
        };
      }
      card.appendChild(left);
      card.appendChild(info);
      card.appendChild(action);
      grid.appendChild(card);
    }
    this.$('chars-wallet').innerHTML = this.walletChips();
  },

  refreshShop() {
    const up = this.$('shop-upgrades');
    up.innerHTML = '';
    for (const u of UPGRADES) {
      const owned = Save.hasUpgrade(u.id);
      const lockedBy = u.requires && !Save.hasUpgrade(u.requires);
      const card = document.createElement('div');
      card.className = 'card shop-card' + (owned ? ' selected' : '');
      card.innerHTML =
        '<div class="shop-icon icon-' + u.icon + '"></div>' +
        '<div class="card-info"><h3>' + u.name + '</h3><p class="char-desc">' + u.desc + '</p></div>';
      const action = document.createElement('button');
      action.className = 'btn btn-small' + (owned ? ' btn-primary' : '');
      if (owned) { action.textContent = 'Gekauft'; action.disabled = true; }
      else if (lockedBy) { action.textContent = 'Vorherige Stufe nötig'; action.disabled = true; }
      else {
        action.innerHTML = 'Kaufen · <span class="coin-dot"></span>' + u.price;
        action.onclick = () => {
          if (Save.buyUpgrade(u.id)) {
            Audio.sfx('buy');
            this.toast(u.name + ' gekauft!', 1800);
          } else {
            Audio.sfx('deny');
            this.toast('Nicht genug Münzen!', 1800);
          }
          this.refreshShop();
        };
      }
      card.appendChild(action);
      up.appendChild(card);
    }

    const tr = this.$('shop-trails');
    tr.innerHTML = '';
    for (const t of TRAILS) {
      const owned = Save.ownTrail(t.id);
      const equipped = Save.data.trail === t.id;
      const card = document.createElement('div');
      card.className = 'card trail-card' + (equipped ? ' selected' : '');
      card.innerHTML =
        '<div class="trail-preview" style="background:radial-gradient(circle,' + t.color + '66,' + t.color + '11)">' +
        '<span class="trail-orb" style="background:' + t.color + '"></span></div>' +
        '<div class="card-info"><h3>' + t.name + '</h3></div>';
      const action = document.createElement('button');
      action.className = 'btn btn-small' + (equipped ? ' btn-primary' : '');
      if (equipped) { action.textContent = 'Aktiv'; action.disabled = true; }
      else if (owned) {
        action.textContent = 'Anlegen';
        action.onclick = () => { Audio.sfx('click'); Save.equipTrail(t.id); this.refreshShop(); };
      } else {
        action.innerHTML = 'Kaufen · <span class="coin-dot"></span>' + t.price;
        action.onclick = () => {
          if (Save.buyTrail(t.id)) {
            Audio.sfx('buy');
            Save.equipTrail(t.id);
            this.toast(t.name + ' angelegt!', 1600);
          } else {
            Audio.sfx('deny');
            this.toast('Nicht genug Münzen!', 1600);
          }
          this.refreshShop();
        };
      }
      card.appendChild(action);
      tr.appendChild(card);
    }
    this.$('shop-wallet').innerHTML = this.walletChips();
  },

  refreshSettings() {
    const s = Save.data.settings;
    this.$('set-master').value = s.master;
    this.$('set-music').value = s.music;
    this.$('set-sfx').value = s.sfx;
  },

  bind() {
    document.querySelectorAll('[data-nav]').forEach(b => {
      b.addEventListener('click', () => {
        Audio.init();
        Audio.sfx('click');
        const target = b.dataset.nav;
        if (target === 'main') Game.quitToMenu();
        else UI.show(target);
      });
    });

    this.$('btn-resume').onclick = () => { Audio.sfx('click'); Game.setPaused(false); };
    this.$('btn-restart').onclick = () => { Audio.sfx('click'); Game.restartLevel(); };
    this.$('btn-pause-levels').onclick = () => { Audio.sfx('click'); UI.show('levels'); Game.state = 'menu'; Game.level = null; };
    this.$('btn-pause-main').onclick = () => { Audio.sfx('click'); Game.quitToMenu(); };

    const master = this.$('set-master'), music = this.$('set-music'), sfxv = this.$('set-sfx');
    master.oninput = () => { Save.setSetting('master', +master.value); Audio.applyVolumes(); };
    music.oninput = () => { Save.setSetting('music', +music.value); Audio.applyVolumes(); };
    sfxv.oninput = () => { Save.setSetting('sfx', +sfxv.value); Audio.applyVolumes(); };
    sfxv.onchange = () => Audio.sfx('coin');

    this.$('btn-reset').onclick = () => {
      this.modal('Wirklich den GESAMTEN Fortschritt löschen? Münzen, Charaktere, Upgrades und Sterne gehen verloren!', () => {
        Save.resetAll();
        Audio.stopMusic();
        Audio.playMusic('menu');
        this.refreshSettings();
        this.toast('Fortschritt zurückgesetzt.', 2000);
      });
    };

    this.$('btn-hud-pause').onclick = () => { Audio.sfx('click'); Game.setPaused(true); };
  },

  showWin(stats, levelIdx) {
    this.showOverlay('win');
    this.hudDirty = true;
    const starsEl = this.$('win-stars');
    starsEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const st = document.createElement('span');
      st.className = 'big-star' + (i < stats.stars ? ' earned' : '');
      st.textContent = '★';
      st.style.animationDelay = (0.3 + i * 0.35) + 's';
      starsEl.appendChild(st);
      if (i < stats.stars) setTimeout(() => Audio.sfx('star', i), 400 + i * 350);
    }
    this.$('win-title').textContent = 'Level geschafft!';
    this.$('win-stats').innerHTML =
      '<div>Münzen eingesammelt: <b>+' + stats.coins + '</b></div>' +
      '<div>Sammel-Bonus: <b>+' + stats.bonus + '</b></div>' +
      '<div>Tode: <b>' + stats.deaths + '</b> · Zeit: <b>' + this.fmtTime(stats.time) + '</b></div>' +
      '<div>Geld gesamt: <b><span class="coin-dot"></span>' + Save.data.wallet + '</b></div>';
    const nextBtn = this.$('btn-win-next');
    nextBtn.style.display = stats.hasNext ? '' : 'none';
    if (stats.hasNext) {
      nextBtn.onclick = () => { Audio.sfx('click'); Game.startLevel(levelIdx + 1); };
    }
    this.$('btn-win-retry').onclick = () => { Audio.sfx('click'); Game.restartLevel(); };
    this.$('btn-win-levels').onclick = () => { Audio.sfx('click'); Game.quitToMenu(); this.show('levels'); };
    this.$('btn-win-main').onclick = () => { Audio.sfx('click'); Game.quitToMenu(); };
  }
};

function bar(val, min, max) {
  const pct = Math.max(8, Math.min(100, ((val - min) / (max - min)) * 100));
  return '<span class="bar"><span class="bar-fill" style="width:' + pct + '%"></span></span>';
}

function heartsBar(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += '<span class="mini-heart"></span>';
  return s;
}
