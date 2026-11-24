// Monopoly-Engine — deutsche Brettversion, ohne UI/Firebase. Node-testbar.
const Mono = (() => {
  // t: go|prop|bahn|werk|tax|jail|free|gotojail|chance|community
  const S = [];
  function prop(name, group, price, house, rent) { S.push({ t: 'prop', name, group, price, house, rent }); }
  const RR = { t: 'bahn', price: 200 };
  const WW = { t: 'werk', price: 150 };

  S.push({ t: 'go', name: 'Los' });
  prop('Badstraße', 'braun', 60, 50, [2, 10, 30, 90, 160, 250]);
  S.push({ t: 'community', name: 'Gemeinschaftsfeld' });
  prop('Turmstraße', 'braun', 60, 50, [4, 20, 60, 180, 320, 450]);
  S.push({ t: 'tax', name: 'Einkommenssteuer', amount: 200 });
  S.push({ t: 'bahn', name: 'Südbahnhof', price: 200 });
  prop('Chausseestraße', 'hellblau', 100, 50, [6, 30, 90, 270, 400, 550]);
  S.push({ t: 'chance', name: 'Ereignisfeld' });
  prop('Elisenstraße', 'hellblau', 100, 50, [6, 30, 90, 270, 400, 550]);
  prop('Poststraße', 'hellblau', 120, 50, [8, 40, 100, 300, 450, 600]);
  S.push({ t: 'jail', name: 'Nur zu Besuch' });
  prop('Seestraße', 'pink', 140, 100, [10, 50, 150, 450, 625, 750]);
  S.push({ t: 'werk', name: 'Elektrizitätswerk', price: 150 });
  prop('Hafenstraße', 'pink', 140, 100, [10, 50, 150, 450, 625, 750]);
  prop('Neue Straße', 'pink', 160, 100, [12, 60, 180, 500, 700, 900]);
  S.push({ t: 'bahn', name: 'Westbahnhof', price: 200 });
  prop('Münchener Straße', 'orange', 180, 100, [14, 70, 200, 550, 750, 950]);
  S.push({ t: 'community', name: 'Gemeinschaftsfeld' });
  prop('Wiener Straße', 'orange', 180, 100, [14, 70, 200, 550, 750, 950]);
  prop('Berliner Straße', 'orange', 200, 100, [16, 80, 220, 600, 800, 1000]);
  S.push({ t: 'free', name: 'Frei parken' });
  prop('Theaterstraße', 'rot', 220, 150, [18, 90, 250, 700, 875, 1050]);
  S.push({ t: 'chance', name: 'Ereignisfeld' });
  prop('Museumstraße', 'rot', 220, 150, [18, 90, 250, 700, 875, 1050]);
  prop('Opernplatz', 'rot', 240, 150, [20, 100, 300, 750, 925, 1100]);
  S.push({ t: 'bahn', name: 'Nordbahnhof', price: 200 });
  prop('Lessingstraße', 'gelb', 260, 150, [22, 110, 330, 800, 975, 1150]);
  S.push({ t: 'werk', name: 'Wasserwerk', price: 150 });
  prop('Schillerstraße', 'gelb', 260, 150, [22, 110, 330, 800, 975, 1150]);
  prop('Goethestraße', 'gelb', 280, 150, [24, 120, 360, 850, 1025, 1200]);
  S.push({ t: 'gotojail', name: 'Gehen Sie ins Gefängnis' });
  prop('Rathausplatz', 'grün', 300, 200, [26, 130, 390, 900, 1100, 1275]);
  prop('Hauptstraße', 'grün', 300, 200, [26, 130, 390, 900, 1100, 1275]);
  S.push({ t: 'community', name: 'Gemeinschaftsfeld' });
  prop('Bahnhofstraße', 'grün', 320, 200, [28, 150, 450, 1000, 1200, 1400]);
  S.push({ t: 'bahn', name: 'Hauptbahnhof', price: 200 });
  S.push({ t: 'chance', name: 'Ereignisfeld' });
  prop('Parkstraße', 'blau', 350, 200, [35, 175, 500, 1100, 1300, 1500]);
  S.push({ t: 'tax', name: 'Zusatzsteuer', amount: 100 });
  prop('Schlossallee', 'blau', 400, 200, [50, 200, 600, 1400, 1700, 2000]);

  const GROUPS = {};
  S.forEach((s, i) => { if (s.group) (GROUPS[s.group] = GROUPS[s.group] || []).push(i); });
  const GROUP_CSS = { braun: '#8B5A2B', hellblau: '#AEE1F5', pink: '#D93A96', orange: '#F7922E', rot: '#ED1B24', gelb: '#FEF200', grün: '#1FA64A', blau: '#004B96' };

  function shuffled(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
  function name(state, pid) { return (state.players[pid] || {}).name || '?'; }
  function log(st, m) { st.log.push(m); if (st.log.length > 60) st.log.shift(); }
  // Animations-Ereignisse für die Oberfläche (Geldflug, Handel, Bankrott)
  function pushFx(st, fx) {
    st.fxSeq = (st.fxSeq || 0) + 1;
    st.fx = st.fx || {};
    st.fx['f' + st.fxSeq] = fx;
    for (const k of Object.keys(st.fx)) if (st.fxSeq - (k.slice(1) | 0) > 12) delete st.fx[k];
  }
  function roll() { return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]; }

  // ---------- Karten (Daten + Interpreter — JSON-serialisierbar für Firebase) ----------
  function runCard(st, pid, card) {
    const fx = card.fx;
    switch (fx.k) {
      case 'moveTo': movePlayerTo(st, pid, fx.i, fx.c !== false); break;
      case 'nearest': moveToNearest(st, pid, fx.t, !!fx.s); break;
      case 'bank': pay(st, null, pid, fx.v); break;
      case 'pay': pay(st, pid, null, fx.v); break;
      case 'jailCard': st.jailCards[pid] = (st.jailCards[pid] || 0) + 1; break;
      case 'jail': sendToJail(st, pid); break;
      case 'back': {
        for (let i = 0; i < fx.n; i++) {
          st.pos[pid] = (st.pos[pid] + 39) % 40;
          recordStep(st, pid, st.pos[pid]);
        }
        resolveSpace(st, pid);
        break;
      }
      case 'perBuilding': payPerBuilding(st, pid, fx.h, fx.hotel); break;
      case 'payEach': payEachPlayer(st, pid, fx.v); break;
      case 'receiveEach': receiveFromEach(st, pid, fx.v); break;
    }
  }
  const C = (text, fx) => ({ text, fx });
  function chanceDeck() {
    return shuffled([
      C('Rücken Sie vor bis zur Schlossallee.', { k: 'moveTo', i: 39 }),
      C('Rücken Sie vor bis auf Los. (Ziehen Sie 200 € ein.)', { k: 'moveTo', i: 0 }),
      C('Rücken Sie vor bis zum Opernplatz. Wenn Sie über Los kommen, ziehen Sie 200 € ein.', { k: 'moveTo', i: 24 }),
      C('Rücken Sie vor bis zur Seestraße. Wenn Sie über Los kommen, ziehen Sie 200 € ein.', { k: 'moveTo', i: 11 }),
      C('Rücken Sie vor bis zum nächsten Versorgungswerk. Werfen Sie die Würfel und zahlen Sie dem Eigentümer den zehnfachen Betrag als Miete.', { k: 'nearest', t: 'werk', s: true }),
      C('Rücken Sie vor bis zum nächsten Bahnhof. Zahlen Sie dem Eigentümer die doppelte Miete.', { k: 'nearest', t: 'bahn', s: true }),
      C('Die Bank zahlt Ihnen eine Dividende von 50 €.', { k: 'bank', v: 50 }),
      C('Sie kommen aus dem Gefängnis frei. (Karte aufheben)', { k: 'jailCard' }),
      C('Gehen Sie 3 Felder zurück.', { k: 'back', n: 3 }),
      C('Gehen Sie in das Gefängnis. Begeben Sie sich direkt dorthin und gehen Sie nicht über Los.', { k: 'jail' }),
      C('Machen Sie einen Ausflug zum Südbahnhof. Wenn Sie über Los kommen, ziehen Sie 200 € ein.', { k: 'moveTo', i: 5 }),
      C('Lassen Sie alle Ihre Häuser renovieren: 25 € pro Haus, 100 € pro Hotel.', { k: 'perBuilding', h: 25, hotel: 100 }),
      C('Sie werden zur Straßenausbesserung herangezogen: 40 € pro Haus, 115 € pro Hotel.', { k: 'perBuilding', h: 40, hotel: 115 }),
      C('Sie sind zum Vorstand gewählt worden. Zahlen Sie jedem Mitspieler 50 €.', { k: 'payEach', v: 50 }),
      C('Ihre Bausparkasse schüttet aus: 150 €.', { k: 'bank', v: 150 }),
      C('Strafzettel! Zahlen Sie 15 €.', { k: 'pay', v: 15 }),
    ]);
  }
  function communityDeck() {
    return shuffled([
      C('Rücken Sie vor bis auf Los. (Ziehen Sie 200 € ein.)', { k: 'moveTo', i: 0 }),
      C('Bankirrtum zu Ihren Gunsten. Ziehen Sie 200 € ein.', { k: 'bank', v: 200 }),
      C('Arztkosten. Zahlen Sie 50 €.', { k: 'pay', v: 50 }),
      C('Verkauf von Aktien. Ziehen Sie 50 € ein.', { k: 'bank', v: 50 }),
      C('Sie kommen aus dem Gefängnis frei. (Karte aufheben)', { k: 'jailCard' }),
      C('Gehen Sie in das Gefängnis. Begeben Sie sich direkt dorthin und gehen Sie nicht über Los.', { k: 'jail' }),
      C('Urlaubsgeld! Ziehen Sie 100 € ein.', { k: 'bank', v: 100 }),
      C('Steuerrückerstattung. Ziehen Sie 20 € ein.', { k: 'bank', v: 20 }),
      C('Sie haben Geburtstag. Jeder Mitspieler zahlt Ihnen 10 €.', { k: 'receiveEach', v: 10 }),
      C('Lebensversicherung fällig. Ziehen Sie 100 € ein.', { k: 'bank', v: 100 }),
      C('Krankenhauskosten. Zahlen Sie 100 €.', { k: 'pay', v: 100 }),
      C('Schulgeld. Zahlen Sie 50 €.', { k: 'pay', v: 50 }),
      C('Beratungshonorar. Ziehen Sie 25 € ein.', { k: 'bank', v: 25 }),
      C('Zweiter Preis im Schönheitswettbewerb. Ziehen Sie 10 € ein.', { k: 'bank', v: 10 }),
      C('Sie erben 100 €.', { k: 'bank', v: 100 }),
      C('Sie lassen Ihre Häuser renovieren: 40 € pro Haus, 115 € pro Hotel.', { k: 'perBuilding', h: 40, hotel: 115 }),
    ]);
  }

  // ---------- Basisoperationen ----------
  function pay(st, from, to, amount) {
    if (from) st.money[from] -= amount;
    if (to) st.money[to] += amount;
    if (from && to) {
      log(st, name(st, from) + ' zahlt ' + amount + ' € an ' + name(st, to));
      pushFx(st, { k: 'pay', from, to, v: amount });
    }
    else if (from) log(st, name(st, from) + ' zahlt ' + amount + ' € an die Bank');
    else if (to) log(st, name(st, to) + ' erhält ' + amount + ' € von der Bank');
    checkBankrupt(st, from, to);
  }
  function payEachPlayer(st, from, amount) {
    for (const pid of st.order) { if (pid !== from && !st.out[pid]) pay(st, from, pid, amount); }
  }
  function receiveFromEach(st, to, amount) {
    for (const pid of st.order) { if (pid !== to && !st.out[pid]) pay(st, pid, to, amount); }
  }
  function payPerBuilding(st, pid, perHouse, perHotel) {
    let cost = 0;
    for (const k in st.props) {
      const p = st.props[k];
      if (p.owner === pid && p.houses > 0) cost += p.houses === 5 ? perHotel : perHouse * p.houses;
    }
    if (cost > 0) pay(st, pid, null, cost); else log(st, name(st, pid) + ' hat keine Gebäude — nichts zu zahlen');
  }
  function movePlayerTo(st, pid, idx, collect) {
    const old = st.pos[pid];
    st.pos[pid] = idx;
    recordStep(st, pid, idx, true);
    if (collect && idx < old) { st.money[pid] += 200; log(st, name(st, pid) + ' zieht über Los: +200 €'); }
    log(st, name(st, pid) + ' rückt auf ' + S[idx].name);
    resolveSpace(st, pid);
  }
  function moveToNearest(st, pid, type, specialRent) {
    const p = st.pos[pid];
    const targets = type === 'bahn' ? [5, 15, 25, 35] : [12, 27];
    let idx = targets.find(t => t > p); if (idx === undefined) idx = targets[0];
    const passed = idx <= p;
    if (passed) { st.money[pid] += 200; log(st, name(st, pid) + ' zieht über Los: +200 €'); }
    st.pos[pid] = idx;
    recordStep(st, pid, idx, true);
    log(st, name(st, pid) + ' rückt auf ' + S[idx].name);
    if (specialRent) st.rentBoost = pid;
    resolveSpace(st, pid);
  }
  function sendToJail(st, pid) {
    st.pos[pid] = 10; st.jailed[pid] = 0;
    recordStep(st, pid, 10, true);
    log(st, name(st, pid) + ' geht ins Gefängnis');
    st.pending = null; st.phase = 'manage';
  }

  // ---------- Miete / Feldauflösung ----------
  function ownsGroup(st, pid, group) { return GROUPS[group].every(i => st.props[i] && st.props[i].owner === pid); }
  function rentFor(st, idx, dice) {
    const s = S[idx], p = st.props[idx];
    if (s.t === 'bahn') { const n = [5, 15, 25, 35].filter(i => st.props[i] && st.props[i].owner === p.owner).length; return 25 * Math.pow(2, n - 1); }
    if (s.t === 'werk') { const n = [12, 27].filter(i => st.props[i] && st.props[i].owner === p.owner).length; const mult = st.rentBoost === st.order[st.turn] ? 10 : (n === 2 ? 10 : 4); return mult * dice; }
    if (p.houses > 0) return s.rent[p.houses];
    if (ownsGroup(st, p.owner, s.group)) return 2 * s.rent[0];
    return s.rent[0];
  }

  function resolveSpace(st, pid) {
    const idx = st.pos[pid], s = S[idx];
    st.rentBoost = st.rentBoost === pid ? st.rentBoost : null;
    if (s.t === 'tax') { pay(st, pid, null, s.amount); st.phase = 'manage'; }
    else if (s.t === 'gotojail') { sendToJail(st, pid); }
    else if (s.t === 'chance' || s.t === 'community') {
      const card = s.t === 'chance' ? st.chance.shift() : st.community.shift();
      (s.t === 'chance' ? st.chance : st.community).push(card);
      log(st, name(st, pid) + ': ' + card.text);
      st.lastCard = card.text;
      st.lastCardType = s.t;
      st.cardSeq = (st.cardSeq || 0) + 1;
      st.phase = 'manage';
      // Weitere Züge dieser Aktion gehören zur Karte — separat animieren
      if (st.motion && st.motion.pid === pid) st.motion.cardSplit = true;
      runCard(st, pid, card);
      if (st.phase !== 'buy' && st.phase !== 'over') st.phase = st.pending ? 'buy' : st.phase;
    }
    else if (s.t === 'prop' || s.t === 'bahn' || s.t === 'werk') {
      const pr = st.props[idx];
      if (!pr || !pr.owner) {
        st.pending = { kind: 'buy', space: idx };
        st.phase = 'buy';
      } else if (pr.owner !== pid && !pr.mortgaged) {
        const rent = rentFor(st, idx, st.dice[0] + st.dice[1]);
        log(st, name(st, pid) + ' zahlt ' + rent + ' € Miete an ' + name(st, pr.owner));
        pay(st, pid, pr.owner, rent);
        st.rentBoost = null;
        st.phase = 'manage';
      } else st.phase = 'manage';
    }
    else st.phase = 'manage';
    if (st.money[pid] < 0) st.phase = 'manage'; // Konkurs-Check passiert in pay()
    if (st.status === 'finished') st.phase = 'over';
  }

  function checkBankrupt(st, debtor, creditor) {
    if (!debtor || st.money[debtor] >= 0) return;
    if (totalAssets(st, debtor) >= 0) { st.mustRaise = st.mustRaise || {}; st.mustRaise[debtor] = creditor || 'bank'; return; }
    declareBankrupt(st, debtor, creditor);
  }
  function totalAssets(st, pid) {
    let v = st.money[pid];
    for (const k in st.props) {
      const p = st.props[k];
      if (p.owner !== pid) continue;
      if (!p.mortgaged) v += Math.floor(S[k].price / 2);
      v += Math.floor(S[k].house * p.houses / 2);
    }
    return v;
  }
  function declareBankrupt(st, pid, creditor) {
    st.out[pid] = true;
    delete st.mustRaise[pid];
    log(st, name(st, pid) + ' ist bankrott!');
    pushFx(st, { k: 'out', pid });
    for (const k in st.props) {
      const p = st.props[k];
      if (p.owner !== pid) continue;
      if (creditor && creditor !== 'bank' && st.order.includes(creditor)) { p.owner = creditor; }
      else { p.owner = null; p.houses = 0; p.mortgaged = false; }
    }
    const alive = st.order.filter(x => !st.out[x]);
    if (alive.length === 1) { st.status = 'finished'; st.winner = alive[0]; log(st, name(st, alive[0]) + ' gewinnt!'); }
  }

  // ---------- Zugablauf ----------
  function nextTurn(st) {
    const n = st.order.length;
    do { st.turn = (st.turn + 1) % n; } while (st.out[st.order[st.turn]]);
    st.doubles = 0; st.pending = null; st.trade = null; st.auction = null;
    st.phase = st.jailed[st.order[st.turn]] !== undefined ? 'jail' : 'roll';
  }

  function canRollAgain(st, pid) {
    return st.status === 'playing' && st.doubles > 0 && st.dice?.[0] === st.dice?.[1] &&
      st.jailed[pid] === undefined && st.mustRaise[pid] === undefined && !st.out[pid];
  }

  function finishPurchase(st, pid) {
    st.pending = null;
    st.phase = canRollAgain(st, pid) ? 'roll' : 'manage';
  }

  function applyAction(st, pid, a) {
    // RTDB löscht leere Objekte — defensiv initialisieren
    st.mustRaise = st.mustRaise || {};
    st.out = st.out || {};
    st.pos = st.pos || {};
    st.money = st.money || {};
    st.props = st.props || {};
    st.jailed = st.jailed || {};
    st.jailCards = st.jailCards || {};
    st.log = st.log || [];
    if (st.status !== 'playing') return { ok: false, err: 'Spiel läuft nicht' };
    const me = st.order[st.turn];
    if (st.out[pid]) return { ok: false, err: 'Ausgeschieden' };

    // Auktion: jeder darf mitbieten
    if (st.auction) return auctionAction(st, pid, a);
    // Handelsangebot: nur Empfänger antwortet
    if (st.trade) return tradeAction(st, pid, a);
    if (pid !== me) {
      // Wer Geld auftreiben muss, darf das auch außerhalb seines Zugs
      if (st.mustRaise[pid] === undefined) return { ok: false, err: 'Nicht dein Zug' };
      if (!['mortgage', 'sellhouse', 'unmortgage', 'bankrupt'].includes(a.t))
        return { ok: false, err: 'Du musst erst Geld auftreiben.' };
    }
    // Während offener Schulden nur Geld auftreiben oder Konkurs
    if (st.mustRaise[pid] !== undefined && !['mortgage', 'sellhouse', 'unmortgage', 'bankrupt'].includes(a.t))
      return { ok: false, err: 'Erst Schulden begleichen (Hypothek/Gebäude verkaufen oder Konkurs).' };

    switch (a.t) {
      case 'roll': {
        if (st.phase === 'jail') {
          if (a.mode === 'pay') {
            if (st.money[pid] < 50) return { ok: false, err: 'Nicht genug Geld' };
            pay(st, pid, null, 50); delete st.jailed[pid]; st.phase = 'roll';
            return { ok: true };
          }
          if (a.mode === 'card') {
            if (!(st.jailCards[pid] > 0)) return { ok: false, err: 'Keine Karte' };
            st.jailCards[pid]--; delete st.jailed[pid]; st.phase = 'roll';
            log(st, name(st, pid) + ' nutzt die Gefängnisfrei-Karte');
            return { ok: true };
          }
          // jail roll
          rollDice(st, pid);
          log(st, name(st, pid) + ' würfelt ' + st.dice[0] + ' und ' + st.dice[1]);
          if (st.dice[0] === st.dice[1]) { delete st.jailed[pid]; movePlayer(st, pid, st.dice[0] + st.dice[1]); }
          else {
            st.jailed[pid]++;
            if (st.jailed[pid] >= 3) { log(st, name(st, pid) + ' muss 50 € zahlen'); pay(st, pid, null, 50); delete st.jailed[pid]; movePlayer(st, pid, st.dice[0] + st.dice[1]); }
            else { log(st, name(st, pid) + ' bleibt im Gefängnis'); st.phase = 'jailend'; }
          }
          return { ok: true };
        }
        if (st.phase !== 'roll') return { ok: false, err: 'Schon gewürfelt' };
        rollDice(st, pid);
        log(st, name(st, pid) + ' würfelt ' + st.dice[0] + ' und ' + st.dice[1]);
        if (st.dice[0] === st.dice[1]) {
          st.doubles++;
          if (st.doubles >= 3) { log(st, 'Drei Pasch hintereinander — Gefängnis!'); sendToJail(st, pid); st.phase = 'jailend'; return { ok: true }; }
        }
        movePlayer(st, pid, st.dice[0] + st.dice[1]);
        // Pasch → nochmal würfeln (wenn Feld nicht in Buy/Ende mündete)
        if (st.phase === 'manage' && canRollAgain(st, pid)) st.phase = 'roll';
        return { ok: true };
      }
      case 'buy': {
        if (st.phase !== 'buy' || !st.pending || st.pending.kind !== 'buy') return { ok: false, err: 'Nichts zu kaufen' };
        const idx = st.pending.space, s = S[idx];
        if (st.money[pid] < s.price) return { ok: false, err: 'Nicht genug Geld' };
        pay(st, pid, null, s.price);
        st.props[idx] = { owner: pid, houses: 0, mortgaged: false };
        log(st, name(st, pid) + ' kauft ' + s.name + ' für ' + s.price + ' €');
        finishPurchase(st, pid);
        return { ok: true };
      }
      case 'auction': {
        if (st.phase !== 'buy' || !st.pending) return { ok: false, err: 'Keine Auktion möglich' };
        const idx = st.pending.space;
        st.auction = { space: idx, high: 0, bidder: null, left: st.order.filter(p => !st.out[p]), idx: 0 };
        st.pending = null;
        log(st, 'Versteigerung von ' + S[idx].name);
        return { ok: true };
      }
      case 'build': {
        if (!ownProp(st, pid, a.space)) return { ok: false, err: 'Nicht dein Grundstück' };
        const idx = a.space, s = S[idx], p = st.props[idx];
        if (s.t !== 'prop' || p.mortgaged) return { ok: false, err: 'Hier kann nicht gebaut werden' };
        if (!ownsGroup(st, pid, s.group)) return { ok: false, err: 'Du brauchst die ganze Farbgruppe' };
        if (p.houses >= 5) return { ok: false, err: 'Hotel erreicht' };
        const others = GROUPS[s.group].filter(i => i !== idx).map(i => st.props[i]);
        if (others.some(o => o.mortgaged || o.houses < p.houses)) return { ok: false, err: 'Gleichmäßig bauen (erst die anderen)' };
        if (st.money[pid] < s.house) return { ok: false, err: 'Nicht genug Geld' };
        pay(st, pid, null, s.house);
        p.houses++;
        log(st, name(st, pid) + ' baut ' + (p.houses === 5 ? 'ein Hotel' : 'ein Haus') + ' auf ' + s.name);
        settle(st, pid);
        return { ok: true };
      }
      case 'sellhouse': {
        if (!ownProp(st, pid, a.space)) return { ok: false, err: 'Nicht dein Grundstück' };
        const idx = a.space, s = S[idx], p = st.props[idx];
        if (p.houses <= 0) return { ok: false, err: 'Kein Gebäude' };
        const others = GROUPS[s.group].filter(i => i !== idx).map(i => st.props[i]);
        if (others.some(o => o.houses > p.houses)) return { ok: false, err: 'Gleichmäßig abreißen' };
        p.houses--;
        st.money[pid] += Math.floor(s.house / 2);
        log(st, name(st, pid) + ' verkauft ein Gebäude auf ' + s.name + ' für ' + Math.floor(s.house / 2) + ' €');
        settle(st, pid);
        return { ok: true };
      }
      case 'mortgage': {
        if (!ownProp(st, pid, a.space)) return { ok: false, err: 'Nicht dein Grundstück' };
        const idx = a.space, s = S[idx], p = st.props[idx];
        if (p.mortgaged) return { ok: false, err: 'Schon belastet' };
        if (s.group && GROUPS[s.group].some(i => st.props[i] && st.props[i].houses > 0)) return { ok: false, err: 'Erst Gebäude der Gruppe verkaufen' };
        p.mortgaged = true;
        const v = Math.floor(s.price / 2);
        st.money[pid] += v;
        log(st, name(st, pid) + ' belastet ' + s.name + ' für ' + v + ' €');
        settle(st, pid);
        return { ok: true };
      }
      case 'unmortgage': {
        if (!ownProp(st, pid, a.space)) return { ok: false, err: 'Nicht dein Grundstück' };
        const idx = a.space, s = S[idx], p = st.props[idx];
        if (!p.mortgaged) return { ok: false, err: 'Nicht belastet' };
        const v = Math.ceil(s.price / 2 * 1.1);
        if (st.money[pid] < v) return { ok: false, err: 'Nicht genug Geld (' + v + ' €)' };
        pay(st, pid, null, v);
        p.mortgaged = false;
        log(st, name(st, pid) + ' löst ' + s.name + ' aus für ' + v + ' €');
        settle(st, pid);
        return { ok: true };
      }
      case 'trade': {
        if (!st.order.includes(a.to) || st.out[a.to]) return { ok: false, err: 'Ungültiger Partner' };
        if (!validTrade(st, pid, a)) return { ok: false, err: 'Angebot ungültig' };
        st.trade = { from: pid, to: a.to, give: a.give || [], take: a.take || [], giveMoney: a.giveMoney || 0, takeMoney: a.takeMoney || 0, giveCard: !!a.giveCard, takeCard: !!a.takeCard };
        log(st, name(st, pid) + ' macht ' + name(st, a.to) + ' ein Angebot');
        return { ok: true };
      }
      case 'bankrupt': {
        if ((st.mustRaise[pid] === undefined) && st.money[pid] >= 0) return { ok: false, err: 'Nicht bankrott' };
        declareBankrupt(st, pid, st.mustRaise[pid] === 'bank' ? null : st.mustRaise[pid]);
        if (st.status === 'playing' && pid === me) nextTurn(st);
        return { ok: true };
      }
      case 'end': {
        if (Object.keys(st.mustRaise).length) return { ok: false, err: 'Erst müssen alle Schulden begleichen sein (Hypothek/Gebäude verkaufen oder Konkurs)' };
        if (st.phase === 'jailend' || st.phase === 'manage' || st.phase === 'buy') {
          if (canRollAgain(st, pid)) {
            finishPurchase(st, pid);
            return { ok: true };
          }
          nextTurn(st);
          return { ok: true };
        }
        return { ok: false, err: 'Erst würfeln' };
      }
    }
    return { ok: false, err: 'Unbekannte Aktion' };
  }

  function settle(st, pid) { if (st.mustRaise[pid] !== undefined && st.money[pid] >= 0) delete st.mustRaise[pid]; }
  function ownProp(st, pid, idx) { return st.props[idx] && st.props[idx].owner === pid; }
  function rollDice(st, pid) {
    st.dice = roll();
    st.rollSeq = (st.rollSeq || 0) + 1;
    st.motion = { pid, steps: [] };
  }
  function recordStep(st, pid, space, jump = false) {
    if (st.motion && st.motion.pid === pid && Array.isArray(st.motion.steps)) {
      const step = { space, jump };
      if (st.motion.cardSplit) (st.motion.cardSteps ||= []).push(step);
      else st.motion.steps.push(step);
    }
  }
  function movePlayer(st, pid, steps) {
    const old = st.pos[pid];
    st.pos[pid] = (old + steps) % 40;
    for (let i = 1; i <= steps; i++) recordStep(st, pid, (old + i) % 40);
    if (st.pos[pid] < old) { st.money[pid] += 200; log(st, name(st, pid) + ' zieht über Los: +200 €'); }
    log(st, name(st, pid) + ' rückt auf ' + S[st.pos[pid]].name);
    resolveSpace(st, pid);
  }
  function validTrade(st, pid, a) {
    const give = a.give || [], take = a.take || [];
    const given = a.giveMoney || 0, taken = a.takeMoney || 0;
    if (![given, taken].every(x => Number.isSafeInteger(x) && x >= 0)) return false;
    if (pid === a.to || (!give.length && !take.length && !given && !taken && !a.giveCard && !a.takeCard)) return false;
    if (!give.every(i => ownProp(st, pid, i) && !st.props[i].houses)) return false;
    if (!take.every(i => ownProp(st, a.to, i) && !st.props[i].houses)) return false;
    if ((a.giveMoney || 0) > st.money[pid] || (a.takeMoney || 0) > st.money[a.to]) return false;
    if (a.giveCard && !(st.jailCards[pid] > 0)) return false;
    if (a.takeCard && !(st.jailCards[a.to] > 0)) return false;
    // auf bebauten Grundstücken nicht handelbar
    if (give.concat(take).some(i => st.props[i].houses > 0)) return false;
    return true;
  }
  function auctionAction(st, pid, a) {
    const au = st.auction;
    if (!au.left.includes(pid)) return { ok: false, err: 'Du bist raus aus der Auktion' };
    const cur = au.left[au.idx];
    if (pid !== cur) return { ok: false, err: 'Du bist nicht am Zug' };
    if (a.t === 'bid') {
      const v = a.amount | 0;
      if (v < au.high + 10) return { ok: false, err: 'Mindestens ' + (au.high + 10) + ' € bieten' };
      if (v > st.money[pid]) return { ok: false, err: 'Nicht genug Geld' };
      au.high = v; au.bidder = pid;
      log(st, name(st, pid) + ' bietet ' + v + ' €');
    } else if (a.t === 'pass') {
      au.left.splice(au.idx, 1);
      log(st, name(st, pid) + ' steigt aus');
      if (au.idx >= au.left.length) au.idx = 0;
    } else return { ok: false, err: 'Unbekannte Aktion' };
    if (a.t === 'bid') au.idx = (au.idx + 1) % au.left.length;
    // Der Höchstbietende erhält den Zuschlag, sobald alle anderen passen.
    if (!au.left.length || (au.left.length === 1 && au.left[0] === au.bidder)) {
      const win = au.bidder;
      if (au.bidder) {
        pay(st, win, null, au.high);
        st.props[au.space] = { owner: win, houses: 0, mortgaged: false };
        log(st, name(st, win) + ' ersteigert ' + S[au.space].name + ' für ' + au.high + ' €');
      } else {
        log(st, 'Niemand bietet — ' + S[au.space].name + ' bleibt der Bank');
      }
      st.auction = null;
      finishPurchase(st, st.order[st.turn]);
    } else if (au.left[au.idx] === au.bidder) {
      au.idx = (au.idx + 1) % au.left.length;
    }
    return { ok: true };
  }
  function tradeAction(st, pid, a) {
    const tr = st.trade;
    if (a.t === 'cancel' && pid === tr.from) { st.trade = null; log(st, 'Angebot zurückgezogen'); return { ok: true }; }
    if (pid !== tr.to) return { ok: false, err: 'Nur ' + name(st, tr.to) + ' antwortet' };
    if (a.t === 'accept') {
      for (const i of tr.give || []) st.props[i].owner = tr.to;
      for (const i of tr.take || []) st.props[i].owner = tr.from;
      st.money[tr.from] -= tr.giveMoney; st.money[tr.to] += tr.giveMoney;
      st.money[tr.to] -= tr.takeMoney; st.money[tr.from] += tr.takeMoney;
      if (tr.giveCard) { st.jailCards[tr.from]--; st.jailCards[tr.to] = (st.jailCards[tr.to] || 0) + 1; }
      if (tr.takeCard) { st.jailCards[tr.to]--; st.jailCards[tr.from] = (st.jailCards[tr.from] || 0) + 1; }
      log(st, 'Handel angenommen');
      pushFx(st, { k: 'trade', from: tr.from, to: tr.to, give: tr.give, take: tr.take, giveMoney: tr.giveMoney, takeMoney: tr.takeMoney, giveCard: tr.giveCard, takeCard: tr.takeCard });
      st.trade = null;
      checkBankrupt(st, tr.from, tr.to); checkBankrupt(st, tr.to, tr.from);
      return { ok: true };
    }
    if (a.t === 'decline') { st.trade = null; log(st, name(st, pid) + ' lehnt den Handel ab'); return { ok: true }; }
    return { ok: false, err: 'Unbekannte Aktion' };
  }

  function deal(state) {
    const st = state;
    st.status = 'playing';
    st.pos = {}; st.money = {}; st.props = {}; st.out = {}; st.jailed = {}; st.jailCards = {};
    for (const pid of st.order) { st.pos[pid] = 0; st.money[pid] = 1500; st.jailCards[pid] = 0; }
    st.turn = 0; st.doubles = 0; st.dice = null; st.rollSeq = 0; st.motion = null;
    st.round = (st.round || 0) + 1;
    st.chance = chanceDeck(); st.community = communityDeck();
    st.pending = null; st.auction = null; st.trade = null;
    st.phase = 'roll'; st.winner = null; st.mustRaise = {}; st.rentBoost = null;
    st.lastCard = null; st.lastCardType = null; st.cardSeq = 0;
    st.fx = {}; st.fxSeq = 0;
    st.log = ['Spiel gestartet — viel Glück!'];
    return st;
  }

  return { S, GROUPS, GROUP_CSS, deal, applyAction, canRollAgain, ownsGroup, rentFor, totalAssets };
})();

if (typeof module !== 'undefined') module.exports = Mono;
