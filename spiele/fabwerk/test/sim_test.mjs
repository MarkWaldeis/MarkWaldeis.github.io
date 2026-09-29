// FABWERK - Szenario-Tests der Kernsimulation (ohne Browser)
// Aufruf: node test/sim_test.mjs
import { newState, genTerrain, makeBuilding, addBuilding, serialize, loadState, removeBuilding } from '../js/world.js';
import { updateSim } from '../js/sim.js';
import { keyOf, BUILDINGS, ITEMS, CONTRACTS, GRID } from '../js/config.js';

let passed=0, failed=0;
function ok(cond,msg){
  if(cond){passed++;console.log('  OK  ',msg);}
  else{failed++;console.log('  FAIL',msg);}
}
function run(S,secs,evt){
  const dt=0.05;
  for(let t=0;t<secs;t+=dt) updateSim(S,dt,evt);
}
function fresh(){
  const S=newState(12345);
  return S;
}
// Simuliert den Delivery-Zaehler aus main.js (Verkaufs-Event)
function deliveredEvt(S){
  return {sell(item){S.stats.delivered[item]=(S.stats.delivered[item]||0)+1;},rp(){}};
}
function belt(S,x,z,d){const b=makeBuilding(S,'belt',x,z,d);addBuilding(S,b);return b;}

// ---------- 1) Erz -> Ofen -> Markt ----------
{
  const S=fresh();
  S.res[keyOf(10,10)]=1; // Eisen
  const ext=makeBuilding(S,'extractor',10,10,0,1);addBuilding(S,ext);
  for(let i=11;i<=13;i++) belt(S,i,10,0);
  const fur=makeBuilding(S,'furnace',14,10,0);fur.recipe='smelt_iron';addBuilding(S,fur);
  for(let i=15;i<=17;i++) belt(S,i,10,0);
  const mkt=makeBuilding(S,'market',18,10,0);addBuilding(S,mkt);
  const evt=deliveredEvt(S);
  run(S,40,evt);
  ok(mkt.count>=3,'Kette Erz->Ofen->Markt liefert ('+mkt.count+' verkauft)');
  ok(S.coins>0,'Muenzen gutgeschrieben: '+S.coins);
  ok(S.stats.delivered.iron_bar>=3,'delivered iron_bar gezaehlt: '+S.stats.delivered.iron_bar);
}

// ---------- 2) Labor gibt FP + Coins ----------
{
  const S=fresh();
  const lab=makeBuilding(S,'lab',5,5,0);addBuilding(S,lab);
  lab.inputs.circuit=3;
  const evt={sell(){},rp(){}};
  const rp0=S.rp;
  run(S,6,evt);
  ok(S.rp>rp0,'Labor erzeugt Forschungspunkte ('+S.rp+' FP)');
  ok(S.coins>0,'Labor zahlt Muenzen');
  ok((lab.inputs.circuit||0)===0,'Labor-Inputs verbraucht');
}

// ---------- 3) Verteiler alterniert ----------
{
  const S=fresh();
  // Quelle: Ofen-Ausgang - Ausgaenge: geradeaus (dir=0, Ost) + links (left(0)=3, Nord)
  const fur=makeBuilding(S,'furnace',10,10,0);fur.recipe='smelt_iron';fur.outItem='iron_bar';fur.outCount=4;addBuilding(S,fur);
  const sp=makeBuilding(S,'splitter',11,10,0);addBuilding(S,sp);
  const bA=belt(S,12,10,0);
  const bB=belt(S,11,9,3);
  const mktA=makeBuilding(S,'market',13,10,0);addBuilding(S,mktA);
  const mktB=makeBuilding(S,'market',11,8,0);addBuilding(S,mktB);
  run(S,20,{});
  ok(mktA.count>0&&mktB.count>0,`Verteiler bedient beide Ausgaenge (A:${mktA.count} B:${mktB.count})`);
}

// ---------- 4) Unterfuehrung kreuzt Band ----------
{
  const S=fresh();
  const uin=makeBuilding(S,'under_in',10,10,0);addBuilding(S,uin);
  const uout=makeBuilding(S,'under_out',13,10,0);addBuilding(S,uout);
  // Link findet automatisch
  ok(uin.link===keyOf(13,10)&&uout.link===keyOf(10,10),'Unterfuehrung verlinkt Enden');
  // Band kreuzt dazwischen
  belt(S,11,9,1);belt(S,11,10,1);belt(S,11,11,1);
  uin.buf.push('iron_ore');
  const mkt=makeBuilding(S,'market',14,10,0);addBuilding(S,mkt);
  run(S,10,{});
  ok(mkt.count===1,'Item durch Unterfuehrung gelaufen');
}

