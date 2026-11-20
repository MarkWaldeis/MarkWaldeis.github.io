'use strict';
/* global UnoEngine, UNO_FIREBASE_CONFIG */
const E = UnoEngine;
const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const SYMBOLS = { skip: '⊘', rev: '⇄', d2: '+2', wild: '', wild4: '+4' };
const FB_VERSION = '10.14.1';

let db = null, fb = null;
let roomRef = null;
let myPid = null, myName = '';
let roomCode = null, isHost = false, joined = false;
let cur = null;
let localMode = false;
let curtainFor = null;
let pendingWild = null;
let actionQueue = [], draining = false;
let fbEnabled = !!window.UNO_FIREBASE_CONFIG;

// ---------- kleine Helfer ----------
function toast(msg, ms = 2600) {
  const t = $('toast');
  t.textContent = msg;
  show('toast');
  clearTimeout(t._h);
  t._h = setTimeout(() => hide('toast'), ms);
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  show(id);
}
function err(msg) { $('start-error').textContent = msg; }

// ---------- Firebase ----------
async function ensureFb() {
  if (db) return true;
  if (!window.UNO_FIREBASE_CONFIG) return false;
  const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
  const appMod = await import(base + 'firebase-app.js');
  fb = await import(base + 'firebase-database.js');
  db = fb.getDatabase(appMod.initializeApp(window.UNO_FIREBASE_CONFIG));
  return true;
}

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

async function createRoom() {
  if (!(await ensureFb())) return err('Firebase ist nicht konfiguriert');
  myPid = 'p' + Math.random().toString(36).slice(2, 10);
  for (let i = 0; i < 10; i++) {
    const code = newCode();
    const ref = fb.ref(db, 'rooms/' + code);
    if (!(await fb.get(ref)).exists()) {
      roomCode = code;
      roomRef = ref;
      sessionStorage.setItem('uno-pid-' + code, myPid);
      await fb.set(ref, {
        code, status: 'lobby', hostId: myPid, createdAt: Date.now(),
        players: { [myPid]: { name: myName, connected: true, joinedAt: Date.now() } },
      });
      afterJoin();
      return;
    }
  }
  err('Kein freier Raum — nochmal versuchen');
}

async function joinRoom(code) {
  if (!(await ensureFb())) return err('Firebase ist nicht konfiguriert');
  code = (code || '').toUpperCase().trim();
  if (code.length !== 4) return err('Code hat 4 Zeichen');
  const ref = fb.ref(db, 'rooms/' + code);
  const snap = await fb.get(ref);
  if (!snap.exists()) return err('Raum nicht gefunden');
  const room = snap.val();
  myPid = sessionStorage.getItem('uno-pid-' + code) || 'p' + Math.random().toString(36).slice(2, 10);
  const existing = room.players && room.players[myPid];
  if (room.status !== 'lobby' && !existing) return err('Das Spiel läuft schon');
  const count = Object.keys(room.players || {}).length;
  if (!existing && count >= 8) return err('Raum ist voll (max. 8)');
  roomCode = code;
  roomRef = ref;
  sessionStorage.setItem('uno-pid-' + code, myPid);
  await fb.update(fb.child(roomRef, 'players/' + myPid), {
    name: myName, connected: true,
    joinedAt: (existing && existing.joinedAt) || Date.now(),
  });
  afterJoin();
}

function afterJoin() {
  joined = true;
  fb.onDisconnect(fb.child(roomRef, 'players/' + myPid + '/connected')).set(false);
  subscribeRoom();
  showScreen('screen-lobby');
  renderLobby();
}

