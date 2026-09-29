// FABWERK Smoke-Test: Konsole, Menue, Modals, Sim-Loop, Screenshots
import { chromium } from 'file:///C:/Users/Mark%20Waldeis/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const BASE='http://127.0.0.1:8030/index.html';
const OUT='tools/shots';
fs.mkdirSync(OUT,{recursive:true});
const errors=[];
const logs=[];

const browser=await chromium.launch({headless:true,executablePath:'C:/Users/Mark Waldeis/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'});
const page=await browser.newPage({viewport:{width:1440,height:860}});
page.on('console',m=>{const t=`[${m.type()}] ${m.text()}`;logs.push(t);if(m.type()==='error')errors.push(t);});
page.on('pageerror',e=>errors.push('[pageerror] '+e.message));

await page.goto(BASE,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(2500);

// 1) Menü sichtbar?
const menuVisible=await page.evaluate(()=>!document.getElementById('menuOverlay').classList.contains('hidden'));
console.log('MENU_VISIBLE',menuVisible);
await page.screenshot({path:OUT+'/01_menu.png'});

// 2) Neues Spiel
await page.click('#btnNewGame');
await page.waitForTimeout(1200);
const menuGone=await page.evaluate(()=>document.getElementById('menuOverlay').classList.contains('hidden'));
console.log('MENU_GONE_AFTER_NEW',menuGone);
await page.screenshot({path:OUT+'/02_game.png'});

// 3) Hilfe schliessen (falls offen)
const helpOpen=await page.evaluate(()=>!document.getElementById('helpModal').classList.contains('hidden'));
if(helpOpen){await page.click('#helpClose');await page.waitForTimeout(300);}

// 4) Sim: Gebäude programmatisch setzen via __fw (Extractor->Belt->Furnace->Belt->Lab)
const placed=await page.evaluate(async()=>{
  const fw=window.__fw; const S=fw.getS();
  const {makeBuilding,addBuilding}=await import('./js/world.js');
  const c=Math.floor(S.size/2);
  // Finde Eisenvorkommen (res=1) in Spawnnähe
  let ex=-1,ez=-1;
  outer:for(let dz=-14;dz<14;dz++)for(let dx=-14;dx<14;dx++){
    const x=c+dx,z=c+dz;
    if(x<1||z<1||x>=S.size-1||z>=S.size-1)continue;
    if(S.res[z*S.size+x]===1&&!S.buildings.get(z*S.size+x)){ex=x;ez=z;break outer;}
  }
  if(ex<0) return {ok:false,why:'no iron'};
  const ext=makeBuilding(S,'extractor',ex,ez,0,1); addBuilding(S,ext); fw.render.buildingAdded(ext,S);
  // Belt-Linie: 3 Felder ostwärts
  for(let i=1;i<=3;i++){const b=makeBuilding(S,'belt',ex+i,ez,0);addBuilding(S,b);fw.render.buildingAdded(b,S);}
  const fur=makeBuilding(S,'furnace',ex+4,ez,0);fur.recipe='smelt_iron';addBuilding(S,fur);fw.render.buildingAdded(fur,S);
  for(let i=5;i<=7;i++){const b=makeBuilding(S,'belt',ex+i,ez,0);addBuilding(S,b);fw.render.buildingAdded(b,S);}
  const mkt=makeBuilding(S,'market',ex+8,ez,0);addBuilding(S,mkt);fw.render.buildingAdded(mkt,S);
  return {ok:true,ex,ez};
});
console.log('PLACED',JSON.stringify(placed));
await page.waitForTimeout(9000);
const simCheck=await page.evaluate(()=>{
  const S=window.__fw.getS();
  return {coins:S.coins,earned:S.stats.earned,sold:S.stats.sold,delivered:S.stats.delivered};
});
console.log('SIM',JSON.stringify(simCheck));
await page.screenshot({path:OUT+'/03_factory.png'});

// 5) Modals: Aufträge, Tech, Pause
await page.click('#btnOrders'); await page.waitForTimeout(400);
await page.screenshot({path:OUT+'/04_orders.png'});
const ordOpen=await page.evaluate(()=>!document.getElementById('ordersModal').classList.contains('hidden'));
console.log('ORDERS_OPEN',ordOpen);
await page.click('#ordersClose');
await page.click('#btnTech'); await page.waitForTimeout(400);
await page.screenshot({path:OUT+'/05_tech.png'});
await page.click('#techClose');
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
const pauseOpen=await page.evaluate(()=>!document.getElementById('pauseModal').classList.contains('hidden'));
console.log('PAUSE_OPEN',pauseOpen);
await page.screenshot({path:OUT+'/06_pause.png'});
await page.click('#pauseResume'); await page.waitForTimeout(300);

// 6) Gebäude-Klick setzen: Extraktor-Tool wählen + auf Ressource klicken
const chip=await page.evaluate(()=>{
  // Produktion-Tab aktivieren
  const tabs=[...document.querySelectorAll('#buildTabs button')];
  const prod=tabs.find(b=>b.dataset.cat==='production');
  prod.click();
  const chips=[...document.querySelectorAll('.chip')];
  const ext=chips.find(c=>c.dataset.type==='extractor');
  ext.click();
  return true;
});
await page.waitForTimeout(300);
// Klick auf Eisenfeld (Projektion via render.worldToScreen)
const clickPos=await page.evaluate(()=>{
  const fw=window.__fw;const S=fw.getS();const c=Math.floor(S.size/2);
  for(let dz=-14;dz<14;dz++)for(let dx=-14;dx<14;dx++){
    const x=c+dx,z=c+dz;
    if(S.res[z*S.size+x]===1&&!S.buildings.get(z*S.size+x)){
      return fw.render.worldToScreen(x,z);
    }
  }
  return null;
});
if(clickPos){
  await page.mouse.click(clickPos.x,clickPos.y);
  await page.waitForTimeout(400);
  const cnt=await page.evaluate(()=>window.__fw.getS().buildings.size);
  console.log('BUILDINGS_AFTER_CLICK',cnt);
}

// 7) localStorage-Save prüfen
const saveOk=await page.evaluate(()=>{window.__fw.save();const r=localStorage.getItem('fabwerk_save_v1');return r?JSON.parse(r).v:null});
console.log('SAVE_VERSION',saveOk);

console.log('---ERRORS---');
errors.forEach(e=>console.log(e));
console.log('ERR_COUNT',errors.length);
console.log('---WARN/LOG (letzte 15)---');
logs.slice(-15).forEach(l=>console.log(l));
await browser.close();
process.exit(errors.length?1:0);
