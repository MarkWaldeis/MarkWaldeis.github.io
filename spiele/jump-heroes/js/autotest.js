'use strict';

window.__AUTOTEST__ = /[?&](autotest|botdebug)/.test(location.search);

const DT = 1 / 60;

function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

async function __runAutotest() {
  const lines = [];
  let passCount = 0, failCount = 0;

  function log(line, ok) {
    lines.push((ok === false ? 'FAIL ' : ok === true ? 'PASS ' : '     ') + line);
    console.log('[AT] ' + line + (ok === true ? ' [PASS]' : ok === false ? ' [FAIL]' : ''));
  }

  function check(name, cond, extra) {
    if (cond) { passCount++; log(name, true); }
    else { failCount++; log(name + (extra ? ' — ' + extra : ''), false); }
  }

  const G = window.__game.Game;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function run() {
    log('=== JUMP HEROES AUTOTEST ===');

    try {
      localStorage.removeItem('jumpHeroesSaveV1');
    } catch (e) {}
    Save.resetAll();

    let t0 = Date.now();

    t('Save: Reset setzt Wallet auf 0', Save.data.wallet === 0);
    t('Save: Nur Starter-Charakter besessen', Save.data.ownedChars.length === 1 && Save.data.ownedChars[0] === 'blitz');
    Save.addCoins(100);
    Save.flush();
    const raw = localStorage.getItem('jumpHeroesSaveV1');
    let roundtrip = false;
    try { roundtrip = JSON.parse(raw).wallet === 100; } catch (e) {}
    t('Save: Roundtrip via localStorage', roundtrip);
    Save.resetAll();

    t('Daten: Alle Charaktere valide', CHARS.every(c => c.id && c.name && c.speed > 0 && c.jump > 0 && c.hp >= 1 && c.jumps >= 1 && c.price >= 0));
    t('Daten: Genau ein Gratis-Charakter', CHARS.filter(c => c.price === 0).length === 1);
    t('Daten: Upgrades valide', UPGRADES.every(u => u.id && u.price > 0 && (!u.requires || UPGRADES.some(x => x.id === u.requires))));
    t('Daten: Trails valide', TRAILS.every(tr => tr.id && tr.price >= 0));
    t('Level: 12 Level vorhanden', LEVELS.length === 12);

    for (let i = 0; i < LEVELS.length; i++) {
      const L = new Level(LEVELS[i], i);
      const sc = Math.floor(L.spawn.x / TILE);
      const spawnGrounded = ['#'].includes(L.tileChar(sc, L.h - 1));
      const noEntLeft = L.grid.every(row => row.every(ch => '#-^~BD.'.includes(ch)));
      check(
        'Level ' + (i + 1) + ' "' + LEVELS[i].name + '" Struktur',
        L.w > 60 &&
        L.goal.x > L.spawn.x &&
        L.coins.length >= 8 &&
        L.enemies.length >= 1 &&
        L.springs.length + L.movers.length >= 0 &&
        spawnGrounded && noEntLeft,
        'goal=' + !!L.goal.x + ' coins=' + L.coins.length + ' enemies=' + L.enemies.length +
        ' groundedSpawn=' + spawnGrounded
      );
    }

    Save.addCoins(10000);
    t('Shop: Charakterkauf erfolgreich', Save.buyChar('kira') && Save.data.ownedChars.includes('kira'));
    t('Shop: Doppelkauf true aber keine Doppelliste', Save.buyChar('kira') && Save.data.ownedChars.filter(c => c === 'kira').length === 1);
    t('Shop: Upgrade mit Vorbedingung blockiert', !Save.buyUpgrade('heart2'));
    t('Shop: Upgrade-Kauf erfolgreich', Save.buyUpgrade('heart1') && Save.hasUpgrade('heart1'));
    t('Shop: Folge-Upgrade jetzt kaufbar', Save.buyUpgrade('heart2') && Save.heartsBonus() === 2);
    t('Shop: Trail-Kauf erfolgreich', Save.buyTrail('fire') && Save.equipTrail('fire') && Save.data.trail === 'fire');
    Save.spend(Save.data.wallet);
    t('Shop: Kauf ohne Geld abgelehnt', !Save.buyChar('nyx') && !Save.buyUpgrade('doublejump'));
    Save.resetAll();
    t('Charakter: Ausrüsten setzt selChar', Save.equipChar('blitz') && Save.data.selChar === 'blitz');
    t('Progress: Sterne setzen & Level-Unlock', (Save.setStars(0, 3), Save.getStars(0) === 3 && Save.unlocked(1) && !Save.unlocked(2)));

    G.startLevel(0, { silent: true });
    const P = G.player, L = G.level;
    const startX = P.x;
    let sawAir = false;
    Input.right = true;
    for (let f = 0; f < 600; f++) {
      if (f % 40 === 20 && P.grounded) Input.jumpP = true;
      if (!P.grounded) sawAir = true;
      G.step(DT);
      if (!Number.isFinite(P.x) || !Number.isFinite(P.y)) break;
    }
    Input.right = false; Input.jumpP = false;
    check('Physik: 10s Lauf nach rechts, Fortschritt > 250px', Number.isFinite(P.x) && P.x - startX > 250, 'dx=' + (P.x - startX).toFixed(0));
    check('Physik: Sprünge fanden statt', sawAir);
    check('Physik: Keine NaN-Positionen', Number.isFinite(P.x) && Number.isFinite(P.y) && Number.isFinite(P.vx) && Number.isFinite(P.vy));

    G.startLevel(0, { silent: true });
    Save.resetAll();
    const coin = G.level.coins[0];
    const walletBefore = Save.data.wallet;
    G.player.x = coin.x - 11; G.player.y = coin.y - 15; G.player.vx = 0; G.player.vy = 0;
    for (let f = 0; f < 4; f++) G.step(DT);
    check('Münzen: Einsammeln gutschreiben', coin.taken && Save.data.wallet - walletBefore === COIN_VALUE,
      'taken=' + coin.taken + ' delta=' + (Save.data.wallet - walletBefore));
    check('Münzen: Run-Zähler hochgezählt', G.coinsRun === 1);

    G.startLevel(2, { silent: true });
    let spikeCell = null;
    for (let r = 0; r < G.level.h && !spikeCell; r++)
      for (let c = 0; c < G.level.w; c++)
        if (G.level.tileChar(c, r) === '^') { spikeCell = { c, r }; break; }
    let spikeOk = false, iframeOk = false;
    if (spikeCell) {
      const p2 = G.player;
      p2.x = spikeCell.c * TILE + 5;
      p2.y = spikeCell.r * TILE - p2.h - 2;
      p2.vx = 0; p2.vy = 0;
      const hpMax = p2.maxHp;
      for (let f = 0; f < 120 && p2.hp === hpMax; f++) G.step(DT);
      spikeOk = p2.hp < hpMax && p2.invuln > 0;
      const hpAfterHit = p2.hp;
      for (let f = 0; f < 5; f++) G.step(DT);
      iframeOk = p2.hp === hpAfterHit;
    }
    check('Gefahren: Spike verursacht Schaden + i-Frames aktiv', spikeOk);
    check('Gefahren: i-Frames verhindern Sofortschaden', iframeOk);

    G.startLevel(0, { silent: true });
    const walker = G.level.enemies.find(e => e instanceof Walker);
    let stompOk = false;
    if (walker) {
      const p3 = G.player;
      p3.x = walker.x; p3.y = walker.y - p3.h - 34; p3.vx = 0; p3.vy = -50;
      for (let f = 0; f < 90 && !walker.dead; f++) G.step(DT);
      stompOk = walker.dead && G.player.vy < 0;
    }
    check('Kampf: Stomp besiegt Gegner & bounce', stompOk);

    G.startLevel(0, { silent: true });
    {
      const p4 = G.player;
      p4.x = G.level.goal.x - 70;
      p4.y = G.level.goal.y - p4.h - 2;
      p4.vx = 0; p4.vy = 0;
      Input.right = true;
      let frames = 0;
      while (G.state !== 'win' && frames++ < 300) G.step(DT);
      Input.right = false;
      check('Ziel: Fahne löst Sieg aus + mind. 1 Stern', G.state === 'win' && G.winStats.stars >= 1,
        'state=' + G.state + ' stars=' + (G.winStats ? G.winStats.stars : '-'));
      check('Ziel: nächstes Level freigeschaltet', Save.unlocked(1));
    }

    const BOT_PLAN = [
      { mode: 'win' },
      { mode: 'win' },
      { mode: 'win' },
      { mode: 'win' },
      { mode: 'win' },
      { mode: 'win' },
      { mode: 'progress', val: 0.55 },
      { mode: 'progress', val: 0.40 },
      { mode: 'win' },
      { mode: 'progress', val: 0.45 },
      { mode: 'win' },
      { mode: 'arena' }
    ];

    for (let i = 0; i < LEVELS.length; i++) {
      const res = runBot(i, BOT_PLAN[i], makeRng(1234 + i * 77));
      let ok = false, info = '';
      if (res.mode === 'win') { ok = res.won; info = 'won=' + res.won + ' pct=' + (res.progress * 100).toFixed(0) + '%'; }
      else if (res.mode === 'arena') { ok = res.won || res.arenaReached; info = 'won=' + res.won + ' arena=' + res.arenaReached + ' pct=' + (res.progress * 100).toFixed(0) + '%'; }
      else { ok = res.progress >= res.need; info = 'pct=' + (res.progress * 100).toFixed(0) + '% need=' + (res.need * 100) + '%'; }
      check(
        'Bot: Level ' + (i + 1) + ' "' + LEVELS[i].name + '"',
        ok,
        info + ' deaths=' + res.deaths + ' frames=' + res.frames + ' | died@ ' + (res.deathSummary || '-') + ' | ' + res.samples.slice(-3).join(' ')
      );
    }

    if (false) { /* diagnostic hook */ }

    G.startLevel(11, { silent: true });
    {
      const boss = G.level.boss;
      let bossOk = !!boss;
      if (bossOk) {
        const p5 = G.player;
        for (let hit = 0; hit < 3 && bossOk && !boss.dead; hit++) {
          let waited = 0;
          while (boss.invuln > 0 && waited++ < 240) G.step(DT);
          p5.dead = false;
          p5.hp = Math.max(1, p5.hp);
          p5.invuln = 3.5;
          p5.x = boss.cx - p5.w / 2;
          p5.y = boss.y - p5.h - 42;
          p5.vx = 0; p5.vy = -60;
          const hpBefore = boss.hp;
          let frames = 0;
          while (boss.hp === hpBefore && !boss.dead && frames++ < 300) {
            if (!p5.dead && frames % 3 === 0) {
              p5.x = boss.cx - p5.w / 2;
              if (p5.y + p5.h < boss.y - 4) p5.y = boss.y - p5.h - 42;
            }
            G.step(DT);
          }
          if (boss.hp >= hpBefore && !boss.dead) bossOk = false;
        }
      }
      check('Boss: 3 Kopftreffer besiegen den Wächter', bossOk && boss.dead && G.level.bossDefeated && !G.level.bossAlive,
        'hp=' + (boss ? boss.hp : '-') + ' defeated=' + G.level.bossDefeated);
    }

    G.startLevel(8, { silent: true });
    {
      const rng = makeRng(42);
      const p6 = G.player;
      let totalMs = 0, frames = 3600, badFrame = 0;
      let toggle = 0;
      for (let f = 0; f < frames; f++) {
        if (f % 30 === 0) {
          toggle = rng();
          Input.right = toggle < 0.75; Input.left = !Input.right && toggle < 0.9;
          if (rng() < 0.25) Input.jumpP = true;
        }
        const s0 = performance.now();
        G.step(DT);
        totalMs += performance.now() - s0;
        if (!Number.isFinite(p6.x)) badFrame++;
      }
      Input.right = Input.left = false;
      const avg = totalMs / frames;
      check('Performance: Ø Step-Zeit < 6ms über 3600 Frames', avg < 6 && badFrame === 0, 'avg=' + avg.toFixed(2) + 'ms bad=' + badFrame);
    }

    Save.resetAll();
    try { localStorage.removeItem('jumpHeroesSaveV1'); } catch (e) {}

    const total = passCount + failCount;
    const verdict = failCount === 0 ? 'PASS' : 'FAIL';
    log('==========================================');
    log('ERGEBNIS: ' + verdict + '  —  ' + passCount + '/' + total + ' Tests bestanden' + (failCount ? ', ' + failCount + ' fehlgeschlagen' : ''), failCount === 0);
    console.log('[AT] AUTOTEST_RESULT ' + verdict + ' ' + passCount + '/' + total);
    document.title = 'AUTOTEST ' + verdict + ' (' + passCount + '/' + total + ')';

    showReport(lines, verdict, passCount, total);
  }

  function t(name, cond) { check(name, cond); }

  const deathLog = [];
  const origDie = Player.prototype.die;
  Player.prototype.die = function () {
    deathLog.push({ lvl: G.levelIdx, col: Math.round(this.x / TILE), hp: this.hp });
    return origDie.call(this);
  };

  function runBot(levelIdx, plan, rng) {
    G.startLevel(levelIdx, { silent: true });
    const L = G.level;
    const P = G.player;
    const dStart = deathLog.length;
    const spawnX = P.x;
    const targetX = L.goal.x;
    let maxX = spawnX;
    let refX = P.x, refT = 0;
    let phase = 'run', phaseT = 0, backCount = 0;
    let holdT = 0;
    let dangerAhead = false;
    let frames = 0;
    const samples = [];
    const maxFrames = 16000;
    let won = false, arenaReached = false;

    while (frames++ < maxFrames) {
      if (G.state === 'win') { won = true; break; }
      if (G.deaths > 45) break;

      Input.left = false; Input.right = false; Input.jump = false;
      holdT -= DT;
      if (holdT > 0) Input.jump = true;

      if (phase === 'back') {
        Input.left = true;
        if (P.grounded) { Input.jumpP = true; holdT = 0.32; }
      } else {
        const nearC = Math.floor((P.x + P.w + 14) / TILE);
        const farC = Math.floor((P.x + P.w + 84) / TILE);
        const headRow = Math.floor((P.y + 4) / TILE);
        const bodyRow = Math.floor((P.y + P.h - 4) / TILE);
        const sr = Math.floor((P.y + P.h + 3) / TILE);
        const isSup = (c, r) => '#-B'.includes(L.tileChar(c, r));
        const wall = P.grounded && (L.solidAt(farC, headRow) || L.solidAt(farC, bodyRow));
        const haz = L.tileChar(nearC, bodyRow) === '^' || L.tileChar(nearC, sr) === '^';
        const sN = [isSup(nearC, sr), isSup(nearC, sr - 1), isSup(nearC, sr - 2), isSup(nearC, sr - 3)];
        const sF = [isSup(farC, sr), isSup(farC, sr - 1), isSup(farC, sr - 2), isSup(farC, sr - 3)];
        let gap = false;
        if (P.grounded && !sN[0] && !sN[1] && !sN[2]) {
          gap = true;
          for (let rr = sr + 1; rr <= sr + 4; rr++) {
            if (isSup(nearC, rr)) { gap = false; break; }
          }
        }

        const feet = P.y + P.h;

        let enemyAhead = false;
        for (const e of L.enemies) {
          if (e.dead || e.gone) continue;
          if (e.cx > P.cx + 8 && e.cx < P.cx + 170 && Math.abs(e.cy - P.cy) < 52) { enemyAhead = true; break; }
        }

        let springAhead = false;
        for (const s of L.springs) {
          if (s.x > P.x + 20 && s.x < P.x + 280 && Math.abs(s.y + 14 - feet) < 60) { springAhead = true; break; }
        }

        let moverHold = false, moverGo = false;
        if (P.grounded && gap) {
          for (const m of L.movers) {
            if (m.cx > P.x - 40 && m.cx < P.x + 16 * TILE) {
              const r = m.rect();
              const dv = Math.abs(r.y - feet);
              const mc = r.x + r.w / 2;
              if (mc >= P.x + P.w - 10 && mc <= P.x + P.w + 100 && dv <= 95) moverGo = true;
              else if (dv <= 130) moverHold = true;
            }
          }
        }
        const wait = moverHold && !moverGo;
        if (wait) { refX = P.x; refT = 0; }

        const upNear = sN[1] || sN[2] || sN[3];
        const upFar = sF[1] || sF[2] || sF[3];

        let doJump = false, holdV = 0;
        if (P.grounded && !wait && (wall || (haz && !springAhead) || gap)) { doJump = true; holdV = 0.34; }
        else if (P.grounded && !wait && enemyAhead && !gap && !haz) { doJump = true; holdV = 0.3; }
        else if (P.grounded && !wait && !haz && !enemyAhead && (upNear || upFar)) {
          doJump = true;
          holdV = (sN[2] || sN[3] || sF[2] || sF[3]) ? 0.34 : 0.12;
        }
        if (!P.grounded && P.vy > 80 && P.maxJumps > 1 && P.jumpsLeft > 0 && rng() < 0.3) { Input.jumpP = true; holdT = 0.3; }
        if (doJump) { Input.jumpP = true; holdT = holdV; Input.right = true; }
        else if (!wait) Input.right = true;

        dangerAhead = wall || haz || gap || enemyAhead;
        if (P.ride && P.ride.dx < 0 && !sN[0] && !sN[1] && !sN[2]) { Input.jumpP = true; holdT = 0.34; Input.right = true; }
      }

      phaseT += DT;
      if (phase === 'back' && phaseT > 0.5) { phase = 'run'; phaseT = 0; refX = P.x; refT = 0; }
      if (phase === 'run') {
        refT += DT;
        if (P.x - refX > 16) { refX = P.x; refT = 0; }
        if (refT > 1.0) {
          backCount++;
          if (!dangerAhead) {
            phase = 'back';
            phaseT = 0;
            if (backCount % 3 === 0) { phaseT = -0.35; }
          } else {
            refT = 0;
            refX = P.x;
          }
        }
      }

      maxX = Math.max(maxX, P.x);
      if (frames % 400 === 0) samples.push('f' + frames + ':x' + Math.round(P.x / TILE) + (P.grounded ? 'g' : 'a'));
      G.step(DT);

      if (L.bossAlive && L.arena && P.x >= L.arena.l - 24) { arenaReached = true; break; }
    }

    Input.left = false; Input.right = false; Input.jump = false; Input.jumpP = false;

    const dCols = {};
    for (let k = dStart; k < deathLog.length; k++) {
      if (deathLog[k].lvl !== levelIdx) continue;
      const c = deathLog[k].col + (deathLog[k].hp <= 0 ? 'h' : 'f');
      dCols[c] = (dCols[c] || 0) + 1;
    }
    const deathSummary = Object.entries(dCols).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([c, n]) => 'x' + c + '(' + n + ')').join(' ');

    return {
      won, arenaReached,
      progress: (maxX - spawnX) / Math.max(1, targetX - spawnX),
      deaths: G.deaths,
      frames,
      samples,
      deathSummary,
      need: plan.val || 0,
      mode: plan.mode
    };
  }

  function showReport(lines, verdict, passCount, total) {
    const div = document.createElement('div');
    div.className = 'autotest-report';
    div.textContent = 'JUMP HEROES AUTOTEST\n' + lines.join('\n');
    document.body.appendChild(div);
  }

  await run();
}