function subscribeRoom() {
  fb.onValue(roomRef, snap => {
    cur = snap.val();
    if (!cur) { toast('Der Raum wurde geschlossen'); leaveRoom(true); return; }
    isHost = cur.hostId === myPid;
    // Host-Übernahme, falls der Host offline ist
    const host = cur.players && cur.players[cur.hostId];
    if (joined && host && host.connected === false) {
      fb.runTransaction(fb.child(roomRef, 'hostId'), h => {
        const hNow = cur.players && cur.players[h];
        return (hNow && hNow.connected === false) ? myPid : undefined;
      });
    }
    if (cur.status === 'lobby') { showScreen('screen-lobby'); renderLobby(); }
    else { showScreen('screen-game'); renderGame(); }
    if (cur.status === 'finished') renderEnd();
    else hide('modal-end');
  });
  fb.onChildAdded(fb.child(roomRef, 'actions'), snap => {
    if (!isHost) return;
    actionQueue.push(snap);
    drainActions();
  });
  fb.onChildAdded(fb.child(roomRef, 'feedback/' + myPid), snap => {
    toast(snap.val());
    fb.remove(snap.ref);
  });
}

async function drainActions() {
  if (draining) return;
  draining = true;
  while (actionQueue.length) {
    const snap = actionQueue.shift();
    const a = snap.val();
    const r = E.applyAction(cur, a.pid, a);
    if (r.ok) {
      try { await fb.set(roomRef, cur); } catch (e) { /* Verbindung weg — nächster Sync korrigiert */ }
    } else {
      await fb.push(fb.child(roomRef, 'feedback/' + a.pid), r.err || 'Ungültiger Zug').catch(() => {});
    }
    await fb.remove(snap.ref).catch(() => {});
  }
  draining = false;
}

function sendAction(a) {
  if (localMode) {
    const pid = cur.order[cur.turn];
    const before = cur.turn;
    const r = E.applyAction(cur, pid, a);
    if (!r.ok) return toast(r.err);
    if (cur.status === 'finished') renderEnd();
    if (cur.status === 'playing' && cur.turn !== before) {
      curtainFor = cur.order[cur.turn];
      renderGame();
    } else renderGame();
    return;
  }
  fb.push(fb.child(roomRef, 'actions'), Object.assign({ pid: myPid }, a));
}

// ---------- Lobby ----------
function renderLobby() {
  $('lobby-code').textContent = roomCode;
  const ul = $('lobby-players');
  const players = cur && cur.players ? cur.players : {};
  const ids = Object.keys(players).sort((x, y) => (players[x].joinedAt || 0) - (players[y].joinedAt || 0));
  ul.innerHTML = ids.map(pid => {
    const p = players[pid];
    const me = pid === myPid ? ' (du)' : '';
    const crown = pid === cur.hostId ? ' <span class="crown">👑</span>' : '';
    return `<li><span class="dot${p.connected === false ? ' off' : ''}"></span>${esc(p.name)}${me}${crown}</li>`;
  }).join('');
  const online = ids.filter(pid => players[pid].connected !== false).length;
  if (isHost) {
    show('btn-start-game');
    $('btn-start-game').disabled = online < 2;
    $('lobby-wait').textContent = online < 2 ? 'Mindestens 2 Spieler nötig — teile den Code!' : 'Du bist der Host.';
  } else {
    hide('btn-start-game');
    $('lobby-wait').textContent = 'Warte auf den Host …';
  }
}

async function hostStartGame() {
  const ids = Object.keys(cur.players)
    .filter(pid => cur.players[pid].connected !== false)
    .sort((x, y) => (cur.players[x].joinedAt || 0) - (cur.players[y].joinedAt || 0));
  cur.order = ids;
  E.deal(cur);
  cur.actions = null; // alte Intents löschen
  await fb.set(roomRef, cur);
}

// ---------- Spielfeld ----------
function activePid() { return localMode ? cur.order[cur.turn] : myPid; }
function myTurn() { return localMode || cur.order[cur.turn] === myPid; }

function cardHtml(card, small) {
  const sym = card.c === 'w' ? (card.v === 'wild' ? '<span class="wild-oval"></span>' : '+4')
    : (SYMBOLS[card.v] || card.v);
  const corner = card.c === 'w' ? (card.v === 'wild' ? '★' : '+4') : (SYMBOLS[card.v] || card.v);
  return `<div class="card ${card.c}${small ? '' : ''}" title="${esc(E.label(card))}">
    <span class="corner tl">${corner}</span>${sym}<span class="corner br">${corner}</span></div>`;
}

