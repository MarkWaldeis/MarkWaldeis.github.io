'use strict';
/* global Mono, MonoBoard */
const E = Mono;
const $ = id => document.getElementById(id);
const show = id => {
  const el = $(id);
  if (el instanceof HTMLDialogElement) {
    if (!el.open) el.showModal();
  } else el.classList.remove('hidden');
};
const hide = id => {
  const el = $(id);
  if (el instanceof HTMLDialogElement) el.close();
  else el.classList.add('hidden');
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const FB_VERSION = '10.14.1';
const TOKENS = ['🚗', '🎩', '🐕', '🚢', '👢', '🧺'];
const TOKEN_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#27ae60', '#9b59b6', '#e67e22'];
let db = null, fb = null;
let roomRef = null;
let myPid = null, myName = '';
let roomCode = null, isHost = false, local = false;
let cur = null;
let disconnect = null;
let subscriptions = [];
let connected = false, draining = false, pendingAction = null;
let lastCardSeq = 0;
let round = null;
let isAnimating = false;
let afterRoll = 0;
let lastFxSeq = 0;
let pendingCardTimer = null;
let dismissedTradeKey = null;
const visuals = MonoBoard.create(E, TOKENS, TOKEN_COLORS, onSpaceClick);

function toast(msg, ms = 3000) {
  const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
  let t = $('toast');
  if (dialog) {
    t = dialog.querySelector('.dialog-feedback');
    if (!t) {
      t = document.createElement('p');
      t.className = 'dialog-feedback';
      t.setAttribute('role', 'status');
      dialog.firstElementChild.append(t);
    }
  }
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add('hidden'), ms);
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  show(id);
}
function err(msg) { $('start-error').textContent = msg; }
function fmt(n) { return n + ' €'; }

// ---------- Firebase ----------
async function ensureFb() {
  if (db) return true;
  if (!window.MONO_FIREBASE_CONFIG) { err('Firebase ist nicht konfiguriert'); return false; }
  const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
  const appMod = await import(base + 'firebase-app.js');
  fb = await import(base + 'firebase-database.js');
  db = fb.getDatabase(appMod.initializeApp(window.MONO_FIREBASE_CONFIG));
  return true;
}

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

async function createRoom() {
  if (!(await ensureFb())) return;
  myPid = 'p' + Math.random().toString(36).slice(2, 10);
  for (let i = 0; i < 10; i++) {
    const code = newCode();
    const ref = fb.ref(db, 'mrooms/' + code);
    const player = { name: myName, connected: true, joinedAt: Date.now() };
    const result = await fb.runTransaction(ref, current => current === null ? {
      code, status: 'lobby', hostId: myPid, createdAt: Date.now(),
      players: { [myPid]: player }
    } : undefined, { applyLocally: false });
    if (result.committed) {
      roomCode = code;
      roomRef = ref;
      sessionStorage.setItem('mono-pid-' + code, myPid);
      afterJoin();
      return;
    }
  }
  err('Kein freier Raum — nochmal versuchen');
}

async function joinRoom(code) {
  if (!(await ensureFb())) return;
  code = (code || '').toUpperCase().trim();
  if (!/^[A-Z0-9]{4}$/.test(code)) return err('Der Einladungscode besteht aus vier Zeichen.');
  const ref = fb.ref(db, 'mrooms/' + code);
  // Ein aktiver Listener hält den Raum im SDK-Cache, bis die Transaktion läuft.
  let stopWatching;
  try {
    const snapshot = await new Promise((resolve, reject) => { stopWatching = fb.onValue(ref, resolve, reject); });
    if (!snapshot.exists()) return err('Raum nicht gefunden.');
    myPid = sessionStorage.getItem('mono-pid-' + code) || 'p' + Math.random().toString(36).slice(2, 10);
    const result = await fb.runTransaction(ref, room => {
      if (!room) return;
      room.players ||= {};
      const existing = room.players[myPid];
      if (!existing && (room.status !== 'lobby' || Object.keys(room.players).length >= 6)) return;
      room.players[myPid] = { name: myName, connected: true, joinedAt: existing?.joinedAt || Date.now() };
      return room;
    }, { applyLocally: false });
    if (!result.committed) return err(result.snapshot.val()?.status === 'lobby' ?
      'Der Raum ist voll (maximal 6 Spieler).' : 'Der Raum ist geschlossen oder das Spiel läuft bereits.');
    roomCode = code;
    roomRef = ref;
    sessionStorage.setItem('mono-pid-' + code, myPid);
    afterJoin();
  } finally { stopWatching?.(); }
}

function afterJoin() {
  history.replaceState(null, '', '?room=' + roomCode);
  subscribeRoom();
}

