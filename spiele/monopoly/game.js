'use strict';
/* global Mono, MONO_FIREBASE_CONFIG */
const E = Mono;
const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const FB_VERSION = '10.14.1';
const TOKENS = ['🚗', '🎩', '🐕', '🚢', '👢', '🧺'];
const TOKEN_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#27ae60', '#9b59b6', '#e67e22'];
const PIP_POS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
};

let db = null, fb = null;
let roomRef = null;
let myPid = null, myName = '';
let roomCode = null, isHost = false, joined = false;
let cur = null;
let actionQueue = [], draining = false;
let lastCardSeq = 0;
let manageOpen = false;

function toast(msg, ms = 3000) {
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
    if (!(await fb.get(ref)).exists()) {
      roomCode = code;
      roomRef = ref;
      sessionStorage.setItem('mono-pid-' + code, myPid);
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
  if (!(await ensureFb())) return;
  code = (code || '').toUpperCase().trim();
  if (code.length !== 4) return err('Code hat 4 Zeichen');
  const ref = fb.ref(db, 'mrooms/' + code);
  const snap = await fb.get(ref);
  if (!snap.exists()) return err('Raum nicht gefunden');
  const room = snap.val();
  myPid = sessionStorage.getItem('mono-pid-' + code) || 'p' + Math.random().toString(36).slice(2, 10);
  const existing = room.players && room.players[myPid];
  if (room.status !== 'lobby' && !existing) return err('Das Spiel läuft schon');
  const count = Object.keys(room.players || {}).length;
  if (!existing && count >= 6) return err('Raum ist voll (max. 6)');
  roomCode = code;
  roomRef = ref;
  sessionStorage.setItem('mono-pid-' + code, myPid);
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
  try {
    while (actionQueue.length) {
      const snap = actionQueue.shift();
      const a = snap.val();
      let r;
      try { r = E.applyAction(cur, a.pid, a); }
      catch (e) { r = { ok: false, err: 'Fehler: ' + e.message }; }
      if (r.ok) {
        try { await fb.set(roomRef, cur); } catch (e) {}
      } else {
        await fb.push(fb.child(roomRef, 'feedback/' + a.pid), r.err || 'Ungültiger Zug').catch(() => {});
      }
      await fb.remove(snap.ref).catch(() => {});
    }
  } finally { draining = false; }
}

function sendAction(a) {
  fb.push(fb.child(roomRef, 'actions'), Object.assign({ pid: myPid }, a));
}

// ---------- Lobby ----------
function renderLobby() {
  $('lobby-code').textContent = roomCode;
  const ul = $('lobby-players');
  const players = cur && cur.players ? cur.players : {};
  const ids = Object.keys(players).sort((x, y) => (players[x].joinedAt || 0) - (players[y].joinedAt || 0));
  ul.innerHTML = ids.map((pid, i) => {
    const p = players[pid];
    const me = pid === myPid ? ' (du)' : '';
    const crown = pid === cur.hostId ? ' <span class="crown">👑</span>' : '';
    const token = TOKENS[i % TOKENS.length];
    return `<li><span class="dot${p.connected === false ? ' off' : ''}"></span><span class="ptoken">${token}</span>${esc(p.name)}${me}${crown}</li>`;
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
  cur.actions = null;
  await fb.set(roomRef, cur);
}

// ---------- Brett ----------
function gridPos(i) {
  if (i <= 9) return { row: 11, col: 11 - i, edge: 'top' };
  if (i <= 19) return { row: 21 - i, col: 1, edge: 'right' };
  if (i <= 29) return { row: 1, col: i - 19, edge: 'bottom' };
  return { row: i - 29, col: 11, edge: 'left' };
}
const TYPE_ICON = { bahn: '🚂', werk: '💡', tax: '💰', chance: '❓', community: '📦', free: '🅿️', go: '➡️', goToJail: '👮', jail: '🔒' };

let boardBuilt = false;
function buildBoard() {
  const board = $('board');
  const center = $('board-center');
  E.S.forEach((s, i) => {
    const g = gridPos(i);
    const d = document.createElement('div');
    d.className = 'space t-' + s.t + ' edge-' + g.edge + (i % 10 === 0 ? ' corner' : '');
    d.id = 'space-' + i;
    d.style.gridRow = g.row;
    d.style.gridColumn = g.col;
    let inner = '';
    if (s.t === 'prop') inner += `<div class="colorbar" style="background:${E.GROUP_CSS[s.group]}"></div>`;
    inner += `<div class="s-name">${esc(s.name)}</div>`;
    if (s.price) inner += `<div class="s-price">${s.price} €</div>`;
    if (s.t === 'tax') inner += `<div class="s-price">${s.amount} €</div>`;
    if (TYPE_ICON[s.t]) inner += `<div class="s-icon">${TYPE_ICON[s.t]}</div>`;
    inner += '<div class="s-houses"></div><div class="s-owner"></div><div class="s-tokens"></div>';
    d.innerHTML = inner;
    d.addEventListener('click', () => onSpaceClick(i));
    board.insertBefore(d, center);
  });
  boardBuilt = true;
}

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
  const p = cur && cur.props && cur.props[i];
  let info = spaceDesc(i);
  if (p && p.owner) info += `\nBesitzer: ${esc((cur.players[p.owner] || {}).name)}`;
  if (p && p.mortgaged) info += '\n(Hypothek)';
  toast(info, 4500);
}

// ---------- Render ----------
function renderGame() {
  if (!cur || !cur.order) return;
  // RTDB löscht leere Objekte
  cur.out = cur.out || {}; cur.pos = cur.pos || {}; cur.money = cur.money || {};
  cur.props = cur.props || {}; cur.jailed = cur.jailed || {}; cur.jailCards = cur.jailCards || {};
  cur.mustRaise = cur.mustRaise || {}; cur.log = cur.log || [];
  if (!boardBuilt) buildBoard();

  const active = cur.order[cur.turn];
  const myTurn = active === myPid;

  // Würfel
  renderDie('die1', cur.dice && cur.dice[0]);
  renderDie('die2', cur.dice && cur.dice[1]);

  // Felder aktualisieren
  const tokenMap = {};
  cur.order.forEach(pid => {
    if (cur.out[pid]) return;
    const pos = cur.pos[pid];
    (tokenMap[pos] = tokenMap[pos] || []).push(pid);
  });
  for (let i = 0; i < 40; i++) {
    const el = $('space-' + i);
    const p = cur.props && cur.props[i];
    const houses = el.querySelector('.s-houses');
    if (p && p.houses > 0) {
      houses.innerHTML = p.houses === 5
        ? '<span class="hotel">🏨</span>'
        : Array(p.houses).fill('<span class="house"></span>').join('');
    } else houses.innerHTML = '';
    const own = el.querySelector('.s-owner');
    if (p && p.owner) {
      const oi = cur.order.indexOf(p.owner);
      own.innerHTML = `<span class="own-dot" style="background:${TOKEN_COLORS[oi % TOKEN_COLORS.length]}">${p.mortgaged ? '💸' : ''}</span>`;
    } else own.innerHTML = '';
    const tk = el.querySelector('.s-tokens');
    tk.innerHTML = (tokenMap[i] || []).map(pid => {
      const oi = cur.order.indexOf(pid);
      return `<span class="token" title="${esc((cur.players[pid] || {}).name)}" style="text-shadow:0 0 3px ${TOKEN_COLORS[oi % TOKEN_COLORS.length]}">${TOKENS[oi % TOKENS.length]}</span>`;
    }).join('');
    el.classList.toggle('mortgaged', !!(p && p.mortgaged));
  }

  // Mitte
  const st = $('center-status');
  if (cur.status === 'finished') st.textContent = '';
  else if (cur.auction) st.textContent = '🔨 Versteigerung läuft!';
  else st.textContent = myTurn ? 'Du bist am Zug' : 'Am Zug: ' + esc((cur.players[active] || {}).name || '?');
  $('log-box').innerHTML = (cur.log || []).slice(-8).map(l => `<div>${esc(l)}</div>`).join('');
  $('log-box').scrollTop = 99999;

  // Karten-Popup
  if (cur.cardSeq && cur.cardSeq !== lastCardSeq && cur.lastCard) {
    lastCardSeq = cur.cardSeq;
    const type = cur.lastCardType === 'community' ? 'GEMEINSCHAFT' : 'EREIGNIS';
    $('drawn-card').classList.toggle('community', cur.lastCardType === 'community');
    $('drawn-card').querySelector('.dc-type').textContent = type + 'SKARTE';
    $('drawn-card').querySelector('.dc-text').textContent = cur.lastCard;
    show('modal-card');
    clearTimeout($('modal-card')._h);
    $('modal-card')._h = setTimeout(() => hide('modal-card'), 6000);
  }

  // Buttons
  const raising = cur.mustRaise && cur.mustRaise[myPid] !== undefined;
  ['btn-roll', 'btn-jail-pay', 'btn-jail-card', 'btn-buy', 'btn-auction', 'btn-end', 'btn-trade', 'btn-manage', 'btn-bankrupt'].forEach(hide);
  if (cur.status === 'playing' && !cur.auction) {
    if (myTurn && !cur.trade) {
      if (cur.phase === 'roll') show('btn-roll');
      if (cur.phase === 'jail') {
        $('btn-roll').textContent = '🎲 Würfeln (Pasch)';
        show('btn-roll');
        if ((cur.money[myPid] || 0) >= 50) show('btn-jail-pay');
        if ((cur.jailCards && cur.jailCards[myPid]) > 0) show('btn-jail-card');
      } else $('btn-roll').textContent = '🎲 Würfeln';
      if (cur.phase === 'buy' && cur.pending) {
        const s = E.S[cur.pending.space];
        $('btn-buy').textContent = 'Kaufen (' + s.price + ' €)';
        show('btn-buy'); show('btn-auction'); show('btn-end');
      }
      if (cur.phase === 'manage' || cur.phase === 'jailend') {
        show('btn-end');
        if (!raising) { show('btn-manage'); show('btn-trade'); }
      }
      if (raising) {
        show('btn-manage');
        show('btn-bankrupt');
        toast('Du bist im Minus — verkaufe Gebäude/Hypotheken oder erkläre Konkurs', 4000);
      }
    }
  }

  $('turn-banner').textContent = cur.status === 'playing'
    ? (myTurn ? (raising ? '⚠️ Schulden begleichen!' : '🎲 Du bist dran!') : esc((cur.players[active] || {}).name || '?') + ' ist dran …')
    : '';

  // Spielerliste
  $('players-list').innerHTML = cur.order.map((pid, i) => {
    const p = cur.players[pid] || { name: '?' };
    const cls = ['pl-row'];
    if (pid === active) cls.push('active');
    if (cur.out[pid]) cls.push('out');
    if (p.connected === false) cls.push('off');
    const props = cur.props ? Object.keys(cur.props).filter(k => cur.props[k].owner === pid).length : 0;
    return `<div class="${cls.join(' ')}">
      <span class="ptoken" style="color:${TOKEN_COLORS[i % TOKEN_COLORS.length]}">${TOKENS[i % TOKENS.length]}</span>
      <span class="pl-name">${esc(p.name)}${pid === myPid ? ' (du)' : ''}${cur.jailed[pid] !== undefined ? ' 🔒' : ''}</span>
      <span class="pl-money">${fmt(cur.money[pid] || 0)}</span>
      <span class="pl-props">${props} Grundstücke</span>
    </div>`;
  }).join('');

  // Eigene Grundstücke (Kurzliste)
  const mine = cur.props ? Object.keys(cur.props).filter(k => cur.props[k].owner === myPid).map(Number).sort((x, y) => x - y) : [];
  $('my-props').innerHTML = mine.length
    ? '<div class="props-head">Deine Grundstücke:</div>' + mine.map(i => {
        const s = E.S[i], p = cur.props[i];
        const col = s.group ? E.GROUP_CSS[s.group] : '#888';
        return `<div class="my-prop" data-i="${i}"><span class="chip" style="background:${col}"></span>${esc(s.name)}${p.mortgaged ? ' 💸' : ''}${p.houses ? ' ' + '🏠'.repeat(p.houses === 5 ? 0 : p.houses) + (p.houses === 5 ? '🏨' : '') : ''}</div>`;
      }).join('')
    : '';

  // Auktions-Modal
  if (cur.auction) renderAuction();
  else hide('modal-auction');

  // Handel eingehend
  const tr = cur.trade;
  if (tr && tr.to === myPid) renderTradeIn(tr);
  else hide('modal-trade-in');
}

function renderDie(id, v) {
  const d = $(id);
  const cells = d.querySelectorAll('.pip');
  if (cells.length !== 9) {
    d.innerHTML = '<div class="pipgrid">' + Array(9).fill('<span class="pip"></span>').join('') + '</div>';
  }
  d.querySelectorAll('.pip').forEach((p, i) => p.classList.toggle('on', PIP_POS[v] && PIP_POS[v].includes(i)));
  d.classList.toggle('rolled', !!v);
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
  $('btn-bid').disabled = !myBidTurn;
  $('btn-pass-auction').disabled = !myBidTurn;
  document.querySelectorAll('.bid-amt').forEach(b => b.disabled = !myBidTurn);
  $('auction-status').textContent = !inAuction
    ? 'Du bist ausgestiegen / nicht dabei'
    : (myBidTurn ? 'Du bist am Zug — bieten oder passen' : 'Warte auf ' + esc((cur.players[au.left[au.idx]] || {}).name));
  show('modal-auction');
}

let bidAdd = 10;
document.addEventListener('click', e => {
  if (e.target.classList && e.target.classList.contains('bid-amt')) {
    bidAdd = parseInt(e.target.dataset.add, 10);
    $('btn-bid').textContent = 'Bieten: ' + ((cur && cur.auction ? cur.auction.high : 0) + bidAdd) + ' €';
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
  const list = arr => arr.length ? arr.map(i => esc(E.S[i].name)).join(', ') : '—';
  $('trade-in-body').innerHTML = `
    <p><b>${from}</b> bietet dir:</p>
    <p>➡️ ${list(tr.give)}${tr.giveMoney ? ' + ' + tr.giveMoney + ' €' : ''}${tr.giveCard ? ' + Gefängnisfrei-Karte' : ''}</p>
    <p>⬅️ dafür: ${list(tr.take)}${tr.takeMoney ? ' + ' + tr.takeMoney + ' €' : ''}${tr.takeCard ? ' + Gefängnisfrei-Karte' : ''}</p>`;
  show('modal-trade-in');
}

// ---------- Verwaltung ----------
function renderManage() {
  const mine = cur.props ? Object.keys(cur.props).filter(k => cur.props[k].owner === myPid).map(Number).sort((a, b) => a - b) : [];
  $('manage-list').innerHTML = mine.length ? mine.map(i => {
    const s = E.S[i], p = cur.props[i];
    const col = s.group ? E.GROUP_CSS[s.group] : '#888';
    const ownAll = s.group && E.ownsGroup(cur, myPid, s.group);
    const canBuild = ownAll && !p.mortgaged && p.houses < 5 && (cur.money[myPid] || 0) >= s.house;
    const canSell = p.houses > 0;
    const canMort = !p.mortgaged && !(s.group && E.GROUPS[s.group].some(j => cur.props[j] && cur.props[j].houses > 0));
    const canUnmort = p.mortgaged && (cur.money[myPid] || 0) >= Math.ceil(s.price / 2 * 1.1);
    return `<div class="mg-row">
      <span class="chip" style="background:${col}"></span>
      <span class="mg-name">${esc(s.name)}${p.mortgaged ? ' <em>(Hypothek)</em>' : ''} ${p.houses === 5 ? '🏨' : '🏠'.repeat(p.houses)}</span>
      <span class="mg-btns">
        ${canBuild ? `<button class="btn sm" data-a="build" data-i="${i}">+ ${p.houses === 4 ? '🏨' : '🏠'} ${s.house} €</button>` : ''}
        ${canSell ? `<button class="btn sm" data-a="sellhouse" data-i="${i}">− 🏠 ${Math.floor(s.house / 2)} €</button>` : ''}
        ${canMort ? `<button class="btn sm" data-a="mortgage" data-i="${i}">💸 +${Math.floor(s.price / 2)} €</button>` : ''}
        ${canUnmort ? `<button class="btn sm" data-a="unmortgage" data-i="${i}">↩️ −${Math.ceil(s.price / 2 * 1.1)} €</button>` : ''}
      </span>
    </div>`;
  }).join('') : '<div class="hint">Du besitzt noch nichts.</div>';
}

// ---------- Ende ----------
function renderEnd() {
  const w = cur.winner;
  const name = w === myPid ? 'Du hast' : esc((cur.players[w] || {}).name || '?') + ' hat';
  $('end-title').textContent = '🏆 ' + name + ' gewonnen!';
  show('modal-end');
  $('btn-again').classList.toggle('hidden', !isHost);
}

async function leaveRoom(silent) {
  joined = false;
  if (roomRef && myPid) {
    try { await fb.update(fb.child(roomRef, 'players/' + myPid), { connected: false }); } catch (e) {}
    fb.off(roomRef);
    fb.off(fb.child(roomRef, 'actions'));
    fb.off(fb.child(roomRef, 'feedback/' + myPid));
  }
  roomRef = null; cur = null; roomCode = null; isHost = false;
  actionQueue = []; lastCardSeq = 0; boardBuilt = false;
  document.querySelectorAll('#board .space').forEach(el => el.remove());
  history.replaceState(null, '', location.pathname);
  showScreen('screen-start');
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
  $('btn-leave-game').onclick = () => leaveRoom();
  $('btn-end-leave').onclick = () => { hide('modal-end'); showScreen('screen-lobby'); renderLobby(); };

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
  $('btn-manage').onclick = () => { renderManage(); manageOpen = true; show('modal-manage'); };
  $('btn-close-manage').onclick = () => { manageOpen = false; hide('modal-manage'); };
  $('manage-list').addEventListener('click', e => {
    const b = e.target.closest('button[data-a]');
    if (!b) return;
    sendAction({ t: b.dataset.a, space: parseInt(b.dataset.i, 10) });
    setTimeout(renderManage, 400);
  });
  $('btn-send-trade').onclick = () => {
    const to = $('trade-to').value;
    if (!to) return;
    sendAction({
      t: 'trade', to,
      give: checkedProps('trade-give'), take: checkedProps('trade-take'),
      giveMoney: parseInt($('trade-give-money').value, 10) || 0,
      takeMoney: parseInt($('trade-take-money').value, 10) || 0,
      giveCard: $('trade-give-card').checked, takeCard: $('trade-take-card').checked,
    });
    hide('modal-trade');
  };
  $('btn-cancel-trade').onclick = () => hide('modal-trade');
  $('btn-accept-trade').onclick = () => { sendAction({ t: 'accept' }); hide('modal-trade-in'); };
  $('btn-decline-trade').onclick = () => { sendAction({ t: 'decline' }); hide('modal-trade-in'); };
  $('modal-card').addEventListener('click', () => hide('modal-card'));
  $('btn-again').onclick = async () => {
    hide('modal-end');
    if (isHost && cur) {
      cur.order = Object.keys(cur.players)
        .filter(pid => cur.players[pid].connected !== false)
        .sort((x, y) => (cur.players[x].joinedAt || 0) - (cur.players[y].joinedAt || 0));
      lastCardSeq = 0;
      E.deal(cur);
      cur.actions = null;
      await fb.set(roomRef, cur);
    }
  };
}
init();
