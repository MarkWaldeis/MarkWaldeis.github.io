export const GRID = 168;
export const ITEM_SPACING = 0.25;
export const BASE_BELT_SPEED = 1.2;
export const INPUT_CAP = 6;
export const OUT_CAP = 4;
export const UNDER_CAP = 4;
export const UNDER_MIN = 2;
export const UNDER_MAX = 6;
export const START_COINS = 1500;
export const EXTRACT_TIME = 3;
export const LAB_TIME = 0.7;
export const MAX_LEVEL = 4;
export const LEVEL_MULT = 1.5;

export function levelMult(m){
  return Math.pow(LEVEL_MULT,(m&&m.level?m.level:1)-1);
}

export function upgradeCost(defCost,level){
  return Math.round(defCost*1.6*Math.pow(2.2,level));
}

export const DX = [1, 0, -1, 0];
export const DZ = [0, 1, 0, -1];

export const opp = d => (d + 2) & 3;
export const left = d => (d + 3) & 3;
export const right = d => (d + 1) & 3;

export const ITEMS = {
  iron_ore:   { name: 'Eisenerz',     color: 0xa8b0ba, value: 1, sci: 1, shape: 'chunk' },
  copper_ore: { name: 'Kupfererz',    color: 0xd98a52, value: 1, sci: 1, shape: 'chunk' },
  stone:      { name: 'Stein',        color: 0xb9b6a8, value: 1, sci: 1, shape: 'chunk' },
  coal:       { name: 'Kohle',        color: 0x474751, value: 1, sci: 1, shape: 'chunk' },
  sand:       { name: 'Sand',         color: 0xe8d493, value: 1, sci: 1, shape: 'chunk' },
  wood:       { name: 'Holz',         color: 0xa5793f, value: 2, sci: 2, shape: 'log' },
  brick:      { name: 'Ziegel',       color: 0xc46a4a, value: 5, sci: 3, shape: 'box' },
  iron_bar:   { name: 'Eisenbarren',  color: 0xdde3ea, value: 6, sci: 3, shape: 'bar' },
  copper_bar: { name: 'Kupferbarren', color: 0xef9550, value: 6, sci: 3, shape: 'bar' },
  glass:      { name: 'Glas',         color: 0x9fd4e8, value: 7, sci: 4, shape: 'box' },
  plank:      { name: 'Brett',        color: 0xcaa46a, value: 5, sci: 3, shape: 'box' },
  wire:       { name: 'Draht',        color: 0xe6b84f, value: 4, sci: 4, shape: 'coil' },
  gear:       { name: 'Zahnrad',      color: 0xb9bfc9, value: 12, sci: 6, shape: 'gearItem' },
  steel:      { name: 'Stahl',        color: 0x93a7bd, value: 20, sci: 8, shape: 'bar' },
  circuit:    { name: 'Schaltkreis',  color: 0x59c26b, value: 30, sci: 14, shape: 'box' },
  motor:      { name: 'Motor',        color: 0x8494ab, value: 90, sci: 28, shape: 'box' },
  solar_panel:{ name: 'Solarpanel',   color: 0x2a5a9c, value: 95, sci: 22, shape: 'box' },
  computer:   { name: 'Computer',     color: 0x6fb3ef, value: 240, sci: 60, shape: 'box' },
  robot:      { name: 'Roboter',      color: 0xd3dae1, value: 650, sci: 130, shape: 'box' }
};

export const RECIPES = [
  { id: 'smelt_iron',   machine: 'furnace',   inp: { iron_ore: 1 },            out: 'iron_bar',   n: 1, time: 2 },
  { id: 'smelt_copper', machine: 'furnace',   inp: { copper_ore: 1 },          out: 'copper_bar', n: 1, time: 2 },
  { id: 'smelt_brick',  machine: 'furnace',   inp: { stone: 1 },               out: 'brick',      n: 1, time: 2 },
  { id: 'smelt_glass',  machine: 'furnace',   inp: { sand: 2 },                out: 'glass',      n: 1, time: 3 },
  { id: 'smelt_steel',  machine: 'furnace',   inp: { iron_bar: 2, coal: 1 },   out: 'steel',      n: 1, time: 5 },
  { id: 'make_plank',   machine: 'assembler', inp: { wood: 1 },                out: 'plank',      n: 1, time: 2 },
  { id: 'make_gear',    machine: 'assembler', inp: { iron_bar: 2 },            out: 'gear',       n: 1, time: 3 },
  { id: 'make_wire',    machine: 'assembler', inp: { copper_bar: 1 },          out: 'wire',       n: 2, time: 2 },
  { id: 'make_circuit', machine: 'assembler', inp: { wire: 3, iron_bar: 1 },   out: 'circuit',    n: 1, time: 4 },
  { id: 'make_motor',   machine: 'assembler', inp: { gear: 1, circuit: 1, steel: 1 }, out: 'motor', n: 1, time: 6 },
  { id: 'make_solar',   machine: 'assembler', inp: { glass: 2, wire: 2, circuit: 1 }, out: 'solar_panel', n: 1, time: 8 },
  { id: 'make_computer',machine: 'assembler', inp: { circuit: 2, motor: 1 },   out: 'computer',   n: 1, time: 8 },
  { id: 'make_robot',   machine: 'assembler', inp: { computer: 1, motor: 2, steel: 2 }, out: 'robot', n: 1, time: 12 }
];

