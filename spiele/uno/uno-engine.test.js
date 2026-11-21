const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./uno-engine.js');

function game(hands) {
  const top = { c: 'r', v: '3' };
  const players = { a: { name: 'Ada' }, b: { name: 'Ben' }, c: { name: 'Cem' } };
  return { status: 'playing', players, order: Object.keys(players), hands, top,
    currentColor: top.c, discard: [top], deck: [], turn: 0, dir: 1, log: [] };
}

test('UNO is automatic and never adds penalty cards', () => {
  const card = { c: 'r', v: '3' };
  const other = { c: 'r', v: '5' };
  const state = game({ a: [card, other], b: [card], c: [card] });
  assert.equal(E.applyAction(state, 'a', { t: 'play', card }).ok, true);
  assert.deepEqual(state.hands.a, [other]);
  assert.deepEqual(state.move, { n: 1, t: 'play', pid: 'a', card, uno: true });
  assert.match(state.log.at(-1), /Ada ruft UNO!/);
  state.turn = 0;
  assert.equal(E.applyAction(state, 'a', { t: 'play', card: other }).ok, true);
  assert.equal(state.winner, 'a');
  assert.equal(state.move.uno, undefined);
});

test('draw effects carry the recipient and cards actually drawn', () => {
  const card = { c: 'w', v: 'wild4' };
  const filler = { c: 'b', v: '9' };
  const state = game({ a: [card, filler], b: [filler], c: [filler] });
  state.deck = [filler];
  assert.equal(E.applyAction(state, 'a', { t: 'play', card, color: 'b' }).ok, true);
  assert.equal(state.currentColor, 'b');
  assert.equal(state.move.target, 'b');
  assert.equal(state.move.count, 2);
  assert.equal(state.hands.b.length, 3);
  assert.equal(state.turn, 2);
  assert.deepEqual(state.discard, [card]);
});

test('draw with no remaining cards passes without adding an undefined card', () => {
  const state = game({ a: [], b: [], c: [] });
  delete state.deck; // Firebase omits empty arrays.
  assert.equal(E.applyAction(state, 'a', { t: 'draw' }).ok, true);
  assert.deepEqual(state.hands.a, []);
  assert.equal(state.move.t, 'pass');
  assert.equal(state.turn, 1);
});

test('bot decisions respect the draw and wild card rules', () => {
  const wild = { c: 'w', v: 'wild' };
  const plusFour = { c: 'w', v: 'wild4' };
  const red = { c: 'r', v: '5' };
  const green = { c: 'g', v: '3' };
  const state = game({ a: [plusFour, red, green], b: [], c: [] });
  assert.deepEqual(E.botAction(state, 'a'), { t: 'play', card: red });
  state.drew = green;
  assert.deepEqual(E.botAction(state, 'a'), { t: 'play', card: green });
  state.drew = wild;
  state.hands.a = [wild, green];
  assert.deepEqual(E.botAction(state, 'a'), { t: 'play', card: wild, color: 'g' });
});

for (const size of [2, 3, 5]) {
  for (const dir of [1, -1]) {
    test(`+2 and +4: next player for ${size} seats, direction ${dir}`, () => {
      for (const [v, c, count] of [['d2', 'r', 2], ['wild4', 'w', 4]]) {
        const card = { c, v };
        const rest = { c: 'b', v: '9' };
        const state = game({ a: [card, rest], b: [rest], c: [rest], d: [rest], e: [rest] });
        state.order = ['a', 'b', 'c', 'd', 'e'].slice(0, size);
        state.dir = dir;
        state.deck = Array(5).fill(rest);
        const target = state.order[(size + dir) % size];
        state.players[target] ??= { name: target };
        assert.equal(E.applyAction(state, 'a', { t: 'play', card, color: 'b' }).ok, true);
        assert.equal(state.move.target, target);
        assert.equal(state.move.count, count);
        assert.equal(state.hands[target].length, 1 + count);
        assert.equal(state.order[state.turn], state.order[(size + dir * (size === 2 ? 1 : 2)) % size]);
        assert.notEqual(state.order[state.turn], 'a');
        assert.match(state.log.at(-1), size === 2 ? /und ist dran$/ : /und setzt aus$/);
        assert.equal(state.drew, null);
      }
    });
  }
}

