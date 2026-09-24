import {
  GRID, START_COINS, ITEMS, RECIPE_BY_ID, BUILDINGS,
  RES_ITEM, keyOf, UNDER_MIN
} from './config.js';

export function mulberry32(a){
  return function(){
    a|=0; a=(a+0x6D2B79F5)|0;
    let t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

export function newState(seed){
  return {
    seed,
    size:GRID,
    res:new Uint8Array(GRID*GRID),
    buildings:new Map(),
    nextId:1,
    coins:START_COINS,
    rp:0,
    researched:new Set(),
    stats:{earned:0,sold:0,rpEarned:0,peakCoins:START_COINS},
    tut:{dismissed:false}
  };
}

export function genTerrain(S){
  const rng=mulberry32(S.seed);
  const size=S.size;
  const res=S.res;
  const cx=size/2, cz=size/2;
  const plan=[
    [1,5],[2,5],[3,4],[4,4],[5,7]
  ];
  for(const [code,count] of plan){
    for(let p=0;p<count;p++){
      let px=0,pz=0,ok=false;
      for(let tries=0;tries<80&&!ok;tries++){
        px=4+Math.floor(rng()*(size-8));
        pz=4+Math.floor(rng()*(size-8));
        const dx=px-cx,dz=pz-cz;
        if(dx*dx+dz*dz>13*13) ok=true;
      }
      if(!ok) continue;
      const blob=14+Math.floor(rng()*14);
      let x=px,z=pz;
      for(let i=0;i<blob;i++){
        const ddx=x-cx,ddz=z-cz;
        if(ddx*ddx+ddz*ddz>10*10 && x>1&&z>1&&x<size-2&&z<size-2){
          res[z*size+x]=code;
        }
        const dir=Math.floor(rng()*4);
        if(dir===0&&x<size-2)x++;
        else if(dir===1&&z<size-2)z++;
        else if(dir===2&&x>1)x--;
        else if(dir===3&&z>1)z--;
      }
    }
  }
  S.decorSeed=Math.floor(rng()*1e9);
}

export function makeBuilding(S,type,x,z,dir,resCode){
  const b={
    id:S.nextId++,
    type,
    x,z,
    dir:((dir%4)+4)%4
  };
  switch(type){
    case 'belt':
    case 'under_in':
    case 'under_out':
      b.items=[];
      if(type!=='belt'){ b.buf=[]; b.link=null; }
      break;
    case 'splitter':
      b.items=[];
      b.pref=false;
      break;
    case 'extractor':
    case 'furnace':
    case 'assembler':
      b.recipe=null;
      b.progress=0;
      b.crafting=false;
      b.inputs={};
      b.outItem=null;
      b.outCount=0;
      b.worked=0;
      b.total=0;
      b.res=resCode||0;
      b.level=1;
      break;
    case 'lab':
      b.progress=0;
      b.crafting=false;
      b.inputs={};
      b.curItem=null;
      b.worked=0;
      b.total=0;
      b.level=1;
      b.timer=0;
      break;
    case 'inserter':
      b.hold=null;
      b.phase=0;
      b.level=1;
      break;
    case 'market':
      b.count=0;
      break;
  }
  return b;
}

export function getB(S,x,z){
  return S.buildings.get(keyOf(x,z));
}

export function addBuilding(S,b){
  S.buildings.set(keyOf(b.x,b.z),b);
  if(b.type==='under_in') tryLinkFrom(S,b);
  else if(b.type==='under_out') tryLinkFrom(S,b);
  return b;
}

function tryLinkFrom(S,b){
  const stepX=DXW[b.dir], stepZ=DZW[b.dir];
  const sgn=b.type==='under_in'?1:-1;
  for(let t=UNDER_MIN; t<=6; t++){
    const nx=b.x+stepX*t*sgn;
    const nz=b.z+stepZ*t*sgn;
    if(nx<0||nz<0||nx>=S.size||nz>=S.size) break;
    const o=S.buildings.get(keyOf(nx,nz));
    if(!o) continue;
    const want=b.type==='under_in'?'under_out':'under_in';
    if(o.type===want&&o.dir===b.dir&&!o.link){
      b.link=keyOf(nx,nz); o.link=keyOf(b.x,b.z); return true;
    }
  }
  return false;
}
const DXW=[1,0,-1,0], DZW=[0,1,0,-1];

export function removeBuilding(S,b){
  if((b.type==='under_in'||b.type==='under_out')&&b.link){
    const o=S.buildings.get(b.link);
    if(o&&(o.type==='under_in'||o.type==='under_out')) o.link=null;
    b.link=null;
  }
  S.buildings.delete(keyOf(b.x,b.z));
}

function serB(b){
  const o={t:b.type,x:b.x,z:b.z,d:b.dir};
  if(b.items) o.items=b.items.map(i=>[i.it,Math.round(i.pos*1000)/1000,i.es]);
  if(b.buf) o.buf=b.buf.slice();
  if(b.link!==undefined) o.lk=b.link;
  if(b.pref!==undefined) o.pf=b.pref?1:0;
  if(b.recipe!==undefined) o.rc=b.recipe;
  if(b.inputs!==undefined) o.inp=b.inputs;
  if(b.outItem!==undefined){o.oi=b.outItem;o.oc=b.outCount;}
  if(b.worked!==undefined){o.w=Math.round(b.worked*10)/10;o.tt=Math.round(b.total*10)/10;}
  if(b.res!==undefined) o.rs=b.res;
  if(b.level!==undefined) o.lv=b.level;
  if(b.timer!==undefined) o.tm=Math.round(b.timer*1000)/1000;
  if(b.hold!==undefined) o.hd=b.hold;
  if(b.phase!==undefined) o.ph=Math.round(b.phase*1000)/1000;
  if(b.count!==undefined) o.cn=b.count;
  if(b.curItem!==undefined) o.ci=b.curItem;
  if(b.crafting!==undefined) o.cr=b.crafting?1:0;
  if(b.progress!==undefined) o.pg=Math.round(b.progress*1000)/1000;
  return o;
}

function deserB(S,o){
  const b=makeBuilding(S,o.t,o.x,o.z,o.d||0,o.rs||0);
  if(o.items&&b.items){
    for(const [it,pos,es] of o.items){
      if(ITEMS[it]&&isFinite(pos)) b.items.push({it,pos:Math.min(1,Math.max(0,pos)),es:(es|0)&3});
    }
    b.items.sort((a,c)=>c.pos-a.pos);
  }
  if(o.buf&&b.buf) b.buf=o.buf.filter(i=>ITEMS[i]);
  if(o.lk!==undefined&&b.link!==undefined) b.link=o.lk;
  if(o.pf!==undefined&&b.pref!==undefined) b.pref=!!o.pf;
  if(o.rc&&b.recipe!==undefined){
    const r=RECIPE_BY_ID[o.rc];
    if(r&&r.machine===o.t) b.recipe=o.rc;
  }
  if(o.inp&&b.inputs){
    for(const k in o.inp){
      if(ITEMS[k]&&typeof o.inp[k]==='number'&&o.inp[k]>0) b.inputs[k]=Math.min(99,Math.floor(o.inp[k]));
    }
  }
  if(o.oi!==undefined&&b.outItem!==undefined&&ITEMS[o.oi]){ b.outItem=o.oi; b.outCount=Math.max(0,Math.min(99,o.oc|0)); }
  if(o.w!==undefined&&b.worked!==undefined){ b.worked=o.w; b.total=o.tt; }
  if(o.lv!==undefined&&b.level!==undefined) b.level=Math.max(1,Math.min(4,o.lv|0));
  if(o.tm!==undefined&&b.timer!==undefined) b.timer=o.tm;
  if(o.hd&&b.hold!==undefined&&ITEMS[o.hd]) b.hold=o.hd;
  if(o.ph!==undefined&&b.phase!==undefined) b.phase=o.ph;
  if(o.cn!==undefined&&b.count!==undefined) b.count=o.cn;
  if(o.ci&&b.curItem!==undefined&&ITEMS[o.ci]) b.curItem=o.ci;
  if(o.cr!==undefined&&b.crafting!==undefined) b.crafting=!!o.cr;
  if(o.pg!==undefined&&b.progress!==undefined){
    b.progress=o.pg;
    if(b.type==='lab') b.progress=Math.max(0,Math.min(1,b.progress));
  }
  return b;
}

export function serialize(S){
  return {
    v:1,
    seed:S.seed,
    coins:S.coins,
    rp:S.rp,
    nextId:S.nextId,
    researched:[...S.researched],
    stats:S.stats,
    tut:S.tut,
    buildings:[...S.buildings.values()].map(serB)
  };
}

const VALID_TYPES=new Set([...Object.keys(BUILDINGS),'under_in','under_out']);

export function loadState(obj){
  const S=newState(obj.seed??(Math.random()*1e9|0));
  genTerrain(S);
  S.coins=typeof obj.coins==='number'?obj.coins:S.coins;
  S.rp=typeof obj.rp==='number'?obj.rp:0;
  S.nextId=obj.nextId||1;
  S.researched=new Set((obj.researched||[]).filter(id=>typeof id==='string'));
  if(obj.stats) S.stats=Object.assign(S.stats,obj.stats);
  if(obj.tut) S.tut=Object.assign(S.tut,obj.tut);
  if(Array.isArray(obj.buildings)){
    for(const o of obj.buildings){
      if(!VALID_TYPES.has(o.t)) continue;
      if(typeof o.x!=='number'||typeof o.z!=='number') continue;
      if(o.x<0||o.z<0||o.x>=S.size||o.z>=S.size) continue;
      const k=keyOf(o.x,o.z);
      if(S.buildings.has(k)) continue;
      const b=deserB(S,o);
      if(b.type==='extractor'&&!S.res[k]) b.res=0;
      S.buildings.set(k,b);
    }
    for(const b of S.buildings.values()){
      if((b.type==='under_in'||b.type==='under_out')&&b.link){
        const o=S.buildings.get(b.link);
        if(!o||(o.type!=='under_in'&&o.type!=='under_out')) b.link=null;
      }
    }
  }
  return S;
}
