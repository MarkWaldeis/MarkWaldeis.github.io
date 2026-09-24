import {
  GRID, ITEM_SPACING, BASE_BELT_SPEED, INPUT_CAP, OUT_CAP, UNDER_CAP,
  EXTRACT_TIME, LAB_TIME, ITEMS, RECIPES, RECIPE_BY_ID, TECHS,
  RES_ITEM, LAB_ORDER, DX, DZ, keyOf, opp, left,
  multFor, isUnlockedRecipe, levelMult, LAB_FEE
} from './config.js';

export function isBeltLike(t){
  return t==='belt'||t==='splitter'||t==='under_in'||t==='under_out';
}

function beltRoom(b){
  const its=b.items;
  return its.length===0||its[its.length-1].pos>ITEM_SPACING;
}

function machineAccepts(S,m,item){
  if(m.type==='lab') return (m.inputs[item]||0)<INPUT_CAP;
  const rec=m.recipe?RECIPE_BY_ID[m.recipe]:null;
  if(!rec||!isUnlockedRecipe(S,rec.id)) return false;
  return !!rec.inp[item]&&(m.inputs[item]||0)<INPUT_CAP;
}

export function tryDeliver(S,nx,nz,mv,item,evt,dry,intoMachines=true){
  if(nx<0||nz<0||nx>=GRID||nz>=GRID) return false;
  const b=S.buildings.get(keyOf(nx,nz));
  if(!b) return false;
  switch(b.type){
    case 'belt':{
      if(b.dir===opp(mv)) return false;
      if(!beltRoom(b)) return false;
      if(!dry) b.items.push({it:item,pos:0,es:opp(mv)});
      return true;
    }
    case 'splitter':{
      const es=opp(mv);
      if(es===b.dir||es===left(b.dir)) return false;
      if(!beltRoom(b)) return false;
      if(!dry) b.items.push({it:item,pos:0,es});
      return true;
    }
    case 'under_in':{
      if(b.buf.length>=UNDER_CAP) return false;
      if(!dry) b.buf.push(item);
      return true;
    }
    case 'under_out':
    case 'inserter':
      return false;
    case 'market':{
      if(!dry){
        const v=ITEMS[item].value;
        S.coins+=v;
        S.stats.earned+=v;
        S.stats.sold++;
        b.count++;
        if(evt&&evt.sell) evt.sell(item,v);
      }
      return true;
    }
    case 'lab':
    case 'extractor':
    case 'furnace':
    case 'assembler':{
      if(!intoMachines) return false;
      if(!machineAccepts(S,b,item)) return false;
      if(!dry) b.inputs[item]=(b.inputs[item]||0)+1;
      return true;
    }
  }
  return false;
}

function exitLimit(S,x,z,b,item,sp){
  const mv=b.dir;
  if(b.type==='under_in'){
    return b.buf.length<UNDER_CAP ? 1+sp : 1;
  }
  if(b.type==='splitter'){
    const outs=[b.dir,left(b.dir)];
    const order=b.pref?[1,0]:[0,1];
    for(const oi of order){
      const d=outs[oi];
      if(tryDeliver(S,x+DX[d],z+DZ[d],d,item,null,true)) return 1+sp;
    }
    return 1;
  }
  return tryDeliver(S,x+DX[mv],z+DZ[mv],mv,item,null,true) ? 1+sp : 1;
}

function doExitTransfer(S,x,z,b,evt){
  const item=b.items[0].it;
  if(b.type==='under_in'){
    if(b.buf.length<UNDER_CAP){ b.buf.push(item); b.items.shift(); return true; }
    return false;
  }
  if(b.type==='splitter'){
    const outs=[b.dir,left(b.dir)];
    const order=b.pref?[1,0]:[0,1];
    for(const oi of order){
      const d=outs[oi];
      if(tryDeliver(S,x+DX[d],z+DZ[d],d,item,evt,false)){
        b.items.shift();
        b.pref=!b.pref;
        return true;
      }
    }
    return false;
  }
  const mv=b.dir;
  if(tryDeliver(S,x+DX[mv],z+DZ[mv],mv,item,evt,false)){
    b.items.shift();
    return true;
  }
  return false;
}

