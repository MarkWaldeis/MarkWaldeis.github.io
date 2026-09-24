import * as THREE from 'three';
import {
  GRID, ITEMS, DX, DZ, BASE_BELT_SPEED,
  RES_COLOR, RECIPE_BY_ID, EXTRACT_TIME, OUT_CAP, keyOf, opp, left, multFor
} from './config.js';
import { isBeltLike } from './sim.js';

const WX = g => g - GRID / 2;
const DEG = Math.PI / 180;
const ROMAN = ['', 'I', 'II', 'III', 'IV'];

function mulberry(a){
  return function(){
    a|=0; a=(a+0x6D2B79F5)|0;
    let t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

function makeGradient(){
  const data=new Uint8Array([80,150,215,255]);
  const tex=new THREE.DataTexture(data,4,1,THREE.RedFormat);
  tex.needsUpdate=true;
  tex.minFilter=THREE.NearestFilter;
  tex.magFilter=THREE.NearestFilter;
  return tex;
}

function makeArrowTexture(staticArrows){
  const cv=document.createElement('canvas');
  cv.width=64; cv.height=64;
  const g=cv.getContext('2d');
  g.fillStyle='#313a46';
  g.fillRect(0,0,64,64);
  g.fillStyle='#262f39';
  g.fillRect(0,0,6,64);
  g.fillRect(58,0,6,64);
  if(!staticArrows){
    g.fillStyle='#66788c';
    for(const oy of [6,38]){
      g.beginPath();
      g.moveTo(32,oy);
      g.lineTo(50,oy+14);
      g.lineTo(42,oy+14);
      g.lineTo(42,oy+22);
      g.lineTo(22,oy+22);
      g.lineTo(22,oy+14);
      g.lineTo(14,oy+14);
      g.closePath();
      g.fill();
    }
  }else{
    g.strokeStyle='#262f39';
    g.lineWidth=13;
    g.lineCap='round';
    g.beginPath();
    g.moveTo(15,51); g.lineTo(32,34); g.lineTo(32,15);
    g.moveTo(49,51); g.lineTo(32,34);
    g.stroke();
    g.strokeStyle='#8fa3b8';
    g.lineWidth=7;
    g.beginPath();
    g.moveTo(15,51); g.lineTo(32,34); g.lineTo(32,15);
    g.moveTo(49,51); g.lineTo(32,34);
    g.stroke();
  }
  const tex=new THREE.CanvasTexture(cv);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=THREE.RepeatWrapping;
  tex.wrapT=THREE.RepeatWrapping;
  return tex;
}

function makeGroundTexture(){
  const cv=document.createElement('canvas');
  cv.width=256; cv.height=256;
  const g=cv.getContext('2d');
  g.fillStyle='#86c264';
  g.fillRect(0,0,256,256);
  g.fillStyle='#7db95a';
  g.fillRect(0,0,128,128);
  g.fillRect(128,128,128,128);
  g.fillStyle='rgba(60,110,45,0.32)';
  for(let i=0;i<40;i++){
    const x=Math.random()*256,y=Math.random()*256,r=1+Math.random()*2.5;
    g.beginPath(); g.arc(x,y,r,0,7); g.fill();
  }
  g.strokeStyle='rgba(40,80,35,0.15)';
  g.lineWidth=2;
  g.strokeRect(0,0,256,256);
  g.beginPath(); g.moveTo(128,0); g.lineTo(128,256); g.moveTo(0,128); g.lineTo(256,128); g.stroke();
  const tex=new THREE.CanvasTexture(cv);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(GRID/2,GRID/2);
  tex.anisotropy=4;
  return tex;
}

function makeSmokeTexture(){
  const cv=document.createElement('canvas');
  cv.width=64; cv.height=64;
  const g=cv.getContext('2d');
  const gr=g.createRadialGradient(32,32,4,32,32,30);
  gr.addColorStop(0,'rgba(238,238,238,0.72)');
  gr.addColorStop(1,'rgba(238,238,238,0)');
  g.fillStyle=gr;
  g.fillRect(0,0,64,64);
  const tex=new THREE.CanvasTexture(cv);
  tex.colorSpace=THREE.SRGBColorSpace;
  return tex;
}

function ribbonGeo(P0,P1,P2,w,segs,y0){
  const pos=[],uv=[],idx=[],nor=[];
  const pts=[];
  for(let i=0;i<=segs;i++){
    const t=i/segs, mt=1-t;
    const x=mt*mt*P0[0]+2*mt*t*P1[0]+t*t*P2[0];
    const z=mt*mt*P0[1]+2*mt*t*P1[1]+t*t*P2[1];
    let tx=2*mt*(P1[0]-P0[0])+2*t*(P2[0]-P1[0]);
    let tz=2*mt*(P1[1]-P0[1])+2*t*(P2[1]-P1[1]);
    const l=Math.hypot(tx,tz)||1;
    tx/=l; tz/=l;
    pts.push({x,z,nx:-tz,nz:tx,t});
  }
  for(const p of pts){
    pos.push(p.x-p.nx*w/2,y0,p.z-p.nz*w/2);
    pos.push(p.x+p.nx*w/2,y0,p.z+p.nz*w/2);
    nor.push(0,1,0,0,1,0);
    uv.push(0,p.t,1,p.t);
  }
  for(let i=0;i<segs;i++){
    const a=i*2;
    idx.push(a,a+1,a+2,a+2,a+1,a+3);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(idx);
  return geo;
}

function straightTopGeo(){
  const y=0.115;
  const pos=[-0.42,y,-0.5, 0.42,y,-0.5, -0.42,y,0.5, 0.42,y,0.5];
  const nor=[0,1,0,0,1,0,0,1,0,0,1,0];
  const uv=[0,0,1,0,0,1,1,1];
  const idx=[0,2,1,2,3,1, 1,3,2,2,1,0];
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(idx);
  return geo;
}

function makeOutArrowGeo(){
  const v=[
    -0.14,0,-0.07, -0.14,0,0.07, 0.05,0,0.07,
    -0.14,0,-0.07, 0.05,0,0.07, 0.05,0,-0.07,
    0.05,0,-0.16, 0.26,0,0, 0.05,0,0.16
  ];
  const nor=[];
  for(let i=0;i<9;i++) nor.push(0,1,0);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
  geo.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  return geo;
}

export function initRender(container){

  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.06;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const statusLayer=document.createElement('div');
  statusLayer.id='statusLayer';
  const sls=statusLayer.style;
  sls.position='absolute';
  sls.inset='0';
  sls.pointerEvents='none';
  sls.zIndex='5';
  sls.overflow='hidden';
  container.appendChild(statusLayer);
  const kf=document.createElement('style');
  kf.textContent='@keyframes spulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.62);opacity:.5}}';
  statusLayer.appendChild(kf);

  const STATUS_MAX=36;
  const statusPool=[];
  for(let i=0;i<STATUS_MAX;i++){
    const d=document.createElement('div');
    const ds=d.style;
    ds.position='absolute';
    ds.left='0px';
    ds.top='0px';
    ds.display='none';
    ds.background='rgba(10,14,20,.78)';
    ds.borderRadius='6px';
    ds.padding='3px 6px';
    ds.font='11px system-ui, sans-serif';
    ds.color='#dfe7ef';
    ds.transform='translate(-50%,-100%)';
    ds.border='1px solid rgba(255,255,255,.12)';
    ds.alignItems='center';
    ds.gap='4px';
    ds.whiteSpace='nowrap';
    d._key='';
    d._fill=null;
    statusLayer.appendChild(d);
    statusPool.push(d);
  }

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0xb2dcf5);
  scene.fog=new THREE.Fog(0xaad4ee,150,420);

  const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,0.5,700);

  const hemi=new THREE.HemisphereLight(0xd7ecff,0x93b96f,1.0);
  scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff1da,2.55);
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left=-58; sun.shadow.camera.right=58;
  sun.shadow.camera.top=58; sun.shadow.camera.bottom=-58;
  sun.shadow.camera.near=5; sun.shadow.camera.far=240;
  sun.shadow.radius=4;
  sun.shadow.bias=-0.0004;
  sun.shadow.normalBias=0.03;
  scene.add(sun);
  scene.add(sun.target);

  const grad=makeGradient();
  const toon=(c,e)=>new THREE.MeshToonMaterial({color:c,gradientMap:grad,emissive:e||0x000000});
  const lam=c=>new THREE.MeshLambertMaterial({color:c});

  const arrowTex=makeArrowTexture(false);
  const splitTex=makeArrowTexture(true);
  const beltBodyMat=lam(0x333c47);
  const beltTopMat=new THREE.MeshLambertMaterial({map:arrowTex,side:THREE.DoubleSide});
  const splitTopMat=new THREE.MeshLambertMaterial({map:splitTex,side:THREE.DoubleSide});

  const ground=new THREE.Mesh(
    new THREE.PlaneGeometry(GRID,GRID),
    new THREE.MeshLambertMaterial({map:makeGroundTexture()})
  );
  ground.rotation.x=-Math.PI/2;
  ground.receiveShadow=true;
  scene.add(ground);

  const rim=new THREE.Mesh(new THREE.PlaneGeometry(GRID*3,GRID*3),lam(0x74ad52));
  rim.rotation.x=-Math.PI/2;
  rim.position.y=-0.05;
  rim.receiveShadow=true;
  scene.add(rim);

  const buildingGroup=new THREE.Group();
  scene.add(buildingGroup);

  const M={
    dark:0x4a545f, darker:0x39424e, metal:0x8b95a3, silver:0xcfd6de,
    light:0xe9edf2, orange:0xf0a13c, orange2:0xf4b054, teal:0x35d0ba,
    stone:0x9a7b6a, stone2:0x7c6154, deep:0x2b2320, wood:0xa9784b,
    wood2:0x8a6540, leaf:0x4d9950, leaf2:0x3f8544, trunk:0x7a5233,
    gold:0xf6c453, red:0xe05656, blue:0x9db8d8, glow:0xff8c3b
  };

  function box(w,h,d,mat,x,y,z,name){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.position.set(x,y,z);
    m.castShadow=true; m.receiveShadow=true;
    if(name)m.name=name;
    return m;
  }
  function cyl(rt,rb,h,mat,x,y,z,seg,name){
    const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg||10),mat);
    m.position.set(x,y,z);
    m.castShadow=true;
    if(name)m.name=name;
    return m;
  }

  const outArrowGeo=makeOutArrowGeo();
  const outArrowMat=new THREE.MeshBasicMaterial({
    color:0xff9a3d,transparent:true,opacity:0.9,depthWrite:false,toneMapped:false
  });

  function addOutArrow(g){
    const m=new THREE.Mesh(outArrowGeo,outArrowMat);
    m.position.set(0.72,0.012,0);
    m.userData.noShadow=true;
    g.add(m);
  }

  const templates={};

  function tplExtractor(){
    const g=new THREE.Group();
    const mDark=toon(M.dark),mO=toon(M.orange),mO2=toon(M.orange2),mSil=toon(M.silver),mVent=toon(M.darker);
    g.add(box(0.94,0.1,0.94,mDark,0,0.05,0));
    for(const sx of [-0.41,0.41]) for(const sz of [-0.41,0.41]) g.add(box(0.09,0.82,0.09,mDark,sx,0.51,sz));
    g.add(box(0.94,0.08,0.94,mDark,0,0.94,0));
    g.add(box(0.58,0.54,0.58,mO,0,0.44,0));
    g.add(box(0.66,0.09,0.66,mO2,0,0.74,0));
    for(let i=0;i<3;i++){
      const yy=0.28+i*0.13;
      g.add(box(0.5,0.04,0.03,mVent,0,yy,0.305));
      g.add(box(0.5,0.04,0.03,mVent,0,yy,-0.305));
    }
    g.add(cyl(0.06,0.06,0.44,mSil,-0.22,1.2,-0.22,10));
    g.add(cyl(0.095,0.08,0.06,mDark,-0.22,1.45,-0.22,10));
    const drill=new THREE.Group();
    drill.name='drill';
    drill.position.set(0,1.02,0);
    drill.add(cyl(0.05,0.05,0.72,mSil,0,-0.36,0,8,'shaft'));
    const bit=new THREE.Mesh(new THREE.ConeGeometry(0.15,0.34,6),mSil);
    bit.rotation.x=Math.PI;
    bit.position.y=-0.79;
    bit.castShadow=true;
    bit.name='bit';
    drill.add(bit);
    drill.add(cyl(0.085,0.085,0.08,mO2,0,-0.18,0,10,'nut'));
    g.add(drill);
    g.userData.anim=['drill'];
    g.userData.drillBase=1.02;
    g.userData.nutBase=-0.18;
    addOutArrow(g);
    return g;
  }

  function tplFurnace(){
    const g=new THREE.Group();
    const mSt=toon(M.stone),mSt2=toon(M.stone2),mDeep=toon(M.deep);
    g.add(box(0.94,0.72,0.94,mSt,0,0.36,0));
    for(const sx of [-0.38,0.38]) for(const sz of [-0.38,0.38]) g.add(box(0.17,0.76,0.17,mSt2,sx,0.38,sz));
    g.add(box(0.99,0.1,0.99,mSt2,0,0.77,0));
    g.add(box(0.08,0.42,0.52,mDeep,0.43,0.27,0));
    g.add(box(0.05,0.08,0.56,mDeep,0.47,0.52,0));
    g.add(box(0.05,0.08,0.42,mDeep,0.485,0.61,0));
    const fire=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.3,0.36),
      new THREE.MeshBasicMaterial({color:M.glow}));
    fire.position.set(0.45,0.26,0);
    fire.name='fire';
    fire.userData.dyn=true;
    g.add(fire);
    const ember=new THREE.Mesh(new THREE.CircleGeometry(0.15,14),
      new THREE.MeshBasicMaterial({color:0xff7a2e,transparent:true,opacity:0.85,toneMapped:false}));
    ember.rotation.y=Math.PI/2;
    ember.position.set(0.52,0.2,0);
    ember.name='ember';
    ember.userData.dyn=true;
    ember.userData.noShadow=true;
    g.add(ember);
    g.add(cyl(0.13,0.17,0.64,mSt2,-0.26,1.12,-0.26,10));
    g.add(cyl(0.19,0.19,0.07,mSt,-0.26,1.47,-0.26,10));
    g.add(cyl(0.1,0.1,0.06,mDeep,-0.26,1.52,-0.26,10));
    g.userData.anim=['fire','ember'];
    g.userData.smoke={x:-0.26,y:1.58,z:-0.26};
    addOutArrow(g);
    return g;
  }

  function tplAssembler(){
    const g=new THREE.Group();
    const mSlab=toon(0x66707f),mFrame=toon(M.dark),mO=toon(M.orange),mO2=toon(M.orange2),mGear=toon(M.silver),mDet=toon(M.darker);
    g.add(box(0.94,0.14,0.94,mSlab,0,0.07,0));
    g.add(box(0.52,0.06,0.52,mDet,0,0.165,0));
    g.add(box(0.2,0.1,0.2,mFrame,0.18,0.245,0.18));
    for(const sz of [-0.34,0.34]) g.add(box(0.14,0.76,0.16,mFrame,0,0.52,sz));
    g.add(box(0.26,0.14,0.94,mFrame,0,0.95,0));
    g.add(box(0.06,0.04,0.86,toon(M.silver),0,0.86,0));
    const rig=box(0.3,0.18,0.32,mO,0,1.08,0,'rig');
    rig.add(cyl(0.02,0.02,0.2,mO2,0,0.14,0,6));
    g.add(rig);
    const arm=new THREE.Group();
    arm.name='arm';
    arm.position.set(0,0.84,0);
    arm.add(cyl(0.035,0.035,0.3,toon(M.silver),0,-0.15,0,8));
    arm.add(box(0.16,0.12,0.16,mO,0,-0.33,0));
    arm.add(box(0.06,0.06,0.22,mGear,0,-0.33,0.15));
    g.add(arm);
    const gg=new THREE.CylinderGeometry(0.16,0.16,0.06,8);
    gg.rotateX(Math.PI/2);
    const gear=new THREE.Mesh(gg,mGear);
    gear.position.set(0,0.3,0.43);
    gear.castShadow=true;
    gear.name='gear';
    gear.userData.spin=1;
    g.add(gear);
    const gear2=new THREE.Mesh(gg.clone(),mGear);
    gear2.position.set(0,0.3,-0.43);
    gear2.scale.setScalar(0.72);
    gear2.castShadow=true;
    gear2.name='gear';
    gear2.userData.spin=-1;
    g.add(gear2);
    g.userData.anim=['rig','arm','gear'];
    g.userData.rigBaseY=1.08;
    addOutArrow(g);
    return g;
  }

  function tplLab(){
    const g=new THREE.Group();
    const mL=toon(M.light),mT=toon(M.teal);
    const winMat=new THREE.MeshBasicMaterial({color:0x3fd6c0});
    winMat.toneMapped=false;
    g.add(box(0.94,0.56,0.94,mL,0,0.28,0));
    g.add(box(0.99,0.08,0.99,mT,0,0.6,0));
    for(const sx of [-0.475,0.475]){
      g.add(box(0.02,0.2,0.26,winMat,sx,0.3,0.2));
      g.add(box(0.02,0.2,0.26,winMat,sx,0.3,-0.2));
    }
    for(const sz of [-0.475,0.475]){
      g.add(box(0.26,0.2,0.02,winMat,0.2,0.3,sz));
      g.add(box(0.26,0.2,0.02,winMat,-0.2,0.3,sz));
    }
    const dome=new THREE.Mesh(
      new THREE.SphereGeometry(0.26,12,8,0,Math.PI*2,0,Math.PI/2),
      new THREE.MeshPhongMaterial({color:0xbfe8f5,transparent:true,opacity:0.45,shininess:90})
    );
    dome.position.set(0,0.64,0);
    dome.userData.noShadow=true;
    dome.name='domeGlass';
    g.add(dome);
    const dish=new THREE.Group();
    dish.name='dish';
    dish.position.set(0,0.7,0);
    dish.add(cyl(0.02,0.03,0.1,mT,0,0.02,0,8));
    const para=new THREE.Mesh(
      new THREE.SphereGeometry(0.19,10,5,0,Math.PI*2,0,Math.PI/2),
      new THREE.MeshToonMaterial({color:M.blue,gradientMap:grad,side:THREE.DoubleSide}));
    para.scale.set(1,0.5,1);
    para.rotation.x=Math.PI;
    para.position.y=0.06;
    para.castShadow=true;
    dish.add(para);
    for(let i=0;i<4;i++){
      const sp=box(0.015,0.008,0.16,toon(M.silver),0,0.1,0);
      sp.rotation.y=i*Math.PI/4;
      dish.add(sp);
    }
    g.add(dish);
    g.add(cyl(0.022,0.022,0.56,mT,0.33,0.9,0.33,6));
    const blink=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,6),
      new THREE.MeshBasicMaterial({color:M.gold}));
    blink.position.set(0.33,1.2,0.33);
    blink.name='blink';
    blink.userData.dyn=true;
    blink.userData.noShadow=true;
    g.add(blink);
    g.userData.anim=['dish','blink'];
    addOutArrow(g);
    return g;
  }

  function tplMarket(){
    const g=new THREE.Group();
    const mW=toon(M.wood),mW2=toon(M.wood2),mR=toon(M.red),mL=toon(M.light),mG=toon(M.gold),mDk=toon(M.dark);
    for(const sx of [-0.4,0.4]) for(const sz of [-0.4,0.4]) g.add(box(0.07,0.92,0.07,mW2,sx,0.46,sz));
    g.add(box(0.94,0.34,0.1,mW,0,0.17,0.4));
    g.add(box(0.98,0.05,0.16,mW2,0,0.365,0.4));
    g.add(box(0.94,0.46,0.06,mW,0,0.23,-0.42));
    function panel(sign){
      const pg=new THREE.Group();
      pg.add(box(1.08,0.05,0.62,mR,0,0,0));
      for(const oz of [-0.2,0,0.2]) pg.add(box(1.08,0.058,0.11,mL,0,0.002,oz));
      pg.position.set(0,1.06,sign*0.28);
      pg.rotation.x=sign*0.5;
      return pg;
    }
    g.add(panel(1));
    g.add(panel(-1));
    g.add(box(1.1,0.06,0.09,mW2,0,1.2,0));
    g.add(box(0.2,0.2,0.2,mW2,-0.28,0.47,0.18));
    g.add(box(0.17,0.17,0.17,mW,0.3,0.085,0.3));
    g.add(cyl(0.11,0.125,0.26,mW2,0.31,0.13,-0.3,10));
    g.add(cyl(0.132,0.132,0.03,mDk,0.31,0.09,-0.3,10));
    g.add(cyl(0.128,0.128,0.03,mDk,0.31,0.17,-0.3,10));
    g.add(box(0.05,1.05,0.05,mW2,0.44,0.52,0.46));
    const b1=box(0.32,0.1,0.03,mL,0.44,0.9,0.46);
    b1.rotation.y=0.35;
    g.add(b1);
    const b2=box(0.26,0.09,0.03,mL,0.44,1.02,0.46);
    b2.rotation.y=-0.25;
    g.add(b2);
    const cg=new THREE.CylinderGeometry(0.12,0.12,0.035,12);
    cg.rotateZ(Math.PI/2);
    const coin=new THREE.Mesh(cg,mG);
    coin.position.set(0.49,0.34,0.1);
    coin.castShadow=true;
    coin.name='coin';
    g.add(coin);
    g.userData.anim=['coin'];
    addOutArrow(g);
    return g;
  }

  function tplInserter(){
    const g=new THREE.Group();
    const mD=toon(M.dark),mO=toon(M.orange),mS=toon(M.silver);
    const warnMat=new THREE.MeshBasicMaterial({color:0xff8330});
    warnMat.toneMapped=false;
    g.add(box(0.9,0.06,0.9,mD,0,0.03,0));
    g.add(cyl(0.075,0.1,0.3,mD,0,0.21,0,10));
    g.add(box(0.56,0.045,0.09,mS,0,0.39,0));
    const warn=new THREE.Mesh(new THREE.SphereGeometry(0.04,8,6),warnMat);
    warn.position.set(0,0.47,0.09);
    warn.userData.noShadow=true;
    g.add(warn);
    const pivot=new THREE.Group();
    pivot.name='pivot';
    pivot.position.set(0,0.44,0);
    pivot.add(box(0.52,0.06,0.09,mO,0.26,0,0));
    const held=new THREE.Mesh(new THREE.BoxGeometry(0.19,0.12,0.19),
      new THREE.MeshLambertMaterial({color:0x222222}));
    held.position.set(0.55,0.02,0);
    held.name='held';
    held.visible=false;
    held.userData.dyn=true;
    pivot.add(held);
    pivot.add(box(0.12,0.08,0.08,mS,-0.1,0,0));
    g.add(pivot);
    g.userData.anim=['pivot','held'];
    addOutArrow(g);
    return g;
  }

  function tplUnder(accentHex){
    const g=new THREE.Group();
    const mPad=toon(0x2f3944),mWall=toon(0x55606e),mChev=toon(0x262f39);
    const stripMat=new THREE.MeshBasicMaterial({color:accentHex});
    stripMat.toneMapped=false;
    g.add(box(0.96,0.06,0.96,mPad,0,0.03,0));
    g.add(box(0.96,0.26,0.15,mWall,0,0.185,0.405));
    g.add(box(0.96,0.26,0.15,mWall,0,0.185,-0.405));
    g.add(box(0.8,0.09,0.96,mWall,0,0.375,0));
    for(let r=0;r<3;r++){
      const zc=(r-1)*0.26;
      const c1=box(0.3,0.02,0.06,mChev,-0.06,0.43,zc+0.06);
      c1.rotation.y=0.4;
      g.add(c1);
      const c2=box(0.3,0.02,0.06,mChev,-0.06,0.43,zc-0.06);
      c2.rotation.y=-0.4;
      g.add(c2);
    }
    g.add(box(0.05,0.035,0.9,stripMat,0.39,0.425,0));
    const mark=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.2,4),toon(accentHex));
    mark.rotation.z=-Math.PI/2;
    mark.position.set(0,0.56,0);
    g.add(mark);
    addOutArrow(g);
    return g;
  }

  templates.extractor=tplExtractor();
  templates.furnace=tplFurnace();
  templates.assembler=tplAssembler();
  templates.lab=tplLab();
  templates.market=tplMarket();
  templates.inserter=tplInserter();
  templates.under_in=tplUnder(M.gold);
  templates.under_out=tplUnder(M.teal);

  function tplBeltGhost(split){
    const g=new THREE.Group();
    g.add(box(0.94,0.09,0.94,toon(M.darker),0,0.045,0));
    const top=new THREE.Mesh(straightTopGeo(),new THREE.MeshBasicMaterial({map:split?splitTex:arrowTex,side:THREE.DoubleSide}));
    g.add(top);
    if(split){
      g.add(box(0.5,0.06,0.5,toon(M.dark),0,0.15,0));
    }
    return g;
  }
  templates.belt=tplBeltGhost(false);
  templates.splitter=tplBeltGhost(true);

  const yawOf=d=>Math.atan2(DX[d],DZ[d]);

  function cloneTemplate(type){
    const src=templates[type];
    const g=src.clone(true);
    const refs={};
    g.traverse(o=>{
      if(o.userData.dyn) o.material=o.material.clone();
      if(o.name){
        if(refs[o.name]){
          if(!Array.isArray(refs[o.name])) refs[o.name]=[refs[o.name]];
          refs[o.name].push(o);
        }else{
          refs[o.name]=o;
        }
      }
      o.castShadow=!o.userData.noShadow;
      o.receiveShadow=!o.userData.noShadow;
    });
    g.userData.refs=refs;
    if(refs.gear&&!Array.isArray(refs.gear)) refs.gear=[refs.gear];
    return g;
  }

  const meshMap=new Map();

  function buildingAdded(b,S){
    if(isBeltLike(b.type)) { rebuildBelts(S||curS); return; }
    if(meshMap.has(keyOf(b.x,b.z))) return;
    const g=cloneTemplate(b.type);
    g.position.set(WX(b.x)+0.5,0,WX(b.z)+0.5);
    g.rotation.y=yawOf(b.dir);
    buildingGroup.add(g);
    meshMap.set(keyOf(b.x,b.z),{g,type:b.type});
  }

  function buildingRemoved(b,S){
    const k=keyOf(b.x,b.z);
    const rec=meshMap.get(k);
    if(rec){
      buildingGroup.remove(rec.g);
      meshMap.delete(k);
    }
    emitters.delete(b.id);
    if(isBeltLike(b.type)) rebuildBelts(S||curS);
  }

  function setRotationOf(b){
    const rec=meshMap.get(keyOf(b.x,b.z));
    if(rec) rec.g.rotation.y=yawOf(b.dir);
    if(isBeltLike(b.type)) rebuildBelts(null);
  }

  const beltGeoBody=new THREE.BoxGeometry(0.94,0.09,0.94);
  const geoStraight=straightTopGeo();
  const geoEntryP=ribbonGeo([0.5,0],[0.5,0.5],[0,0.5],0.84,10,0.115);
  const geoEntryN=ribbonGeo([-0.5,0],[-0.5,0.5],[0,0.5],0.84,10,0.115);

  const inst={
    body:null,straight:null,entryP:null,entryN:null,split:null
  };

  function ensureInst(k,geo,mat,count,shadow){
    const need=Math.max(count,1);
    let m=inst[k];
    if(!m||m.instanceMatrix.count<need){
      if(m){
        scene.remove(m);
        m.dispose();
      }
      m=new THREE.InstancedMesh(geo,mat,Math.max(need*2,32));
      m.frustumCulled=false;
      m.receiveShadow=true;
      if(shadow)m.castShadow=true;
      inst[k]=m;
      scene.add(m);
    }
    return m;
  }

  const tmpMat4=new THREE.Matrix4();
  const tmpQ=new THREE.Quaternion();
  const tmpSc=new THREE.Vector3(1,1,1);
  const YAXIS=new THREE.Vector3(0,1,0);

  function feedsInto(S,x,z,s){
    const nb=S.buildings.get(keyOf(x+DX[s],z+DZ[s]));
    if(!nb) return false;
    if(nb.type==='belt'||nb.type==='splitter'||nb.type==='under_out') return nb.dir===opp(s);
    if(nb.type==='extractor'||nb.type==='furnace'||nb.type==='assembler') return nb.dir===opp(s);
    return false;
  }

  function rebuildBelts(S){
    S=S||curS;
    if(!S) return;
    curS=S;
    const lists={body:[],straight:[],entryP:[],entryN:[],split:[]};
    const q=new THREE.Quaternion();
    const v=new THREE.Vector3();
    for(const b of S.buildings.values()){
      if(!isBeltLike(b.type)) continue;
      const wx=WX(b.x)+0.5, wz=WX(b.z)+0.5;
      q.setFromAxisAngle(YAXIS,yawOf(b.dir));
      tmpMat4.compose(v.set(wx,0.045,wz),q,tmpSc);
      lists.body.push(tmpMat4.clone());
      if(b.type==='splitter'){
        tmpMat4.compose(v.set(wx,0,wz),q,tmpSc);
        lists.split.push(tmpMat4.clone());
        continue;
      }
      if(b.type==='belt'){
        let perp=-1, straightIn=false;
        for(let s=0;s<4;s++){
          if(!feedsInto(S,b.x,b.z,s)) continue;
          if(s===opp(b.dir)){ straightIn=true; break; }
          if(s===b.dir) continue;
          if(perp<0) perp=s;
        }
        tmpMat4.compose(v.set(wx,0,wz),q,tmpSc);
        if(!straightIn&&perp>=0){
          lists[perp===left(b.dir)?'entryP':'entryN'].push(tmpMat4.clone());
        }else{
          lists.straight.push(tmpMat4.clone());
        }
      }
    }
    ensureInst('body',beltGeoBody,beltBodyMat,lists.body.length,true);
    inst.body.count=lists.body.length;
    lists.body.forEach((m,i)=>inst.body.setMatrixAt(i,m));
    inst.body.instanceMatrix.needsUpdate=true;
    const tops={straight:['straight',geoStraight,beltTopMat],entryP:['entryP',geoEntryP,beltTopMat],entryN:['entryN',geoEntryN,beltTopMat],split:['split',geoStraight,splitTopMat]};
    for(const k in tops){
      const [key,geo,mat]=tops[k];
      ensureInst(key,geo,mat,lists[key].length,false);
      inst[key].count=lists[key].length;
      lists[key].forEach((m,i)=>inst[key].setMatrixAt(i,m));
      inst[key].instanceMatrix.needsUpdate=true;
    }
  }

  let itemMesh=null,itemCap=0;
  const ITEM_MAX_HARD=60000;
  const itemGeo=new THREE.BoxGeometry(0.22,0.13,0.22);
  const itemMat=new THREE.MeshToonMaterial({color:0xffffff,gradientMap:grad});

  function ensureItemMesh(cap){
    if(itemMesh){
      scene.remove(itemMesh);
      itemMesh.dispose();
    }
    itemCap=Math.max(cap,8192);
    if(itemCap>ITEM_MAX_HARD) itemCap=ITEM_MAX_HARD;
    itemMesh=new THREE.InstancedMesh(itemGeo,itemMat,itemCap);
    itemMesh.frustumCulled=false;
    itemMesh.castShadow=true;
    const c=new THREE.Color(1,1,1);
    for(let i=0;i<itemCap;i++) itemMesh.setColorAt(i,c);
    scene.add(itemMesh);
  }
  ensureItemMesh(8192);

  function pathPoint(cx,cz,exitD,es,t,out){
    const ax=cx+DX[es]*0.5, az=cz+DZ[es]*0.5;
    const bx=cx+DX[exitD]*0.5, bz=cz+DZ[exitD]*0.5;
    const mt=1-t;
    out.x=mt*mt*ax+2*mt*t*cx+t*t*bx;
    out.z=mt*mt*az+2*mt*t*cz+t*t*bz;
  }

  const tmpV=new THREE.Vector3();
  const tmpC=new THREE.Color();

  let curS=null;

  function updateItems(S){
    curS=S;
    let n=0, needGrow=false;
    for(const b of S.buildings.values()){
      if(!b.items||b.items.length===0) continue;
      if(b.type==='under_in') continue;
      const cx=WX(b.x)+0.5, cz=WX(b.z)+0.5;
      let j=0;
      for(const it of b.items){
        if(n>=itemCap){ needGrow=true; break; }
        const t=Math.min(Math.max(it.pos,0),1);
        pathPoint(cx,cz,b.dir,it.es,t,tmpV);
        const ang=((b.id*73+j*29)%360)*DEG;
        tmpQ.setFromAxisAngle(YAXIS,ang);
        tmpMat4.compose(tmpV.set(tmpV.x,0.19,tmpV.z),tmpQ,tmpSc);
        itemMesh.setMatrixAt(n,tmpMat4);
        const def=ITEMS[it.it];
        tmpC.setHex(def?def.color:0xffffff);
        itemMesh.setColorAt(n,tmpC);
        n++;
        j++;
      }
      if(needGrow) break;
    }
    if(needGrow&&itemCap<ITEM_MAX_HARD){
      ensureItemMesh(itemCap*2);
      return updateItems(S);
    }
    if(itemMesh){
      itemMesh.count=n;
      itemMesh.instanceMatrix.needsUpdate=true;
      if(itemMesh.instanceColor) itemMesh.instanceColor.needsUpdate=true;
    }
  }

  const smokeTex=makeSmokeTexture();
  const smokePool=[];
  for(let i=0;i<48;i++){
    const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,transparent:true,opacity:0,depthWrite:false}));
    spr.scale.setScalar(0.5);
    scene.add(spr);
    smokePool.push({spr,life:0,vx:0,vy:0,vz:0});
  }
  let smokeIdx=0;
  const emitters=new Map();

  function updateSmoke(S,dtS){
    for(const b of S.buildings.values()){
      if(b.type!=='furnace'||!b.crafting) continue;
      let e=emitters.get(b.id);
      if(!e){ e={t:0}; emitters.set(b.id,e); }
      e.t-=dtS;
      if(e.t<=0){
        e.t=0.45+Math.random()*0.2;
        const p=smokePool[smokeIdx]; smokeIdx=(smokeIdx+1)%smokePool.length;
        p.life=1.6;
        p.vx=(Math.random()-0.5)*0.12;
        p.vy=0.75+Math.random()*0.25;
        p.vz=(Math.random()-0.5)*0.12;
        const rec=meshMap.get(keyOf(b.x,b.z));
        if(rec){
          const so=rec.g.userData.smoke||{x:-0.26,y:1.58,z:-0.26};
          p.spr.position.set(WX(b.x)+0.5+so.x,so.y,WX(b.z)+0.5+so.z);
          p.spr.scale.setScalar(0.35);
          p.spr.material.opacity=0.6;
        }
      }
    }
    for(const p of smokePool){
      if(p.life<=0) continue;
      p.life-=dtS;
      p.spr.position.x+=p.vx*dtS;
      p.spr.position.y+=p.vy*dtS;
      p.spr.position.z+=p.vz*dtS;
      p.spr.scale.multiplyScalar(1+0.55*dtS);
      p.spr.material.opacity=Math.max(0,p.life/1.6)*0.55;
    }
  }

  const decorGroup=new THREE.Group();
  scene.add(decorGroup);
  let decorSeedBuilt=-1;

  const FLOWER_COLORS=[0xf7d154,0xffffff,0xf291b2];

  function buildDecor(S){
    if(decorSeedBuilt===S.decorSeed) return;
    decorSeedBuilt=S.decorSeed;
    while(decorGroup.children.length){
      const c=decorGroup.children.pop();
      decorGroup.remove(c);
    }
    const rng=mulberry(S.decorSeed);
    const bushes=[],rocks=[],trees=[],flowers=[];
    for(let z=1;z<GRID-1;z++){
      for(let x=1;x<GRID-1;x++){
        const code=S.res[z*GRID+x];
        const wx=WX(x)+0.5, wz=WX(z)+0.5;
        if(code===5){
          trees.push([wx,wz,0.8+rng()*0.5]);
          continue;
        }
        if(code>0) continue;
        const r=rng();
        if(r<0.012) bushes.push([wx+(rng()-0.5)*0.4,wz+(rng()-0.5)*0.4,0.6+rng()*0.5]);
        else if(r<0.032) rocks.push([wx+(rng()-0.5)*0.4,wz+(rng()-0.5)*0.4,0.5+rng()*0.7]);
        else if(r<0.075){
          const cnt=1+((rng()*2)|0);
          for(let f=0;f<cnt&&flowers.length<1200;f++){
            flowers.push([wx+(rng()-0.5)*0.6,wz+(rng()-0.5)*0.6,(rng()*3)|0,rng()]);
          }
        }
      }
    }
    function inst(geo,mat,arr,fn){
      if(arr.length===0) return null;
      const m=new THREE.InstancedMesh(geo,mat,arr.length);
      const o=new THREE.Object3D();
      arr.forEach((a,i)=>{
        fn(o,a);
        o.updateMatrix();
        m.setMatrixAt(i,o.matrix);
      });
      m.castShadow=true;
      m.receiveShadow=true;
      m.frustumCulled=false;
      decorGroup.add(m);
      return m;
    }
    const bushGeo=new THREE.SphereGeometry(0.22,7,5);
    bushGeo.scale(1,0.6,1);
    inst(bushGeo,new THREE.MeshToonMaterial({color:0x5fae54,gradientMap:grad}),
      bushes,(o,[x,z,s])=>{o.position.set(x,0.1,z);o.scale.setScalar(s);o.rotation.set(0,0,0);});
    const rockGeo=new THREE.DodecahedronGeometry(0.16,0);
    inst(rockGeo,new THREE.MeshToonMaterial({color:0x9aa0a6,gradientMap:grad}),
      rocks,(o,[x,z,s])=>{o.position.set(x,0.09,z);o.scale.setScalar(s);o.rotation.set(rng()*0.6,rng()*3,rng()*0.6);});
    const trunkGeo=new THREE.CylinderGeometry(0.07,0.1,0.5,6);
    inst(trunkGeo,new THREE.MeshToonMaterial({color:M.trunk,gradientMap:grad}),
      trees,(o,[x,z,s])=>{o.position.set(x,0.25*s,z);o.scale.setScalar(s);o.rotation.set(0,0,0);});
    const crownVar=trees.map(()=>[rng()*0.05,0.32+rng()*0.09]);
    const cone1=new THREE.ConeGeometry(0.42,0.8,7);
    const leafMat=new THREE.MeshToonMaterial({color:0xffffff,gradientMap:grad});
    const crown1=inst(cone1,leafMat,trees,(o,[x,z,s])=>{o.position.set(x,0.95*s,z);o.scale.setScalar(s);o.rotation.set(0,0,0);});
    const cone2=new THREE.ConeGeometry(0.3,0.6,7);
    const leafMat2=new THREE.MeshToonMaterial({color:0xffffff,gradientMap:grad});
    const crown2=inst(cone2,leafMat2,trees,(o,[x,z,s])=>{o.position.set(x,1.45*s,z);o.scale.setScalar(s);o.rotation.set(0,0,0);});
    if(crown1&&crown2){
      for(let i=0;i<trees.length;i++){
        const h=0.29+crownVar[i][0];
        const l=crownVar[i][1];
        tmpC.setHSL(h,0.52,l);
        crown1.setColorAt(i,tmpC);
        tmpC.setHSL(h,0.5,Math.min(0.62,l+0.06));
        crown2.setColorAt(i,tmpC);
      }
      crown1.instanceColor.needsUpdate=true;
      crown2.instanceColor.needsUpdate=true;
    }
    if(flowers.length>0){
      const fGeo=new THREE.CircleGeometry(0.04,6);
      fGeo.rotateX(-Math.PI/2);
      const fMat=new THREE.MeshBasicMaterial({color:0xffffff});
      fMat.toneMapped=false;
      const fm=new THREE.InstancedMesh(fGeo,fMat,flowers.length);
      const o=new THREE.Object3D();
      flowers.forEach((a,i)=>{
        o.position.set(a[0],0.028+a[3]*0.012,a[1]);
        o.scale.setScalar(0.8+a[3]*0.6);
        o.updateMatrix();
        fm.setMatrixAt(i,o.matrix);
        tmpC.setHex(FLOWER_COLORS[a[2]]);
        fm.setColorAt(i,tmpC);
      });
      fm.instanceColor.needsUpdate=true;
      fm.frustumCulled=false;
      decorGroup.add(fm);
    }
    const crystalGeo=new THREE.OctahedronGeometry(0.2,0);
    crystalGeo.scale(1,1.5,1);
    const crysByType={};
    for(let z=1;z<GRID-1;z++){
      for(let x=1;x<GRID-1;x++){
        const code=S.res[z*GRID+x];
        if(code===0||code===5) continue;
        (crysByType[code]=crysByType[code]||[]).push([WX(x)+0.3,WX(z)+0.3,code]);
        (crysByType[code]=crysByType[code]).push([WX(x)+0.7,WX(z)+0.68,code]);
      }
    }
    for(const code in crysByType){
      const arr=crysByType[code];
      inst(crystalGeo,new THREE.MeshToonMaterial({color:RES_COLOR[code],gradientMap:grad}),
        arr,(o,[x,z])=>{o.position.set(x,0.16,z);o.scale.setScalar(0.8+rng()*0.5);o.rotation.set(rng()*0.4,rng()*3,rng()*0.4);});
    }
  }

  const camCtl={
    focus:new THREE.Vector3(0,0,0),
    dist:26,
    yaw:Math.PI*0.25,
    yawT:Math.PI*0.25,
    el:0.95,
    pan(sdx,sdy){
      const k=this.dist*0.0011;
      const s=Math.sin(this.yaw),c=Math.cos(this.yaw);
      const fx=-s,fz=-c,rx=c,rz=-s;
      this.focus.x-=(rx*sdx+fx*sdy)*k;
      this.focus.z-=(rz*sdx+fz*sdy)*k;
      this.clamp();
    },
    clamp(){
      const lim=GRID/2-3;
      this.focus.x=Math.max(-lim,Math.min(lim,this.focus.x));
      this.focus.z=Math.max(-lim,Math.min(lim,this.focus.z));
    },
    zoom(f){
      this.dist=Math.max(7,Math.min(80,this.dist*f));
    },
    zoomAt(f,px,py){
      const before=this.screenToGround(px,py);
      this.zoom(f);
      this.apply(camera);
      const after=this.screenToGround(px,py);
      if(before&&after){
        this.focus.x+=before.x-after.x;
        this.focus.z+=before.z-after.z;
        this.clamp();
      }
    },
    rotateSnap(sign){
      this.yawT+=sign*Math.PI/2;
    },
    rotateBy(rad){
      this.yaw+=rad;
      this.yawT+=rad;
    },
    snapYaw(){
      this.yawT=Math.round(this.yaw/(Math.PI/2))*(Math.PI/2);
    },
    update(dt){
      let d=this.yawT-this.yaw;
      this.yaw+=d*Math.min(1,dt*9);
      if(Math.abs(this.yawT-this.yaw)<0.0008) this.yaw=this.yawT;
      this.apply(camera);
    },
    apply(cam){
      const ce=Math.cos(this.el),se=Math.sin(this.el);
      cam.position.set(
        this.focus.x+Math.sin(this.yaw)*ce*this.dist,
        se*this.dist,
        this.focus.z+Math.cos(this.yaw)*ce*this.dist
      );
      cam.lookAt(this.focus);
    },
    screenToGround(px,py){
      const ndc=new THREE.Vector2((px/innerWidth)*2-1,-(py/innerHeight)*2+1);
      const v=new THREE.Vector3(ndc.x,ndc.y,0.5).unproject(camera);
      const dir=v.sub(camera.position).normalize();
      if(Math.abs(dir.y)<1e-6) return null;
      const t=-camera.position.y/dir.y;
      if(t<0) return null;
      return {x:camera.position.x+dir.x*t,z:camera.position.z+dir.z*t};
    }
  };
  camCtl.apply(camera);

  function screenToTile(px,py){
    const g=camCtl.screenToGround(px,py);
    if(!g) return null;
    const gx=Math.floor(g.x+GRID/2);
    const gz=Math.floor(g.z+GRID/2);
    if(gx<0||gz<0||gx>=GRID||gz>=GRID) return null;
    return {x:gx,z:gz};
  }

  const selGroup=new THREE.Group();
  const selEdges=new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02,1.3,1.02)),
    new THREE.LineBasicMaterial({color:0xffb84d,toneMapped:false})
  );
  selEdges.position.y=0.62;
  selGroup.add(selEdges);
  const selRing=new THREE.Mesh(
    new THREE.RingGeometry(0.56,0.66,4,1).rotateZ(Math.PI/4),
    new THREE.MeshBasicMaterial({color:0xffb84d,transparent:true,opacity:0.9,side:THREE.DoubleSide,toneMapped:false,depthWrite:false})
  );
  selRing.rotation.x=-Math.PI/2;
  selRing.position.y=0.02;
  selGroup.add(selRing);
  selGroup.visible=false;
  scene.add(selGroup);

  function setSelection(b){
    if(!b){ selGroup.visible=false; return; }
    selGroup.visible=true;
    selGroup.position.set(WX(b.x)+0.5,0,WX(b.z)+0.5);
  }

  const ghostOK=new THREE.MeshBasicMaterial({color:0x86ffc4,transparent:true,opacity:0.38,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const ghostBAD=new THREE.MeshBasicMaterial({color:0xe05656,transparent:true,opacity:0.5,depthWrite:false,toneMapped:false});
  const ghostPathOK=new THREE.MeshBasicMaterial({map:makeArrowTexture(false),color:0x35d07a,transparent:true,opacity:0.8,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const ghostPathBAD=new THREE.MeshBasicMaterial({map:makeArrowTexture(false),color:0xe05656,transparent:true,opacity:0.8,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});

  const ghostGroup=new THREE.Group();
  scene.add(ghostGroup);
  const ghostSingle={};
  for(const t in templates){
    const g=templates[t].clone(true);
    g.traverse(o=>{o.material=ghostOK;o.castShadow=false;o.receiveShadow=false;});
    g.visible=false;
    ghostGroup.add(g);
    ghostSingle[t]=g;
  }
  const pathPool=[];
  for(let i=0;i<40;i++){
    const m=new THREE.Mesh(geoStraight,ghostPathOK);
    m.visible=false;
    ghostGroup.add(m);
    pathPool.push(m);
  }
  const spanBox=new THREE.Mesh(new THREE.BoxGeometry(1,0.3,1),new THREE.MeshBasicMaterial({color:0x35d07a,transparent:true,opacity:0.3,depthWrite:false,toneMapped:false}));
  spanBox.visible=false;
  ghostGroup.add(spanBox);

  function tintGroup(g,ok){
    g.traverse(o=>{if(o.isMesh)o.material=ok?ghostOK:ghostBAD;});
  }

  function setGhost(desc){
    for(const t in ghostSingle) ghostSingle[t].visible=false;
    for(const m of pathPool) m.visible=false;
    spanBox.visible=false;
    if(!desc||desc.mode==='none') return;
    if(desc.mode==='single'){
      const g=ghostSingle[desc.type];
      if(!g) return;
      g.visible=true;
      g.position.set(WX(desc.x)+0.5,0,WX(desc.z)+0.5);
      g.rotation.y=yawOf(desc.dir);
      tintGroup(g,desc.valid);
    }else if(desc.mode==='path'){
      desc.cells.forEach((c,i)=>{
        if(i>=pathPool.length) return;
        const m=pathPool[i];
        m.visible=true;
        m.position.set(WX(c.x)+0.5,0.12,WX(c.z)+0.5);
        m.rotation.y=yawOf(c.dir);
        m.material=desc.valid?ghostPathOK:ghostPathBAD;
      });
    }else if(desc.mode==='under'){
      if(!desc.ends||desc.ends.length!==2) return;
      const [a,b2]=desc.ends;
      const ok=desc.valid;
      [[a,'under_in'],[b2,'under_out']].forEach(([c,t])=>{
        const g=ghostSingle[t];
        g.visible=true;
        g.position.set(WX(c.x)+0.5,0,WX(c.z)+0.5);
        g.rotation.y=yawOf(c.dir);
        tintGroup(g,ok);
      });
      const mx=(WX(a.x)+WX(b2.x))/2+0.5;
      const mz=(WX(a.z)+WX(b2.z))/2+0.5;
      const len=Math.abs(a.x-b2.x)+Math.abs(a.z-b2.z)-1;
      spanBox.visible=len>0;
      spanBox.position.set(mx,0.15,mz);
      spanBox.scale.set(a.x!==b2.x?len:1,1,a.z!==b2.z?len:1);
      spanBox.material.color.setHex(ok?0x35d07a:0xe05656);
    }
  }

  const STAT_H={extractor:1.5,furnace:1.68,assembler:1.58,lab:1.7};
  const STAT_IS_MACHINE={extractor:1,furnace:1,assembler:1,lab:1};
  const candB=[],candX=[],candY=[],candD=[],candOrd=[],candKey=[],candHtml=[],candPct=[];
  function candSortFn(a,b){ return candD[a]-candD[b]; }

  function statusParts(b){
    const t=b.type;
    let html='',starved=false,blocked=false,pct=-1;
    if(t==='lab'){
      if(b.curItem&&ITEMS[b.curItem]){
        const col='#'+ITEMS[b.curItem].color.toString(16).padStart(6,'0');
        html+='<div style="width:10px;height:10px;border-radius:50%;background:'+col+';animation:spulse 1.1s ease-in-out infinite"></div>';
      }else{
        html+='<div style="width:10px;height:10px;border-radius:50%;background:#3a4552"></div>';
      }
    }
    if(b.crafting&&t!=='lab'){
      const rec=b.recipe?RECIPE_BY_ID[b.recipe]:null;
      const time=rec?rec.time:EXTRACT_TIME;
      pct=time>0?Math.min(1,b.progress/time):0;
    }else if(!b.crafting&&t!=='extractor'){
      const rec=b.recipe?RECIPE_BY_ID[b.recipe]:null;
      if(rec){
        for(const k in rec.inp){
          if((b.inputs[k]||0)<rec.inp[k]){ starved=true; break; }
        }
      }
    }
    if((t==='extractor'||t==='furnace'||t==='assembler')&&(b.outCount||0)>=OUT_CAP) blocked=true;
    if(pct>=0){
      html+='<div style="width:54px;height:6px;background:#141b24;border-radius:3px;overflow:hidden"><div data-f="1" style="width:'+(pct*100).toFixed(1)+'%;height:100%;background:linear-gradient(90deg,#25b89a,#5ceac9);border-radius:3px"></div></div>';
    }
    if(starved){
      html+='<div style="min-width:16px;height:16px;border-radius:50%;background:#d84a4a;color:#fff;font:700 11px system-ui;display:flex;align-items:center;justify-content:center;line-height:1">!</div>';
    }
    if(blocked){
      html+='<div style="min-width:16px;height:16px;border-radius:4px;background:#d84a4a;color:#fff;font:700 10px system-ui;display:flex;align-items:center;justify-content:center;line-height:1">X</div>';
    }
    const lv=b.level||1;
    if(lv>1&&lv<ROMAN.length){
      html+='<span style="color:#f6c453;font:700 10px system-ui">'+ROMAN[lv]+'</span>';
    }
    const key=t+'|'+(b.crafting?1:0)+'|'+(starved?1:0)+'|'+(blocked?1:0)+'|'+(b.curItem||'')+'|'+lv;
    return {key,html,pct};
  }

  function updateStatus(S){
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    candB.length=0;candX.length=0;candY.length=0;candD.length=0;
    candOrd.length=0;candKey.length=0;candHtml.length=0;candPct.length=0;
    const vw=innerWidth,vh=innerHeight;
    for(const b of S.buildings.values()){
      const t=b.type;
      if(!STAT_IS_MACHINE[t]) continue;
      if(!meshMap.has(keyOf(b.x,b.z))) continue;
      tmpV.set(WX(b.x)+0.5,STAT_H[t],WX(b.z)+0.5).project(camera);
      if(tmpV.z>=1||tmpV.z<-1) continue;
      const sx=(tmpV.x+1)/2*vw, sy=(-tmpV.y+1)/2*vh;
      if(sx<-80||sy<-80||sx>vw+80||sy>vh+80) continue;
      candB.push(b);
      candX.push(sx);
      candY.push(sy);
      candD.push(tmpV.x*tmpV.x+tmpV.y*tmpV.y);
    }
    for(let i=0;i<candB.length;i++) candOrd.push(i);
    candOrd.sort(candSortFn);
    const shown=Math.min(STATUS_MAX,candOrd.length);
    for(let i=0;i<shown;i++){
      const oi=candOrd[i];
      const parts=statusParts(candB[oi]);
      candKey.push(parts.key);
      candHtml.push(parts.html);
      candPct.push(parts.pct);
    }
    for(let i=0;i<shown;i++){
      const d=statusPool[i];
      if(d._key!==candKey[i]){
        d.innerHTML=candHtml[i];
        d._key=candKey[i];
        d._fill=d.querySelector('[data-f]');
      }
      if(d._fill&&candPct[i]>=0) d._fill.style.width=(candPct[i]*100).toFixed(1)+'%';
      d.style.left=candX[candOrd[i]]+'px';
      d.style.top=candY[candOrd[i]]+'px';
      if(d.style.display!=='flex') d.style.display='flex';
    }
    for(let i=shown;i<STATUS_MAX;i++){
      const d=statusPool[i];
      if(d.style.display!=='none'){
        d.style.display='none';
        d._key='';
        d._fill=null;
      }
    }
  }

  let animClock=0;

  function frame(S,dtS,dtR){
    animClock+=dtS;
    camCtl.update(dtR);
    sun.position.set(camCtl.focus.x+26,46,camCtl.focus.z-18);
    sun.target.position.copy(camCtl.focus);
    arrowTex.offset.y-=dtS*BASE_BELT_SPEED*multFor(S,'belt');
    for(const b of S.buildings.values()){
      const rec=meshMap.get(keyOf(b.x,b.z));
      if(!rec) continue;
      const refs=rec.g.userData.refs;
      switch(b.type){
        case 'extractor':{
          const d=refs.drill;
          if(d){
            const act=b.crafting;
            const base=rec.g.userData.drillBase??1.02;
            d.rotation.y+=dtS*(act?6:0.6);
            d.position.y=base+(act?Math.sin(animClock*7)*0.03:0);
          }
          const nut=refs.nut;
          if(nut){
            const nb=rec.g.userData.nutBase??-0.18;
            nut.position.y=nb+(b.crafting?Math.sin(animClock*6+b.id)*0.11:0);
          }
          break;
        }
        case 'furnace':{
          const f=refs.fire;
          if(f){
            const act=b.crafting;
            const fl=act?0.85+Math.sin(animClock*13+b.id)*0.15:0.25;
            f.material.color.setHSL(0.07,1,fl*0.55);
            f.scale.y=act?1+Math.sin(animClock*17+b.id)*0.12:1;
          }
          const em=refs.ember;
          if(em){
            const act=b.crafting;
            const pu=Math.sin(animClock*9+b.id);
            em.material.opacity=act?0.7+pu*0.2:0.35;
            em.material.color.setHSL(0.05+0.02*(act?pu:0),1,act?0.52+pu*0.1:0.35);
            em.scale.setScalar(act?1+pu*0.08:1);
          }
          break;
        }
        case 'assembler':{
          const rig=refs.rig;
          if(rig) rig.position.x=Math.sin(animClock*(b.crafting?4.2:0.9))*0.26;
          const arm=refs.arm;
          if(arm) arm.rotation.y+=dtS*(b.crafting?2.2:0.3);
          const gears=refs.gear||[];
          for(const gr of gears){
            const sg=gr.userData.spin||1;
            gr.rotation.z+=dtS*sg*(b.crafting?5:0.4);
          }
          break;
        }
        case 'lab':{
          const d=refs.dish;
          if(d) d.rotation.y+=dtS*(b.crafting?3:0.5);
          const bl=refs.blink;
          if(bl){
            const act=b.crafting;
            bl.material.color.setHSL(0.12,0.85,act?0.55+0.25*Math.sin(animClock*6+b.id):0.3+0.12*Math.sin(animClock*2.2+b.id));
          }
          break;
        }
        case 'market':{
          const cn=refs.coin;
          if(cn) cn.rotation.x+=dtS*2.2;
          break;
        }
        case 'inserter':{
          const pv=refs.pivot;
          if(pv){
            const ang=Math.abs(b.phase-0.5)*2*Math.PI;
            pv.rotation.y=-ang;
            pv.position.y=0.44+Math.sin(ang)*0.04;
          }
          const hd=refs.held;
          if(hd){
            hd.visible=!!b.hold;
            if(b.hold) hd.material.color.setHex(ITEMS[b.hold].color);
          }
          break;
        }
      }
    }
    if(selGroup.visible){
      const ss=1+Math.sin(animClock*4)*0.04;
      selRing.scale.setScalar(ss);
    }
    updateItems(S);
    updateSmoke(S,dtS);
    updateStatus(S);
    renderer.render(scene,camera);
  }

  function syncAll(S){
    curS=S;
    while(buildingGroup.children.length){
      buildingGroup.remove(buildingGroup.children[0]);
    }
    meshMap.clear();
    for(const b of S.buildings.values()){
      if(isBeltLike(b.type)) continue;
      const g=cloneTemplate(b.type);
      g.position.set(WX(b.x)+0.5,0,WX(b.z)+0.5);
      g.rotation.y=yawOf(b.dir);
      buildingGroup.add(g);
      meshMap.set(keyOf(b.x,b.z),{g,type:b.type});
    }
    buildDecor(S);
    rebuildBelts(S);
  }

  addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  });

  return {
    scene,
    camera,
    dom:renderer.domElement,
    cam:camCtl,
    screenToTile,
    buildingAdded,
    buildingRemoved,
    setRotationOf,
    rebuildBelts,
    setSelection,
    setGhost,
    frame,
    syncAll,
    worldToScreen(x,z){
      const v=tmpV.set(WX(x)+0.5,0.6,WX(z)+0.5).project(camera);
      return {x:(v.x+1)/2*innerWidth,y:(-v.y+1)/2*innerHeight};
    }
  };
}