test('skip and reverse only repeat the turn in a duel; reverse changes direction', () => {
  for (const size of [2, 3]) {
    for (const v of ['skip', 'rev']) {
      const card = { c: 'r', v };
      const state = game({ a: [card, { c: 'b', v: '7' }], b: [], c: [] });
      state.order = state.order.slice(0, size);
      assert.equal(E.applyAction(state, 'a', { t: 'play', card }).ok, true);
      assert.equal(state.dir, v === 'rev' ? -1 : 1);
      assert.equal(state.order[state.turn], size === 2 ? 'a' : 'c');
      if (size === 2) assert.match(state.log.at(-1), /Ada ist noch einmal dran/);
    }
  }
});

test('matching color, matching value and wild cards all block drawing', () => {
  for (const card of [{ c: 'r', v: '5' }, { c: 'g', v: '3' }, { c: 'w', v: 'wild' }, { c: 'w', v: 'wild4' }]) {
    const state = game({ a: [card], b: [], c: [] });
    state.deck = [{ c: 'y', v: '9' }];
    const before = structuredClone(state);
    assert.equal(E.canDraw(state.hands.a, state), false);
    assert.equal(E.applyAction(state, 'a', { t: 'draw' }).ok, false);
    assert.deepEqual(state, before);
    assert.equal(E.botAction(state, 'a').t, 'play');
  }
});

test('an unplayable draw advances and a playable draw allows only the new card or pass', () => {
  const other = { c: 'y', v: '9' };
  const playable = { c: 'r', v: '6' };
  for (const next of [{ t: 'play', card: playable }, { t: 'pass' }, null]) {
    const state = game({ a: [other], b: [], c: [] });
    state.deck = [next ? playable : other];
    assert.equal(E.canDraw(state.hands.a, state), true);
    assert.equal(E.botAction(state, 'a').t, 'draw');
    assert.equal(E.applyAction(state, 'a', { t: 'draw' }).ok, true);
    if (next) {
      assert.equal(state.turn, 0);
      assert.equal(E.canDraw(state.hands.a, state), false);
      assert.equal(E.applyAction(state, 'a', { t: 'draw' }).ok, false);
      assert.equal(E.applyAction(state, 'a', { t: 'play', card: other }).ok, false);
      assert.equal(E.applyAction(state, 'a', next).ok, true);
    }
    assert.equal(state.turn, 1);
    assert.equal(state.drew, null);
  }
});

test('wild requires a color, then passes the turn with that color active', () => {
  const card = { c: 'w', v: 'wild' };
  const state = game({ a: [card, { c: 'r', v: '1' }], b: [], c: [] });
  assert.equal(E.applyAction(state, 'a', { t: 'play', card }).ok, false);
  assert.equal(state.turn, 0);
  assert.equal(E.applyAction(state, 'a', { t: 'play', card, color: 'y' }).ok, true);
  assert.equal(state.currentColor, 'y');
  assert.equal(state.turn, 1);
});

test('an old action cannot play a second card when skip keeps the same player', () => {
  const card = { c: 'r', v: 'skip' };
  const state = game({ a: [card, card], b: [] });
  state.order = ['a', 'b'];
  const action = { t: 'play', card, revision: E.revision(state) };
  assert.equal(E.applyAction(state, 'a', action).ok, true);
  assert.equal(state.turn, 0);
  assert.equal(E.applyAction(state, 'a', action).ok, false);
  assert.equal(state.hands.a.length, 1);
  E.deal(state);
  assert.equal(E.applyAction(state, 'a', action).ok, false);
});

test('the starting discard is a number so no action is implied before turn one', t => {
  t.mock.method(Math, 'random', () => .9999);
  const state = E.deal(game({}));
  assert.match(state.top.v, /^\d$/);
  assert.equal(state.turn, 0);
  assert.equal(state.hands.a.length, 7);
  assert.equal(state.deck.length + 1 + 7 * state.order.length, 108);
});