function normalizeAfterShift(b){
  let prev=1;
  for(let i=0;i<b.items.length;i++){
    const it=b.items[i];
    if(it.pos>prev) it.pos=prev;
    prev=it.pos-ITEM_SPACING;
  }
}

function updateBeltTile(S,x,z,b,dt,evt){
  const sp=Math.min(BASE_BELT_SPEED*multFor(S,'belt')*dt,ITEM_SPACING*0.9);
  const its=b.items;
  if(b.type==='under_out'&&b.link){
    const L=S.buildings.get(b.link);
    if(L&&L.buf&&L.buf.length&&beltRoom(b)){
      its.push({it:L.buf.shift(),pos:0,es:opp(b.dir)});
    }
  }
  if(its.length===0) return;
  const lim=exitLimit(S,x,z,b,its[0].it,sp);
  let prev=lim;
  for(let i=0;i<its.length;i++){
    const it=its[i];
    const np=it.pos+sp;
    it.pos=np>prev?prev:np;
    prev=it.pos-ITEM_SPACING;
  }
  if(its[0].pos>=1-1e-6){
    if(doExitTransfer(S,x,z,b,evt)){
      normalizeAfterShift(b);
    } else {
      its[0].pos=1;
      for(let i=1;i<its.length;i++){
        if(its[i].pos>its[i-1].pos-ITEM_SPACING) its[i].pos=its[i-1].pos-ITEM_SPACING;
      }
    }
  }
}

function hasInputs(m,rec){
  for(const k in rec.inp){
    if((m.inputs[k]||0)<rec.inp[k]) return false;
  }
  return true;
}
function consumeInputs(m,rec){
  for(const k in rec.inp) m.inputs[k]-=rec.inp[k];
}

function outSpaceFor(m,out){
  if(m.outCount>=OUT_CAP) return false;
  if(m.outItem&&m.outItem!==out&&m.outCount>0) return false;
  return true;
}

function giveOut(m,out,n){
  m.outItem=out;
  m.outCount+=n;
}

function drainOut(S,m,evt){
  if(!m.outItem||m.outCount<=0) return;
  const nx=m.x+DX[m.dir], nz=m.z+DZ[m.dir];
  if(nx<0||nz<0||nx>=GRID||nz>=GRID) return;
  const nb=S.buildings.get(keyOf(nx,nz));
  if(!nb) return;
  if(nb.type==='market'){
    const v=ITEMS[m.outItem].value;
    S.coins+=v;
    S.stats.earned+=v;
    S.stats.sold++;
    nb.count++;
    m.outCount--;
    if(evt&&evt.sell) evt.sell(m.outItem,v);
    return;
  }
  if(nb.type!=='belt'&&nb.type!=='splitter'&&nb.type!=='under_in') return;
  if(nb.type==='belt'&&nb.dir===opp(m.dir)) return;
  if(nb.type==='splitter'){
    const es=opp(m.dir);
    if(es===nb.dir||es===left(nb.dir)) return;
  }
  if(nb.type==='under_in'){
    if(nb.buf.length<UNDER_CAP){ nb.buf.push(m.outItem); m.outCount--; }
    return;
  }
  if(beltRoom(nb)){ nb.items.push({it:m.outItem,pos:0,es:opp(m.dir)}); m.outCount--; }
}

function updateProducer(S,m,dt,evt){
  m.total+=dt;
  const speed=multFor(S,m.type)*levelMult(m);
  const rec=m.type==='extractor'?null:(m.recipe?RECIPE_BY_ID[m.recipe]:null);
  const recValid=!rec||isUnlockedRecipe(S,rec.id);
  const outItem=m.type==='extractor'?RES_ITEM[m.res]:(rec?rec.out:null);
  const outN=(rec?rec.n:1);
  const time=rec?rec.time:EXTRACT_TIME;
  if(outItem&&recValid){
    if(!m.crafting){
      if((m.type==='extractor'||hasInputs(m,rec))&&outSpaceFor(m,outItem)){
        if(m.type!=='extractor') consumeInputs(m,rec);
        m.crafting=true;
        m.progress=0;
      }
    } else {
      m.progress+=dt*speed;
      m.worked+=dt;
      if(m.progress>=time){
        if(outSpaceFor(m,outItem)){
          giveOut(m,outItem,outN);
          m.crafting=false;
          m.progress=0;
        } else {
          m.progress=time;
        }
      }
    }
  }
  drainOut(S,m,evt);
}

