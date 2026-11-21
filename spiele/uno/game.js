'use strict';
/* global UnoEngine, UNO_FIREBASE_CONFIG */
const E = UnoEngine;
const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const SYMBOLS = { skip: '⊘', rev: '⇄', d2: '+2', wild: '★', wild4: '+4' };
const EFFECTS = { skip: 'Aussetzen', rev: 'Richtungswechsel', d2: '+2 Karten', wild: 'Farbwechsel', wild4: '+4 Karten' };
const FB_VERSION = '10.14.1';

let db = null, fb = null;
let roomRef = null;
let myPid = null, myName = '';
let roomCode = null, isHost = false, joined = false;
let cur = null;
let localMode = false;
let soloMode = false;
let botTimer, endTimer, effectTimer, actionTimer, curtainTimer, interactionTimer;
let curtainFor = null;
let pendingWild = null;
let selectedCard = null, lastMove = null, lastHand = null, lastDiscard = null, waiting = false;
let viewedSeat = null;
let actionQueue = [], draining = false;
const queuedActions = new Set();
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
    const becameHost = !isHost && cur.hostId === myPid;
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
    if (becameHost) Object.entries(cur.actions || {}).forEach(([key, action]) => queueAction(key, action));
  });
  fb.onChildAdded(fb.child(roomRef, 'actions'), snap => {
    if (isHost) queueAction(snap.key, snap.val());
  });
  fb.onChildAdded(fb.child(roomRef, 'feedback/' + myPid), snap => {
    unlockAction();
    renderGame();
    toast(snap.val());
    fb.remove(snap.ref);
  });
}

function queueAction(key, action) {
  if (queuedActions.has(key)) return;
  queuedActions.add(key);
  actionQueue.push({ key, action, ref: roomRef, host: myPid });
  drainActions();
}

async function drainActions() {
  if (draining) return;
  draining = true;
  try {
    while (actionQueue.length) {
      const { key, action, ref, host } = actionQueue.shift();
      let err;
      let result;
      try {
        if (ref !== roomRef || !isHost) continue;
        result = await fb.runTransaction(ref, state => {
          err = null;
          if (state?.hostId !== host || !state.actions?.[key]) return;
          if (action.revision == null) {
            err = 'Bitte lade das Spiel neu';
            return;
          }
          const applied = E.applyAction(state, action.pid, action);
          if (!applied.ok) { err = applied.err; return; }
          delete state.actions[key];
          return state;
        }, { applyLocally: false });
        if (!result.committed && err) {
          await fb.push(fb.child(ref, 'feedback/' + action.pid), err);
          await fb.remove(fb.child(ref, 'actions/' + key));
        }
      } catch (_) {
        // Nicht quittierte Aktionen bleiben beim Raum.
      } finally { queuedActions.delete(key); }
    }
  } finally { draining = false; }
}

function sendAction(a, revision = cur && E.revision(cur)) {
  if (!myTurn() || cur.status !== 'playing' || waiting || interactionTimer || curtainFor || revision !== E.revision(cur)) return;
  a = { ...a, revision };
  if (localMode) {
    applyLocal(a);
    return;
  }
  waiting = true;
  renderGame();
  actionTimer = setTimeout(() => {
    unlockAction();
    renderGame();
    toast('Der Raum antwortet nicht. Prüfe deine Verbindung.');
  }, 8000);
  fb.push(fb.child(roomRef, 'actions'), Object.assign({ pid: myPid }, a)).catch(() => {
    if (!waiting) return;
    unlockAction();
    renderGame();
    toast('Zug konnte nicht gesendet werden.');
  });
}

function unlockAction() {
  clearTimeout(actionTimer);
  waiting = false;
}

function applyLocal(action) {
  const pid = cur.order[cur.turn];
  const r = E.applyAction(cur, pid, action);
  if (!r.ok) return toast(r.err);
  if (!soloMode && cur.status === 'playing' && cur.order[cur.turn] !== pid) curtainFor = cur.order[cur.turn];
  renderGame();
  scheduleBot();
}