function renderGame() {
  if (!cur || !cur.order) return;
  if (localMode && curtainFor) {
    $('curtain-name').textContent = cur.players[curtainFor].name;
    show('modal-curtain');
  } else hide('modal-curtain');

  const me = activePid();
  // Gegner-Leiste
  $('opponents').innerHTML = cur.order
    .filter(pid => pid !== me)
    .map(pid => {
      const p = cur.players[pid] || { name: '?' };
      const n = (cur.hands[pid] || []).length;
      const act = cur.order[cur.turn] === pid ? ' active' : '';
      const off = p.connected === false && !localMode ? ' off' : '';
      const uno = n === 1 ? '<span class="uno-badge">UNO!</span>' : '';
      const backs = Array(Math.min(n, 10)).fill('<span class="mini-back"></span>').join('');
      return `<div class="opp${act}${off}">${uno}<span class="n">${esc(p.name)}</span><span class="cards">${backs}</span></div>`;
    }).join('');

  // Tischmitte
  $('discard-wrap').innerHTML = cardHtml(cur.top);
  document.querySelector('#pile .deck-count').textContent = cur.deck.length;
  $('color-dot').style.background = { r: '#e0453a', y: '#f5b91f', g: '#3da642', b: '#2277dd' }[cur.currentColor] || '#fff';
  $('log-line').textContent = (cur.log && cur.log[cur.log.length - 1]) || '';
  $('turn-banner').textContent = cur.status === 'playing'
    ? (myTurn() ? 'Du bist dran!' : (cur.players[cur.order[cur.turn]] || {}).name + ' ist dran …')
    : '';

  // Eigene Hand
  const hand = cur.hands[me] || [];
  const turn = myTurn() && cur.status === 'playing';
  const w4ok = E.wild4Legal(hand, cur);
  $('hand').innerHTML = '';
  hand.forEach((card, i) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = cardHtml(card);
    const el = wrap.firstChild;
    let playable = turn && (!cur.drew ? E.canPlay(card, cur) : sameCard(card, cur.drew));
    if (card.v === 'wild4' && !w4ok) playable = false;
    el.classList.add(playable ? 'playable' : 'disabled');
    if (cur.drew && sameCard(card, cur.drew)) el.classList.add('drew-card');
    el.addEventListener('click', () => onCardClick(card));
    $('hand').appendChild(el);
  });

  // Buttons
  const canDraw = turn && !cur.drew;
  $('pile').classList.toggle('playable', canDraw);
  $('pile').onclick = canDraw ? () => sendAction({ t: 'draw' }) : null;
  const canPass = turn && !!cur.drew;
  $('btn-pass').classList.toggle('hidden', !canPass);
  $('btn-uno').classList.toggle('hidden', !(turn || hand.length <= 2));
}

function sameCard(a, b) { return a && b && a.c === b.c && a.v === b.v; }

function onCardClick(card) {
  if (!myTurn() || cur.status !== 'playing') return;
  if (cur.drew && !sameCard(card, cur.drew)) return toast('Nur die gezogene Karte — oder weitergeben');
  if (!E.canPlay(card, cur)) return toast('Diese Karte passt nicht');
  if (card.v === 'wild4' && !E.wild4Legal(cur.hands[activePid()], cur)) {
    return toast('+4 darfst du nur spielen, wenn du keine Karte der Farbe ' + E.COLOR_NAMES[cur.currentColor] + ' hast');
  }
  if (card.c === 'w') { pendingWild = card; show('modal-color'); return; }
  sendAction({ t: 'play', card });
}

function renderEnd() {
  const w = cur.winner;
  const name = w === myPid || (localMode && w === activePid()) ? 'Du hast' : esc((cur.players[w] || {}).name || '?') + ' hat';
  $('end-title').textContent = '🏆 ' + name + ' gewonnen!';
  show('modal-end');
  $('btn-again').classList.toggle('hidden', !isHost && !localMode);
}