export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map(r => [r.id, r]));

export const BUILDINGS = {
  belt:       { name: 'Förderband',    cost: 5,   cat: 'logistics',  desc: 'Transportiert Items. Ziehen zum Verlegen.' },
  splitter:   { name: 'Verteiler',      cost: 15,  cat: 'logistics',  desc: 'Verteilt Items abwechselnd auf zwei Ausgänge.' },
  sorter:     { name: 'Sorter',         cost: 80,  cat: 'logistics',  tech: 'sorting', desc: 'Filtert ein Item nach links, Rest geradeaus. Filter im Inspektor wählen.' },
  underground:{ name: 'Unterführung',  cost: 40,  cat: 'logistics',  desc: 'Gerader Tunnel 2-6 Kacheln. Kreuzt andere Bänder.' },
  inserter:   { name: 'Greifer',        cost: 40,  cat: 'logistics',  desc: 'Trägt Items von der Kachel hinter sich nach vorne.' },
  extractor:  { name: 'Extraktor',      cost: 100, cat: 'production', desc: 'Auf eine Ressource setzen. Fördert endlos.' },
  furnace:    { name: 'Schmelzofen',    cost: 150, cat: 'production', desc: 'Schmilzt Erze zu Barren und Glas. Ausgang zeigt aufs Band.' },
  assembler:  { name: 'Montage',        cost: 400, cat: 'production', tech: 'assembly', desc: 'Fertigt Bauteile nach Rezept.' },
  market:     { name: 'Markt',          cost: 300, cat: 'economy',    desc: 'Verkauft gelieferte Items für Münzen.' },
  lab:        { name: 'Forschungslabor',cost: 600, cat: 'economy',    desc: 'Belohnt jede Lieferung mit Münzen UND Forschung. Wertvolle Waren geben mehr.' }
};

export const BASE_BUILDINGS = ['belt','splitter','underground','inserter','extractor','furnace','market','lab'];
export const BASE_RECIPES = ['smelt_iron','smelt_copper','smelt_brick','smelt_glass'];

export const CATS = [
  ['logistics', 'Logistik'],
  ['production', 'Produktion'],
  ['economy', 'Wirtschaft']
];

export const TECHS = [
  { id:'assembly',    name:'Montage',          cost:8,   req:[],              unlockBuildings:['assembler'], unlockRecipes:['make_plank','make_gear','make_wire'], desc:'Schaltet die Montage frei: Bretter, Zahnräder, Draht.' },
  { id:'logistics2',  name:'Logistik 2',       cost:15,  req:[],              mult:{belt:1.5},   desc:'Förderband-Tempo +50%.' },
  { id:'mining1',     name:'Bergbau 1',        cost:18,  req:[],              mult:{extractor:1.5}, desc:'Extraktoren +50% Tempo.' },
  { id:'metallurgy',  name:'Metallurgie',      cost:25,  req:['assembly'],    unlockRecipes:['smelt_steel'], desc:'Stahl aus Eisenbarren und Kohle.' },
  { id:'sorting',     name:'Sortiertechnik',   cost:30,  req:['logistics2'],  unlockBuildings:['sorter'], desc:'Der Sorter filtert ein Item auf die Seitenbahn.' },
  { id:'smelting1',   name:'Schmelzkunde 1',   cost:30,  req:[],              mult:{furnace:1.5}, desc:'Öfen +50% Tempo.' },
  { id:'smelting2',   name:'Schmelzkunde 2',   cost:140, req:['smelting1'],  mult:{furnace:2}, desc:'Öfen doppelt so schnell.' },
  { id:'inserter2',   name:'Schnellgreifer',   cost:45,  req:[],              mult:{inserter:2}, desc:'Greifer doppelt so schnell.' },
  { id:'electronics', name:'Elektronik',       cost:55,  req:['metallurgy'],  unlockRecipes:['make_circuit'], desc:'Schaltkreise aus Draht und Eisen.' },
  { id:'solar_tech',  name:'Solartechnik',     cost:80,  req:['electronics'], unlockRecipes:['make_solar'], desc:'Solarpanels aus Glas, Draht und Schaltkreis.' },
  { id:'automation',  name:'Automation',       cost:100, req:['electronics'], unlockRecipes:['make_motor'], desc:'Motoren - große Marge.' },
  { id:'assembly2',   name:'Feinmechanik',     cost:90,  req:['automation'],  mult:{assembler:1.5}, desc:'Montage +50% Tempo.' },
  { id:'mining2',     name:'Bergbau 2',        cost:120, req:['mining1'],     mult:{extractor:2}, desc:'Extraktoren nochmal doppelt.' },
  { id:'logistics3',  name:'Express-Bänder',  cost:130, req:['logistics2'],  mult:{belt:2}, desc:'Förderband-Tempo nochmal verdoppelt.' },
  { id:'computing',   name:'Computertechnik',  cost:180, req:['automation'],  unlockRecipes:['make_computer'], desc:'Computer fertigen.' },
  { id:'robotics',    name:'Robotik',          cost:320, req:['computing'],   unlockRecipes:['make_robot'], desc:'Roboter - der Endpunkt der Kette.' }
];