function updateLab(S,m,dt,evt){
  m.total+=dt;
  const speed=multFor(S,'lab')*levelMult(m);
  m.timer=(m.timer||0)-dt*speed;
  let guard=6;
  while(m.timer<=0&&guard-->0){
    let pick=null;
    for(const it of LAB_ORDER){
      if((m.inputs[it]||0)>0){ pick=it; break; }
    }
    if(!pick){
      for(const k in m.inputs){
        if(ITEMS[k]&&m.inputs[k]>0){ pick=k; break; }
      }
    }
    if(!pick){ m.timer=0; break; }
    m.inputs[pick]--;
    m.curItem=pick;
    const v=ITEMS[pick].value||1;
    const sci=ITEMS[pick].sci||1;
    const gain=Math.max(1,Math.floor(v*LAB_FEE));
    S.coins+=gain;
    S.stats.earned+=gain;
    S.stats.sold++;
    S.rp+=sci;
    S.stats.rpEarned+=sci;
    m.worked+=LAB_TIME;
    m.crafting=true;
    if(evt&&evt.sell) evt.sell(pick,gain);
    if(evt&&evt.rp) evt.rp(sci,sci<28);
    m.timer+=LAB_TIME;
  }
  let hasAny=false;
  for(const k in m.inputs){
    if((m.inputs[k]||0)>0){ hasAny=true; break; }
  }
  m.crafting=m.timer>0||hasAny;
  if(m.timer>0){
    m.progress=Math.max(0,Math.min(1,1-m.timer/LAB_TIME));
  }else{
    m.progress=0;
    if(!hasAny) m.curItem=null;
  }
}

function pickFromSource(S,n,item){
  const src=S.buildings.get(keyOf(n.x-DX[n.dir],n.z-DZ[n.dir]));
  n.srcType=src?src.type:null;
  if(!src) return null;
  switch(src.type){
    case 'belt':
    case 'splitter':
    case 'under_out':{
      const its=src.items;
      for(let i=0;i<its.length;i++){
        if(its[i].pos>=0.28){
          const taken=its[i].it;
          its.splice(i,1);
          return {item:taken};
        }
      }
      return null;
    }
    case 'under_in':
      return src.buf.length?{item:src.buf.shift()}:null;
    case 'extractor':
    case 'furnace':
    case 'assembler':
      if(src.outCount>0&&src.outItem){ src.outCount--; return {item:src.outItem}; }
      return null;
  }
  return null;
}

function placeToTarget(S,n,item,evt){
  const tx=n.x+DX[n.dir], tz=n.z+DZ[n.dir];
  return tryDeliver(S,tx,tz,n.dir,item,evt,false,true);
}

function updateInserter(S,n,dt,evt){
  const speed=1.2*multFor(S,'inserter')*levelMult(n);
  n.phase+=dt*speed;
  while(n.phase>=1)n.phase-=1;
  const firstHalf=n.phase<0.5;
  if(firstHalf){
    if(!n.hold){
      const got=pickFromSource(S,n);
      if(got) n.hold=got.item;
    }
  } else {
    if(n.hold){
      if(placeToTarget(S,n,n.hold,evt)) n.hold=null;
    }
  }
}

export function updateSim(S,dt,evt){
  if(dt<=0) return;
  for(const b of S.buildings.values()){
    switch(b.type){
      case 'belt':
      case 'splitter':
      case 'under_in':
      case 'under_out':
        updateBeltTile(S,b.x,b.z,b,dt,evt);
        break;
      case 'inserter':
        updateInserter(S,b,dt,evt);
        break;
      case 'extractor':
      case 'furnace':
      case 'assembler':
        updateProducer(S,b,dt,evt);
        break;
      case 'lab':
        updateLab(S,b,dt,evt);
        break;
    }
  }
}
