'use strict';

function makeBuilder(w, h) {
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  const B = { g, w, h };
  B.inside = (x, y) => x >= 0 && x < w && y >= 0 && y < h;
  B.set = (x, y, ch) => { if (B.inside(x, y)) g[y][x] = ch; };
  B.fill = (x0, x1, y0, y1, ch) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (B.inside(x, y)) g[y][x] = ch;
  };
  B.ground = (x0, x1, top = 14) => B.fill(x0, x1, top, h - 1, '#');
  B.block = (x, y, w2 = 1, hgt = 1) => B.fill(x, x + w2 - 1, y, y + hgt - 1, '#');
  B.plat = (x, y, len) => B.fill(x, x + len - 1, y, y, '-');
  B.row = (x, y, len, ch) => B.fill(x, x + len - 1, y, y, ch);
  return B;
}

function serialize(B) { return B.g.map(r => r.join('')); }

function defLevel(o) {
  const h = 16;
  const B = makeBuilder(o.width, h);
  o.build(B);
  return { name: o.name, world: o.world, theme: o.theme, hint: o.hint || '', grid: serialize(B), w: o.width, h };
}

const LEVELS = [

  defLevel({
    name: 'Sonnenwiese', world: 'Grüne Hügel', theme: 'green',
    hint: 'Laufen: ← → oder A D · Springen: LEERTASTE',
    width: 100,
    build(B) {
      B.set(2, 13, 'P');
      B.ground(0, 27); B.ground(31, 55); B.ground(59, 99);
      B.plat(20, 12, 3); B.row(20, 11, 3, 'o');
      B.row(8, 12, 3, 'o'); B.row(13, 11, 2, 'o');
      B.row(33, 12, 3, 'o');
      B.plat(44, 12, 3); B.row(44, 11, 3, 'o');
      B.row(63, 11, 3, 'o'); B.plat(63, 12, 3);
      B.row(78, 12, 4, 'o');
      B.set(44, 13, 'E'); B.set(49, 13, 'E'); B.set(72, 13, 'E');
      B.block(41, 13, 1, 1); B.block(52, 13, 1, 1); B.block(62, 13, 1, 1);
      B.set(88, 13, 's'); B.row(87, 9, 3, 'o'); B.set(88, 8, 'o');
      B.set(96, 13, 'G');
    }
  }),

  defLevel({
    name: 'Hügellauf', world: 'Grüne Hügel', theme: 'green',
    hint: 'Die Hügel werden steiler – bleibt dran!',
    width: 112,
    build(B) {
      B.set(2, 13, 'P');
      B.ground(0, 17);
      B.ground(18, 27, 12);
      B.ground(28, 45);
      B.ground(46, 53, 12);
      B.ground(54, 61, 10);
      B.ground(65, 74, 12);
      B.ground(75, 111);
      B.row(6, 12, 3, 'o');
      B.row(20, 10, 4, 'o');
      B.plat(34, 12, 3); B.row(34, 11, 3, 'o');
      B.row(48, 10, 3, 'o');
      B.row(56, 8, 4, 'o');
      B.set(63, 11, 'M');
      B.row(68, 10, 4, 'o');
      B.set(70, 11, 'C');
      B.set(77, 13, 's'); B.row(76, 7, 4, 'o');
      B.set(87, 11, 'M');
      B.row(92, 12, 4, 'o');
      B.set(33, 13, 'E'); B.set(51, 11, 'E'); B.set(70, 8, 'F'); B.set(95, 13, 'E'); B.set(102, 13, 'E');
      B.set(108, 13, 'G');
    }
  }),

  defLevel({
    name: 'Wipfelpfad', world: 'Grüne Hügel', theme: 'green',
    hint: 'Klettert durch die Baumkronen – unten lauert Gefahr!',
    width: 118,
    build(B) {
      B.set(2, 13, 'P');
      B.ground(0, 117);
      B.plat(18, 12, 4); B.row(19, 11, 2, 'o');
      B.plat(23, 10, 3); B.row(23, 9, 3, 'o');
      B.plat(27, 12, 3);
      B.plat(33, 10, 4); B.row(34, 9, 2, 'o');
      B.plat(39, 8, 3); B.set(40, 7, 'C'); B.set(39, 7, 'o'); B.set(41, 7, 'o');
      B.plat(43, 10, 3);
      B.plat(47, 12, 4); B.row(48, 11, 2, 'o');
      B.plat(54, 10, 3); B.row(54, 9, 3, 'o');
      B.plat(58, 12, 4);
      B.plat(64, 10, 3); B.set(65, 9, 'o');
      B.plat(68, 12, 4);
      B.plat(74, 10, 3); B.row(74, 9, 3, 'o');
      B.plat(78, 12, 4);
      B.plat(84, 10, 3); B.set(85, 9, 'o');
      B.plat(88, 12, 4);
      B.plat(94, 10, 3); B.set(95, 9, 'o');
      B.plat(98, 12, 4);
      B.row(26, 13, 6, '^'); B.row(38, 13, 8, '^'); B.row(52, 13, 6, '^');
      B.row(68, 13, 6, '^'); B.row(82, 13, 8, '^');
      B.set(24, 4, 'F'); B.set(42, 4, 'F'); B.set(56, 4, 'F'); B.set(71, 4, 'F'); B.set(89, 5, 'F');
      B.row(106, 12, 3, 'o');
      B.set(114, 13, 'G');
    }
  }),

  defLevel({
    name: 'Mauerbrecher', world: 'Grüne Hügel', theme: 'green',
    hint: 'Federfedern katapultieren euch über Mauern!',
    width: 126,
    build(B) {
      B.set(2, 13, 'P');
      B.ground(0, 55);
      B.ground(64, 124);
      B.row(20, 12, 3, '-'); B.row(20, 11, 3, 'o');
      B.set(36, 13, 's'); B.row(35, 7, 5, 'o'); B.set(37, 6, 'o');
      B.fill(40, 41, 9, 15, '#'); B.set(40, 7, 'o'); B.set(41, 7, 'o');
      B.row(50, 12, 3, 'o');
      B.row(56, 12, 5, 'B'); B.row(56, 11, 5, 'o');
      B.set(70, 13, 'C');
      B.set(80, 13, 's'); B.row(79, 7, 3, 'o');
      B.fill(84, 85, 10, 15, '#');
      B.row(90, 13, 3, '^');
      B.plat(95, 12, 3); B.row(95, 11, 3, 'o');
      B.set(30, 13, 'E'); B.set(48, 13, 'E'); B.set(74, 13, 'E'); B.set(100, 13, 'E'); B.set(108, 13, 'E');
      B.set(60, 3, 'F'); B.set(104, 9, 'F');
      B.row(114, 12, 4, 'o');
      B.set(122, 13, 'G');
    }
  }),

  defLevel({
    name: 'Frostpass', world: 'Frostwelt', theme: 'ice',
    hint: 'Achtung, glatt! Der Untergrund ist rutschig.',
    width: 108,
    build(B) {
      B.set(2, 13, 'P');
      B.ground(0, 20);
      B.ground(21, 30, 12);
      B.ground(31, 40);
      B.plat(38, 12, 3); B.row(38, 11, 3, 'o');
      B.ground(41, 52, 11);
      B.ground(53, 62, 13);
      B.ground(66, 107);
      B.row(5, 12, 3, 'o');
      B.row(23, 10, 4, 'o');
      B.plat(34, 12, 3); B.row(34, 11, 3, 'o');
      B.row(45, 9, 4, 'o');
      B.plat(57, 11, 3); B.row(57, 10, 3, 'o');
      B.row(70, 12, 4, 'o');
      B.plat(80, 12, 3); B.row(80, 11, 3, 'o');
      B.set(25, 11, 'E'); B.set(46, 10, 'E'); B.set(72, 13, 'E'); B.set(86, 13, 'E'); B.set(94, 13, 'E');
      B.set(64, 12, 'M');
      B.set(90, 13, 's'); B.row(89, 8, 3, 'o');
      B.set(104, 13, 'G');
    }
  }),

  defLevel({
    name: 'Gletscherspalte', world: 'Frostwelt', theme: 'ice',
    hint: 'Überquert die Spalte – oben wartet der Ausgang.',
    width: 120,
    build(B) {
      B.set(2, 13, 'P');
      B.ground(0, 18);
      B.fill(19, 22, 12, 15, '#');
      B.fill(23, 26, 10, 15, '#');
      B.fill(27, 30, 8, 15, '#'); B.set(28, 6, 'C');
      B.fill(31, 119, 7, 15, '#');
      B.row(52, 6, 3, '^'); B.row(74, 6, 3, '^');
      B.row(34, 6, 4, 'o'); B.row(56, 6, 4, 'o'); B.row(84, 6, 4, 'o'); B.row(98, 6, 4, 'o');
      B.plat(58, 4, 3); B.row(58, 3, 3, 'o');
      B.plat(90, 4, 3); B.row(90, 3, 3, 'o');
      B.set(36, 6, 'E'); B.set(56, 6, 'E'); B.set(70, 6, 'E'); B.set(95, 6, 'E'); B.set(108, 6, 'E');
      B.set(46, 3, 'F'); B.set(64, 3, 'F'); B.set(80, 2, 'F');
      B.set(116, 6, 'G');
    }
  }),

  defLevel({
    name: 'Eiskathedralen', world: 'Frostwelt', theme: 'ice',
    hint: 'Findet den Schlüssel, um das Eisportal zu öffnen!',
    width: 124,
    build(B) {
      B.set(2, 13, 'P');
      B.fill(0, 123, 0, 1, '#');
      B.ground(0, 123);
      B.block(20, 12, 2, 2); B.block(34, 12, 2, 2); B.block(48, 12, 2, 2);
      B.set(58, 13, 's');
      B.plat(61, 10, 5); B.set(63, 9, 'K'); B.set(61, 9, 'o'); B.set(65, 9, 'o');
      B.set(76, 13, 'C');
      B.fill(82, 82, 9, 13, 'D');
      B.block(92, 12, 2, 2); B.block(106, 12, 2, 2);
      B.row(88, 13, 3, '^'); B.row(112, 13, 3, '^');
      B.set(90, 11, 'F'); B.set(100, 11, 'F');
      B.row(26, 11, 3, 'o'); B.row(42, 11, 3, 'o'); B.row(68, 12, 4, 'o'); B.row(98, 11, 3, 'o'); B.row(117, 12, 3, 'o');
      B.set(120, 13, 'G');
    }
  }),

  defLevel({
    name: 'Eiskönig-Pass', world: 'Frostwelt', theme: 'ice',
    hint: 'Federt euch über die Spikefelder auf die andere Seite!',
    width: 132,
    build(B) {
      B.set(2, 13, 'P');
      B.ground(0, 16);
      B.ground(17, 61);
      B.ground(62, 70);
      B.ground(71, 110);
      B.ground(111, 131);
      B.set(18, 13, 's'); B.set(19, 13, 's'); B.row(20, 13, 5, '^');
      B.set(25, 13, 's'); B.set(26, 13, 's'); B.row(27, 13, 5, '^');
      B.set(32, 13, 's'); B.set(33, 13, 's'); B.row(34, 13, 5, '^');
      B.set(39, 13, 's'); B.set(40, 13, 's'); B.row(41, 13, 5, '^');
      B.set(46, 13, 's'); B.set(47, 13, 's'); B.row(48, 13, 5, '^');
      B.set(53, 13, 's'); B.set(54, 13, 's'); B.row(55, 13, 4, '^');
      B.row(20, 8, 3, 'o'); B.set(22, 7, 'o'); B.row(34, 8, 3, 'o'); B.set(36, 7, 'o'); B.row(48, 8, 3, 'o');
      B.set(63, 13, 'C'); B.set(66, 13, 'E');
      B.set(72, 13, 's'); B.set(73, 13, 's'); B.row(74, 13, 5, '^');
      B.set(79, 13, 's'); B.set(80, 13, 's'); B.row(81, 13, 5, '^');
      B.set(86, 13, 's'); B.set(87, 13, 's'); B.row(88, 13, 5, '^');
      B.set(93, 13, 's'); B.set(94, 13, 's'); B.row(95, 13, 5, '^');
      B.set(100, 13, 's'); B.set(101, 13, 's'); B.row(102, 13, 5, '^');
      B.set(107, 13, 's'); B.set(108, 13, 's'); B.row(109, 13, 1, '^');
      B.row(74, 8, 3, 'o'); B.set(76, 7, 'o'); B.row(88, 8, 3, 'o'); B.set(90, 7, 'o');
      B.set(115, 10, 'F'); B.set(122, 13, 'E');
      B.row(113, 12, 4, 'o'); B.row(125, 12, 3, 'o');
      B.set(128, 13, 'G');
    }
  }),

  defLevel({
    name: 'Aschefelder', world: 'Vulkanschlot', theme: 'volcano',
    hint: 'Lava brennt! Klettert schnell wieder heraus.',
    width: 118,
    build(B) {
      B.set(2, 13, 'P');
      B.ground(0, 21);
      B.fill(22, 24, 14, 15, '~');
      B.ground(25, 40);
      B.fill(41, 47, 14, 15, '~'); B.row(41, 12, 7, 'B'); B.row(41, 11, 7, 'o');
      B.ground(48, 60);
      B.fill(61, 67, 14, 15, '~'); B.fill(62, 66, 13, 15, '#');
      B.ground(68, 80); B.set(70, 13, 'C');
      B.fill(81, 88, 14, 15, '~'); B.set(84, 12, 'M');
      B.ground(89, 117);
      B.row(30, 12, 3, 'o'); B.row(52, 12, 3, 'o'); B.row(74, 12, 3, 'o'); B.row(94, 12, 3, 'o'); B.row(103, 12, 4, 'o');
      B.set(32, 13, 'E'); B.set(52, 13, 'E'); B.set(74, 13, 'E'); B.set(95, 13, 'E'); B.set(105, 13, 'E');
      B.block(58, 13, 1, 1);
      B.set(45, 9, 'F'); B.set(79, 9, 'F'); B.set(101, 9, 'F');
      B.set(114, 13, 'G');
    }
  }),

  defLevel({
    name: 'Glutgrat', world: 'Vulkanschlot', theme: 'volcano',
    hint: 'Nur bewegliche Plattformen tragen euch über den Grat!',
    width: 128,
    build(B) {
      B.set(2, 13, 'P');
      B.ground(0, 19);
      B.fill(20, 102, 14, 15, '~');
      B.fill(30, 32, 12, 15, '#'); B.fill(44, 46, 12, 15, '#'); B.fill(58, 60, 12, 15, '#');
      B.fill(72, 74, 12, 15, '#'); B.fill(86, 88, 12, 15, '#'); B.fill(100, 102, 12, 15, '#');
      B.ground(103, 127);
      B.set(25, 12, 'M'); B.set(38, 12, 'M'); B.set(52, 12, 'M'); B.set(66, 12, 'M'); B.set(80, 12, 'M'); B.set(94, 12, 'M');
      B.set(73, 11, 'C');
      B.set(31, 11, 'o'); B.set(45, 11, 'o'); B.set(59, 11, 'o'); B.set(87, 11, 'o'); B.set(101, 11, 'o');
      B.set(28, 8, 'F'); B.set(55, 7, 'F'); B.set(83, 8, 'F'); B.set(97, 7, 'F');
      B.set(110, 13, 'E'); B.set(118, 13, 'E');
      B.row(112, 12, 3, 'o'); B.row(120, 12, 3, 'o');
      B.set(124, 13, 'G');
    }
  }),

  defLevel({
    name: 'Schlotanstieg', world: 'Vulkanschlot', theme: 'volcano',
    hint: 'Der Aufstieg ins Herz des Vulkans – verliert keine Herzen!',
    width: 118,
    build(B) {
      B.set(2, 13, 'P');
      B.ground(0, 10);
      B.fill(11, 20, 12, 15, '#');
      B.fill(21, 30, 10, 15, '#');
      B.fill(31, 40, 8, 15, '#');
      B.fill(41, 50, 6, 15, '#');
      B.fill(51, 60, 4, 15, '#');
      B.fill(61, 117, 4, 15, '#');
      B.row(18, 11, 2, '^'); B.row(28, 9, 2, '^'); B.row(38, 7, 2, '^'); B.row(48, 5, 2, '^');
      B.row(66, 3, 3, '^'); B.row(75, 3, 3, '^'); B.row(90, 3, 4, '^');
      B.set(55, 3, 'C');
      B.row(13, 10, 3, 'o'); B.row(23, 8, 3, 'o'); B.row(33, 6, 3, 'o'); B.row(43, 4, 3, 'o'); B.row(53, 2, 3, 'o');
      B.row(70, 3, 2, 'o'); B.row(84, 3, 3, 'o'); B.row(98, 3, 3, 'o'); B.row(108, 3, 3, 'o');
      B.set(21, 4, 'F'); B.set(41, 1, 'F'); B.set(62, 1, 'F');
      B.set(80, 3, 'E'); B.set(95, 3, 'E'); B.set(105, 3, 'E');
      B.set(113, 3, 'G');
    }
  }),

  defLevel({
    name: 'Herz des Vulkans', world: 'Vulkanschlot', theme: 'volcano',
    hint: 'Der Endgegner wartet! Springt ihm auf den Kopf!',
    width: 152,
    build(B) {
      B.set(2, 13, 'P');
      B.ground(0, 14);
      B.fill(15, 17, 14, 15, '~');
      B.ground(18, 34); B.set(25, 13, 'E');
      B.block(21, 13, 1, 1);
      B.fill(35, 40, 14, 15, '~'); B.row(35, 12, 5, 'B'); B.row(35, 11, 5, 'o');
      B.ground(41, 50); B.set(45, 9, 'F');
      B.fill(51, 62, 14, 15, '~'); B.set(53, 12, 'M'); B.set(59, 12, 'M');
      B.ground(63, 77); B.set(65, 13, 'C'); B.set(70, 13, 'E'); B.row(74, 13, 3, '^');
      B.block(67, 13, 1, 1); B.block(72, 13, 1, 1);
      B.block(76, 12, 1, 1);
      B.fill(78, 79, 11, 15, '#');
      B.ground(80, 94); B.set(90, 8, 'F');
      B.fill(95, 101, 14, 15, '~'); B.fill(97, 99, 13, 15, '#');
      B.ground(102, 151);
      B.set(106, 13, 'C');
      B.set(126, 13, 'X');
      B.block(138, 12, 2, 1); B.block(142, 11, 2, 1);
      B.row(22, 12, 3, 'o'); B.row(43, 12, 3, 'o'); B.row(67, 12, 3, 'o'); B.row(86, 12, 3, 'o'); B.row(110, 12, 3, 'o');
      B.set(147, 13, 'G');
    }
  })
];