function subscribeRoom() {
  const ref = roomRef;
  const presence = fb.child(ref, 'players/' + myPid + '/connected');
  let connectedBefore = false;
  subscriptions.push(fb.onValue(fb.ref(db, '.info/connected'), async snap => {
    connected = snap.val() === true;
    if (cur?.status === 'playing') renderTurn();
    if (!connected) return;
    const reconnecting = connectedBefore;
    connectedBefore = true;
    try {
      disconnect = fb.onDisconnect(presence);
      await disconnect.set(false);
      if (reconnecting && roomRef === ref) await fb.set(presence, true);
    } catch {
      if (roomRef === ref) toast('Verbindung zum Spielraum unterbrochen.');
    }
  }));
  subscriptions.push(fb.onValue(ref, snap => {
    cur = snap.val();
    if (!cur) { toast('Der Raum wurde geschlossen'); leaveRoom(true); return; }
    isHost = cur.hostId === myPid;
    if (pendingAction && !cur.actions?.[pendingAction]) pendingAction = null;
    const host = cur.players && cur.players[cur.hostId];
    if (host?.connected === false && cur.players?.[myPid]?.connected) {
      fb.runTransaction(ref, room => {
        if (room?.players?.[room.hostId]?.connected !== false || !room.players?.[myPid]?.connected) return;
        room.hostId = myPid;
        return room;
      }, { applyLocally: false }).catch(() => {});
    }
    if (cur.status === 'lobby') { showScreen('screen-lobby'); renderLobby(); }
    else { showScreen('screen-game'); renderGame(); }
    if (isHost && cur.actions) drainActions();
  }));
  subscriptions.push(fb.onChildAdded(fb.child(ref, 'feedback/' + myPid), snap => {
    toast(snap.val());
  }));
}

async function drainActions() {
  if (draining) return;
  const ref = roomRef;
  const host = myPid;
  draining = true;
  try {
    while (roomRef === ref && isHost && cur?.actions) {
      const key = Object.keys(cur.actions).sort()[0];
      if (!key) break;
      const result = await fb.runTransaction(ref, room => {
        const action = room?.actions?.[key];
        if (!action || room.hostId !== host) return;
        delete room.actions[key];
        if (!room.players?.[action.pid]) return room;
        const state = structuredClone(room);
        const result = applyAction(state, action.pid, action);
        if (result.ok) return state;
        room.feedback ||= {};
        room.feedback[action.pid] = { [key]: result.err };
        return room;
      }, { applyLocally: false });
      if (!result.committed || cur?.actions?.[key]) break;
    }
  } catch {
    if (roomRef === ref) toast('Der Zug konnte nicht verarbeitet werden.');
  } finally { draining = false; }
}

function applyAction(state, pid, action) {
  try { return E.applyAction(state, pid, action); }
  catch { return { ok: false, err: 'Diese Aktion konnte nicht ausgeführt werden.' }; }
}

function sendAction(a) {
  if (isAnimating || pendingAction) return;
  if (local) {
    const next = structuredClone(cur);
    const result = applyAction(next, myPid, a);
    if (!result.ok) return toast(result.err);
    cur = next;
    renderGame();
    return;
  }
  if (!connected || !roomRef) return toast('Warte auf die Verbindung zum Spielraum.');
  const ref = fb.push(fb.child(roomRef, 'actions'));
  pendingAction = ref.key;
  renderTurn();
  fb.set(ref, { ...a, pid: myPid }).catch(() => {
    if (pendingAction !== ref.key) return;
    pendingAction = null;
    renderGame();
    toast('Der Zug konnte nicht gesendet werden. Versuche es erneut.');
  });
}

// ---------- Lobby ----------
function tokenIdx(pid, fallback) {
  const t = cur && cur.players && cur.players[pid] && cur.players[pid].token;
  return Number.isInteger(t) && t >= 0 && t < TOKENS.length ? t : (fallback ?? 0);
}

function renderLobby() {
  $('lobby-code').textContent = roomCode;
  const ul = $('lobby-players');
  const players = cur && cur.players ? cur.players : {};
  const ids = Object.keys(players).sort((x, y) => (players[x].joinedAt || 0) - (players[y].joinedAt || 0));
  ul.innerHTML = ids.map((pid, i) => {
    const p = players[pid];
    const me = pid === myPid ? ' (du)' : '';
    const crown = pid === cur.hostId ? ' <span class="crown">👑</span>' : '';
    const token = TOKENS[tokenIdx(pid, i)];
    return `<li><span class="dot${p.connected === false ? ' off' : ''}"></span><span class="ptoken">${token}</span>${esc(p.name)}${me}${crown}</li>`;
  }).join('');
  // Figuren-Auswahl (nur im Warteraum)
  const taken = new Set(ids.map(pid => players[pid].token).filter(t => Number.isInteger(t)));
  const mine = players[myPid] ? tokenIdx(myPid, ids.indexOf(myPid)) : -1;
  $('token-pick').innerHTML = players[myPid]
    ? '<div class="token-pick-label">Deine Figur:</div>' + TOKENS.map((t, i) =>
        `<button type="button" class="tok-opt${i === mine ? ' sel' : ''}" data-tok="${i}" ${taken.has(i) && i !== mine ? 'disabled' : ''}>${t}</button>`).join('')
    : '';
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
  const phase = cur.status;
  const button = $(phase === 'lobby' ? 'btn-start-game' : 'btn-again');
  button.disabled = true;
  try {
    const result = await fb.runTransaction(roomRef, room => {
      if (room?.hostId !== myPid || room.status !== phase) return;
      const ids = connectedPlayers(room);
      if (ids.length < 2) return;
      room.order = ids;
      room.actions = null;
      room.feedback = null;
      return E.deal(room);
    }, { applyLocally: false });
    if (!result.committed) toast('Zum Start müssen mindestens zwei Personen verbunden sein.');
  } catch {
    toast('Der Spielstart ist fehlgeschlagen. Versuche es erneut.');
  } finally { button.disabled = false; }
}

function connectedPlayers(room) {
  return Object.keys(room.players || {}).filter(pid => room.players[pid].connected !== false)
    .sort((x, y) => room.players[x].joinedAt - room.players[y].joinedAt);
}

// ---------- Brett ----------

