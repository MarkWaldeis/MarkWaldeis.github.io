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