function scheduleBot() {
  clearTimeout(botTimer);
  if (!soloMode || cur.status !== 'playing' || myTurn()) return;
  botTimer = setTimeout(() => applyLocal(E.botAction(cur, cur.order[cur.turn])), 780);
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
function activePid() { return localMode && !soloMode ? cur.order[cur.turn] : myPid; }
function myTurn() { return cur && cur.order[cur.turn] === activePid(); }

function cardHtml(card, button = false, attrs = '') {
  const symbol = SYMBOLS[card.v] || card.v;
  const tag = button ? 'button' : 'span';
  const label = esc(E.label(card));
  return `<${tag} class="card ${card.c}" ${button ? 'type="button"' : 'role="img"'} aria-label="${label}" ${attrs}>
    <span class="corner tl" aria-hidden="true">${symbol}</span>
    <span class="card-oval" aria-hidden="true"><span>${symbol}</span></span>
    <span class="corner br" aria-hidden="true">${symbol}</span></${tag}>`;
}

function renderGame() {
  if (!cur || !cur.order) return;
  const me = activePid();
  const current = cur.order[cur.turn];
  const move = cur.move;
  const key = move ? `${cur.round}:${move.n}` : null;
  const newMove = key !== null && key !== lastMove;
  const animate = newMove && lastHand !== null;
  const source = animate && move.t === 'play'
    ? (selectedCard && move.pid === viewedSeat ? selectedCard.rect : seatRect(move.pid, viewedSeat)) : null;
  const drawDest = animate && curtainFor && move.t === 'draw' ? seatRect(move.pid, viewedSeat) : null;
  viewedSeat = me;
  if (newMove) {
    lastMove = key;
    selectedCard = null;
    unlockAction();
    if (pendingWild) {
      pendingWild = null;
      hideDialog('modal-color');
    }
    if (move.pid === me && current === me) {
      clearTimeout(interactionTimer);
      interactionTimer = setTimeout(() => {
        interactionTimer = null;
        renderGame();
      }, 260);
    }
  }

  $('mode-label').textContent = soloMode ? 'Gegen Bots' : localMode ? 'Am selben Gerät' : 'Raum ' + roomCode;
  $('opponents').innerHTML = cur.order
    .filter(pid => pid !== me)
    .map(pid => {
      const p = cur.players[pid] || { name: '?' };
      const n = (cur.hands[pid] || []).length;
      const act = current === pid && cur.status === 'playing' ? ' active' : '';
      const off = p.connected === false && !localMode ? ' off' : '';
      const uno = n === 1 ? '<span class="uno-badge">UNO!</span>' : '';
      const backs = '<span class="mini-back"></span>'.repeat(Math.min(n, 5));
      return `<div class="opp${act}${off}" aria-label="${esc(p.name)}, ${n} Karten${act ? ', am Zug' : ''}"><div class="opp-name"><span class="seat-dot"></span><strong>${esc(p.name)}</strong></div>
        <div class="seat-cards"><span class="cards" aria-hidden="true">${backs}</span><span>${n}</span></div>${uno}</div>`;
    }).join('');

  const discard = cur.discard.slice(-3);
  const discardKey = JSON.stringify([cur.round, discard, newMove && move.t === 'play' ? key : lastDiscard?.play]);
  if (discardKey !== lastDiscard?.key) {
    lastDiscard = { key: discardKey, play: newMove && move.t === 'play' ? key : lastDiscard?.play };
    $('discard-wrap').innerHTML = discard.map((card, i) => cardHtml(card, false,
      i === discard.length - 1 ? 'data-top' : `aria-hidden="true" data-layer="${discard.length - 1 - i}"`)).join('');
  }
  $('color-dot').dataset.color = cur.currentColor;
  $('color-name').textContent = E.COLOR_NAMES[cur.currentColor];
  $('direction').textContent = cur.dir === 1 ? '↻' : '↺';
  $('direction').setAttribute('aria-label', cur.dir === 1 ? 'Im Uhrzeigersinn' : 'Gegen den Uhrzeigersinn');
  $('direction').title = $('direction').getAttribute('aria-label');
  $('log-line').textContent = (cur.log && cur.log[cur.log.length - 1]) || '';
  const hand = cur.hands[me] || [];
  const turn = myTurn() && cur.status === 'playing' && !curtainFor;
  const deckCount = (cur.deck || []).length;
  const canPass = turn && !!cur.drew;
  const drawAllowed = E.canDraw(hand, cur);
  const blocked = waiting || !!interactionTimer;
  $('turn-banner').classList.toggle('your-turn', turn);
  const title = cur.status === 'finished' ? 'Runde beendet' : turn ? 'Du bist dran!' : cur.players[current].name + ' ist dran';
  let help = '';
  if (turn) {
    if (waiting) help = 'Zug wird gesendet …';
    else if (canPass) help = 'Nur die neue Karte legen oder passen.';
    else if (drawAllowed) help = 'Keine passende Karte – tippe auf den Ziehstapel.';
    else help = 'Lege eine markierte Karte. Ziehen geht nur ohne passende Karte.';
  }
  const banner = `<strong>${esc(title)}</strong>${help ? `<span>${help}</span>` : ''}`;
  if ($('turn-banner').innerHTML !== banner) $('turn-banner').innerHTML = banner;
  $('draw-caption').textContent = deckCount ? `Ziehen · ${deckCount}` : cur.discard.length > 1 ? 'Stapel neu mischen' : 'Stapel leer';
  $('pile').disabled = !turn || blocked || !drawAllowed;
  $('pile').classList.toggle('unavailable', !turn || !drawAllowed);
  $('pile').setAttribute('aria-label', deckCount ? `Karte ziehen, ${deckCount} im Stapel` : $('draw-caption').textContent);
  $('pile').parentElement.dataset.depth = Math.min(deckCount, 3);
  $('btn-pass').classList.toggle('hidden', !canPass);
  $('btn-pass').disabled = blocked;
  $('hand-label').textContent = localMode && !soloMode ? cur.players[me].name + 's Hand' : 'Deine Hand';
  $('hand-count').textContent = curtainFor ? '' : `${hand.length} ${hand.length === 1 ? 'Karte · UNO!' : 'Karten'}`;

  const handEl = $('hand');
  const handKey = JSON.stringify([me, hand, turn, canPass, blocked, cur.currentColor, cur.top.v, curtainFor]);
  if (lastHand !== handKey) {
    lastHand = handKey;
    const scroll = handEl.scrollLeft;
    const drawnIdx = turn && cur.drew ? hand.length - 1 : -1;
    const focus = handEl.contains(document.activeElement) ? +document.activeElement.dataset.index : -1;
    handEl.classList.toggle('can-play', turn);
    handEl.classList.toggle('many', hand.length > 7);
    handEl.innerHTML = curtainFor ? '' : hand.map((card, i) => {
      const playable = turn && E.canPlayFromHand(card, hand, cur);
      const arc = Math.max(-3, Math.min(3, i - (hand.length - 1) / 2));
      return cardHtml(card, true, `data-index="${i}" data-playable="${playable}" data-drawn="${i === drawnIdx}" style="--tilt:${arc * 1.9}deg;--down:${arc ** 2 * .8}px" ${!playable || blocked ? 'disabled' : ''}`);
    }).join('');
    handEl.scrollLeft = scroll;
    if (animate && move.pid === me && move.t === 'draw') handEl.scrollLeft = handEl.scrollWidth;
    if (focus >= 0) {
      const button = handEl.children[focus];
      if (button && !button.disabled) button.focus({ preventScroll: true });
      else if (!$('pile').disabled) $('pile').focus({ preventScroll: true });
    }
  }

  if (curtainFor) {
    $('curtain-name').textContent = cur.players[curtainFor].name;
    if (animate && !reducedMotion() && move.t !== 'pass') {
      curtainTimer = setTimeout(() => {
        curtainTimer = null;
        showDialog('modal-curtain', 'btn-reveal');
      }, move.uno ? 800 : move.count ? 650 : 430);
    } else if (!curtainTimer) showDialog('modal-curtain', 'btn-reveal');
  } else hideDialog('modal-curtain');
  if (animate) animateMove(move, me, source, drawDest);
  if (cur.status === 'finished' && !endTimer && $('modal-end').classList.contains('hidden')) {
    endTimer = setTimeout(() => { endTimer = null; renderEnd(); }, animate && !reducedMotion() ? 520 : 0);
  } else if (cur.status !== 'finished') {
    clearTimeout(endTimer);
    endTimer = null;
    hideDialog('modal-end');
  }
}

function seatRect(pid, me) {
  if (pid === me) return $('hand').getBoundingClientRect();
  return $('opponents').children[cur.order.filter(p => p !== me).indexOf(pid)]?.getBoundingClientRect();
}

function reducedMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }

function flyCard(card, from, to, delay = 0) {
  if (!from || !to || !from.width || !to.width || reducedMotion()) return;
  const tile = document.createElement('div');
  tile.className = 'flying-card';
  tile.setAttribute('aria-hidden', 'true');
  tile.innerHTML = card ? cardHtml(card) : '<span class="card back"><span class="back-mark">UNO</span></span>';
  document.body.appendChild(tile);
  const position = (rect, scale, angle) => `translate(${rect.x + rect.width / 2}px, ${rect.y + rect.height / 2}px) translate(-50%, -50%) scale(${scale}) rotate(${angle}deg)`;
  tile.animate([
    { transform: position(from, .75, -18), opacity: 0 },
    { opacity: 1, offset: .16 },
    { transform: position(to, 1, 0), opacity: 1 },
  ], { duration: 390, delay, easing: 'cubic-bezier(.2,.7,.25,1)' }).finished.then(() => tile.remove());
}

function animateMove(move, me, source, drawDest) {
  clearTimeout(effectTimer);
  hide('move-effect');
  const pile = $('pile').getBoundingClientRect();
  const played = move.t === 'play';
  if (played) {
    const top = document.querySelector('[data-top]');
    flyCard(move.card, source, top.getBoundingClientRect());
    if (source && !reducedMotion()) top.classList.add('arriving');
  }
  const target = move.t === 'draw' ? move.pid : move.target;
  const count = move.t === 'draw' ? 1 : move.count || 0;
  if (count) {
    const handCard = $('hand').lastElementChild;
    const dest = drawDest || (target === me && handCard ? handCard.getBoundingClientRect() : seatRect(target, me));
    for (let i = 0; i < count; i++) flyCard(null, pile, dest, (played ? 170 : 0) + i * 65);
  }
  const effect = played && EFFECTS[move.card.v];
  if (effect || move.uno) {
    const text = [move.uno ? (move.pid === me ? 'UNO!' : cur.players[move.pid].name + ': UNO!') : '', effect].filter(Boolean);
    $('move-effect').textContent = text.join(' · ');
    show('move-effect');
    effectTimer = setTimeout(() => hide('move-effect'), 1250);
  }
}