function spaceDesc(i) {
  const s = E.S[i];
  if (s.t === 'prop') {
    const labels = ['Miete', '1 Haus', '2 Häuser', '3 Häuser', '4 Häuser', 'Hotel'];
    const rents = s.rent.map((r, k) => labels[k] + ': ' + r + ' €').join(' / ');
    return `${s.name} — ${s.price} €\n${rents}\nHaus kostet ${s.house} €`;
  }
  if (s.t === 'bahn') return `${s.name} — 200 €\nMiete: 25/50/100/200 € je nach Anzahl Bahnhöfe`;
  if (s.t === 'werk') return `${s.name} — 150 €\nMiete: 4× bzw. 10× Wurf`;
  if (s.t === 'tax') return `${s.name}: ${s.amount} € an die Bank`;
  return s.name;
}

function onSpaceClick(i) {
  const s = E.S[i];
  if (!s) return;
  if (s.t === 'prop' || s.t === 'bahn' || s.t === 'werk') { showDeed(i); return; }
  toast(spaceDesc(i), 3500);
}

function showDeed(i) {
  const s = E.S[i];
  const p = cur && cur.props && cur.props[i];
  const col = s.group ? E.GROUP_CSS[s.group] : (s.t === 'bahn' ? '#333' : '#4a90c2');
  $('deed-card').querySelector('.deed-head').style.background = col;
  $('deed-card').querySelector('.deed-name').textContent = s.name;
  let body = '';
  if (s.t === 'prop') {
    body += `<div class="deed-row center"><b>MIETE ${s.rent[0]} €</b></div>`;
    body += ['1 Haus', '2 Häuser', '3 Häuser', '4 Häuser'].map((l, k) =>
      `<div class="deed-row"><span>Mit ${l}</span><span>${s.rent[k + 1]} €</span></div>`).join('');
    body += `<div class="deed-row"><span>Mit HOTEL</span><span>${s.rent[5]} €</span></div>`;
    body += `<div class="deed-row muted">Häuser kosten je ${s.house} €</div>`;
  } else if (s.t === 'bahn') {
    body += '<div class="deed-row center"><b>MIETE</b></div>';
    body += [['1 Bahnhof', 25], ['2 Bahnhöfe', 50], ['3 Bahnhöfe', 100], ['4 Bahnhöfe', 200]]
      .map(([l, v]) => `<div class="deed-row"><span>${l}</span><span>${v} €</span></div>`).join('');
  } else {
    body += `<div class="deed-row muted">Hat ein Spieler beide Versorgungswerke, zahlt der Mieter das 10-fache der gewürfelten Augenzahl; besitzt er nur eins, das 4-fache.</div>`;
  }
  body += `<div class="deed-row muted">Hypothekswert ${Math.floor(s.price / 2)} €</div>`;
  if (p && p.owner) body += `<div class="deed-row"><span>Besitzer</span><b>${esc((cur.players[p.owner] || {}).name)}${p.mortgaged ? ' (Hypothek)' : ''}</b></div>`;
  else body += `<div class="deed-row"><span>Preis</span><b>${s.price} €</b></div>`;
  $('deed-card').querySelector('.deed-body').innerHTML = body;
  show('modal-deed');
}

// ---------- Render ----------
function renderGame() {
  if (!cur?.order) return;
  // Realtime Database speichert leere Objektfelder nicht.
  for (const key of ['out', 'pos', 'money', 'props', 'jailed', 'jailCards', 'mustRaise']) cur[key] ||= {};
  if (round !== (cur.round || 0)) {
    round = cur.round || 0;
    lastCardSeq = cur.cardSeq || 0;
    lastFxSeq = cur.fxSeq || 0;
    clearTimeout(afterRoll);
    clearTimeout(pendingCardTimer);
    pendingCardTimer = null;
    isAnimating = false;
    visuals.reset();
  }

  const active = cur.order[cur.turn];
  const timing = visuals.update(cur);
  const duration = timing.duration;
  if (duration > 0) {
    isAnimating = true;
    clearTimeout(afterRoll);
    afterRoll = setTimeout(() => {
      isAnimating = false;
      if (cur?.order) renderGame();
    }, duration);
  }

  // Ereigniskarte: erst anzeigen, dann kurze Pause, dann weiterlaufen
  if (cur.cardSeq && cur.cardSeq !== lastCardSeq && cur.lastCard) {
    lastCardSeq = cur.cardSeq;
    const at = timing.cardAt != null ? timing.cardAt : duration;
    pendingCardTimer = setTimeout(() => {
      pendingCardTimer = null;
      const community = cur.lastCardType === 'community';
      $('drawn-card').classList.toggle('community', community);
      $('card-title').textContent = community ? 'Gemeinschaftskarte' : 'Ereigniskarte';
      $('drawn-card').querySelector('.dc-text').textContent = cur.lastCard;
      show('modal-card');
    }, at);
  }

  // Geldeffekte (Miete, Handel, Bankrott) nach der Laufanimation abspielen
  for (const key of Object.keys(cur.fx || {}).map(Number).filter(s => s > lastFxSeq).sort((a, b) => a - b)) {
    setTimeout(() => playFx(cur.fx[key]), Math.max(0, (duration || 0)) + 250);
  }
  lastFxSeq = cur.fxSeq || 0;

  const nextPlayer = cur.trade?.to || cur.auction?.left?.[cur.auction.idx] || active;
  const handoff = local && myPid && myPid !== nextPlayer && cur.status !== 'finished';
  if (local && !isAnimating && cur.status !== 'finished') myPid = nextPlayer;
  $('table-mode').textContent = local ? 'An einem Gerät' : 'Raum ' + roomCode;
  renderTurn();
  renderPlayers(active);

  const log = cur.log || [];
  const latest = log.slice(-20).reverse().map(message => '<li>' + esc(message) + '</li>').join('');
  if ($('log-box').innerHTML !== latest) {
    $('log-box').start = log.length;
    $('log-box').innerHTML = latest;
  }

  if ($('modal-manage').open) renderManage();
  if (isAnimating) return;

  if (cur.auction) renderAuction();
  else { hide('modal-auction'); bidAdd = 10; }
  if (cur.trade) renderTradeIn(cur.trade);
  else { hide('modal-trade-in'); dismissedTradeKey = null; }
  if (cur.status === 'finished') renderEnd();
  else hide('modal-end');

  if (handoff) {
    $('pass-to').textContent = 'Gib das Gerät an ' + cur.players[nextPlayer].name + ' weiter.';
    show('modal-pass');
  }
}