export const LAB_FEE = 0.6;
export const UPGRADEABLE_TYPES = ['extractor','furnace','assembler','lab','inserter'];

export const RES_ITEM = [null,'iron_ore','copper_ore','stone','coal','wood','sand'];
export const RES_NAME = [null,'Eisen','Kupfer','Stein','Kohle','Holz','Sand'];
export const RES_COLOR = [0,0x9aa2ad,0xd98a52,0xb9b6a8,0x474751,0x4d9950,0xe8d493];

// Garantierte Vorkommen in Spawnnähe: [code, Entfernung, Blob-Größe]
export const STARTER_PATCHES = [
  { code: 1, dist: 9,  size: 20 },
  { code: 2, dist: 12, size: 14 },
  { code: 4, dist: 13, size: 11 }
];

export const LAB_ORDER = ['circuit','motor','solar_panel','computer','robot'];
export const LAB_SET = new Set(LAB_ORDER);

// Auftrags-Kampagne: liefere N Items an Markt oder Labor.
// Fortschritt = lebenslang gelieferte Stückzahl (stats.delivered).
export const CONTRACTS = [
  { id:'c01', item:'iron_bar',   n:15, coins:200,  rp:5  },
  { id:'c02', item:'brick',      n:25, coins:280,  rp:8  },
  { id:'c03', item:'glass',      n:30, coins:350,  rp:10 },
  { id:'c04', item:'plank',      n:25, coins:320,  rp:10 },
  { id:'c05', item:'gear',       n:30, coins:420,  rp:12 },
  { id:'c06', item:'wire',       n:50, coins:480,  rp:14 },
  { id:'c07', item:'steel',      n:30, coins:650,  rp:18 },
  { id:'c08', item:'circuit',    n:25, coins:900,  rp:25 },
  { id:'c09', item:'motor',      n:15, coins:1200, rp:32 },
  { id:'c10', item:'solar_panel',n:12, coins:1600, rp:40 },
  { id:'c11', item:'computer',   n:10, coins:2400, rp:55 },
  { id:'c12', item:'robot',      n:4,  coins:5000, rp:100, final:true }
];

export function keyOf(x,z){ return z*GRID+x; }

export function multFor(S,k){
  let m=1;
  for(const t of TECHS){
    if(t.mult && t.mult[k] && S.researched.has(t.id)) m*=t.mult[k];
  }
  return m;
}

export function isUnlockedBuilding(S,t){
  const def=BUILDINGS[t];
  if(!def) return false;
  if(!def.tech) return true;
  return S.researched.has(def.tech);
}

export function isUnlockedRecipe(S,id){
  if(BASE_RECIPES.includes(id)) return true;
  for(const t of TECHS){
    if(S.researched.has(t.id) && t.unlockRecipes && t.unlockRecipes.includes(id)) return true;
  }
  return false;
}

export function recipesFor(S,machine){
  return RECIPES.filter(r=>r.machine===machine && isUnlockedRecipe(S,r.id));
}

export function missingTechForBuilding(t){
  const def=BUILDINGS[t];
  return def&&def.tech&&!BASE_BUILDINGS.includes(t)?def.tech:null;
}

export function techName(id){
  const t=TECHS.find(x=>x.id===id);
  return t?t.name:id;
}

export function fmt(n){
  return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
