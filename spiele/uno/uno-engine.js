// UNO-Regelwerk — ohne UI, ohne Firebase. Läuft im Browser und in Node (für Tests).
const UnoEngine = (() => {
  const COLORS = ['r', 'g', 'b', 'y'];
  const COLOR_NAMES = { r: 'Rot', g: 'Grün', b: 'Blau', y: 'Gelb' };
  const VALUE_NAMES = {
    skip: 'Aussetzen', rev: 'Richtungswechsel', d2: '+2',
    wild: 'Farbwechsel', wild4: '+4 Farbwechsel',
  };

  function buildDeck() {
    const d = [];
    for (const c of COLORS) {
      d.push({ c, v: '0' });
      for (let i = 1; i <= 9; i++) { d.push({ c, v: String(i) }); d.push({ c, v: String(i) }); }
      for (const v of ['skip', 'rev', 'd2']) { d.push({ c, v }); d.push({ c, v }); }
    }
    for (let i = 0; i < 4; i++) { d.push({ c: 'w', v: 'wild' }); d.push({ c: 'w', v: 'wild4' }); }
    return d;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function same(a, b) { return a && b && a.c === b.c && a.v === b.v; }

  function canPlay(card, state) {
    if (card.c === 'w') return true;
    return card.c === state.currentColor || card.v === state.top.v;
  }

  function wild4Legal(hand, state) {
    return !hand.some(c => c.c === state.currentColor);
  }

  function name(state, pid) {
    return (state.players[pid] && state.players[pid].name) || '?';
  }

  function log(state, msg) {
    state.log.push(msg);
    if (state.log.length > 30) state.log.shift();
  }

  function drawOne(state) {
    if (!state.deck || !state.deck.length) {
      if (state.discard.length <= 1) return;
      state.deck = shuffle(state.discard.slice(0, -1));
      state.discard = [state.top];
      log(state, 'Ablagestapel wurde gemischt');
    }
    return state.deck.pop();
  }

  function nextTurn(state, steps) {
    const n = state.order.length;
    steps = steps || 1;
    state.turn = ((state.turn + state.dir * steps) % n + n) % n;
    state.drew = null;
  }

  // Neues Spiel auf Basis eines Room-/Lobby-Objekts { players:{pid:{name}}, order:[pid] }
  function deal(state) {
    const deck = shuffle(buildDeck());
    const hands = {};
    for (const pid of state.order) hands[pid] = deck.splice(0, 7);
    let top = deck.pop();
    while (top.c === 'w') { deck.unshift(top); top = deck.pop(); }
    state.status = 'playing';
    state.deck = deck;
    state.discard = [top];
    state.top = top;
    state.currentColor = top.c;
    state.hands = hands;
    state.turn = 0;
    state.dir = 1;
    state.drew = null;
    state.round = (state.round || 0) + 1;
    state.move = null;
    state.winner = null;
    state.log = ['Spiel gestartet'];
    return state;
  }

  function applyAction(state, pid, action) {
    if (state.status !== 'playing') return { ok: false, err: 'Spiel läuft nicht' };
    if (state.order[state.turn] !== pid) return { ok: false, err: 'Nicht dein Zug' };
    const hand = state.hands[pid];
    if (!hand) return { ok: false, err: 'Keine Hand' };

    if (action.t === 'draw') {
      if (state.drew) return { ok: false, err: 'Du hast schon gezogen' };
      const card = drawOne(state);
      setMove(state, pid, card ? 'draw' : 'pass');
      if (card) {
        hand.push(card);
        state.drew = card;
        log(state, name(state, pid) + ' zieht eine Karte');
      } else log(state, 'Keine Karte zum Ziehen – ' + name(state, pid) + ' passt');
      if (!card || !canPlay(card, state) || (card.v === 'wild4' && !wild4Legal(hand, state))) nextTurn(state);
      return { ok: true };
    }

    if (action.t === 'pass') {
      if (!state.drew) return { ok: false, err: 'Nur nach dem Ziehen möglich' };
      setMove(state, pid, 'pass');
      log(state, name(state, pid) + ' passt');
      nextTurn(state);
      return { ok: true };
    }

    if (action.t === 'play') {
      if (state.drew && !same(action.card, state.drew)) {
        return { ok: false, err: 'Nur die gezogene Karte legen oder passen' };
      }
      const idx = hand.findIndex(c => same(c, action.card));
      if (idx < 0) return { ok: false, err: 'Karte nicht auf der Hand' };
      const card = hand[idx];
      if (!canPlay(card, state)) return { ok: false, err: 'Karte passt nicht' };
      if (card.v === 'wild4' && !wild4Legal(hand, state)) {
        return { ok: false, err: '+4 nur, wenn du keine Karte der aktuellen Farbe hast' };
      }
      if (card.c === 'w' && !COLORS.includes(action.color)) {
        return { ok: false, err: 'Farbe wählen' };
      }
      hand.splice(idx, 1);
      state.discard.push(card);
      state.top = card;
      state.currentColor = card.c === 'w' ? action.color : card.c;
      log(state, name(state, pid) + ' legt ' + label(card));

      const move = setMove(state, pid, 'play');
      move.card = card;
      if (hand.length === 1) {
        move.uno = true;
        log(state, name(state, pid) + ' ruft UNO!');
      }
      if (hand.length === 0) {
        state.status = 'finished';
        state.winner = pid;
        log(state, name(state, pid) + ' gewinnt!');
        return { ok: true };
      }

      let skip = 1;
      const n = state.order.length;
      if (card.v === 'skip') {
        skip = 2;
        move.target = nextPid(state);
        log(state, name(state, move.target) + ' setzt aus');
      }
      else if (card.v === 'rev') {
        state.dir *= -1;
        skip = n === 2 ? 2 : 1;
        log(state, 'Richtung wechselt');
      } else if (card.v === 'd2') {
        drawToVictim(state, move, 2);
        skip = 2;
      } else if (card.v === 'wild4') {
        drawToVictim(state, move, 4);
        skip = 2;
      }
      nextTurn(state, skip);
      return { ok: true };
    }
    return { ok: false, err: 'Unbekannte Aktion' };
  }

  function setMove(state, pid, t) {
    return (state.move = { n: (state.move ? state.move.n : 0) + 1, pid, t });
  }

  function nextPid(state) {
    const n = state.order.length;
    return state.order[(state.turn + state.dir + n) % n];
  }

  function drawToVictim(state, move, count) {
    move.target = nextPid(state);
    move.count = 0;
    for (let i = 0; i < count; i++) {
      const card = drawOne(state);
      if (!card) break;
      state.hands[move.target].push(card);
      move.count++;
    }
    log(state, name(state, move.target) + (move.count ? ' zieht ' + move.count + ' Karten und setzt aus' : ' setzt aus'));
  }

  function botAction(state, pid) {
    const hand = state.hands[pid];
    const cards = hand.filter(c => (state.drew ? same(c, state.drew) : canPlay(c, state))
      && (c.v !== 'wild4' || wild4Legal(hand, state)));
    const card = cards.find(c => c.c !== 'w') || cards[0];
    if (!card) return { t: state.drew ? 'pass' : 'draw' };
    if (card.c !== 'w') return { t: 'play', card };
    const count = color => hand.filter(c => c.c === color).length;
    const color = COLORS.reduce((best, c) => count(c) > count(best) ? c : best, state.currentColor);
    return { t: 'play', card, color };
  }

  function label(card) {
    if (card.c === 'w') return VALUE_NAMES[card.v];
    const v = VALUE_NAMES[card.v] || card.v;
    return COLOR_NAMES[card.c] + ' ' + v;
  }

  return { COLORS, COLOR_NAMES, buildDeck, canPlay, wild4Legal, deal, applyAction, botAction, label, drawOne, nextTurn };
})();

if (typeof module !== 'undefined') module.exports = UnoEngine;