function renderTurn() {
  const active = cur.order[cur.turn];
  const myTurn = active === myPid;
  const name = cur.players[active]?.name || 'Mitspieler';
  const raising = cur.mustRaise[myPid] !== undefined;
  const funds = cur.money[myPid] || 0;
  const position = cur.pending?.space ?? cur.pos[active];
  const purchase = cur.phase === 'buy' && cur.pending && E.S[cur.pending.space];
  const playing = cur.status === 'playing';
  const busy = isAnimating || !!pendingAction || (!local && !connected);
  const buttons = ['btn-roll', 'btn-jail-pay', 'btn-jail-card', 'btn-buy', 'btn-auction', 'btn-end',
    'btn-trade', 'btn-trade-cancel', 'btn-manage', 'btn-bankrupt'];
  buttons.forEach(hide);

  let title = local ? name + ' ist am Zug' : (myTurn ? 'Du bist am Zug' : name + ' ist am Zug');
  let hint = 'Warten auf den nächsten Zug.';
  if (!playing) {
    title = 'Spiel beendet';
    hint = '';
  } else if (cur.auction) {
    title = 'Versteigerung';
    hint = E.S[cur.auction.space].name;
  } else if (cur.trade) {
    title = 'Handelsangebot';
    hint = (cur.players[cur.trade.to]?.name || 'Mitspieler') + ' entscheidet über das Angebot.';
    if (!local && cur.trade.from === myPid) show('btn-trade-cancel');
  } else if (myTurn && !raising) {
    switch (cur.phase) {
      case 'roll':
        hint = cur.doubles ? 'Pasch! Du darfst erneut würfeln.' : 'Würfle, um deine Figur zu bewegen.';
        $('btn-roll').textContent = cur.doubles ? 'Erneut würfeln' : 'Würfeln';
        show('btn-roll');
        break;
      case 'jail':
        hint = 'Versuche einen Pasch oder nutze eine der anderen Optionen.';
        $('btn-roll').textContent = 'Auf Pasch würfeln';
        show('btn-roll');
        if (funds >= 50) show('btn-jail-pay');
        if (cur.jailCards[myPid] > 0) show('btn-jail-card');
        break;
      case 'buy':
        if (!purchase) break;
        hint = funds >= purchase.price
          ? 'Kaufen, versteigern oder ohne Kauf weiterspielen.'
          : 'Dein Guthaben reicht für den Kauf nicht aus.';
        $('btn-buy').textContent = 'Für ' + fmt(purchase.price) + ' kaufen';
        $('btn-end').textContent = 'Ohne Kauf weiter';
        show('btn-buy'); show('btn-auction'); show('btn-end');
        break;
      case 'manage':
      case 'jailend':
        hint = cur.phase === 'jailend' ? 'Deine Figur bleibt im Gefängnis.' : 'Du kannst handeln, Grundstücke verwalten oder den Zug beenden.';
        $('btn-end').textContent = 'Zug beenden';
        if (E.canRollAgain(cur, myPid)) {
          hint = 'Nach einem Pasch steht dir noch ein Wurf zu.';
          $('btn-end').textContent = 'Weiter zum Zusatzwurf';
        }
        show('btn-end'); show('btn-manage'); show('btn-trade');
        break;
    }
  }
  if (playing && !cur.auction && !cur.trade && raising) {
    buttons.forEach(hide);
    title = 'Du musst Geld auftreiben';
    hint = 'Verkaufe Gebäude oder nimm eine Hypothek auf, um deine Schulden zu begleichen.';
    show('btn-manage'); show('btn-bankrupt');
  }
  if (isAnimating) hint = 'Die Figur zieht …';
  else if (!local && !connected) hint = 'Verbindung zum Spielraum wird hergestellt …';
  else if (pendingAction) hint = 'Zug wird übertragen …';

  $('turn-banner').textContent = title;
  $('turn-hint').textContent = hint;
  $('turn-money').textContent = fmt(funds);
  const field = $('current-space');
  field.dataset.space = position;
  field.textContent = E.S[position]?.name || '';
  field.classList.toggle('hidden', !E.S[position]);
  buttons.forEach(id => $(id).disabled = busy || (id === 'btn-buy' && purchase && funds < purchase.price));
}