// ---------- 5) Greifer uebertraegt ----------
{
  const S=fresh();
  const fur=makeBuilding(S,'furnace',10,10,0);fur.recipe='smelt_iron';fur.outItem='iron_bar';fur.outCount=2;addBuilding(S,fur);
  // Greifer hinter dem Ofen (holt von x=10 -> legt auf x=12, dir=0 => src x-1)
  const ins=makeBuilding(S,'inserter',11,10,0);addBuilding(S,ins);
  const b=belt(S,12,10,0);
  const mkt=makeBuilding(S,'market',13,10,0);addBuilding(S,mkt);
  run(S,15,{});
  ok(mkt.count>0,'Greifer traegt Items Ofen->Band->Markt ('+mkt.count+')');
}

// ---------- 6) Stau-Logik: Band stoppt bei vollem Ziel ----------
{
  const S=fresh();
  const fur=makeBuilding(S,'furnace',10,10,0);fur.recipe='smelt_iron';fur.outItem='iron_bar';fur.outCount=1;addBuilding(S,fur);
  const b=belt(S,11,10,0);
  // kein Abnehmer -> Item staut am Ende
  run(S,5,{});
  ok(b.items.length===1&&Math.abs(b.items[0].pos-1)<0.01,'Item staut sauber am Bandende');
}

// ---------- 7) Save-Roundtrip ----------
{
  const S=fresh();
  genTerrain(S); // identisches Terrain beim Laden (gleicher Seed)
  // echtes Kupferfeld suchen (res=2)
  let rx=-1,rz=-1;
  outer:for(let z=1;z<GRID-1;z++)for(let x=1;x<GRID-1;x++){
    if(S.res[z*GRID+x]===2){rx=x;rz=z;break outer;}
  }
  const ext=makeBuilding(S,'extractor',rx,rz,1,2);ext.level=3;addBuilding(S,ext);
  const fur=makeBuilding(S,'furnace',21,20,2);fur.recipe='smelt_copper';fur.inputs.copper_ore=2;addBuilding(S,fur);
  const so=makeBuilding(S,'sorter',22,20,0);so.filter='iron_bar';so.items=[{it:'wire',pos:0.5,es:2}];addBuilding(S,so);
  const uin=makeBuilding(S,'under_in',23,20,0);addBuilding(S,uin);
  const uout=makeBuilding(S,'under_out',26,20,0);addBuilding(S,uout);
  S.rp=42;S.researched.add('assembly');S.orderIdx=3;S.stats.delivered.gear=9;
  const S2=loadState(JSON.parse(JSON.stringify(serialize(S))));
  ok(S2.rp===42,'Roundtrip RP');
  ok(S2.researched.has('assembly'),'Roundtrip Tech');
  ok(S2.orderIdx===3,'Roundtrip orderIdx');
  const e2=[...S2.buildings.values()].find(b=>b.type==='extractor');
  const f2=[...S2.buildings.values()].find(b=>b.type==='furnace');
  const s2=[...S2.buildings.values()].find(b=>b.type==='sorter');
  ok(e2&&e2.level===3&&e2.res===2,'Roundtrip Extraktor Level+Res');
  ok(f2&&f2.recipe==='smelt_copper'&&f2.inputs.copper_ore===2,'Roundtrip Ofen');
  ok(s2&&s2.filter==='iron_bar'&&s2.items.length===1,'Roundtrip Sorter+Items');
  const u2=[...S2.buildings.values()].find(b=>b.type==='under_in');
  ok(u2&&u2.link!=null,'Roundtrip Unterfuehrungs-Link');
  ok(S2.stats.delivered.gear===9,'Roundtrip delivered');
}

// ---------- 8) Rezept-/Tech-Gating ----------
{
  const S=fresh();
  const asm=makeBuilding(S,'assembler',5,5,0);addBuilding(S,asm);
  asm.recipe='make_robot'; // gesperrt (Robotik fehlt)
  asm.inputs={computer:9,motor:9,steel:9};
  run(S,14,{});
  ok(asm.outCount===0,'Gesperrtes Rezept produziert nicht');
  S.researched.add('robotics');
  run(S,14,{});
  ok(asm.outCount>0,'Nach Forschung produziert Rezept');
}

// ---------- 9) Vertrag-Konsistenz ----------
{
  let bad=0;
  for(const c of CONTRACTS){
    if(!ITEMS[c.item]){console.log('   !! Vertrag mit unbekanntem Item',c.id,c.item);bad++;}
    if(c.n<=0||c.coins<=0)bad++;
  }
  ok(bad===0,CONTRACTS.length+' Auftraege konsistent (letzter final: '+(CONTRACTS.at(-1).final===true)+')');
  for(const t in BUILDINGS){
    if(typeof BUILDINGS[t].cost!=='number')bad++;
  }
}

// ---------- 10) Demolish refund/entfernen ----------
{
  const S=fresh();
  const b=belt(S,7,7,0);
  removeBuilding(S,b);
  ok(!S.buildings.get(keyOf(7,7)),'removeBuilding loescht Eintrag');
}

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed?1:0);