function onCardClick(button) {
  if (button.disabled || !myTurn() || cur.status !== 'playing') return;
  const index = +button.dataset.index;
  const card = cur.hands[activePid()][index];
  selectedCard = { rect: button.getBoundingClientRect(), index };
  if (card.c === 'w') {
    pendingWild = { card, revision: E.revision(cur) };
    showDialog('modal-color', 'modal-color');
    return;
  }
  sendAction({ t: 'play', card });
}

function showDialog(id, focusId) {
  if (!$(id).classList.contains('hidden')) return;
  show(id);
  $('screen-game').inert = true;
  const el = $(focusId);
  (el.closest('button') || el.querySelector('button:not(.hidden)')).focus();
}

function hideDialog(id) {
  if ($(id).classList.contains('hidden')) return;
  hide(id);
  $('screen-game').inert = !!document.querySelector('.overlay:not(.hidden)');
}

function renderEnd() {
  if (cur?.status !== 'finished') return;
  const w = cur.winner;
  const name = (!localMode || soloMode) && w === myPid ? 'Du hast' : (cur.players[w] || {}).name + ' hat';
  $('end-title').textContent = name + ' gewonnen!';
  $('btn-again').classList.toggle('hidden', !isHost && !localMode);
  showDialog('modal-end', 'modal-end');
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
  queuedActions.clear();
  resetPresentation();
  history.replaceState(null, '', location.pathname);
  showScreen('screen-start');
}

function initLocalNames() {
  const box = $('local-names');
  box.innerHTML = '';
  for (let i = 0; i < 2; i++) {
    const inp = document.createElement('input');
    inp.placeholder = 'Spieler ' + (i + 1);
    inp.setAttribute('aria-label', inp.placeholder);
    inp.maxLength = 16;
    inp.value = i === 0 ? (localStorage.getItem('uno-name') || '') : '';
    box.appendChild(inp);
  }
}

function startLocal() {
  const names = [...$('local-names').querySelectorAll('input')]
    .map(i => i.value.trim()).filter(Boolean);
  if (names.length < 2) return err('Mindestens 2 Namen eintragen');
  startOffline(names, false);
}