function renderPlayers(active) {
  $('players-list').innerHTML = cur.order.map((pid, index) => {
    const player = cur.players[pid];
    const classes = ['pl-row'];
    if (pid === active) classes.push('active');
    if (cur.out[pid]) classes.push('out');
    if (player.connected === false) classes.push('off');
    const owned = Object.values(cur.props).filter(prop => prop.owner === pid).length;
    return `<div class="${classes.join(' ')}" data-pid="${pid}">
      <span class="ptoken" style="--piece-color:${TOKEN_COLORS[tokenIdx(pid, index)]}">${TOKENS[tokenIdx(pid, index)]}</span>
      <span class="pl-name">${esc(player.name)}${!local && pid === myPid ? ' (du)' : ''}${cur.jailed[pid] !== undefined ? ' · Gefängnis' : ''}</span>
      <span class="pl-money">${fmt(cur.money[pid] || 0)}</span>
      <span class="pl-props">${owned} Grundstücke</span>
    </div>`;
  }).join('');

  const mine = Object.keys(cur.props).filter(key => cur.props[key].owner === myPid).map(Number).sort((a, b) => a - b);
  $('props-count').textContent = mine.length;
  const properties = mine.map(i => {
    const space = E.S[i], prop = cur.props[i];
    const color = E.GROUP_CSS[space.group] || '#777';
    const status = prop.mortgaged ? ' · Hypothek' : (prop.houses === 5 ? ' · Hotel' : (prop.houses ? ' · ' + prop.houses + ' Haus/Häuser' : ''));
    return `<button type="button" class="my-prop" data-i="${i}">
      <span class="chip" style="background:${color}"></span>${esc(space.name)}${status}</button>`;
  }).join('') || '<p class="hint">Noch keine Grundstücke.</p>';
  if ($('my-props').innerHTML !== properties) $('my-props').innerHTML = properties;
}

function renderAuction() {
  const au = cur.auction;
  const s = E.S[au.space];
  const col = s.group ? E.GROUP_CSS[s.group] : (s.t === 'bahn' ? '#333' : '#666');
  $('auction-prop').innerHTML = `<span class="chip big" style="background:${col}"></span>${esc(s.name)}`;
  $('auction-high').innerHTML = au.bidder
    ? `Höchstgebot: <b>${au.high} €</b> von ${esc((cur.players[au.bidder] || {}).name)}`
    : 'Noch kein Gebot';
  const inAuction = au.left.includes(myPid);
  const myBidTurn = inAuction && au.left[au.idx] === myPid;
  const balance = cur.money[myPid];
  const canAct = myBidTurn && !pendingAction && (local || connected);
  const bid = au.high + bidAdd;
  $('btn-bid').textContent = 'Für ' + fmt(bid) + ' bieten';
  $('btn-bid').disabled = !canAct || bid > balance;
  $('btn-pass-auction').disabled = !canAct;
  document.querySelectorAll('.bid-amt').forEach(button => {
    const add = Number(button.dataset.add);
    button.disabled = !canAct || au.high + add > balance;
    button.setAttribute('aria-pressed', String(add === bidAdd));
  });
  $('auction-status').textContent = !inAuction
    ? 'Du bietest nicht mehr mit.'
    : (myBidTurn ? 'Du bist dran. Erhöhe das Gebot oder passe.' : 'Warte auf ' + cur.players[au.left[au.idx]].name);
  $('btn-auction-leave').classList.toggle('hidden', local);
  show('modal-auction');
}

let bidAdd = 10;
document.addEventListener('click', e => {
  if (e.target.classList && e.target.classList.contains('bid-amt')) {
    bidAdd = parseInt(e.target.dataset.add, 10);
    if (cur?.auction) renderAuction();
  }
});

// ---------- Handel ----------
function renderTradeModal() {
  const sel = $('trade-to');
  const others = cur.order.filter(pid => pid !== myPid && !cur.out[pid]);
  sel.innerHTML = others.map(pid => `<option value="${pid}">${esc((cur.players[pid] || {}).name)}</option>`).join('');
  renderTradeProps();
  sel.onchange = renderTradeProps;
  $('trade-give-money').value = 0;
  $('trade-take-money').value = 0;
  $('trade-give-card').checked = false;
  $('trade-take-card').checked = false;
  $('trade-give-card-row').style.display = (cur.jailCards && cur.jailCards[myPid] > 0) ? '' : 'none';
  show('modal-trade');
}
function renderTradeProps() {
  const to = $('trade-to').value;
  $('trade-take-card').checked = false;
  const mkList = (pid, container) => {
    const list = cur.props ? Object.keys(cur.props).filter(k => cur.props[k].owner === pid && !cur.props[k].houses && !cur.props[k].mortgaged).map(Number).sort((a, b) => a - b) : [];
    $(container).innerHTML = list.length
      ? list.map(i => `<label class="trade-prop"><input type="checkbox" value="${i}"><span class="chip" style="background:${E.S[i].group ? E.GROUP_CSS[E.S[i].group] : '#888'}"></span>${esc(E.S[i].name)}</label>`).join('')
      : '<div class="hint">keine tauschbaren Grundstücke</div>';
  };
  mkList(myPid, 'trade-give');
  mkList(to, 'trade-take');
  $('trade-take-card-row').style.display = (cur.jailCards && cur.jailCards[to] > 0) ? '' : 'none';
}
function checkedProps(id) {
  return [...$(id).querySelectorAll('input:checked')].map(c => parseInt(c.value, 10));
}
function renderTradeIn(tr) {
  const from = esc((cur.players[tr.from] || {}).name);
  const to = esc((cur.players[tr.to] || {}).name);
  const offer = (properties, money, card) => [
    ...(properties || []).map(i => esc(E.S[i].name)),
    ...(money ? [fmt(money)] : []),
    ...(card ? ['Gefängnisfrei-Karte'] : [])
  ].join(', ') || 'Nichts';
  const mine = tr.to === myPid;
  const own = tr.from === myPid;
  if (!mine && !own && dismissedTradeKey === JSON.stringify(tr)) return;
  $('trade-in-body').innerHTML = `
    <p>${mine ? `<b>${from}</b> bietet <b>dir</b>:` : own ? `Dein Angebot an <b>${to}</b>:` : `<b>${from}</b> bietet <b>${to}</b>:`}</p>
    <p><strong>${mine ? 'Du bekommst' : from + ' gibt'}</strong><br>${offer(tr.give, tr.giveMoney, tr.giveCard)}</p>
    <p><strong>${mine ? 'Du gibst' : to + ' gibt'}</strong><br>${offer(tr.take, tr.takeMoney, tr.takeCard)}</p>
    ${own ? '<p class="hint">Wartet auf die Antwort …</p>' : ''}
    ${!mine && !own ? '<p class="hint">Du schaust zu — die beiden verhandeln gerade.</p>' : ''}`;
  $('btn-accept-trade').classList.toggle('hidden', !mine);
  $('btn-decline-trade').classList.toggle('hidden', !mine);
  $('btn-trade-in-cancel').classList.toggle('hidden', !own || local);
  $('btn-trade-spect-close').classList.toggle('hidden', mine || own);
  show('modal-trade-in');
  $('btn-trade-leave').classList.toggle('hidden', local);
}

