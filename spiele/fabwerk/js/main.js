import * as THREE from 'three';
import {
  TECHS, BUILDINGS, GRID, MAX_LEVEL, UPGRADEABLE_TYPES, upgradeCost, ITEMS, CONTRACTS, fmt
} from './config.js';
import {
  newState, genTerrain, serialize, loadState, removeBuilding,
  makeBuilding, addBuilding
} from './world.js';
import { updateSim } from './sim.js';
import { initRender } from './render.js';
import { initUI } from './ui.js';
import { initInput } from './input.js';
import * as AUDIO from './audio.js';

const SAVE_KEY='fabwerk_save_v1';
const SORTER_GLB_URL='assets/sorter.glb';

let S=null;
let render=null;
let ui=null;
let input=null;
let selected=null;
let speed=1;
let paused=false;
let pauseHold=false;      // true, wenn das Pausenmenü die Sim angehalten hat
let prevPaused=false;
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
    if(!obj||(obj.v!==1&&obj.v!==2)) return null;
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

const MILESTONE_ITEMS=new Set(['circuit','motor','computer','robot']);
let lastRpToast=-1e9;

const evt={
  sell(item){
    dirty.top=true;
    S.stats.delivered[item]=(S.stats.delivered[item]||0)+1;
    AUDIO.sfx('coin');
    if(item&&MILESTONE_ITEMS.has(item)){
      S.stats.seen=S.stats.seen||{};
      if(!S.stats.seen[item]){
        S.stats.seen[item]=1;
        ui.toast(item==='robot'
          ?'Endziel erreicht: Roboter produziert!'
          :'Neue Ware produziert: '+ITEMS[item].name,'info');
      }
    }
  },
  rp(gain,silent){
    dirty.top=true;
    AUDIO.sfx('rp');
    const now=performance.now();
    if(!silent&&gain>0&&now-lastRpToast>2600){
      lastRpToast=now;
      ui.toast(`+${gain} Forschung`);
    }
  }
};

// Auftragsfortschritt: erfüllte Aufträge einsammeln (kettet bei Bedarf)
function checkContracts(){
  let advanced=false;
  while(S.orderIdx<CONTRACTS.length){
    const c=CONTRACTS[S.orderIdx];
    const have=(S.stats.delivered||{})[c.item]||0;
    if(have<c.n) break;
    S.orderIdx++;
    S.coins+=c.coins;
    S.rp+=c.rp;
    advanced=true;
    AUDIO.sfx('contract');
    ui.toast(`Auftrag erfüllt: ${c.n}x ${ITEMS[c.item].name} (+${fmt(c.coins)} M, +${c.rp} FP)`);
    if(c.final&&!S.victory){
      S.victory=true;
      setTimeout(()=>{
        AUDIO.sfx('victory');
        ui.showVictory(S);
      },700);
    }
  }
  if(advanced){ dirty.top=true; onChange(); }
}

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
  AUDIO.sfx('demolish');
  onChange();
}

function rotateSelected(){
  if(!selected) return;
  if(selected.type==='under_in'||selected.type==='under_out') return;
  selected.dir=(selected.dir+1)&3;
  render.setRotationOf(selected);
  ui.showInspector(S,selected);
  AUDIO.sfx('rotate');
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
  AUDIO.sfx('upgrade');
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
  AUDIO.sfx('research');
  ui.toast(`Erforscht: ${t.name}`);
  dirty.top=true; dirty.tech=true;
  if(selected) ui.showInspector(S,selected);
  onChange();
}

function applySpeed(v){
  if(v==='p'){
    paused=!paused;
    pauseHold=false;
  }else{
    speed=v;
    paused=false;
    pauseHold=false;
  }
  ui.setSpeedUI(speed,paused);
}

// Pausenmenü: merkt sich den vorherigen Pause-Zustand
function togglePauseMenu(){
  if(ui.pauseOpen()){
    ui.closePause();
    paused=prevPaused;
    pauseHold=false;
    ui.setSpeedUI(speed,paused);
  }else{
    prevPaused=paused;
    paused=true;
    pauseHold=true;
    ui.openPause();
    ui.setSpeedUI(speed,paused);
  }
}

function modalOpen(){
  return ui.anyModalOpen();
}

function menuOpen(){
  return ui.menuOpen();
}

// ---------- Spiel-Fluss ----------
function hasProgress(){
  if(!S) return false;
  if((S.stats.sold||0)>0) return true;
  if((S.stats.earned||0)>0) return true;
  if(S.researched.size>0) return true;
  // Mehr als das Start-Labor gebaut?
  if(S.buildings.size>1) return true;
  return false;
}

function doNewGame(){
  localStorage.removeItem(SAVE_KEY);
  S=freshState();
  const c=Math.floor(GRID/2);
  const lab=makeBuilding(S,'lab',c,c+2,1);
  addBuilding(S,lab);
  speed=1; paused=false; pauseHold=false;
  ui.closeModals();
  ui.closePause();
  ui.hideMenu();
  boot2(true);
  ui.toast('Neues Spiel gestartet');
  saveGame(true);
  // Erste Spielrunde: Schnellstart-Hilfe einblenden
  if(!S.tut.dismissed){
    setTimeout(()=>{ if(!ui.anyModalOpen()) ui.toggleHelp(); },450);
  }
}

function requestNewGame(){
  const start=()=>doNewGame();
  if(hasProgress()){
    ui.confirm(
      'Neues Spiel?',
      'Der aktuelle Spielstand wird verworfen und eine neue Karte erzeugt.',
      start
    );
  }else{
    start();
  }
}

function continueGame(){
  ui.hideMenu();
  AUDIO.unlock();
}