function startOffline(names, solo) {
  err('');
  resetPresentation();
  localMode = true;
  soloMode = solo;
  myPid = solo ? 'l0' : null;
  cur = { players: {}, order: [] };
  names.forEach((n, i) => {
    const pid = 'l' + i;
    cur.players[pid] = { name: n, connected: true };
    cur.order.push(pid);
  });
  resetOfflineRound();
}

function resetOfflineRound() {
  E.deal(cur);
  curtainFor = soloMode ? null : cur.order[0];
  showScreen('screen-game');
  renderGame();
}

function resetPresentation() {
  [botTimer, endTimer, effectTimer, curtainTimer, interactionTimer].forEach(clearTimeout);
  endTimer = curtainTimer = interactionTimer = null;
  unlockAction();
  lastMove = lastHand = lastDiscard = viewedSeat = curtainFor = pendingWild = selectedCard = null;
  ['modal-color', 'modal-curtain', 'modal-end'].forEach(hideDialog);
  hide('move-effect');
  document.querySelectorAll('.flying-card').forEach(tile => tile.remove());
}

function leaveOffline() {
  resetPresentation();
  localMode = soloMode = false;
  cur = null;
  showScreen('screen-start');
}

// ---------- Init ----------
function init() {
  $('input-name').value = localStorage.getItem('uno-name') || '';
  const params = new URLSearchParams(location.search);
  const pre = params.get('room');
  if (pre) $('input-code').value = pre.toUpperCase();

  if (!fbEnabled) hide('online-block');
  initLocalNames();

  $('btn-add-local').onclick = () => {
    const box = $('local-names');
    if (box.children.length >= 8) return;
    const inp = document.createElement('input');
    inp.placeholder = 'Spieler ' + (box.children.length + 1);
    inp.setAttribute('aria-label', inp.placeholder);
    inp.maxLength = 16;
    box.appendChild(inp);
  };
  $('btn-local').onclick = startLocal;

  const saveName = () => {
    myName = $('input-name').value.trim() || 'Spieler';
    localStorage.setItem('uno-name', myName);
  };
  $('btn-bots').onclick = () => {
    saveName();
    startOffline([myName, 'Bot Mika', 'Bot Karo'], true);
  };
  const online = async action => {
    saveName();
    err('');
    $('screen-start').inert = true;
    try { await action(); }
    catch (_) { err('Keine Verbindung zum Online-Spiel. Bitte versuche es erneut.'); }
    finally { $('screen-start').inert = false; }
  };
  $('btn-create').onclick = () => online(createRoom);
  $('btn-join').onclick = () => online(() => joinRoom($('input-code').value));
  $('input-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join').click(); });

  $('btn-copy').onclick = () => {
    const url = location.origin + location.pathname + '?room=' + roomCode;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(() => toast('Link kopiert — schick ihn deinen Mitspielern'))
      .catch(() => toast(url, 6000));
  };
  $('btn-start-game').onclick = hostStartGame;
  $('btn-leave-lobby').onclick = () => leaveRoom();
  $('btn-leave-game').onclick = () => { if (localMode) leaveOffline(); else leaveRoom(); };
  $('btn-end-leave').onclick = () => {
    hideDialog('modal-end');
    if (localMode) leaveOffline();
    else { showScreen('screen-lobby'); renderLobby(); }
  };

  $('pile').onclick = () => sendAction({ t: 'draw' });
  $('btn-pass').onclick = () => sendAction({ t: 'pass' });
  $('hand').onclick = event => {
    const card = event.target.closest('button[data-index]');
    if (card) onCardClick(card);
  };

  document.querySelectorAll('#modal-color [data-color]').forEach(b => {
    b.onclick = () => {
      hideDialog('modal-color');
      if (pendingWild) sendAction({ t: 'play', card: pendingWild.card, color: b.dataset.color }, pendingWild.revision);
      pendingWild = null;
    };
  });
  const cancelColor = () => {
    hideDialog('modal-color');
    pendingWild = null;
    if (selectedCard) $('hand').children[selectedCard.index]?.focus();
    selectedCard = null;
  };
  $('btn-color-cancel').onclick = cancelColor;
  $('modal-color').addEventListener('keydown', e => { if (e.key === 'Escape') cancelColor(); });
  $('btn-reveal').onclick = () => { curtainFor = null; renderGame(); };

  $('btn-again').onclick = async () => {
    hideDialog('modal-end');
    if (localMode) {
      resetPresentation();
      resetOfflineRound();
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