// ---------- Effekt-Animationen ----------
let fxLayer = null;
function fxLayerEl() {
  if (!fxLayer) {
    fxLayer = document.createElement('div');
    fxLayer.id = 'fx-layer';
    $('game-wrap').append(fxLayer);
  }
  return fxLayer;
}
function anchorOf(pid) {
  const layer = fxLayerEl();
  const base = layer.getBoundingClientRect();
  const row = $('players-list').querySelector(`[data-pid="${pid}"]`);
  const boardPt = visuals.piecePoint(pid);
  const boardEl = $('board');
  if (boardPt && boardEl) {
    const b = boardEl.getBoundingClientRect();
    return [b.left + boardPt[0] - base.left, b.top + boardPt[1] - base.top];
  }
  if (row) {
    const r = row.getBoundingClientRect();
    return [r.left + r.width / 2 - base.left, r.top + r.height / 2 - base.top];
  }
  return [base.width / 2, base.height / 2];
}
function flyEl(cls, from, to, delay = 0) {
  const el = document.createElement('span');
  el.className = 'fx ' + cls;
  el.style.left = from[0] + 'px';
  el.style.top = from[1] + 'px';
  fxLayerEl().append(el);
  const midY = Math.min(from[1], to[1]) - 46;
  el.animate([
    { transform: 'translate(-50%,-50%) scale(.7)', opacity: 0 },
    { transform: `translate(${from[0] === to[0] ? '-50%' : '-30%'},-50%) scale(1.1)`, opacity: 1, offset: .18 },
    { transform: `translate(${to[0] - from[0] - 18}px, ${midY - from[1]}px) translate(-50%,-50%) scale(1)`, opacity: 1, offset: .7 },
    { transform: `translate(${to[0] - from[0]}px, ${to[1] - from[1]}px) translate(-50%,-50%) scale(.85)`, opacity: 0 }
  ], { duration: 950, delay, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'backwards' }).onfinish = () => el.remove();
}
function bumpMoney(pid, gain) {
  const row = $('players-list').querySelector(`[data-pid="${pid}"] .pl-money`);
  if (!row) return;
  row.classList.remove('gain', 'loss');
  void row.offsetWidth;
  row.classList.add(gain ? 'gain' : 'loss');
}
function playFx(fx) {
  if (!fx) return;
  if (fx.k === 'pay') {
    const from = anchorOf(fx.from), to = anchorOf(fx.to);
    const n = Math.min(5, Math.max(2, Math.ceil(fx.v / 80)));
    for (let i = 0; i < n; i++) flyEl('bill', from, to, i * 130);
    bumpMoney(fx.from, false);
    setTimeout(() => bumpMoney(fx.to, true), 900);
  } else if (fx.k === 'trade') {
    const a = anchorOf(fx.from), b = anchorOf(fx.to);
    (fx.give || []).forEach((i, k) => {
      const el = flyEl('deed', a, b, k * 140);
      void el;
    });
    (fx.take || []).forEach((i, k) => flyEl('deed', b, a, k * 140));
    if (fx.giveMoney) for (let i = 0; i < 3; i++) flyEl('bill', a, b, 200 + i * 130);
    if (fx.takeMoney) for (let i = 0; i < 3; i++) flyEl('bill', b, a, 200 + i * 130);
    if (fx.giveCard) flyEl('jcard', a, b, 400);
    if (fx.takeCard) flyEl('jcard', b, a, 400);
    if (fx.giveMoney) setTimeout(() => bumpMoney(fx.to, true), 1100);
    if (fx.takeMoney) setTimeout(() => bumpMoney(fx.from, true), 1100);
  } else if (fx.k === 'out') {
    const at = anchorOf(fx.pid);
    const el = document.createElement('span');
    el.className = 'fx burst';
    el.textContent = '💥';
    el.style.left = at[0] + 'px';
    el.style.top = at[1] + 'px';
    fxLayerEl().append(el);
    el.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
      { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 1, offset: .4 },
      { transform: 'translate(-50%,-50%) scale(1.2)', opacity: 0 }
    ], { duration: 1400, easing: 'ease-out' }).onfinish = () => el.remove();
  }
}

