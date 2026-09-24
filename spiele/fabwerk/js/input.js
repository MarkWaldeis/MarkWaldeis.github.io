import {
  GRID, BUILDINGS, UNDER_MIN, UNDER_MAX,
  RES_ITEM, keyOf, recipesFor
} from './config.js';
import { getB, makeBuilding, addBuilding, removeBuilding } from './world.js';
import { isBeltLike } from './sim.js';

export function initInput(dom, ctx){

  const state={
    tool:null,
    ghostDir:0,
    hover:null,
    path:null,
    delDrag:false,
    panBtn:null,
    pointers:new Map(),
    keys:new Set(),
    pinch:null,
    downInfo:null
  };

  function tileFromEvent(e){
    return ctx.render.screenToTile(e.clientX,e.clientY);
  }

  function setTool(type){
    state.tool=type;
    ctx.ui.setActiveTool(type);
    if(!type) ctx.render.setGhost(null);
    ctx.closeInspector();
  }
  state.setTool=setTool;

  function rotateGhost(){
    state.ghostDir=(state.ghostDir+1)&3;
    updateGhost();
  }

  function existingReplaceable(b,type){
    if(!b) return true;
    if(isBeltLike(b.type)&&['belt','splitter'].includes(type)) return true;
    if(isBeltLike(b.type)&&!['belt','splitter'].includes(type)) return true;
    return false;
  }

  function canPlaceAt(S,type,x,z){
    if(x<0||z<0||x>=GRID||z>=GRID) return {ok:false,reason:'Ausserhalb der Karte'};
    const ex=getB(S,x,z);
    if(ex&&!existingReplaceable(ex,type)) return {ok:false,reason:'Feld ist belegt'};
    if(type==='extractor'){
      if(!S.res[keyOf(x,z)]) return {ok:false,reason:'Extraktor braucht eine Ressource'};
    }
    const def=BUILDINGS[type];
    if(def&&S.coins<def.cost) return {ok:false,reason:'Nicht genug Münzen'};
    return {ok:true};
  }

  function computePath(S,sx,sz,cx,cz,type){
    const res={cells:[],valid:false,mode:type==='underground'?'under':'path',ends:[]};
    const dx=cx-sx, dz=cz-sz;
    if(type==='underground'){
      if(dx!==0&&dz!==0) return res;
      const len=Math.abs(dx)+Math.abs(dz)+1;
      if(len<UNDER_MIN||len>UNDER_MAX) return res;
      let dir;
      if(dx>0)dir=0; else if(dx<0)dir=2; else if(dz>0)dir=1; else dir=3;
      const sxn=Math.sign(dx),szn=Math.sign(dz);
      for(let i=0;i<len;i++){
        res.cells.push({x:sx+sxn*i,z:sz+szn*i,dir});
      }
      const a=res.cells[0], b=res.cells[len-1];
      for(let i=1;i<len-1;i++){
        if(getB(S,res.cells[i].x,res.cells[i].z)) return res;
      }
      for(const c of [a,b]){
        const ex=getB(S,c.x,c.z);
        if(ex&&!isBeltLike(ex.type)) return res;
      }
      res.ends=[a,b];
      res.valid=true;
      return res;
    }
    const horizFirst=Math.abs(dx)>=Math.abs(dz);
    const pts=[{x:sx,z:sz}];
    let px=sx,pz=sz;
    const walk=(tx,tz)=>{
      while(px!==tx){ px+=Math.sign(tx-px); pts.push({x:px,z:pz}); }
      while(pz!==tz){ pz+=Math.sign(tz-pz); pts.push({x:px,z:pz}); }
    };
    if(horizFirst){
      walk(cx,pz);
      walk(cx,cz);
    }else{
      walk(px,cz);
      walk(cx,cz);
    }
    const n=pts.length;
    for(let i=0;i<n;i++){
      let d;
      if(i<n-1){
        const nx=pts[i+1];
        d=nx.x>pts[i].x?0:nx.x<pts[i].x?2:nx.z>pts[i].z?1:3;
      }else{
        d=i>0?(pts[i].x>pts[i-1].x?0:pts[i].x<pts[i-1].x?2:pts[i].z>pts[i-1].z?1:3):state.ghostDir;
      }
      res.cells.push({x:pts[i].x,z:pts[i].z,dir:d});
    }
    res.valid=res.cells.every(c=>{
      const ex=getB(S,c.x,c.z);
      return !ex||isBeltLike(ex.type);
    });
    return res;
  }

  function updateGhost(){
    const S=ctx.getS();
    if(!state.tool||state.path&&state.path.active){
      if(state.path&&state.path.active&&state.hover){
        const p=computePath(S,state.path.sx,state.path.sz,state.hover.x,state.hover.z,state.path.type);
        state.path.cur=p;
        ctx.render.setGhost({
          mode:p.mode==='under'?'under':'path',
          cells:p.cells,
          ends:p.ends,
          valid:p.valid&&(state.path.type==='underground'
            ?S.coins>=costOf('underground')
            :S.coins>=p.cells.length*BUILDINGS.belt.cost)
        });
      }
      return;
    }
    if(!state.hover) return;
    if(['belt','splitter','underground'].includes(state.tool)){
      if(state.tool==='splitter'){
        ctx.render.setGhost({
          mode:'single',
          type:'splitter',
          x:state.hover.x,z:state.hover.z,
          dir:state.ghostDir,
          valid:canPlaceAt(S,'splitter',state.hover.x,state.hover.z).ok&&S.coins>=costOf('splitter')
        });
        return;
      }
      if(state.tool==='belt'){
        ctx.render.setGhost({
          mode:'single',
          type:'belt',
          x:state.hover.x,z:state.hover.z,
          dir:state.ghostDir,
          valid:canPlaceAt(S,'belt',state.hover.x,state.hover.z).ok&&S.coins>=costOf('belt')
        });
        return;
      }
      ctx.render.setGhost({
        mode:'single',
        type:'belt',
        x:state.hover.x,z:state.hover.z,
        dir:state.ghostDir,
        valid:S.coins>=costOf('underground')&&canPlaceAt(S,'belt',state.hover.x,state.hover.z).ok
      });
      return;
    }
    const chk=canPlaceAt(S,state.tool,state.hover.x,state.hover.z);
    ctx.render.setGhost({
      mode:'single',
      type:state.tool==='underground'?'under_in':state.tool,
      x:state.hover.x,z:state.hover.z,
      dir:state.ghostDir,
      valid:chk.ok
    });
  }

  function costOf(type){
    if(type==='underground') return BUILDINGS.underground.cost;
    return BUILDINGS[type]?BUILDINGS[type].cost:0;
  }

  function changed(){
    ctx.onChange();
  }

  function removeAt(S,x,z){
    const b=getB(S,x,z);
    if(!b) return false;
    let refund=0;
    if(BUILDINGS[b.type]) refund=Math.floor(BUILDINGS[b.type].cost/2);
    if(b.type==='under_in'||b.type==='under_out') refund=20;
    S.coins+=refund;
    removeBuilding(S,b);
    ctx.render.buildingRemoved(b,S);
    if(ctx.selected()===b) ctx.closeInspector();
    return true;
  }

  function placeSingle(type,x,z){
    const S=ctx.getS();
    if(!canPlaceAt(S,type,x,z).ok) return;
    const ex=getB(S,x,z);
    if(ex) removeBuilding(S,ex),ctx.render.buildingRemoved(ex,S);
    S.coins-=costOf(type);
    const resCode=S.res[keyOf(x,z)]||0;
    const b=makeBuilding(S,type,x,z,state.ghostDir,resCode);
    if((type==='furnace')&&!b.recipe) b.recipe='smelt_iron';
    if(type==='assembler'){
      const r=recipesFor(S,'assembler');
      if(r.length) b.recipe=r[0].id;
    }
    addBuilding(S,b);
    ctx.render.buildingAdded(b,S);
    if(type==='extractor'&&!RES_ITEM[resCode]){ b.res=0; }
    changed();
  }

  function commitPath(){
    const p=state.path;
    if(!p||!p.cur) return;
    const S=ctx.getS();
    if(!p.cur.valid){
      ctx.ui.toast('Hier nicht möglich',true);
      state.path=null;
      ctx.render.setGhost(null);
      return;
    }
    if(p.type==='underground'){
      if(S.coins<costOf('underground')){
        ctx.ui.toast('Nicht genug Münzen',true);
        state.path=null;
        ctx.render.setGhost(null);
        return;
      }
      for(const c of [p.cur.ends[0],p.cur.ends[1]]){
        const ex=getB(S,c.x,c.z);
        if(ex){ removeBuilding(S,ex); ctx.render.buildingRemoved(ex,S); }
      }
      S.coins-=costOf('underground');
      const a=p.cur.ends[0], bEnd=p.cur.ends[1];
      const uin=makeBuilding(S,'under_in',a.x,a.z,a.dir);
      const uout=makeBuilding(S,'under_out',bEnd.x,bEnd.z,bEnd.dir);
      uin.link=keyOf(bEnd.x,bEnd.z);
      uout.link=keyOf(a.x,a.z);
      addBuilding(S,uin);
      addBuilding(S,uout);
      ctx.render.buildingAdded(uin,S);
      ctx.render.buildingAdded(uout,S);
    }else{
      const total=p.cur.cells.length*BUILDINGS.belt.cost;
      if(S.coins<total){
        ctx.ui.toast('Nicht genug Münzen',true);
        state.path=null;
        ctx.render.setGhost(null);
        return;
      }
      for(const c of p.cur.cells){
        const ex=getB(S,c.x,c.z);
        if(ex&&ex.type==='belt'&&ex.dir===c.dir) continue;
        if(ex){ removeBuilding(S,ex); ctx.render.buildingRemoved(ex,S); }
        S.coins-=BUILDINGS.belt.cost;
        const b=makeBuilding(S,'belt',c.x,c.z,c.dir);
        addBuilding(S,b);
        ctx.render.buildingAdded(b,S);
      }
    }
    changed();
    state.path=null;
    updateGhost();
  }

  function trySelect(tile){
    const S=ctx.getS();
    const b=tile?getB(S,tile.x,tile.z):null;
    ctx.selectBuilding(b);
  }

  dom.addEventListener('pointerdown',e=>{
    dom.setPointerCapture(e.pointerId);
    state.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(state.pointers.size===2){
      const pts=[...state.pointers.values()];
      state.pinch={
        d:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),
        ang:Math.atan2(pts[1].y-pts[0].y,pts[1].x-pts[0].x)
      };
      state.path=null;
      state.panBtn=null;
      return;
    }
    const tile=tileFromEvent(e);
    state.downInfo={x:e.clientX,y:e.clientY,t:performance.now(),btn:e.button,moved:false};
    if(e.button===1){
      state.panBtn={x:e.clientX,y:e.clientY};
      return;
    }
    if(e.button===2) return;
    if(e.button!==0) return;
    if(!tile) return;
    const S=ctx.getS();
    if(state.tool==='bulldoze'){
      state.delDrag=true;
      removeAt(S,tile.x,tile.z);
      changed();
      return;
    }
    if(state.tool&&['belt','splitter','underground'].includes(state.tool)){
      if(state.tool==='splitter'){
        placeSingle('splitter',tile.x,tile.z);
        return;
      }
      state.path={active:true,sx:tile.x,sz:tile.z,type:state.tool,cur:null};
      updateGhost();
      return;
    }
    if(state.tool){
      placeSingle(state.tool,tile.x,tile.z);
      updateGhost();
      return;
    }
  });

  dom.addEventListener('pointermove',e=>{
    const rec=state.pointers.get(e.pointerId);
    if(rec){
      e.dx=e.clientX-rec.x;
      e.dy=e.clientY-rec.y;
      rec.x=e.clientX; rec.y=e.clientY;
    }
    if(state.downInfo){
      const di=state.downInfo;
      if(Math.hypot(e.clientX-di.x,e.clientY-di.y)>7) di.moved=true;
    }
    if(state.pointers.size===2&&state.pinch){
      const pts=[...state.pointers.values()];
      const d=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      const ang=Math.atan2(pts[1].y-pts[0].y,pts[1].x-pts[0].x);
      if(state.pinch.d>0) ctx.render.cam.zoom(state.pinch.d/d);
      ctx.render.cam.rotateBy(ang-state.pinch.ang);
      state.pinch={d,ang};
      return;
    }
    if(state.panBtn){
      ctx.render.cam.pan(e.dx,e.dy);
      return;
    }
    if(state.downInfo&&state.downInfo.btn===2&&state.downInfo.moved){
      ctx.render.cam.pan(e.dx,e.dy);
      return;
    }
    const tile=tileFromEvent(e);
    state.hover=tile;
    if(state.delDrag&&tile){
      removeAt(ctx.getS(),tile.x,tile.z);
      changed();
      return;
    }
    if(state.path&&state.path.active){
      updateGhost();
      return;
    }
    if(state.tool) updateGhost();
  });

  dom.addEventListener('pointerup',e=>{
    state.pointers.delete(e.pointerId);
    if(state.pointers.size<2&&state.pinch){
      state.pinch=null;
      ctx.render.cam.snapYaw();
    }
    const di=state.downInfo;
    state.downInfo=null;
    if(state.delDrag){ state.delDrag=false; return; }
    if(state.panBtn){ state.panBtn=null; return; }
    if(di&&di.btn===2){
      if(!di.moved){
        if(state.tool) setTool(null);
        else ctx.closeInspector();
      }
      return;
    }
    if(di&&di.btn===0&&!di.moved&&performance.now()-di.t<450){
      if(state.path&&state.path.active){
        const p=computePath(ctx.getS(),state.path.sx,state.path.sz,state.hover?state.hover.x:state.path.sx,state.hover?state.hover.z:state.path.sz,state.path.type);
        state.path.cur=p;
        commitPath();
        return;
      }
      if(!state.tool){
        trySelect(tileFromEvent(e));
      }
    }
    if(state.path&&state.path.active){
      commitPath();
    }
  });

  dom.addEventListener('pointercancel',e=>{
    state.pointers.delete(e.pointerId);
    state.path=null;
    state.panBtn=null;
    state.pinch=null;
    state.delDrag=false;
    ctx.render.setGhost(null);
  });

  dom.addEventListener('wheel',e=>{
    e.preventDefault();
    const f=Math.pow(1.13,e.deltaY>0?1:-1);
    ctx.render.cam.zoomAt(f,e.clientX,e.clientY);
  },{passive:false});

  dom.addEventListener('contextmenu',e=>e.preventDefault());

  addEventListener('keydown',e=>{
    if(e.repeat) return;
    if(e.target.tagName==='SELECT'||e.target.tagName==='INPUT') return;
    state.keys.add(e.code);
    switch(e.code){
      case 'KeyR':{
        const sel=ctx.selected();
        if(sel) ctx.rotateSelected();
        else if(state.tool) rotateGhost();
        break;
      }
      case 'Escape':
        if(ctx.modalOpen()) ctx.closeModals();
        else if(state.tool) setTool(null);
        else ctx.closeInspector();
        break;
      case 'KeyT': ctx.toggleTech(); break;
      case 'Space': e.preventDefault(); ctx.togglePause(); break;
      case 'Delete': ctx.deleteSelected(); break;
      case 'KeyQ': ctx.render.cam.rotateSnap(-1); break;
      case 'KeyE': ctx.render.cam.rotateSnap(1); break;
      case 'Equal': ctx.render.cam.zoom(0.85); break;
      case 'Minus': ctx.render.cam.zoom(1.18); break;
      case 'KeyX': {
        const t=state.tool?null:'bulldoze';
        setTool(t);
        if(t==='bulldoze') ctx.ui.toast('Abriss-Werkzeug aktiv');
        break;
      }
    }
  });
  addEventListener('keyup',e=>state.keys.delete(e.code));

  function update(dt){
    const k=state.keys;
    let dx=0,dy=0;
    if(k.has('KeyA')||k.has('ArrowLeft'))dx-=1;
    if(k.has('KeyD')||k.has('ArrowRight'))dx+=1;
    if(k.has('KeyW')||k.has('ArrowUp'))dy-=1;
    if(k.has('KeyS')||k.has('ArrowDown'))dy+=1;
    if(dx||dy) ctx.render.cam.pan(dx*900*dt,dy*900*dt);
  }

  return {
    update,
    setTool,
    rotateGhost,
    get tool(){return state.tool;}
  };
}
