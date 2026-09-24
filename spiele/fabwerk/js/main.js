import * as THREE from 'three';
import {
  TECHS, BUILDINGS, GRID, MAX_LEVEL, UPGRADEABLE_TYPES, upgradeCost
} from './config.js';
import {
  newState, genTerrain, serialize, loadState, removeBuilding,
  makeBuilding, addBuilding
} from './world.js';
import { updateSim } from './sim.js';
import { initRender } from './render.js';
import { initUI } from './ui.js';
import { initInput } from './input.js';

const SAVE_KEY='fabwerk_save_v1';

let S=null;
let render=null;
let ui=null;
let input=null;
let selected=null;
let speed=1;
let paused=false;
let saveTimer=0;

const clock=new THREE.Clock();
let tickAcc=0;
const dirty={top:true,tech:false};

function freshState(){
  const s=newState((Math.random()*2**31)|0);
  genTerrain(s);
  return s;
}

function tryLoad(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    const obj=JSON.parse(raw);
    if(!obj||obj.v!==1) return null;
    return loadState(obj);
  }catch(err){
    console.warn('Load failed',err);
    return null;
  }
}

function saveGame(silent){
  try{
    localStorage.setItem(SAVE_KEY,JSON.stringify(serialize(S)));
    if(!silent) ui.toast('Spiel gespeichert');
  }catch(err){
    if(!silent) ui.toast('Speichern fehlgeschlagen',true);
  }
}

const evt={
  sell(){ dirty.top=true; },
  rp(gain,silent){
    dirty.top=true;
    if(!silent&&gain>0) ui.toast(`+${gain} Forschung`);
  }
};

function onChange(){
  dirty.top=true;
}

function selectBuilding(b){
  selected=b;
  render.setSelection(b);
  ui.showInspector(S,b);
}

function closeInspector(){
  selected=null;
  render.setSelection(null);
  ui.showInspector(null);
}

function deleteSelected(){
  if(!selected) return;
  const b=selected;
  let refund=b.type==='under_in'||b.type==='under_out'?20:Math.floor((BUILDINGS[b.type]?BUILDINGS[b.type].cost:0)/2);
  S.coins+=refund;
  removeBuilding(S,b);
  render.buildingRemoved(b,S);
  closeInspector();
  onChange();
}

function rotateSelected(){
  if(!selected) return;
  if(selected.type==='under_in'||selected.type==='under_out') return;
  selected.dir=(selected.dir+1)&3;
  render.setRotationOf(selected);
  ui.showInspector(S,selected);
}

function upgradeSelected(){
  if(!selected) return;
  const def=BUILDINGS[selected.type];
  if(!def||!UPGRADEABLE_TYPES.includes(selected.type)) return;
  const lv=selected.level||1;
  if(lv>=MAX_LEVEL){ ui.toast('Maximale Stufe erreicht',true); return; }
  const cost=upgradeCost(def.cost,lv);
  if(S.coins<cost){ ui.toast(`Upgrade kostet ${cost} Münzen`,true); return; }
  S.coins-=cost;
  selected.level=lv+1;
  ui.toast(`${def.name} jetzt Stufe ${selected.level}`);
  ui.showInspector(S,selected);
  onChange();
}

function setRecipe(b,rid){
  b.recipe=rid||null;
  b.progress=0;
  b.crafting=false;
}

function buyTech(id){
  const t=TECHS.find(x=>x.id===id);
  if(!t||S.researched.has(id)) return;
  const missing=(t.req||[]).filter(r=>!S.researched.has(r));
  if(missing.length){ ui.toast('Zunächst: '+missing.map(m=>TECHS.find(x=>x.id===m).name).join(', '),true); return; }
  if(S.rp<t.cost){ ui.toast('Nicht genug Forschungspunkte',true); return; }
  S.rp-=t.cost;
  S.researched.add(id);
  ui.toast(`Erforscht: ${t.name}`);
  dirty.top=true; dirty.tech=true;
  if(selected) ui.showInspector(S,selected);
  onChange();
}