// ---------- Verwaltung ----------
function renderManage() {
  const mine = cur.props ? Object.keys(cur.props).filter(k => cur.props[k].owner === myPid).map(Number).sort((a, b) => a - b) : [];
  $('manage-list').innerHTML = mine.length ? mine.map(i => {
    const s = E.S[i], p = cur.props[i];
    const col = s.group ? E.GROUP_CSS[s.group] : '#888';
    const ownAll = s.group && E.ownsGroup(cur, myPid, s.group);
    const others = s.group ? E.GROUPS[s.group].filter(j => j !== i).map(j => cur.props[j]) : [];
    const canBuild = ownAll && !p.mortgaged && p.houses < 5 && cur.money[myPid] >= s.house &&
      others.every(prop => !prop.mortgaged && prop.houses >= p.houses);
    const canSell = p.houses > 0 && others.every(prop => (prop?.houses || 0) <= p.houses);
    const canMort = !p.mortgaged && !(s.group && E.GROUPS[s.group].some(j => cur.props[j] && cur.props[j].houses > 0));
    const canUnmort = p.mortgaged && (cur.money[myPid] || 0) >= Math.ceil(s.price / 2 * 1.1);
    return `<div class="mg-row">
      <span class="chip" style="background:${col}"></span>
      <span class="mg-name">${esc(s.name)}${p.mortgaged ? ' <em>(Hypothek)</em>' : ''} ${p.houses === 5 ? '🏨' : '🏠'.repeat(p.houses)}</span>
      <span class="mg-btns">
        ${canBuild ? `<button class="btn sm" data-a="build" data-i="${i}">${p.houses === 4 ? 'Hotel' : 'Haus'} bauen · −${s.house} €</button>` : ''}
        ${canSell ? `<button class="btn sm" data-a="sellhouse" data-i="${i}">Gebäude verkaufen · +${Math.floor(s.house / 2)} €</button>` : ''}
        ${canMort ? `<button class="btn sm" data-a="mortgage" data-i="${i}">Hypothek aufnehmen · +${Math.floor(s.price / 2)} €</button>` : ''}
        ${canUnmort ? `<button class="btn sm" data-a="unmortgage" data-i="${i}">Hypothek ablösen · −${Math.ceil(s.price / 2 * 1.1)} €</button>` : ''}
      </span>
    </div>`;
  }).join('') : '<div class="hint">Du besitzt noch nichts.</div>';
}

// ---------- Ende ----------
function renderEnd() {
  const w = cur.winner;
  const name = !local && w === myPid ? 'Du hast' : (cur.players[w]?.name || 'Ein Spieler') + ' hat';
  $('end-title').textContent = name + ' gewonnen!';
  show('modal-end');
  $('btn-again').classList.toggle('hidden', !local && !isHost);
}

function leaveRoom(silent = false) {
  const ref = roomRef, pid = myPid, presence = disconnect;
  for (const unsubscribe of subscriptions) unsubscribe();
  subscriptions = [];
  roomRef = null; cur = null; myPid = null; roomCode = null;
  isHost = false; connected = false; local = false; disconnect = null; pendingAction = null; round = null;
  isAnimating = false;
  clearTimeout(afterRoll);
  visuals.reset();
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  history.replaceState(null, '', location.pathname);
  showScreen('screen-start');
  if (!silent && ref && pid) {
    fb.runTransaction(ref, room => {
      const player = room?.players?.[pid];
      if (!player) return;
      if (room.status === 'lobby') {
        delete room.players[pid];
        if (!Object.keys(room.players).length) return null;
        if (room.hostId === pid) room.hostId = connectedPlayers(room)[0] || Object.keys(room.players)[0];
      } else player.connected = false;
      return room;
    }, { applyLocally: false }).then(() => presence?.cancel()).catch(() => {});
  }
}

function renderLocalNames() {
  const container = $('local-names');
  const size = Number($('local-count').value);
  while (container.children.length > size) container.lastElementChild.remove();
  while (container.children.length < size) {
    const i = container.children.length + 1;
    const label = document.createElement('label');
    label.className = 'local-player';
    label.innerHTML = `<span class="ptoken" aria-hidden="true">${TOKENS[i - 1]}</span>
      <span>Spieler ${i}</span><input name="player" maxlength="16" placeholder="Name optional" autocapitalize="words">`;
    container.append(label);
  }
}

function startLocal(event) {
  event.preventDefault();
  const players = {};
  new FormData(event.currentTarget).getAll('player').forEach((name, i) => {
    players['local' + i] = { name: name.trim() || 'Spieler ' + (i + 1), connected: true };
  });
  local = true;
  myPid = null;
  cur = E.deal({ players, order: Object.keys(players) });
  hide('modal-local');
  showScreen('screen-game');
  renderGame();
}

