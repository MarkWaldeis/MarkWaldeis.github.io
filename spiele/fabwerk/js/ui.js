import {
  ITEMS, BUILDINGS, CATS, TECHS, RECIPE_BY_ID,
  isUnlockedBuilding, recipesFor,
  techName, fmt, OUT_CAP, INPUT_CAP, RES_NAME,
  MAX_LEVEL, UPGRADEABLE_TYPES, upgradeCost
} from './config.js';

const DIR_NAMES=['O','S','W','N'];
const ROMAN=['','I','II','III','IV'];
const MULT_LABEL={belt:'Band-Tempo',extractor:'Extraktor-Tempo',furnace:'Ofen-Tempo',inserter:'Greifer-Tempo',assembler:'Montage-Tempo',lab:'Labor-Tempo'};

export function initUI(hooks){
  const el=id=>document.getElementById(id);
  const ui={
    coins:el('coinsVal'),
    rp:el('rpVal'),
    menu:el('buildMenu'),
    insp:el('inspector'),
    techModal:el('techModal'),
    techList:el('techList'),
    helpModal:el('helpModal'),
    toasts:el('toasts'),
    tut:el('tutCard'),
    tutList:el('tutList'),
    speedBtns:{}
  };

  let activeCat='logistics';
  let activeTool=null;
  let chipRow=null;

  function toast(msg,bad){
    let v='success';
    if(bad===true) v='bad';
    else if(bad==='info'||bad==='bad'||bad==='success') v=bad;
    const d=document.createElement('div');
    d.className='toast '+v;
    d.textContent=msg;
    ui.toasts.appendChild(d);
    requestAnimationFrame(()=>d.classList.add('show'));
    setTimeout(()=>{
      d.classList.remove('show');
      setTimeout(()=>d.remove(),300);
    },2400);
  }
  ui.toast=toast;

  function iconOf(name){
    const w=name.split(/[\s-]+/).filter(Boolean);
    if(w.length>1) return (w[0][0]+w[1][0]).toUpperCase();
    return name.slice(0,2).toUpperCase();
  }

  function makeChip(type){
    const def=BUILDINGS[type];
    const chip=document.createElement('button');
    chip.className='chip cat-'+def.cat;
    chip.dataset.type=type;
    chip.innerHTML=`
      <span class="chipIcon">${iconOf(def.name)}</span>
      <span class="chipBody">
        <span class="chipName">${def.name}</span>
        <span class="cost"><i></i><span class="costNum">${fmt(def.cost)}</span></span>
      </span>
      <span class="lockTag"></span>`;
    chip.addEventListener('click',()=>hooks.setTool(type));
    return chip;
  }

  function renderCat(){
    ui.menu.querySelectorAll('#buildTabs button').forEach(b=>{
      b.classList.toggle('active',b.dataset.cat===activeCat);
    });
    chipRow.innerHTML='';
    for(const type in BUILDINGS){
      const def=BUILDINGS[type];
      if(def.cat!==activeCat) continue;
      chipRow.appendChild(makeChip(type));
    }
    const S=hooks.getS&&hooks.getS();
    if(S) ui.refreshMenu(S);
    else applyActive();
  }

  function buildMenu(){
    ui.menu.innerHTML='';
    const tabs=document.createElement('div');
    tabs.id='buildTabs';
    for(const [cat,label] of CATS){
      const tb=document.createElement('button');
      tb.dataset.cat=cat;
      tb.textContent=label;
      tb.addEventListener('click',()=>{
        if(activeCat!==cat){ activeCat=cat; renderCat(); }
      });
      tabs.appendChild(tb);
    }
    ui.menu.appendChild(tabs);
    chipRow=document.createElement('div');
    chipRow.id='buildChips';
    ui.menu.appendChild(chipRow);
    renderCat();
  }

  ui.buildMenu=buildMenu;

  function applyActive(){
    ui.menu.querySelectorAll('.chip').forEach(c=>{
      c.classList.toggle('active',c.dataset.type===activeTool);
    });
  }

  ui.refreshMenu=S=>{
    ui.menu.querySelectorAll('.chip').forEach(chip=>{
      const t=chip.dataset.type;
      const def=BUILDINGS[t];
      if(!def) return;
      const unlocked=isUnlockedBuilding(S,t);
      const lock=chip.querySelector('.lockTag');
      if(unlocked){
        lock.style.display='none';
        chip.title=`${def.name} - ${def.desc}`;
      }else{
        lock.style.display='';
        lock.textContent=techName(def.tech);
        chip.title=`Gesperrt - benötigt: ${techName(def.tech)}`;
      }
      chip.classList.toggle('locked',!unlocked);
      chip.classList.toggle('poor',unlocked&&S.coins<def.cost);
    });
    applyActive();
  };

  ui.setActiveTool=type=>{
    activeTool=type||null;
    applyActive();
  };

  ui.refreshTopbar=S=>{
    ui.coins.textContent=fmt(S.coins);
    ui.rp.textContent=fmt(S.rp);
  };

  ui.setSpeedUI=(speed,paused)=>{
    for(const k in ui.speedBtns){
      ui.speedBtns[k].classList.toggle('active',paused?k==='p':String(speed)===k);
    }
  };

  function initTopbar(){
    const mk=(id,fn)=>{
      const b=el(id);
      b.addEventListener('click',fn);
      return b;
    };
    ui.speedBtns.p=mk('btnPause',()=>hooks.setSpeed('p'));
    ui.speedBtns[1]=mk('btnSp1',()=>hooks.setSpeed(1));
    ui.speedBtns[2]=mk('btnSp2',()=>hooks.setSpeed(2));
    ui.speedBtns[3]=mk('btnSp3',()=>hooks.setSpeed(3));
    mk('btnTech',()=>ui.toggleTech());
    mk('btnHelp',()=>ui.toggleHelp());
    mk('btnSave',()=>hooks.saveGame());
  }

  ui.closeModals=()=>{
    ui.techModal.classList.add('hidden');
    ui.helpModal.classList.add('hidden');
  };
  ui.techOpen=()=>!ui.techModal.classList.contains('hidden');
  ui.toggleTech=()=>{
    ui.helpModal.classList.add('hidden');
    ui.techModal.classList.toggle('hidden');
    if(!ui.techModal.classList.contains('hidden')) hooks.refreshTech();
  };
  ui.toggleHelp=()=>{
    ui.techModal.classList.add('hidden');
    ui.helpModal.classList.toggle('hidden');
  };

  function effectTags(t){
    const tags=[];
    if(t.unlockRecipes&&t.unlockRecipes.length) tags.push(['new','Neue Rezepte']);
    if(t.unlockBuildings&&t.unlockBuildings.length) tags.push(['new','Neues Gebäude']);
    for(const k in (t.mult||{})){
      const p=Math.round((t.mult[k]-1)*100);
      tags.push(['mult',`${MULT_LABEL[k]||k} +${p}%`]);
    }
    if(!tags.length) return '';
    return `<div class="tags">${tags.map(([c,x])=>`<span class="tag ${c}">${x}</span>`).join('')}</div>`;
  }

  ui.refreshTech=S=>{
    const fp=el('techRp');
    if(fp) fp.textContent=fmt(S.rp);
    ui.techList.innerHTML='';
    const depth=t=>{
      let d=1;
      for(const r of t.req){
        const rt=TECHS.find(x=>x.id===r);
        if(rt) d=Math.max(d,depth(rt)+1);
      }
      return d;
    };
    const tiers={};
    for(const t of TECHS){
      (tiers[depth(t)]=tiers[depth(t)]||[]).push(t);
    }
    const maxTier=Math.max(...Object.keys(tiers).map(Number));
    for(let i=1;i<=maxTier;i++){
      const col=document.createElement('div');
      col.className='tierCol';
      const head=document.createElement('div');
      head.className='tierHead';
      head.textContent='Stufe '+i;
      col.appendChild(head);
      for(const t of (tiers[i]||[])){
        const owned=S.researched.has(t.id);
        const missing=(t.req||[]).filter(r=>!S.researched.has(r));
        const can=!owned&&missing.length===0&&S.rp>=t.cost;
        const card=document.createElement('div');
        card.className='techCard'+(owned?' owned':'')+(can?' can':'')+(!owned&&missing.length?' locked':'');
        card.innerHTML=`
          <div class="techName">${t.name}</div>
          <div class="techDesc">${t.desc}</div>
          ${effectTags(t)}
          <div class="techFoot">
            <span class="rpCost"><span class="dot sm rp"></span>${fmt(t.cost)} FP</span>
            <button class="${can?'primary':''}" ${(owned||!can)?'disabled':''}>${owned?'Erforscht':(can?'Forschen':'Gesperrt')}</button>
          </div>`;
        if(missing.length){
          const m=document.createElement('div');
          m.className='techMissing';
          m.textContent='Braucht: '+missing.map(techName).join(', ');
          card.appendChild(m);
        }
        card.querySelector('button').addEventListener('click',()=>{
          hooks.buyTech(t.id);
        });
        col.appendChild(card);
      }
      ui.techList.appendChild(col);
    }
  };

  let inspKey=null;
  let inspRefs={};

  function keyOfB(b){return b.z*10000+b.x;}

  function paintUpgrade(b,S){
    const btn=inspRefs.upBtn;
    if(!btn) return;
    const lv=b.level||1;
    if(inspRefs.upLv) inspRefs.upLv.textContent=`Stufe ${ROMAN[lv]} / ${ROMAN[MAX_LEVEL]}`;
    if(lv>=MAX_LEVEL){
      btn.textContent='Maximal erreicht';
      btn.disabled=true;
      btn.classList.remove('primary');
      btn.title='Endstufe erreicht';
      return;
    }
    const cost=upgradeCost(BUILDINGS[b.type].cost,lv);
    const ok=S.coins>=cost;
    btn.disabled=!ok;
    btn.classList.toggle('primary',ok);
    btn.innerHTML=`<i class="dot sm gold"></i><span class="${ok?'':'poorNum'}">${fmt(cost)}</span>`;
    btn.title=ok?`Auf Stufe ${ROMAN[lv+1]} ausbauen (+50% Tempo)`:`Nicht genug Münzen - kostet ${fmt(cost)}`;
  }

  ui.showInspector=(S,b)=>{
    if(!b){
      ui.insp.classList.add('hidden');
      inspKey=null;
      inspRefs={};
      return;
    }
    inspKey=keyOfB(b);
    const under=b.type==='under_in'||b.type==='under_out';
    const def=BUILDINGS[b.type]||(under?{name:'Unterführung'}:{name:b.type});
    ui.insp.classList.remove('hidden');
    const upable=!under&&UPGRADEABLE_TYPES.includes(b.type);
    const rows=[];
    rows.push(`<div class="inspHead"><span class="inspTitle">${def.name}${upable?` <span class="lvBadge">${ROMAN[b.level||1]}</span>`:''}</span><button id="inspClose" title="Schließen">X</button></div>`);
    rows.push(`<div class="inspSub">Position ${b.x} / ${b.z}${b.dir!==undefined&&!['market'].includes(b.type)?` &middot; Richtung ${DIR_NAMES[b.dir]}`:''}</div>`);
    if(upable){
      rows.push(`<div class="upBox"><span class="lvl" id="inspUpLv"></span><button id="inspUpBtn" class="upBtn"></button></div>`);
    }
    if(b.type==='extractor'){
      rows.push(`<div class="row"><span>Ressource</span><b>${RES_NAME[b.res]||'-'}</b></div>`);
    }
    if(['extractor','furnace','assembler'].includes(b.type)){
      const opts=recipesFor(S,b.type);
      if(b.type!=='extractor'){
        let sel='<option value="">- Rezept wählen -</option>';
        for(const r of opts){
          sel+=`<option value="${r.id}"${b.recipe===r.id?' selected':''}>${recipeLabel(r)}</option>`;
        }
        rows.push(`<div class="row col"><span>Rezept</span><select id="inspRecipe">${sel}</select></div>`);
      }
      rows.push(`<div class="row"><span>Fortschritt</span><div class="bar"><div id="inspProg"></div></div></div>`);
      rows.push(`<div class="row"><span>Effizienz</span><b id="inspEff">-</b></div>`);
      rows.push(`<div class="row"><span>Eingang</span><span id="inspIn" class="itemChips"></span></div>`);
      rows.push(`<div class="row"><span>Ausgang</span><span id="inspOut" class="itemChips"></span></div>`);
    }
    if(b.type==='lab'){
      rows.push(`<div class="row"><span>Fortschritt</span><div class="bar"><div id="inspProg"></div></div></div>`);
      rows.push(`<div class="row"><span>Eingang</span><span id="inspIn" class="itemChips"></span></div>`);
      rows.push('<div class="hint">Belohnt Lieferungen SOFORT mit Münzen und Forschung. Rohstoffe bringen wenig, hochwertige Waren viel.</div>');
    }
    if(b.type==='market'){
      rows.push(`<div class="row"><span>Verkauft</span><b id="inspSold">0</b></div>`);
      rows.push('<div class="hint">Bezahlt den vollen Itempreis - aber keine Forschung.</div>');
    }
    if(b.type==='inserter'){
      rows.push(`<div class="row"><span>Hält</span><b id="inspHeld">-</b></div>`);
      rows.push('<div class="hint">Nimmt von der Kachel hinter sich und legt vor sich ab.</div>');
    }
    if(b.items){
      rows.push(`<div class="row"><span>Auf Band</span><b id="inspItems">0</b></div>`);
    }
    rows.push('<div class="inspBtns"><button id="inspRotate">Drehen</button><button id="inspDel" class="danger">Abrei&szlig;en</button></div>');
    ui.insp.innerHTML=rows.join('');
    el('inspClose').addEventListener('click',()=>hooks.closeInspector());
    const rs=el('inspRecipe');
    if(rs) rs.addEventListener('change',()=>hooks.setRecipe(b,rs.value));
    el('inspRotate').addEventListener('click',()=>hooks.rotateSel());
    el('inspDel').addEventListener('click',()=>hooks.deleteSelected());
    inspRefs={
      prog:el('inspProg'),
      eff:el('inspEff'),
      inChips:el('inspIn'),
      out:el('inspOut'),
      sold:el('inspSold'),
      held:el('inspHeld'),
      items:el('inspItems'),
      upBtn:el('inspUpBtn'),
      upLv:el('inspUpLv')
    };
    if(inspRefs.upBtn){
      inspRefs.upBtn.addEventListener('click',()=>{
        if(hooks.upgradeSelected) hooks.upgradeSelected();
      });
    }
    ui.refreshInspectorLive(S);
  };

  function recipeLabel(r){
    const inn=Object.entries(r.inp).map(([k,v])=>`${v}x ${ITEMS[k].name}`).join(' + ');
    return `${inn} &rarr; ${r.n>1?r.n+'x ':''}${ITEMS[r.out].name}`;
  }

  ui.refreshInspectorLive=S=>{
    if(!inspKey) return;
    let b=null;
    for(const bb of S.buildings.values()){
      if(keyOfB(bb)===inspKey){ b=bb; break; }
    }
    if(!b){ ui.showInspector(null); return; }
    const chipHtml=(map,cap)=>{
      const parts=[];
      for(const k in map){
        if(!ITEMS[k]) continue;
        const c='#'+ITEMS[k].color.toString(16).padStart(6,'0');
        parts.push(`<span class="ichip"><i style="background:${c}"></i>${ITEMS[k].name} ${map[k]}${cap?'/'+cap:''}</span>`);
      }
      return parts.length?parts.join(' '):'<span class="dim">leer</span>';
    };
    if(inspRefs.prog){
      let pct=0;
      if(b.crafting){
        if(b.type==='lab'){
          pct=Math.min(100,(b.progress||0)*100);
        }else{
          const rec=b.recipe?RECIPE_BY_ID[b.recipe]:null;
          const time=rec?rec.time:3;
          pct=Math.min(100,b.progress/time*100);
        }
      }
      inspRefs.prog.style.width=pct+'%';
    }
    if(inspRefs.eff){
      const e=b.total>0?Math.round(b.worked/b.total*100):0;
      inspRefs.eff.textContent=e+'%';
    }
    if(inspRefs.inChips) inspRefs.inChips.innerHTML=chipHtml(b.inputs||{},INPUT_CAP);
    if(inspRefs.out){
      inspRefs.out.innerHTML=b.outItem&&b.outCount>0
        ?`<span class="ichip"><i style="background:#${ITEMS[b.outItem].color.toString(16).padStart(6,'0')}"></i>${ITEMS[b.outItem].name} ${b.outCount}/${OUT_CAP}</span>`
        :'<span class="dim">leer</span>';
    }
    if(inspRefs.sold) inspRefs.sold.textContent=fmt(b.count||0);
    if(inspRefs.held) inspRefs.held.textContent=b.hold?ITEMS[b.hold].name:'-';
    if(inspRefs.items) inspRefs.items.textContent=b.items?b.items.length:0;
    paintUpgrade(b,S);
  };

  ui.tutDismiss=()=>{
    ui.tut.classList.add('hidden');
  };

  const TUT_ITEMS=[
    ['t1','Setze einen Extraktor auf eine Ressource'],
    ['t2','Verbinde Ofen und Extraktor mit einem Förderband'],
    ['t3','Beliefere das Labor am Spawn (gibt Forschung)'],
    ['t4','Erforsche deine erste Technologie'],
    ['t5','Baue eine Montage'],
    ['t6','Erreiche 2.000 Münzen']
  ];

  function buildTut(){
    ui.tutList.innerHTML='';
    for(const [id,txt] of TUT_ITEMS){
      const li=document.createElement('li');
      li.id='tut_'+id;
      li.textContent=txt;
      ui.tutList.appendChild(li);
    }
  }

  ui.tickTutorial=S=>{
    if(S.tut.dismissed) return;
    let ext=false,fur=false,belt=false,asm=false;
    for(const b of S.buildings.values()){
      if(b.type==='extractor')ext=true;
      if(b.type==='furnace')fur=true;
      if(b.type==='belt')belt=true;
      if(b.type==='assembler')asm=true;
    }
    const done={
      t1:ext,
      t2:fur&&belt,
      t3:S.stats.rpEarned>0,
      t4:S.researched.size>0,
      t5:asm,
      t6:S.stats.peakCoins>=2000
    };
    let all=true;
    for(const [id] of TUT_ITEMS){
      el('tut_'+id).classList.toggle('done',!!done[id]);
      if(!done[id]) all=false;
    }
    ui.tut.classList.toggle('hidden',all);
  };

  initTopbar();
  buildMenu();
  buildTut();

  el('techClose').addEventListener('click',()=>ui.toggleTech());
  el('helpClose').addEventListener('click',()=>ui.toggleHelp());
  el('tutClose').addEventListener('click',()=>{
    ui.tutDismiss();
    hooks.dismissTutorial();
  });
  el('helpNew').addEventListener('click',()=>hooks.newGame());

  return ui;
}