function applySpeed(v){
  if(v==='p'){
    paused=!paused;
  }else{
    speed=v;
    paused=false;
  }
  ui.setSpeedUI(speed,paused);
}

function modalOpen(){
  return ui.techOpen()||!document.getElementById('helpModal').classList.contains('hidden');
}

const hooks={
  getS:()=>S,
  setTool:t=>input.setTool(t),
  buyTech,
  setSpeed:applySpeed,
  togglePause:()=>applySpeed('p'),
  saveGame:()=>saveGame(false),
  newGame,
  refreshTech:()=>ui.refreshTech(S),
  closeInspector,
  setRecipe:(b,rid)=>{
    setRecipe(b,rid);
    ui.refreshInspectorLive(S);
  },
  rotateSel:rotateSelected,
  upgradeSelected,
  deleteSelected,
  dismissTutorial:()=>{S.tut.dismissed=true; saveGame(true);},
  onChange,
  selectBuilding,
  modalOpen,
  toggleTech:()=>ui.toggleTech(),
  closeModals:()=>ui.closeModals()
};

function tickUI(){
  S.stats.peakCoins=Math.max(S.stats.peakCoins||0,S.coins);
  ui.refreshTopbar(S);
  ui.refreshMenu(S);
  if(dirty.tech&&ui.techOpen()){ ui.refreshTech(S); }
  ui.tickTutorial(S);
  ui.refreshInspectorLive(S);
}

function boot2(isNew){
  render.syncAll(S);
  render.cam.focus.set(0,0,isNew?2:0);
  closeInspector();
  ui.refreshTopbar(S);
  ui.refreshMenu(S);
  ui.refreshTech(S);
  ui.setSpeedUI(speed,paused);
  input.setTool(null);
  document.getElementById('tutCard').classList.toggle('hidden',S.tut.dismissed);
  tickUI();
}

function newGame(){
  if(!confirm('Neues Spiel starten? Der aktuelle Spielstand geht verloren.')) return;
  localStorage.removeItem(SAVE_KEY);
  S=freshState();
  boot2(true);
  ui.toast('Neues Spiel gestartet');
  saveGame(true);
}

function loop(){
  requestAnimationFrame(loop);
  const dtReal=Math.min(clock.getDelta(),0.05);
  const dtSim=paused?0:dtReal*speed;
  updateSim(S,dtSim,evt);
  input.update(dtReal);
  render.frame(S,dtSim,dtReal);
  tickAcc+=dtReal;
  if(tickAcc>0.25){
    tickAcc=0;
    tickUI();
  }
  saveTimer+=dtReal;
  if(saveTimer>30){
    saveTimer=0;
    saveGame(true);
  }
}

function boot(){
  const loaded=tryLoad();
  S=loaded||freshState();
  S.__loaded=!!loaded;

  if(!loaded){
    const c=Math.floor(GRID/2);
    const lab=makeBuilding(S,'lab',c,c+2,1);
    addBuilding(S,lab);
  }

  const container=document.getElementById('app');
  render=initRender(container);
  ui=initUI(hooks);
  const ictx=Object.assign({},hooks,{render,ui,selected:()=>selected});
  input=initInput(render.dom,ictx);

  document.getElementById('btnRotL').addEventListener('click',()=>render.cam.rotateSnap(-1));
  document.getElementById('btnRotR').addEventListener('click',()=>render.cam.rotateSnap(1));
  document.getElementById('btnZoomIn').addEventListener('click',()=>render.cam.zoom(0.85));
  document.getElementById('btnZoomOut').addEventListener('click',()=>render.cam.zoom(1.18));
  document.getElementById('mbCancel').addEventListener('click',()=>input.setTool(null));

  boot2(!S.__loaded);

  if(!S.__loaded){
    setTimeout(()=>ui.toggleHelp(),400);
  }

  window.addEventListener('beforeunload',()=>saveGame(true));
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden) saveGame(true);
  });

  loop();
}

boot();