// ---------- Aktionen / Buttons ----------
async function leaveRoom(silent) {
  joined = false;
  if (roomRef && myPid) {
    try { await fb.update(fb.child(roomRef, 'players/' + myPid), { connected: false }); } catch (e) {}
    fb.off(roomRef);
    fb.off(fb.child(roomRef, 'actions'));
    fb.off(fb.child(roomRef, 'feedback/' + myPid));
  }
  roomRef = null; cur = null; roomCode = null; isHost = false;
  actionQueue = [];
  history.replaceState(null, '', location.pathname);
  showScreen('screen-start');
}

function initLocalNames() {
  const box = $('local-names');
  box.innerHTML = '';
  for (let i = 0; i < 2; i++) {
    const inp = document.createElement('input');
    inp.placeholder = 'Spieler ' + (i + 1);
    inp.maxLength = 16;
    inp.value = i === 0 ? (localStorage.getItem('uno-name') || '') : '';
    box.appendChild(inp);
  }
}

function startLocal() {
  const names = [...$('local-names').querySelectorAll('input')]
    .map(i => i.value.trim()).filter(Boolean);
  if (names.length < 2) return err('Mindestens 2 Namen eintragen');
  localMode = true;
  cur = { status: 'lobby', players: {}, order: [], log: [] };
  names.forEach((n, i) => {
    const pid = 'l' + i;
    cur.players[pid] = { name: n, connected: true };
    cur.order.push(pid);
  });
  E.deal(cur);
  curtainFor = cur.order[0];
  showScreen('screen-game');
  renderGame();
}

// ---------- Init ----------
function init() {
  $('input-name').value = localStorage.getItem('uno-name') || '';
  const params = new URLSearchParams(location.search);
  const pre = params.get('room');
  if (pre) $('input-code').value = pre.toUpperCase();

  if (!fbEnabled) {
    hide('online-block');
    show('local-block');
    initLocalNames();
  }

  $('btn-add-local').onclick = () => {
    const box = $('local-names');
    if (box.children.length >= 8) return;
    const inp = document.createElement('input');
    inp.placeholder = 'Spieler ' + (box.children.length + 1);
    inp.maxLength = 16;
    box.appendChild(inp);
  };
  $('btn-local').onclick = startLocal;

  const saveName = () => {
    myName = $('input-name').value.trim() || 'Spieler';
    localStorage.setItem('uno-name', myName);
  };
  $('btn-create').onclick = () => { saveName(); err(''); createRoom(); };
  $('btn-join').onclick = () => { saveName(); err(''); joinRoom($('input-code').value); };
  $('input-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join').click(); });

  $('btn-copy').onclick = () => {
    const url = location.origin + location.pathname + '?room=' + roomCode;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(() => toast('Link kopiert — schick ihn deinen Mitspielern'))
      .catch(() => toast(url, 6000));
  };
  $('btn-start-game').onclick = hostStartGame;
  $('btn-leave-lobby').onclick = () => leaveRoom();
  $('btn-leave-game').onclick = () => { if (localMode) { showScreen('screen-start'); } else leaveRoom(); };
  $('btn-end-leave').onclick = () => {
    hide('modal-end');
    if (localMode) { localMode = false; showScreen('screen-start'); }
    else { showScreen('screen-lobby'); renderLobby(); }
  };

  $('btn-uno').onclick = () => {
    sendAction({ t: 'uno' });
    toast('UNO!');
  };
  $('btn-pass').onclick = () => sendAction({ t: 'pass' });

  document.querySelectorAll('#modal-color button').forEach(b => {
    b.onclick = () => {
      hide('modal-color');
      if (pendingWild) sendAction({ t: 'play', card: pendingWild, color: b.dataset.color });
      pendingWild = null;
    };
  });
  $('btn-reveal').onclick = () => { curtainFor = null; renderGame(); };

  $('btn-again').onclick = async () => {
    hide('modal-end');
    if (localMode) {
      E.deal(cur);
      curtainFor = cur.order[0];
      renderGame();
      return;
    }
    if (isHost && cur) {
      cur.order = Object.keys(cur.players)
        .filter(pid => cur.players[pid].connected !== false)
        .sort((x, y) => (cur.players[x].joinedAt || 0) - (cur.players[y].joinedAt || 0));
      E.deal(cur);
      await fb.set(roomRef, cur);
    }
  };
}
init();