// ---------- Init ----------
function init() {
  $('input-name').value = localStorage.getItem('mono-name') || '';
  const params = new URLSearchParams(location.search);
  const pre = params.get('room');
  if (pre) $('input-code').value = pre.toUpperCase();

  const saveName = () => {
    myName = $('input-name').value.trim() || 'Spieler';
    localStorage.setItem('mono-name', myName);
  };
  const online = async action => {
    saveName();
    err('');
    for (const id of ['btn-join', 'btn-create', 'btn-local']) $(id).disabled = true;
    $('online-block').setAttribute('aria-busy', 'true');
    try { await action(); }
    catch { err('Der Spielraum ist gerade nicht erreichbar. Prüfe deine Verbindung und versuche es erneut.'); }
    finally {
      $('online-block').removeAttribute('aria-busy');
      for (const id of ['btn-join', 'btn-create', 'btn-local']) $(id).disabled = false;
    }
  };
  $('btn-create').onclick = () => online(createRoom);
  $('btn-join').onclick = () => online(() => joinRoom($('input-code').value));
  $('input-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join').click(); });
  const shareUrl = () => new URL('?room=' + roomCode, location.href).href;
  $('btn-copy').onclick = () => {
    const url = shareUrl();
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(() => toast('Link kopiert — schick ihn deinen Mitspielern'))
      .catch(() => window.prompt('Einladungslink kopieren', url));
  };
  if (navigator.share) {
    show('btn-share');
    $('btn-share').onclick = () => navigator.share({ title: 'Monopoly', url: shareUrl() }).catch(() => {});
  }
  $('btn-start-game').onclick = hostStartGame;
  $('btn-leave-lobby').onclick = $('btn-end-leave').onclick = () => leaveRoom();
  const confirmLeave = () => { if (confirm('Möchtest du die Partie verlassen?')) leaveRoom(); };
  for (const id of ['btn-leave-game', 'btn-auction-leave', 'btn-trade-leave']) $(id).onclick = confirmLeave;
  $('btn-local').onclick = () => { renderLocalNames(); show('modal-local'); };
  $('btn-local-close').onclick = () => hide('modal-local');
  $('local-count').onchange = renderLocalNames;
  $('local-form').onsubmit = startLocal;
  $('btn-local-ready').onclick = () => hide('modal-pass');
  $('field-select').replaceChildren(...E.S.map((space, i) => new Option(space.name, i)));
  $('btn-field').onclick = () => onSpaceClick(Number($('field-select').value));
  $('current-space').onclick = () => onSpaceClick(Number($('current-space').dataset.space));
  for (const id of ['modal-auction', 'modal-pass', 'modal-trade-in', 'modal-end']) {
    $(id).addEventListener('cancel', event => event.preventDefault());
  }

  $('btn-roll').onclick = () => sendAction({ t: 'roll' });
  $('btn-jail-pay').onclick = () => sendAction({ t: 'roll', mode: 'pay' });
  $('btn-jail-card').onclick = () => sendAction({ t: 'roll', mode: 'card' });
  $('btn-buy').onclick = () => sendAction({ t: 'buy' });
  $('btn-auction').onclick = () => sendAction({ t: 'auction' });
  $('btn-end').onclick = () => sendAction({ t: 'end' });
  $('btn-bankrupt').onclick = () => { if (confirm('Wirklich Konkurs erklären? Du scheidest aus.')) sendAction({ t: 'bankrupt' }); };
  $('btn-bid').onclick = () => { if (cur && cur.auction) sendAction({ t: 'bid', amount: cur.auction.high + bidAdd }); };
  $('btn-pass-auction').onclick = () => sendAction({ t: 'pass' });
  $('btn-trade').onclick = renderTradeModal;
  $('btn-trade-cancel').onclick = () => sendAction({ t: 'cancel' });
  $('btn-manage').onclick = () => { renderManage(); show('modal-manage'); };
  $('btn-close-manage').onclick = () => hide('modal-manage');
  $('manage-list').addEventListener('click', e => {
    const b = e.target.closest('button[data-a]');
    if (!b) return;
    sendAction({ t: b.dataset.a, space: parseInt(b.dataset.i, 10) });
  });
  $('btn-send-trade').onclick = () => {
    const to = $('trade-to').value;
    if (!to) return;
    const offer = {
      t: 'trade', to,
      give: checkedProps('trade-give'), take: checkedProps('trade-take'),
      giveMoney: parseInt($('trade-give-money').value, 10) || 0,
      takeMoney: parseInt($('trade-take-money').value, 10) || 0,
      giveCard: $('trade-give-card').checked, takeCard: $('trade-take-card').checked,
    };
    if (!offer.give.length && !offer.take.length && !offer.giveMoney && !offer.takeMoney && !offer.giveCard && !offer.takeCard) {
      return toast('Wähle aus, was du geben oder bekommen möchtest.');
    }
    hide('modal-trade');
    sendAction(offer);
  };
  $('btn-cancel-trade').onclick = () => hide('modal-trade');
  $('btn-accept-trade').onclick = () => sendAction({ t: 'accept' });
  $('btn-decline-trade').onclick = () => sendAction({ t: 'decline' });
  $('btn-trade-in-cancel').onclick = () => sendAction({ t: 'cancel' });
  $('btn-trade-spect-close').onclick = () => { dismissedTradeKey = JSON.stringify(cur?.trade); hide('modal-trade-in'); };
  $('btn-card-close').onclick = () => hide('modal-card');
  $('btn-deed-close').onclick = () => hide('modal-deed');
  $('token-pick').addEventListener('click', async e => {
    const b = e.target.closest('.tok-opt');
    if (!b || b.disabled) return;
    const t = +b.dataset.tok;
    try {
      await fb.runTransaction(roomRef, room => {
        if (!room || room.status !== 'lobby' || !room.players?.[myPid]) return;
        room.players[myPid].token = t;
        return room;
      }, { applyLocally: false });
    } catch {}
  });
  $('my-props').addEventListener('click', e => {
    const row = e.target.closest('.my-prop');
    if (row) showDeed(+row.dataset.i);
  });
  $('btn-again').onclick = () => {
    if (!local) return hostStartGame();
    myPid = null;
    E.deal(cur);
    renderGame();
  };
}
init();