function toMainMenu(){
  ui.closePause();
  ui.closeModals();
  saveGame(true);
  ui.showMenu(S,true);
}

function toggleAudio(){
  const muted=AUDIO.toggleMuted();
  ui.syncAudioBtns(muted);
  if(!muted){ AUDIO.unlock(); AUDIO.sfx('click'); }
}

const hooks={
  getS:()=>S,
  setTool:t=>input.setTool(t),
  buyTech,
  setSpeed:applySpeed,
  togglePause:()=>applySpeed('p'),
  togglePauseMenu,
  toggleOrders:()=>ui.toggleOrders(),
  saveGame:()=>saveGame(false),
  requestNewGame,
  continueGame,
  toMainMenu,
  toggleAudio,
  sfx:n=>AUDIO.sfx(n),
  refreshTech:()=>ui.refreshTech(S),
  closeInspector,
  setRecipe:(b,rid)=>{
    setRecipe(b,rid);
    ui.refreshInspectorLive(S);
  },
  rotateSelected,
  upgradeSelected,
  deleteSelected,
  dismissTutorial:()=>{S.tut.dismissed=true; saveGame(true);},
  onChange,
  selectBuilding,
  modalOpen,
  menuOpen,
  toggleTech:()=>ui.toggleTech(),
  closeModals:()=>{
    if(ui.pauseOpen()){ togglePauseMenu(); }
    else ui.closeModals();
  }
};

const rateBuf=[];
let rateAcc=0;

function sampleRates(dtReal){
  rateAcc+=dtReal;
  if(rateAcc<1) return;
  rateAcc=0;
  rateBuf.push({t:performance.now(),c:S.coins,r:S.rp});
  if(rateBuf.length>70) rateBuf.shift();
}

function currentRates(){
  const n=rateBuf.length;
  if(n<10) return {c:0,r:0};
  const a=rateBuf[Math.max(0,n-61)];
  const b=rateBuf[n-1];
  const mins=(b.t-a.t)/60000;
  if(mins<=0.02) return {c:0,r:0};
  return {c:(b.c-a.c)/mins,r:(b.r-a.r)/mins};
}

function tickUI(){
  S.stats.peakCoins=Math.max(S.stats.peakCoins||0,S.coins);
  checkContracts();
  ui.refreshTopbar(S);
  ui.refreshMenu(S);
  ui.refreshGoal(S);
  if(ui.ordersOpen()) ui.refreshOrders(S);
  const rt=currentRates();
  ui.setRates(rt.c,rt.r);
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
  ui.refreshGoal(S);
  ui.refreshTech(S);
  ui.setSpeedUI(speed,paused);
  input.setTool(null);
  document.getElementById('tutCard').classList.toggle('hidden',S.tut.dismissed);
  tickUI();
}

function loop(){
  requestAnimationFrame(loop);
  const dtReal=Math.min(clock.getDelta(),0.05);
  const blocked=paused||menuOpen();
  const dtSim=blocked?0:dtReal*speed;
  if(dtSim>0) S.stats.playTime=(S.stats.playTime||0)+dtSim;
  updateSim(S,dtSim,evt);
  input.update(dtReal);
  sampleRates(dtReal);
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

// Blender-GLB fuer den Sorter laden (optional - prozeduraler Fallback im Renderer)
async function loadGameAssets(){
  const assets={};
  try{
    const {GLTFLoader}=await import('https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
    const loader=new GLTFLoader();
    const gltf=await new Promise((res,rej)=>{
      const to=setTimeout(()=>rej(new Error('timeout')),8000);
      loader.load(SORTER_GLB_URL,g=>{
        clearTimeout(to); res(g);
      },undefined,e=>{clearTimeout(to);rej(e);});
    });
    assets.sorter=gltf.scene;
  }catch(err){
    console.warn('Sorter-GLB nicht geladen, nutze Fallback:',err&&err.message?err.message:err);
  }
  return assets;
}

async function boot(){
  const loaded=tryLoad();
  S=loaded||freshState();
  S.__loaded=!!loaded;

  if(!loaded){
    const c=Math.floor(GRID/2);
    const lab=makeBuilding(S,'lab',c,c+2,1);
    addBuilding(S,lab);
  }

  const assets=await loadGameAssets();
  const container=document.getElementById('app');
  render=initRender(container,assets);
  ui=initUI(hooks);
  const ictx=Object.assign({},hooks,{render,ui,selected:()=>selected});
  input=initInput(render.dom,ictx);

  document.getElementById('btnRotL').addEventListener('click',()=>render.cam.rotateSnap(-1));
  document.getElementById('btnRotR').addEventListener('click',()=>render.cam.rotateSnap(1));
  document.getElementById('btnZoomIn').addEventListener('click',()=>render.cam.zoom(0.85));
  document.getElementById('btnZoomOut').addEventListener('click',()=>render.cam.zoom(1.18));
  document.getElementById('mbCancel').addEventListener('click',()=>input.setTool(null));

  ui.syncAudioBtns(AUDIO.isMuted());
  // Autoplay-Policy: Audio beim ersten echten Input entsperren
  const unlock=()=>{ AUDIO.unlock(); };
  window.addEventListener('pointerdown',unlock,{once:true});
  window.addEventListener('keydown',unlock,{once:true});

  boot2(!S.__loaded);

  // Hauptmenü immer zuerst; Welt läuft pausiert darunter weiter (sim eingefroren)
  ui.showMenu(S,S.__loaded);

  window.addEventListener('beforeunload',()=>saveGame(true));
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden) saveGame(true);
  });

  // Debug-/Test-Hook (kein Spielbestandteil)
  window.__fw={
    getS:()=>S,
    render,
    ui,
    input,
    save:()=>saveGame(true)
  };

  loop();
}

boot();
