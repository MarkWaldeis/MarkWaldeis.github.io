'use strict';

const TILE = 32;
const VIEW_W = 960;
const VIEW_H = 540;
const GRAV = 1500;
const MAXFALL = 920;
const COIN_VALUE = 5;

const CHARS = [
  {
    id: 'blitz', name: 'Max Blitz', title: 'Der Allrounder', price: 0,
    desc: 'Ausgewogener Held. Ideal für den Start.',
    color: '#ffd34d', accent: '#e2574c',
    speed: 235, jump: 460, hp: 2, jumps: 1, ability: null
  },
  {
    id: 'lina', name: 'Lina Springfeder', title: 'Die Hochfliegerin', price: 150,
    desc: 'Springt deutlich höher, etwas langsamer.',
    color: '#7ec4ff', accent: '#2b6cb0',
    speed: 210, jump: 545, hp: 2, jumps: 1, ability: 'highjump'
  },
  {
    id: 'rocco', name: 'Rocco Panzer', title: 'Der Bulle', price: 300,
    desc: 'Drei Herzen! Dafür etwas träge.',
    color: '#8ee08e', accent: '#2f855a',
    speed: 195, jump: 430, hp: 3, jumps: 1, ability: null
  },
  {
    id: 'kira', name: 'Ninja Kira', title: 'Die Schnelle', price: 450,
    desc: 'Doppelsprung + Dash (Shift / X).',
    color: '#c792ea', accent: '#5e2f91',
    speed: 265, jump: 440, hp: 2, jumps: 2, ability: 'dash'
  },
  {
    id: 'volt', name: 'Robo-Volt', title: 'Der Sammler', price: 600,
    desc: 'Eingebauter Münzmagnet zieht Münzen an.',
    color: '#ffab5e', accent: '#c05621',
    speed: 225, jump: 450, hp: 2, jumps: 1, ability: 'magnet'
  },
  {
    id: 'nyx', name: 'Geist Nyx', title: 'Die Schwebende', price: 800,
    desc: 'Haltet SPRUNG beim Fallen: Sie schwebt sanft.',
    color: '#b8c6ff', accent: '#5a67d8',
    speed: 230, jump: 440, hp: 2, jumps: 1, ability: 'glide'
  }
];

const UPGRADES = [
  { id: 'heart1', name: 'Extra-Herz I', desc: '+1 maximales Herz für alle Charaktere.', price: 200, requires: null, icon: 'heart' },
  { id: 'heart2', name: 'Extra-Herz II', desc: 'Noch ein Herz mehr (benötigt Extra-Herz I).', price: 450, requires: 'heart1', icon: 'heart' },
  { id: 'doublejump', name: 'Universal-Doppelsprung', desc: 'Jeder Charakter erhält +1 Luftsprung.', price: 400, requires: null, icon: 'wings' },
  { id: 'magnet', name: 'Münzmagnet', desc: 'Zieht Münzen im Umkreis automatisch an.', price: 300, requires: null, icon: 'magnet' },
  { id: 'shield', name: 'Startschild', desc: 'Blockt den ersten Treffer nach jedem Respawn.', price: 350, requires: null, icon: 'shield' }
];

const TRAILS = [
  { id: 'none', name: 'Keine Spur', price: 0, color: '#ffffff' },
  { id: 'fire', name: 'Feuer-Spur', price: 80, color: '#ff7b39' },
  { id: 'ice', name: 'Eis-Spur', price: 80, color: '#9fdcff' },
  { id: 'toxic', name: 'Gift-Spur', price: 120, color: '#8dff5a' },
  { id: 'rainbow', name: 'Regenbogen-Spur', price: 200, color: '#ff5ad0' },
  { id: 'gold', name: 'Gold-Spur', price: 260, color: '#ffd34d' }
];

const THEMES = {
  green: {
    skyTop: '#7ecbff', skyBot: '#d9f7c5',
    hillFar: '#a8ddb5', hillNear: '#6cc07d',
    dirt: '#8a5a33', dirtDark: '#6d4426', top: '#4fc44f', topDark: '#3aa53a',
    weather: 'leaves', icy: false
  },
  ice: {
    skyTop: '#a8d8ff', skyBot: '#eef9ff',
    hillFar: '#cfe8fb', hillNear: '#9cc8ea',
    dirt: '#6b8aa6', dirtDark: '#54708a', top: '#f2fbff', topDark: '#cfe9f8',
    weather: 'snow', icy: true
  },
  volcano: {
    skyTop: '#301a3d', skyBot: '#ff8c5a',
    hillFar: '#4a2140', hillNear: '#331631',
    dirt: '#4a3040', dirtDark: '#382433', top: '#ff9a4d', topDark: '#d96f2e',
    lava: '#ff5a2b', lavaGlow: '#ffd23d',
    weather: 'embers', icy: false
  }
};

const WORLD_NAMES = { green: 'Grüne Hügel', ice: 'Frostwelt', volcano: 'Vulkanschlot' };

function getChar(id) { return CHARS.find(c => c.id === id) || CHARS[0]; }
function getUpgrade(id) { return UPGRADES.find(u => u.id === id); }
function getTrail(id) { return TRAILS.find(t => t.id === id) || TRAILS[0]; }
