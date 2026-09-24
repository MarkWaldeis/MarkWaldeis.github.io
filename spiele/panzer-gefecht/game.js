'use strict';

const TANK_DEFS=[
{name:'BT-7',nation:'UdSSR',role:'Schneller Spähpanzer · 45mm',color:0x55663c,hp:550,speed:17,accel:16,turn:2.05,turretTurn:2.5,reload:2.5,damage:70,pen:85,armorF:45,armorS:28,gunLen:3.0,muzzleBrake:false,speedBar:.95,armorBar:.22,fpBar:.30},
{name:'T-34-85',nation:'UdSSR',role:'Mittlerer Panzer · 85mm',color:0x4a5a34,hp:800,speed:11.5,accel:11,turn:1.55,turretTurn:2.1,reload:4.2,damage:135,pen:135,armorF:90,armorS:45,gunLen:3.8,muzzleBrake:false,speedBar:.62,armorBar:.52,fpBar:.60},
{name:'M4A3 Sherman',nation:'USA',role:'Mittlerer Panzer · 76mm',color:0x59653b,hp:750,speed:12.5,accel:12,turn:1.65,turretTurn:2.3,reload:3.1,damage:105,pen:118,armorF:82,armorS:40,gunLen:3.5,muzzleBrake:false,speedBar:.70,armorBar:.46,fpBar:.50},
{name:'Tiger I',nation:'Deutschland',role:'Schwerer Panzer · 88mm',color:0x867651,hp:1150,speed:8,accel:8,turn:1.05,turretTurn:1.6,reload:5.4,damage:195,pen:168,armorF:150,armorS:82,gunLen:4.2,muzzleBrake:true,speedBar:.38,armorBar:.85,fpBar:.85},
{name:'IS-2',nation:'UdSSR',role:'Schwerer Panzer · 122mm',color:0x44532e,hp:1050,speed:9.5,accel:9,turn:1.2,turretTurn:1.5,reload:6.6,damage:265,pen:205,armorF:155,armorS:92,gunLen:4.4,muzzleBrake:true,speedBar:.46,armorBar:.88,fpBar:1.0}
];

const MAP_DEFS=[
{id:'wueste',name:'Wüste Sandsturm',desc:'Offenes Gelände · Felsen & Ruinen',ground:0xc7a468,patch:0xb99858,sky:0xdcb98d,fogN:70,fogF:360,sun:0xffe9c4,hemiSky:0xfff3dc,hemiGnd:0x8a704c,mountain:0xa8895e,
props:{rocks:24,deadTrees:14,ruins:9,cacti:12,barrels:8,crates:12}},
{id:'schnee',name:'Eisige Weiten',desc:'Kälte · Hügel & Tannen',ground:0xdfe6ea,patch:0xcfd8de,sky:0xcdd6dd,fogN:55,fogF:300,sun:0xf3f6ff,hemiSky:0xeef4fa,hemiGnd:0x8d97a0,mountain:0xaebbc6,
props:{rocks:22,deadTrees:6,ruins:4,pines:34,barrels:7,crates:10}},
{id:'wald',name:'Grüner Wald',desc:'Deckung · Dichte Wälder',ground:0x4f6337,patch:0x465a30,sky:0xa8c4cf,fogN:45,fogF:260,sun:0xfff4d6,hemiSky:0xcfe0da,hemiGnd:0x39502c,mountain:0x54704a,
props:{rocks:14,deadTrees:8,pines:52,ruins:3,barrels:9,crates:14}},
{id:'stadt',name:'Verlassene Stadt',desc:'Urbaner Nahkampf · Ruinen',ground:0x8f8f8a,patch:0x84847e,sky:0x9aa0a6,fogN:50,fogF:290,sun:0xf5ede0,hemiSky:0xc4c8cd,hemiGnd:0x5d5d58,mountain:0x737a80,
props:{rocks:8,deadTrees:5,ruins:14,buildings:16,rubble:14,pines:6,barrels:12,crates:16}}
];

let renderer=null,scene=null,camera=null,menuScene=null,menuCam=null,menuTank=null,menuSpin=0;
let sunLight=null,clock=new THREE.Clock();
let gameState='menu';
let selTank=1,selMap=0;

let world=null;
let player=null,enemies=[],bullets=[],effects=[],fxLights=[],delayed=[],floats=[];
let wave=0,waveState='idle',waveTimer=0,pendingSpawns=[],spawnClock=0;
let score=0,kills=0,shotsFired=0,shotsHit=0,dmgTakenTime=-99;
let camYaw=0,camPitch=0.24,camDist=12,shakeAmt=0;
let keys={},mouseLocked=false,lastAim=new THREE.Vector3(0,0,50);
let audioCtx=null,masterGain=null,noiseBuf=null,engineOsc=null,engineOsc2=null,engineGain=null,engineFilter=null;
let mmCtx=null,bannerTO1=null,bannerTO2=null,vigTO=null,hmTO=null;
let best=0;
try{best=parseInt(localStorage.getItem('pg_best')||'0')||0;}catch(e){}

const V1=new THREE.Vector3(),V2=new THREE.Vector3(),V3=new THREE.Vector3(),V4=new THREE.Vector3();
const HALF=150;

function normAng(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}
function rand(a,b){return a+Math.random()*(b-a);}
function randi(a,b){return Math.floor(rand(a,b+1));}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function segDist(ax,az,bx,bz,px,pz){
  const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz;
  let t=l2>0?((px-ax)*dx+(pz-az)*dz)/l2:0;t=clamp(t,0,1);
  const cx=ax+dx*t,cz=az+dz*t;
  return Math.hypot(px-cx,pz-cz);
}
function fwdOf(yaw,out){out.set(Math.sin(yaw),0,Math.cos(yaw));return out;}

function initAudio(){
  if(audioCtx)return;
  try{
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    masterGain=audioCtx.createGain();masterGain.gain.value=0.5;masterGain.connect(audioCtx.destination);
    const len=audioCtx.sampleRate;
    noiseBuf=audioCtx.createBuffer(1,len,audioCtx.sampleRate);
    const d=noiseBuf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
    const wind=audioCtx.createBufferSource();wind.buffer=noiseBuf;wind.loop=true;
    const wf=audioCtx.createBiquadFilter();wf.type='lowpass';wf.frequency.value=220;
    const wg=audioCtx.createGain();wg.gain.value=0.03;
    wind.connect(wf);wf.connect(wg);wg.connect(masterGain);wind.start();
  }catch(e){audioCtx=null;}
}
function noiseHit(dur,freq,gain,type){
  if(!audioCtx)return;
  const s=audioCtx.createBufferSource();s.buffer=noiseBuf;s.loop=true;
  const f=audioCtx.createBiquadFilter();f.type=type||'bandpass';f.frequency.value=freq;f.Q.value=0.8;
  const g=audioCtx.createGain();const t=audioCtx.currentTime;
  g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  s.connect(f);f.connect(g);g.connect(masterGain);s.start(t);s.stop(t+dur+0.05);
}
function tone(freq,freqEnd,dur,gain,type){
  if(!audioCtx)return;
  const o=audioCtx.createOscillator();o.type=type||'sine';
  const t=audioCtx.currentTime;
  o.frequency.setValueAtTime(freq,t);
  if(freqEnd)o.frequency.exponentialRampToValueAtTime(Math.max(freqEnd,1),t+dur);
  const g=audioCtx.createGain();
  g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(g);g.connect(masterGain);o.start(t);o.stop(t+dur+0.05);
}
function sndShot(vol){vol=vol===undefined?1:vol;noiseHit(0.22,700,0.55*vol,'bandpass');noiseHit(0.1,2500,0.25*vol,'highpass');tone(90,40,0.3,0.5*vol,'sine');}
function sndExplosion(vol){vol=vol===undefined?1:vol;noiseHit(0.8,240,0.85*vol,'lowpass');tone(60,25,0.9,0.7*vol,'sine');noiseHit(0.25,1800,0.2*vol,'highpass');}
function sndPen(vol){vol=vol===undefined?1:vol;tone(300,80,0.12,0.4*vol,'square');noiseHit(0.08,2200,0.3*vol,'bandpass');}
function sndRico(vol){vol=vol===undefined?1:vol;tone(2600,500,0.16,0.22*vol,'triangle');}
function sndClank(vol){vol=vol===undefined?1:vol;tone(900,300,0.06,0.18*vol,'square');}
function sndDry(){tone(1400,900,0.05,0.12,'square');}
function sndReloadDone(){tone(1100,1500,0.07,0.14,'sine');}
function sndSwitch(){tone(650,850,0.06,0.12,'sine');}
function sndKill(){tone(700,700,0.09,0.2,'sine');setTimeout(()=>tone(1050,1050,0.14,0.2,'sine'),90);}
function startEngine(){
  if(!audioCtx||engineOsc)return;
  engineOsc=audioCtx.createOscillator();engineOsc.type='sawtooth';engineOsc.frequency.value=55;
  engineOsc2=audioCtx.createOscillator();engineOsc2.type='sawtooth';engineOsc2.frequency.value=57;
  engineFilter=audioCtx.createBiquadFilter();engineFilter.type='lowpass';engineFilter.frequency.value=320;
  engineGain=audioCtx.createGain();engineGain.gain.value=0.0;
  engineOsc.connect(engineFilter);engineOsc2.connect(engineFilter);engineFilter.connect(engineGain);engineGain.connect(masterGain);
  engineOsc.start();engineOsc2.start();
}
function stopEngine(){
  if(!engineOsc)return;
  try{engineOsc.stop();engineOsc2.stop();}catch(e){}
  engineOsc=null;engineOsc2=null;engineGain=null;
}

function circleTexture(){
  const c=document.createElement('canvas');c.width=c.height=64;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,2,32,32,30);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.5,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(c);
}
let TEX_CIRCLE=null;

function buildTankMesh(def,isPlayer){
  const g=new THREE.Group();
  const bodyMat=new THREE.MeshStandardMaterial({color:def.color,roughness:.85,metalness:.15});
  const darkMat=new THREE.MeshStandardMaterial({color:0x22221f,roughness:.95});
  const trackMat=new THREE.MeshStandardMaterial({color:0x2a2a27,roughness:.95});
  const hull=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.05,4.6),bodyMat);
  hull.position.y=1.02;hull.castShadow=true;hull.receiveShadow=true;g.add(hull);
  const glacis=new THREE.Mesh(new THREE.BoxGeometry(2.5,0.75,1.4),bodyMat);
  glacis.position.set(0,1.35,1.95);glacis.rotation.x=-0.5;glacis.castShadow=true;g.add(glacis);
  const deck=new THREE.Mesh(new THREE.BoxGeometry(2.3,0.28,2.6),bodyMat);
  deck.position.set(0,1.68,-0.6);deck.castShadow=true;g.add(deck);
  for(const sx of[-1.62,1.62]){
    const tr=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.95,4.9),trackMat);
    tr.position.set(sx,0.62,0);tr.castShadow=true;tr.receiveShadow=true;g.add(tr);
    for(let i=0;i<5;i++){
      const w=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.78,10),darkMat);
      w.rotation.z=Math.PI/2;w.position.set(sx,0.55,-1.9+i*0.95);g.add(w);
    }
  }
  const turret=new THREE.Group();turret.position.set(0,1.82,-0.35);g.add(turret);
  const tb=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.28,0.72,14),bodyMat);
  tb.castShadow=true;turret.add(tb);
  const mantlet=new THREE.Mesh(new THREE.BoxGeometry(0.95,0.8,0.6),bodyMat);
  mantlet.position.set(0,0,1.05);mantlet.castShadow=true;turret.add(mantlet);
  const cupola=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.38,0.28,10),darkMat);
  cupola.position.set(-0.35,0.48,-0.25);turret.add(cupola);
  const barrelPivot=new THREE.Group();barrelPivot.position.set(0,0.02,1.1);turret.add(barrelPivot);
  const barrelMat=new THREE.MeshStandardMaterial({color:0x33352f,roughness:.7,metalness:.4});
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.17,def.gunLen,10),barrelMat);
  barrel.rotation.x=Math.PI/2;barrel.position.z=def.gunLen/2;barrel.castShadow=true;barrelPivot.add(barrel);
  if(def.muzzleBrake){
    const mb=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.42,10),barrelMat);
    mb.rotation.x=Math.PI/2;mb.position.z=def.gunLen+0.05;barrelPivot.add(mb);
  }
  const muzzle=new THREE.Object3D();muzzle.position.z=def.gunLen+0.35;barrelPivot.add(muzzle);
  if(isPlayer){
    const mark=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.1,8),new THREE.MeshStandardMaterial({color:0xd9c98a,emissive:0x554a1e}));
    mark.position.set(0,0.55,-1.1);mark.rotation.x=Math.PI/2;turret.add(mark);
  }
  return{group:g,turret:turret,barrelPivot:barrelPivot,muzzle:muzzle};
}

class HpBarSprite{
  constructor(){
    this.canvas=document.createElement('canvas');this.canvas.width=64;this.canvas.height=8;
    this.tex=new THREE.CanvasTexture(this.canvas);
    this.mat=new THREE.SpriteMaterial({map:this.tex,transparent:true,depthTest:false});
    this.sprite=new THREE.Sprite(this.mat);
    this.sprite.scale.set(3.4,0.42,1);
    this.pct=1;
    this.draw();
  }
  set(pct){if(pct!==this.pct){this.pct=pct;this.draw();}}
  draw(){
    const x=this.canvas.getContext('2d');
    x.clearRect(0,0,64,8);
    x.fillStyle='rgba(0,0,0,.65)';x.fillRect(0,0,64,8);
    x.fillStyle=this.pct>0.5?'#8fce4a':(this.pct>0.25?'#d9b13b':'#cf5033');
    x.fillRect(1,1,62*this.pct,6);
    this.tex.needsUpdate=true;
  }
}

class Tank{
  constructor(def,team,x,z,opts){
    opts=opts||{};
    this.def=def;this.team=team;this.isPlayer=team===0;
    this.maxHp=Math.round(def.hp*(opts.hpMul||1));
    this.hp=this.maxHp;
    this.dmgMul=opts.dmgMul||1;
    this.reloadMul=opts.reloadMul||1;
    this.speedMul=opts.speedMul||1;
    this.acc=opts.acc||0;
    const m=buildTankMesh(def,this.isPlayer);
    this.group=m.group;this.turret=m.turret;this.barrelPivot=m.barrelPivot;this.muzzle=m.muzzle;
    this.group.position.set(x,0,z);
    this.yaw=rand(0,Math.PI*2);
    this.turretYaw=0;this.barrelPitch=0;
    this.throttle=0;this.steer=0;this.vel=0;this.brake=false;
    this.reloadTimer=opts.startLoaded?0:def.reload;
    this.recoil=0;this.dead=false;
    this.ammo={AP:this.isPlayer?30:999,HE:this.isPlayer?15:999};
    this.shell=this.isPlayer?'AP':'AP';
    this.lastDamagedBy=null;this.regenDelay=0;
    this.aiState='advance';this.aiThink=0;this.strafeDir=Math.random()<0.5?-1:1;
    this.unstuckT=0;this.stuckT=0;this.lastX=x;this.lastZ=z;this.fireJitter=rand(0,1);
    if(!this.isPlayer){
      this.hpBar=new HpBarSprite();
      this.hpBar.sprite.position.set(x,4.6,z);
      scene.add(this.hpBar.sprite);
    }
    scene.add(this.group);
  }
  get pos(){return this.group.position;}
  worldGunYaw(){return this.yaw+this.turretYaw;}
  aimAt(p,dt){
    const dx=p.x-this.pos.x,dz=p.z-this.pos.z;
    const desired=normAng(Math.atan2(dx,dz)-this.yaw);
    const rate=this.def.turretTurn*dt;
    const d=normAng(desired-this.turretYaw);
    this.turretYaw+=clamp(d,-rate,rate);
    const gy=this.worldGunYaw();
    const flat=Math.hypot(p.x-this.pos.x,p.z-this.pos.z);
    const dy=p.y-(this.pos.y+2.4);
    const want=clamp(Math.atan2(dy,flat),-0.26,0.30);
    const dp=clamp(want-this.barrelPitch,-rate*1.3,rate*1.3);
    this.barrelPitch+=dp;
    this.turret.rotation.y=this.turretYaw;
    this.barrelPivot.rotation.x=-this.barrelPitch;
  }
  angleErrTo(p){
    const gy=this.worldGunYaw();
    const a=Math.atan2(p.x-this.pos.x,p.z-this.pos.z);
    return Math.abs(normAng(a-gy));
  }
  gunTipPos(out){
    this.muzzle.getWorldPosition(out);
    return out;
  }
  canFire(){return !this.dead&&this.reloadTimer<=0&&this.ammo[this.shell]>0;}
  tryFire(aimPoint){
    if(this.dead||this.reloadTimer>0)return false;
    if(this.ammo[this.shell]<=0){
      if(this.isPlayer){
        const other=this.shell==='AP'?'HE':'AP';
        if(this.ammo[other]>0){this.switchShell(other);}else{sndDry();showHintFlash();}
        return false;
      }
      return false;
    }
    this.ammo[this.shell]--;
    const ap=this.shell==='AP';
    const dmg=(ap?this.def.damage:this.def.damage*1.5)*this.dmgMul;
    const pen=ap?this.def.pen:this.def.pen*0.35;
    const splash=ap?0:7;
    this.gunTipPos(V1);
    V2.copy(aimPoint).sub(V1).normalize();
    spawnBullet(this,V1.clone(),V2.clone(),dmg,pen,splash,ap);
    this.reloadTimer=this.def.reload*this.reloadMul;
    this.recoil=1;
    shotsFired++;
    spawnMuzzleFX(V1,V2,this.def.gunLen);
    const dCam=camera?camera.position.distanceTo(V1):50;
    sndShot(clamp(1-dCam/220,0.12,1)*(this.isPlayer?1:0.8));
    if(this.isPlayer){shakeAmt=Math.min(shakeAmt+0.22,0.6);}
    return true;
  }
  switchShell(s){this.shell=s;sndSwitch();updateAmmoUI();}
  takeDamage(amount,source,kind,hitPos){
    if(this.dead)return;
    this.hp-=amount;
    this.regenDelay=0;
    if(source)this.lastDamagedBy=source;
    if(hitPos){
      if(kind==='pen')floatText(hitPos,String(Math.round(amount)),'#ffd76b',false);
      else if(kind==='nope')floatText(hitPos,'KEIN DURCHSCHLAG','#9aa0a6',true);
      else if(kind==='rico')floatText(hitPos,'ABPRALLER','#cfd8e0',true);
    }
    if(this.isPlayer){
      dmgTakenTime=elapsed;
      flashVignette();
      shakeAmt=Math.min(shakeAmount()+amount/this.maxHp,0.9);
      updateHpUI();
    }else if(this.hpBar){
      this.hpBar.set(clamp(this.hp/this.maxHp,0,1));
    }
    if(this.hp<=0)this.destroy(source);
  }
  heal(hp){
    this.hp=Math.min(this.maxHp,this.hp+hp);
    if(this.isPlayer)updateHpUI();
    else if(this.hpBar)this.hpBar.set(clamp(this.hp/this.maxHp,0,1));
  }
  destroy(source){
    if(this.dead)return;
    this.dead=true;
    explosionFX(this.pos.x,2,this.pos.z,2.2);
    sndExplosion(this.isPlayer?1:clamp(1-camera.position.distanceTo(this.pos)/200,0.2,1)*0.9);
    spawnWreck(this);
    scene.remove(this.group);
    if(this.hpBar){scene.remove(this.hpBar.sprite);}
    if(this.isPlayer){
      playerDestroyed();
    }else{
      kills++;
      const pts=100+(this.defIndex||0)*40;
      score+=pts;
      addFeed((source&&source.isPlayer?'DU':((source&&source.def)?source.def.name:'???'))+' hat '+this.def.name+' vernichtet  (+'+pts+')');
      if(source&&source.isPlayer){shotsHit++;showHitmarker(true);sndKill();floatText(V1.copy(this.pos).setY(4.5),'+'+pts,'#d9c98a',true);}
      updateTopUI();
    }
  }
  move(dt){
    const maxSpd=this.def.speed*this.speedMul;
    if(this.brake)this.vel*= Math.pow(0.001,dt);
    else if(this.throttle!==0){
      const target=maxSpd*this.throttle;
      const acc=this.def.accel*dt;
      if(this.vel<target)this.vel=Math.min(this.vel+acc,target);
      else this.vel=Math.max(this.vel-acc,target);
    }else{
      this.vel*=Math.pow(0.05,dt);
      if(Math.abs(this.vel)<0.05)this.vel=0;
    }
    const turnRate=this.def.turn*dt*(this.vel<-0.5?-1:1);
    this.yaw=normAng(this.yaw+this.steer*turnRate*Math.min(1,Math.abs(this.vel)/maxSpd*2+0.45));
    fwdOf(this.yaw,V3);
    this.pos.x+=V3.x*this.vel*dt;
    this.pos.z+=V3.z*this.vel*dt;
    this.pos.x=clamp(this.pos.x,-HALF+6,HALF-6);
    this.pos.z=clamp(this.pos.z,-HALF+6,HALF-6);
    this.group.rotation.y=this.yaw;
    this.recoil=Math.max(0,this.recoil-dt*4);
    this.turret.position.z=-0.35-this.recoil*0.14;
    this.reloadTimer-=dt;
    if(this.reloadTimer<=0&&this._wasReloading){this._wasReloading=false;if(this.isPlayer)sndReloadDone();}
    if(this.reloadTimer>0)this._wasReloading=true;
    this.resolveCollisions();
    this.regenDelay+=dt;
    if(this.regenDelay>8&&this.hp<this.maxHp&&!this.dead)this.heal(6*dt);
  }
  resolveCollisions(){
    for(const c of world.colliders){
      const dx=this.pos.x-c.x,dz=this.pos.z-c.z;
      const rr=c.r+1.9;
      const d2=dx*dx+dz*dz;
      if(d2<rr*rr&&d2>0.0001){
        const d=Math.sqrt(d2);
        const push=(rr-d);
        this.pos.x+=dx/d*push;this.pos.z+=dz/d*push;
        this.vel*=0.94;
      }
    }
    const others=[player].concat(enemies);
    for(const o of others){
      if(!o||o===this||o.dead)continue;
      const dx=this.pos.x-o.pos.x,dz=this.pos.z-o.pos.z;
      const d=Math.hypot(dx,dz),rr=4.2;
      if(d<rr&&d>0.001){
        const push=(rr-d)/2;
        this.pos.x+=dx/d*push;this.pos.z+=dz/d*push;
        o.pos.x-=dx/d*push;o.pos.z-=dz/d*push;
      }
    }
  }
  updateAI(dt){
    if(this.dead||!player||player.dead){this.throttle=0;this.steer=0;return;}
    this.aiThink-=dt;
    const dx=player.pos.x-this.pos.x,dz=player.pos.z-this.pos.z;
    const dist=Math.hypot(dx,dz);
    const los=dist<130&&hasLOS(this.pos.x,this.pos.z,player.pos.x,player.pos.z);
    if(this.aiThink<=0){
      this.aiThink=0.4;
      if(!los||dist>75)this.aiState='advance';
      else if(dist<26)this.aiState='back';
      else this.aiState='combat';
      if(Math.random()<0.25)this.strafeDir*=-1;
    }
    const angTo=Math.atan2(dx,dz);
    if(this.unstuckT>0){
      this.unstuckT-=dt;
      this.throttle=-1;this.steer=this.unstuckSteer||1;
    }else if(this.aiState==='advance'){
      const diff=normAng(angTo-this.yaw);
      this.steer=clamp(diff*2.2,-1,1);
      this.throttle=Math.abs(diff)>1.4?0.35:1;
    }else if(this.aiState==='back'){
      const diff=normAng(angTo-this.yaw);
      this.throttle=-0.8;
      this.steer=clamp(-diff*1.5,-1,1);
    }else{
      const orbitAng=angTo+this.strafeDir*1.35;
      const diff=normAng(orbitAng-this.yaw);
      this.steer=clamp(diff*2,-1,1);
      this.throttle=0.55;
    }
    fwdOf(this.yaw,V3);
    const probeX=this.pos.x+V3.x*7,probeZ=this.pos.z+V3.z*7;
    if(this.throttle>0.1){
      for(const c of world.colliders){
        const d=Math.hypot(probeX-c.x,probeZ-c.z);
        if(d<c.r+2.4){
          const side=Math.sign(normAng(Math.atan2(c.x-this.pos.x,c.z-this.pos.z)-this.yaw))||1;
          this.steer=-side;this.throttle*=0.55;
          break;
        }
      }
    }
    const moved=Math.hypot(this.pos.x-this.lastX,this.pos.z-this.lastZ);
    if(this.throttle!==0&&moved<0.06){this.stuckT+=dt;}else{this.stuckT=0;}
    if(this.stuckT>1.1){
      this.stuckT=0;this.unstuckT=1.3;
      this.unstuckSteer=Math.random()<0.5?-1:1;
    }
    this.lastX=this.pos.x;this.lastZ=this.pos.z;
    V4.copy(player.pos);V4.y=1.4;
    if(los&&dist>8){
      const lead=dist/130;
      V4.x+=Math.sin(player.yaw)*player.vel*lead*0.85;
      V4.z+=Math.cos(player.yaw)*player.vel*lead*0.85;
    }
    const j=(this.fireJitter-0.5)*this.acc;
    if(j!==0){
      const ca=Math.cos(j),sa=Math.sin(j);
      const ox=V4.x-this.pos.x,oz=V4.z-this.pos.z;
      V4.x=this.pos.x+ox*ca-oz*sa;
      V4.z=this.pos.z+ox*sa+oz*ca;
    }
    this.aimAt(V4,dt);
    if(los&&this.reloadTimer<=0&&this.angleErrTo(V4)<0.055&&this.ammo.AP>0){
      V4.y=1.5;
      this.tryFire(V4);
    }
    this.brake=false;
  }
}

function shakeAmount(){return shakeAmt;}
function hasLOS(ax,az,bx,bz){
  const dx=bx-ax,dz=bz-az;
  const len=Math.hypot(dx,dz);
  const steps=Math.ceil(len/5);
  for(let i=1;i<steps;i++){
    const t=i/steps;
    const px=ax+dx*t,pz=az+dz*t;
    for(const c of world.colliders){
      if(c.noBlock)continue;
      const d=Math.hypot(px-c.x,pz-c.z);
      if(d<c.r*0.8)return false;
    }
  }
  return true;
}

let elapsed=0;

function spawnBullet(owner,pos,dir,dmg,pen,splash,ap){
  const geo=new THREE.BoxGeometry(0.14,0.14,1.6);
  const col=ap?0xffe08a:0xff9040;
  const mat=new THREE.MeshBasicMaterial({color:col});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.position.copy(pos);
  scene.add(mesh);
  bullets.push({mesh:mesh,pos:pos.clone(),vel:dir.clone().multiplyScalar(135),owner:owner,team:owner.team,dmg:dmg,pen:pen,splash:splash,life:2.6,ap:ap});
}
function updateBullets(dt){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.life-=dt;
    if(b.life<=0){scene.remove(b.mesh);bullets.splice(i,1);continue;}
    const ox=b.pos.x,oy=b.pos.y,oz=b.pos.z;
    b.pos.addScaledVector(b.vel,dt);
    b.mesh.position.copy(b.pos);
    V1.copy(b.pos).add(b.vel);
    b.mesh.lookAt(V1);
    let hitSomething=false;
    let bestD=Infinity,hitTank=null,hitProp=null;
    for(const t of [player].concat(enemies)){
      if(!t||t.dead||t===b.owner)continue;
      if(b.team===t.team)continue;
      const d=segDist(ox,oz,b.pos.x,b.pos.z,t.pos.x,t.pos.z);
      if(d<2.35&&oy<4.6){
        const dc=Math.hypot(ox-t.pos.x,oz-t.pos.z)+Math.hypot(b.pos.x-t.pos.x,b.pos.z-t.pos.z);
        if(dc<bestD){bestD=dc;hitTank=t;hitProp=null;}
      }
    }
    for(const p of world.destructibles){
      const d=segDist(ox,oz,b.pos.x,b.pos.z,p.x,p.z);
      if(d<p.r+0.4){
        const dc=Math.hypot(ox-p.x,oz-p.z)+Math.hypot(b.pos.x-p.x,b.pos.z-p.z);
        if(dc<bestD){bestD=dc;hitProp=p;hitTank=null;}
      }
    }
    for(const c of world.colliders){
      const d=segDist(ox,oz,b.pos.x,b.pos.z,c.x,c.z);
      if(d<c.r){
        bestD=-1;break;
      }
    }
    if(bestD===-1){
      dirtFX(b.pos.x,0.6,b.pos.z);
      sndClank(0.4);
      scene.remove(b.mesh);bullets.splice(i,1);continue;
    }
    if(hitTank){
      shellImpact(hitTank,b);
      scene.remove(b.mesh);bullets.splice(i,1);continue;
    }
    if(hitProp){
      destroyProp(hitProp,b.owner,true);
      if(b.splash>0)explodeAt(b.pos.x,b.pos.z,b.splash,b.dmg*0.6,b.team,b.owner);
      scene.remove(b.mesh);bullets.splice(i,1);continue;
    }
    if(b.pos.y<0.12){
      dirtFX(b.pos.x,0.3,b.pos.z);
      scene.remove(b.mesh);bullets.splice(i,1);continue;
    }
    if(Math.abs(b.pos.x)>295||Math.abs(b.pos.z)>295){
      scene.remove(b.mesh);bullets.splice(i,1);
    }
  }
}
function shellImpact(tank,b){
  const impactPos=V2.copy(b.mesh.position);
  const dirNorm=V3.copy(b.vel).normalize();
  fwdOf(tank.yaw,V4);
  const dot=dirNorm.dot(V4);
  const front=dot<-0.35;
  const armor=front?tank.def.armorF:tank.def.armorS;
  const roll=b.pen*rand(0.85,1.15);
  const distCam=camera?camera.position.distanceTo(impactPos):40;
  const vol=clamp(1-distCam/160,0.15,1);
  if(roll>=armor){
    const crit=roll>armor*1.5;
    const dmg=b.dmg*rand(0.9,1.1)*(crit?1.15:1);
    tank.takeDamage(dmg,b.owner,'pen',impactPos);
    sparkFX(impactPos.x,impactPos.y,impactPos.z,0xffd76b,10);
    sndPen(vol);
    if(b.owner&&b.owner.isPlayer&&!tank.isPlayer){shotsHit++;showHitmarker(false);}
    if(b.splash>0)explodeAt(impactPos.x,impactPos.z,b.splash,b.dmg*0.5,b.team,b.owner);
  }else if(roll>=armor*0.78){
    tank.takeDamage(b.dmg*0.3,b.owner,'nope',impactPos);
    sparkFX(impactPos.x,impactPos.y,impactPos.z,0xffeebb,6);
    sndClank(vol);
    if(b.owner&&b.owner.isPlayer&&!tank.isPlayer){shotsHit++;showHitmarker(false);}
  }else{
    tank.takeDamage(b.dmg*0.08,b.owner,'rico',impactPos);
    ricoFX(impactPos.x,impactPos.y,impactPos.z);
    sndRico(vol);
    if(b.owner&&b.owner.isPlayer&&!tank.isPlayer)showHitmarker(false);
  }
}
function explodeAt(x,z,radius,dmg,team,owner){
  explosionFX(x,1.2,z,radius*0.35);
  sndExplosion(clamp(1-(camera?camera.position.distanceTo(V1.set(x,1,z)):60)/180,0.15,1));
  for(const t of [player].concat(enemies)){
    if(!t||t.dead)continue;
    const d=Math.hypot(t.pos.x-x,t.pos.z-z);
    if(d<radius+1.5){
      const fall=clamp(1-d/(radius+1.5),0,1);
      t.takeDamage(dmg*fall,owner,'pen',null);
      if(!owner&&t.isPlayer){}
    }
  }
  for(let i=world.destructibles.length-1;i>=0;i--){
    const p=world.destructibles[i];
    if(Math.hypot(p.x-x,p.z-z)<radius){
      delayed.push({t:rand(0.05,0.25),fn:function(){destroyProp(p,owner,false);}});
    }
  }
}
function destroyProp(p,owner,byBullet){
  const idx=world.destructibles.indexOf(p);
  if(idx<0)return;
  world.destructibles.splice(idx,1);
  const ci=world.colliders.indexOf(p.collider);
  if(ci>=0)world.colliders.splice(ci,1);
  scene.remove(p.mesh);
  if(p.kind==='barrel'){
    explodeAt(p.x,p.z,7,85,null,null);
  }else{
    woodFX(p.x,1,p.z);
    sndClank(0.5);
  }
}
function spawnWreck(tank){
  const clone=tank.group.clone(true);
  clone.traverse(function(o){
    if(o.isMesh){
      o.material=wreckMaterial(o.material);
    }
  });
  clone.position.y=-0.06;
  clone.rotation.z=rand(-0.05,0.05);
  scene.add(clone);
  const wreck={mesh:clone,x:tank.pos.x,z:tank.pos.z,smoke:6};
  world.wrecks.push(wreck);
  world.colliders.push({x:wreck.x,z:wreck.z,r:2.5,noBlock:false});
  delayed.push({t:0.4,fn:function(){
    smokeFX(wreck.x,2.2,wreck.z,1.6,3.5);
  }});
  if(world.wrecks.length>10){
    const old=world.wrecks.shift();
    scene.remove(old.mesh);
    for(let i=world.colliders.length-1;i>=0;i--){
      const c=world.colliders[i];
      if(c.r===2.5&&Math.abs(c.x-old.x)<0.1&&Math.abs(c.z-old.z)<0.1){world.colliders.splice(i,1);break;}
    }
  }
}
const _wreckMats={};
function wreckMaterial(orig){
  const key=orig.color?orig.color.getHexString():'x';
  if(!_wreckMats[key]){
    _wreckMats[key]=new THREE.MeshStandardMaterial({color:new THREE.Color(key).multiplyScalar(0.25),roughness:1});
  }
  return _wreckMats[key];
}

function makeSprite(color,blend,scale){
  const mat=new THREE.SpriteMaterial({map:TEX_CIRCLE,color:color,transparent:true,depthWrite:false,
    blending:blend==='add'?THREE.AdditiveBlending:THREE.NormalBlending});
  const s=new THREE.Sprite(mat);
  s.scale.set(scale,scale,1);
  return s;
}
function addFx(sprite,opt){
  opt=opt||{};
  scene.add(sprite);
  effects.push({s:sprite,vel:opt.vel||new THREE.Vector3(),life:opt.life||1,maxLife:opt.life||1,grow:opt.grow||0,grav:opt.grav||0,drag:opt.drag===undefined?1:opt.drag,startScale:opt.scale||1});
}
function updateEffects(dt){
  for(let i=effects.length-1;i>=0;i--){
    const e=effects[i];
    e.life-=dt;
    if(e.life<=0){scene.remove(e.s);e.s.material.dispose();effects.splice(i,1);continue;}
    e.vel.multiplyScalar(Math.pow(e.drag,dt*60));
    e.vel.y+=e.grav*dt;
    e.s.position.addScaledVector(e.vel,dt);
    const k=e.life/e.maxLife;
    e.s.material.opacity=k;
    const sc=e.startScale+(1-k)*e.grow;
    e.s.scale.set(sc,sc,1);
  }
  for(let i=fxLights.length-1;i>=0;i--){
    const l=fxLights[i];
    l.life-=dt;
    if(l.life<=0){scene.remove(l.light);fxLights.splice(i,1);continue;}
    l.light.intensity=l.maxI*(l.life/l.maxLife);
  }
}
function spawnLight(x,y,z,color,intensity,dist,life){
  const li=new THREE.PointLight(color,intensity,dist,2);
  li.position.set(x,y,z);
  scene.add(li);
  fxLights.push({light:li,life:life,maxLife:life,maxI:intensity});
}
function spawnMuzzleFX(pos,dir,gunLen){
  for(let i=0;i<3;i++){
    const s=makeSprite(i===0?0xffdf8a:0xff9430,'add',rand(1.2,2.4));
    s.position.copy(pos).addScaledVector(dir,gunLen*0.2+i*0.4);
    addFx(s,{vel:new THREE.Vector3(rand(-1,1),rand(0,2),rand(-1,1)),life:rand(0.08,0.16),grow:4,scale:2});
  }
  spawnLight(pos.x,pos.y,pos.z,0xffbb55,3,22,0.09);
}
function sparkFX(x,y,z,color,n){
  for(let i=0;i<n;i++){
    const s=makeSprite(color,'add',rand(0.3,0.9));
    s.position.set(x,y,z);
    addFx(s,{vel:new THREE.Vector3(rand(-6,6),rand(2,8),rand(-6,6)),life:rand(0.15,0.4),grav:-14,drag:0.94,scale:0.6});
  }
  spawnLight(x,y,z,color,1.6,12,0.12);
}
function ricoFX(x,y,z){
  sparkFX(x,y,z,0xdfe8ff,5);
  const s=makeSprite(0xffffff,'add',0.5);
  s.position.set(x,y,z);
  addFx(s,{vel:new THREE.Vector3(rand(-4,4),rand(4,9),rand(-4,4)),life:0.3,grav:-10,scale:0.5});
}
function dirtFX(x,y,z){
  for(let i=0;i<6;i++){
    const s=makeSprite(0x9a8563,'normal',rand(0.5,1.3));
    s.material.opacity=0.8;
    s.position.set(x,y,z);
    addFx(s,{vel:new THREE.Vector3(rand(-3,3),rand(2,5),rand(-3,3)),life:rand(0.3,0.6),grav:-6,drag:0.93,scale:1,grow:1.5});
  }
}
function woodFX(x,y,z){
  for(let i=0;i<7;i++){
    const s=makeSprite(0x9c7a44,'normal',rand(0.3,0.8));
    s.material.opacity=0.95;
    s.position.set(x,y,z);
    addFx(s,{vel:new THREE.Vector3(rand(-4,4),rand(2,6),rand(-4,4)),life:rand(0.3,0.6),grav:-12,drag:0.95,scale:0.6});
  }
}
function smokeFX(x,y,z,size,life){
  const shades=[0x3a3a38,0x55554f,0x2c2c2a];
  for(let i=0;i<5;i++){
    const s=makeSprite(pick(shades),'normal',size*rand(0.7,1.3));
    s.material.opacity=0.55;
    s.position.set(x+rand(-0.6,0.6),y,z+rand(-0.6,0.6));
    addFx(s,{vel:new THREE.Vector3(rand(-0.5,0.5),rand(1.2,2.2),rand(-0.5,0.5)),life:life*rand(0.7,1.2),drag:0.99,scale:size,grow:size*1.6});
  }
}
function explosionFX(x,y,z,size){
  spawnLight(x,y+1.5,z,0xffa040,5,40*size,0.3);
  for(let i=0;i<10;i++){
    const s=makeSprite(pick([0xffd070,0xff9030,0xff5522]),'add',rand(1.5,3)*size);
    s.position.set(x+rand(-0.8,0.8),y+rand(0,1.2),z+rand(-0.8,0.8));
    addFx(s,{vel:new THREE.Vector3(rand(-5,5),rand(2,9),rand(-5,5)).multiplyScalar(size*0.6),life:rand(0.25,0.55),drag:0.92,scale:2*size,grow:5*size});
  }
  for(let i=0;i<8;i++){
    const s=makeSprite(pick([0x2e2c28,0x4a473f,0x1f1e1b]),'normal',rand(1.5,2.6)*size);
    s.material.opacity=0.6;
    s.position.set(x+rand(-1,1),y+rand(0.5,2),z+rand(-1,1));
    addFx(s,{vel:new THREE.Vector3(rand(-1.5,1.5),rand(2,4),rand(-1.5,1.5)),life:rand(0.8,1.6),drag:0.985,scale:2*size,grow:6*size});
  }
  for(let i=0;i<6;i++){
    const s=makeSprite(0xffb040,'add',0.35);
    s.position.set(x,y+1,z);
    addFx(s,{vel:new THREE.Vector3(rand(-9,9),rand(5,14),rand(-9,9)),life:rand(0.4,0.8),grav:-18,drag:0.96,scale:0.4});
  }
}

function floatText(worldPos,text,color,big){
  const el=document.createElement('div');
  el.className='ft'+(big?' big':'');
  el.textContent=text;
  el.style.color=color;
  document.getElementById('floats').appendChild(el);
  floats.push({el:el,pos:worldPos.clone?worldPos.clone():new THREE.Vector3(worldPos.x,worldPos.y,worldPos.z),age:0,max:1.15});
}
function updateFloats(dt){
  for(let i=floats.length-1;i>=0;i--){
    const f=floats[i];
    f.age+=dt;
    if(f.age>f.max){f.el.remove();floats.splice(i,1);continue;}
    V1.copy(f.pos);V1.y+=(f.age/f.max)*2.2;
    V1.project(camera);
    if(V1.z>1){f.el.style.display='none';continue;}
    f.el.style.display='';
    f.el.style.left=((V1.x*0.5+0.5)*innerWidth)+'px';
    f.el.style.top=((-V1.y*0.5+0.5)*innerHeight)+'px';
    f.el.style.opacity=String(1-f.age/f.max);
  }
}

function propTree(x,z,snow){
  const g=new THREE.Group();
  const trunkH=rand(3,4.6);
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.42,trunkH,7),new THREE.MeshStandardMaterial({color:0x5a4630,roughness:1}));
  trunk.position.y=trunkH/2;trunk.castShadow=true;g.add(trunk);
  const leafCol=snow?0x2e4a35:pick([0x39572c,0x416230,0x345028]);
  for(let i=0;i<3;i++){
    const r=2.1-i*0.55,h=2.4-i*0.3;
    const cone=new THREE.Mesh(new THREE.ConeGeometry(r,h,8),new THREE.MeshStandardMaterial({color:leafCol,roughness:1}));
    cone.position.y=trunkH*0.55+i*1.5;
    cone.castShadow=true;g.add(cone);
  }
  if(snow){
    const tip=new THREE.Mesh(new THREE.ConeGeometry(0.8,1.2,8),new THREE.MeshStandardMaterial({color:0xeef3f6,roughness:1}));
    tip.position.y=trunkH*0.55+2*1.5+1.2;tip.castShadow=true;g.add(tip);
  }
  g.position.set(x,0,z);
  g.rotation.y=rand(0,6.28);
  return{mesh:g,r:1.1};
}
function propDeadTree(x,z){
  const g=new THREE.Group();
  const h=rand(3.5,5);
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.36,h,6),new THREE.MeshStandardMaterial({color:0x6b5a44,roughness:1}));
  trunk.position.y=h/2;trunk.castShadow=true;g.add(trunk);
  for(let i=0;i<3;i++){
    const br=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.13,rand(1.2,2),5),trunk.material);
    br.position.set(rand(-0.5,0.5),h*rand(0.5,0.9),rand(-0.5,0.5));
    br.rotation.z=rand(0.5,1.2)*(Math.random()<0.5?1:-1);
    br.rotation.x=rand(-0.4,0.4);
    g.add(br);
  }
  g.position.set(x,0,z);g.rotation.y=rand(0,6.28);
  return{mesh:g,r:0.9};
}
function propRock(x,z){
  const size=rand(0.9,2.3);
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(size,0),new THREE.MeshStandardMaterial({color:world.mapDef.mountain,roughness:1}));
  m.position.set(x,size*0.55,z);
  m.scale.y=rand(0.55,0.8);
  m.rotation.set(rand(0,3),rand(0,3),rand(0,3));
  m.castShadow=true;m.receiveShadow=true;
  return{mesh:m,r:size*1.05};
}
function propRuins(x,z){
  const g=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:0xa39374,roughness:1});
  const w=rand(5,8),h=rand(2.4,4);
  const wall=new THREE.Mesh(new THREE.BoxGeometry(w,h,0.9),mat);
  wall.position.y=h/2;wall.castShadow=true;wall.receiveShadow=true;g.add(wall);
  const wall2=new THREE.Mesh(new THREE.BoxGeometry(w*0.55,h*0.7,0.9),mat);
  wall2.position.set(w*0.2,h*0.35,1.6);wall2.rotation.y=rand(-0.6,0.6);wall2.castShadow=true;g.add(wall2);
  const rub=new THREE.Mesh(new THREE.BoxGeometry(w*0.5,0.8,1.6),mat);
  rub.position.set(-w*0.3,0.4,1.2);rub.rotation.y=rand(0,1);g.add(rub);
  g.position.set(x,0,z);g.rotation.y=rand(0,6.28);
  return{mesh:g,r:w*0.55};
}
function propBuilding(x,z){
  const w=rand(8,16),d=rand(8,14),h=rand(6,14);
  const shade=pick([0x8d8578,0x7d7a72,0x97887b]);
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:shade,roughness:1}));
  m.position.set(x,h/2,z);
  m.castShadow=true;m.receiveShadow=true;
  const roof=new THREE.Mesh(new THREE.BoxGeometry(w+0.6,0.5,d+0.6),new THREE.MeshStandardMaterial({color:0x54514a,roughness:1}));
  roof.position.set(x,h+0.25,z);
  return{mesh:[m,roof],r:Math.max(w,d)*0.62};
}
function propRubble(x,z){
  const g=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:0x7e7a70,roughness:1});
  for(let i=0;i<5;i++){
    const s=rand(0.5,1.4);
    const m=new THREE.Mesh(new THREE.BoxGeometry(s,s*0.7,s*rand(0.7,1.4)),mat);
    m.position.set(rand(-1.6,1.6),s*0.3,rand(-1.6,1.6));
    m.rotation.y=rand(0,3);
    m.castShadow=true;g.add(m);
  }
  g.position.set(x,0,z);
  return{mesh:g,r:1.9};
}
function propCrate(x,z){
  const m=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.4,1.5),new THREE.MeshStandardMaterial({color:0x8a6b3e,roughness:1}));
  m.position.set(x,0.7,z);m.rotation.y=rand(0,3);m.castShadow=true;
  return{mesh:m,r:1.0,kind:'crate',hp:1};
}
function propBarrel(x,z){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.62,1.5,10),new THREE.MeshStandardMaterial({color:0x9e2f22,roughness:.8}));
  m.position.set(x,0.75,z);m.castShadow=true;
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(0.66,0.66,0.16,10),new THREE.MeshStandardMaterial({color:0x5c1a12}));
  ring.position.y=0.3;m.add(ring);
  return{mesh:m,r:0.85,kind:'barrel',hp:1};
}
function propCactus(x,z){
  const g=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:0x4f7a3a,roughness:1});
  const h=rand(2,3.2);
  const t=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.34,h,8),mat);
  t.position.y=h/2;t.castShadow=true;g.add(t);
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.2,1.2,8),mat);
  arm.position.set(0.55,h*0.6,0);arm.rotation.z=-1;arm.castShadow=true;g.add(arm);
  g.position.set(x,0,z);g.rotation.y=rand(0,6.28);
  return{mesh:g,r:0.7};
}

function placeFree(r,minCenterDist){
  for(let tries=0;tries<40;tries++){
    const x=rand(-HALF+12,HALF-12),z=rand(-HALF+12,HALF-12);
    if(Math.hypot(x,z)<minCenterDist)continue;
    let ok=true;
    for(const c of world.colliders){
      if(Math.hypot(x-c.x,z-c.z)<c.r+r+2){ok=false;break;}
    }
    if(ok)return{x:x,z:z};
  }
  return null;
}
function addSolid(prop,x,z,r,blocks){
  scene.add(prop.mesh||prop);
  if(prop.mesh&&prop.mesh.length){for(const mm of prop.mesh)scene.add(mm);}
  world.colliders.push({x:x,z:z,r:r,noBlock:!blocks});
}
function buildWorld(md){
  world={mapDef:md,colliders:[],destructibles:[],wrecks:[]};
  scene=new THREE.Scene();
  scene.background=new THREE.Color(md.sky);
  scene.fog=new THREE.Fog(md.sky,md.fogN,md.fogF);

  const hemi=new THREE.HemisphereLight(md.hemiSky,md.hemiGnd,0.85);
  scene.add(hemi);
  sunLight=new THREE.DirectionalLight(md.sun,1.15);
  sunLight.position.set(70,95,40);
  sunLight.castShadow=true;
  sunLight.shadow.mapSize.width=2048;
  sunLight.shadow.mapSize.height=2048;
  sunLight.shadow.camera.near=10;
  sunLight.shadow.camera.far=320;
  sunLight.shadow.camera.left=-90;
  sunLight.shadow.camera.right=90;
  sunLight.shadow.camera.top=90;
  sunLight.shadow.camera.bottom=-90;
  sunLight.shadow.bias=-0.0006;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const ground=new THREE.Mesh(new THREE.PlaneGeometry(640,640),new THREE.MeshStandardMaterial({color:md.ground,roughness:1}));
  ground.rotation.x=-Math.PI/2;
  ground.receiveShadow=true;
  scene.add(ground);
  for(let i=0;i<36;i++){
    const px=rand(-280,280),pz=rand(-280,280);
    const patch=new THREE.Mesh(new THREE.CircleGeometry(rand(4,14),16),new THREE.MeshStandardMaterial({color:md.patch,roughness:1,transparent:true,opacity:0.5}));
    patch.rotation.x=-Math.PI/2;
    patch.position.set(px,0.02+i*0.0004,pz);
    patch.receiveShadow=true;
    scene.add(patch);
  }
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2+rand(-0.2,0.2);
    const R=rand(255,300);
    const h=rand(26,60),r=rand(34,64);
    const mt=new THREE.Mesh(new THREE.ConeGeometry(r,h,7),new THREE.MeshStandardMaterial({color:md.mountain,roughness:1}));
    mt.position.set(Math.sin(a)*R,h/2-rand(2,8),Math.cos(a)*R);
    mt.rotation.y=rand(0,3);
    scene.add(mt);
  }

  const P=md.props;
  const put=function(gen,count,r,blocks,destructible,minCD){
    minCD=minCD||20;
    for(let i=0;i<count;i++){
      const spot=placeFree(r,minCD);
      if(!spot)continue;
      const pr=gen(spot.x,spot.z);
      if(destructible){
        scene.add(pr.mesh);
        const col={x:spot.x,z:spot.z,r:pr.r,noBlock:true};
        world.colliders.push(col);
        world.destructibles.push({x:spot.x,z:spot.z,r:pr.r,kind:pr.kind,mesh:pr.mesh,collider:col,hp:1});
      }else{
        addSolid(pr,spot.x,spot.z,pr.r,blocks);
      }
    }
  };
  if(P.rocks)put(propRock,P.rocks,2.4,false,false,16);
  if(P.pines)put(function(x,z){return propTree(x,z,md.id==='schnee');},P.pines,1.2,false,false,14);
  if(P.deadTrees)put(propDeadTree,P.deadTrees,1,false,false,14);
  if(P.ruins)put(propRuins,P.ruins,4.5,true,false,22);
  if(P.cacti)put(propCactus,P.cacti,0.8,false,false,14);
  if(P.buildings)put(propBuilding,P.buildings,9,true,false,26);
  if(P.rubble)put(propRubble,P.rubble,2,false,false,16);
  if(P.crates)put(propCrate,P.crates,1,true,true,12);
  if(P.barrels)put(propBarrel,P.barrels,0.9,true,true,12);
}

function updateSun(){
  if(!player||!sunLight)return;
  sunLight.position.set(player.pos.x+70,95,player.pos.z+40);
  sunLight.target.position.set(player.pos.x,0,player.pos.z);
}

function spawnWave(n){
  const total=Math.min(2+Math.ceil(n*1.25),14);
  const pool=n<=1?[0,0,0,2]:n===2?[0,0,1,2]:n===3?[0,1,1,2,3]:n===4?[1,1,2,2,3]:[1,1,2,3,3,4];
  pendingSpawns=[];
  for(let i=0;i<total;i++){
    pendingSpawns.push({type:pick(pool),delay:i*rand(0.8,1.6)});
  }
  spawnClock=0;
  showBanner('WELLE '+n,total+' FEINDLICHE PANZER');
  addFeed('Welle '+n+' beginnt – '+total+' Gegner');
}
function spawnEnemy(typeIdx){
  const def=TANK_DEFS[typeIdx];
  let spot=null;
  for(let t=0;t<50&&!spot;t++){
    const a=rand(0,Math.PI*2);
    const R=rand(HALF*0.75,HALF*0.95);
    const x=clamp(Math.sin(a)*R,-HALF+10,HALF-10);
    const z=clamp(Math.cos(a)*R,-HALF+10,HALF-10);
    if(player&&Math.hypot(x-player.pos.x,z-player.pos.z)<70)continue;
    let ok=true;
    for(const c of world.colliders){if(Math.hypot(x-c.x,z-c.z)<c.r+3){ok=false;break;}}
    if(ok)spot={x:x,z:z};
  }
  if(!spot)spot={x:0,z:-120};
  const hpMul=1+(wave-1)*0.08;
  const dmgMul=Math.min(1+(wave-1)*0.055,1.7);
  const relMul=Math.max(1-(wave-1)*0.028,0.72);
  const acc=Math.max(0.028,0.075-wave*0.005);
  const e=new Tank(def,1,spot.x,spot.z,{hpMul:hpMul,dmgMul:dmgMul,reloadMul:relMul,acc:acc,speedMul:0.85,startLoaded:true});
  e.defIndex=typeIdx;
  enemies.push(e);
  updateTopUI();
}
function updateWaveLogic(dt){
  if(waveState==='fighting'){
    spawnClock+=dt;
    for(let i=pendingSpawns.length-1;i>=0;i--){
      const ps=pendingSpawns[i];
      ps.delay-=dt;
      if(ps.delay<=0&&enemies.length<8){
        pendingSpawns.splice(i,1);
        spawnEnemy(ps.type);
      }
    }
    if(pendingSpawns.length===0&&enemies.length===0){
      waveState='intermission';
      waveTimer=5;
      const bonus=250+wave*50;
      score+=bonus;
      player.heal(player.maxHp*0.15);
      showBanner('WELLE '+wave+' ÜBERSTANDEN','+'+bonus+' PUNKTE · NÄCHSTE WELLE IN 5s');
      updateTopUI();
    }
  }else if(waveState==='intermission'){
    waveTimer-=dt;
    if(waveTimer<=0){
      wave++;
      waveState='fighting';
      spawnWave(wave);
      updateTopUI();
    }
  }
}

function updateCamera(dt){
  shakeAmt=Math.max(0,shakeAmt-dt*1.8);
  const cp=Math.cos(camPitch);
  V1.set(Math.sin(camYaw)*cp,Math.sin(camPitch),Math.cos(camYaw)*cp);
  const pivotY=player.dead?1.2:2.5;
  V2.copy(player.pos);V2.y+=pivotY;
  camera.position.copy(V2).addScaledVector(V1,-camDist);
  if(camera.position.y<0.6)camera.position.y=0.6;
  if(shakeAmt>0){
    camera.position.x+=rand(-1,1)*shakeAmt*0.35;
    camera.position.y+=rand(-1,1)*shakeAmt*0.35;
    camera.position.z+=rand(-1,1)*shakeAmt*0.35;
  }
  camera.lookAt(V2.x+V1.x*20,V2.y+V1.y*20,V2.z+V1.z*20);
  const rd=camDir();
  let t=140;
  if(rd.y<-0.02)t=clamp((1.35-camera.position.y)/rd.y,8,200);
  lastAim.copy(camera.position).addScaledVector(rd,t);
}
function camDir(out){
  out=out||V3;
  const cp=Math.cos(camPitch);
  out.set(Math.sin(camYaw)*cp,Math.sin(camPitch),Math.cos(camYaw)*cp);
  return out;
}

function updatePlayerInput(dt){
  if(player.dead)return;
  let th=0,st=0;
  if(keys['KeyW'])th+=1;
  if(keys['KeyS'])th-=1;
  if(keys['KeyA'])st-=1;
  if(keys['KeyD'])st+=1;
  player.brake=!!keys['Space'];
  player.throttle=th;
  player.steer=st;
  player.aimAt(lastAim,dt);
}

function updateHUD(){
  const rl=player.reloadTimer;
  const rt=player.def.reload*player.reloadMul;
  const pct=rl<=0?1:clamp(1-rl/rt,0,1);
  const deg=Math.round(pct*360);
  document.getElementById('reloadRing').style.background=
    'conic-gradient(rgba(217,201,138,.9) '+deg+'deg, rgba(255,255,255,.12) '+deg+'deg)';
  document.getElementById('reloadTxt').textContent=rl<=0?(player.ammo[player.shell]>0?'BEREIT':'KEINE MUNITION'):('LADE NACH… '+rl.toFixed(1)+'s');
  updateAmmoUI();
}
function updateAmmoUI(){
  const ap=document.getElementById('shellAP'),he=document.getElementById('shellHE');
  ap.classList.toggle('active',player.shell==='AP');
  he.classList.toggle('active',player.shell==='HE');
  document.getElementById('cntAP').textContent=player.ammo.AP;
  document.getElementById('cntHE').textContent=player.ammo.HE;
}
function updateHpUI(){
  const pct=clamp(player.hp/player.maxHp,0,1);
  const f=document.getElementById('hpFill');
  f.style.width=(pct*100)+'%';
  f.style.background=pct>0.5?'linear-gradient(90deg,#7fae3f,#a8cf60)':(pct>0.25?'linear-gradient(90deg,#c9a227,#e0c25a)':'linear-gradient(90deg,#b3402e,#d9664a)');
  document.getElementById('hpText').textContent=Math.max(0,Math.round(player.hp))+' / '+player.maxHp;
}
function updateTopUI(){
  document.getElementById('waveVal').textContent=wave;
  document.getElementById('enemyVal').textContent=enemies.length+pendingSpawns.length;
  document.getElementById('killVal').textContent=kills;
  document.getElementById('scoreVal').textContent=score;
}
function showHintFlash(){
  const h=document.getElementById('hint');
  h.textContent='KEINE MUNITION MEHR!';
  h.style.color='#ff8866';
  setTimeout(function(){h.textContent='WASD FAHREN · MAUS ZIELEN · LINKSKLICK FEUER · 1/2 MUNITION · ESC PAUSE';h.style.color='';},1500);
}
function showBanner(text,sub){
  const bt=document.getElementById('bannerText'),bs=document.getElementById('bannerSub');
  bt.textContent=text;bs.textContent=sub||'';
  bt.style.opacity='1';bs.style.opacity='1';
  clearTimeout(bannerTO1);clearTimeout(bannerTO2);
  bannerTO1=setTimeout(function(){bt.style.opacity='0';},2600);
  bannerTO2=setTimeout(function(){bs.style.opacity='0';},2600);
}
function addFeed(text){
  const kf=document.getElementById('killfeed');
  const d=document.createElement('div');
  d.textContent=text;
  kf.appendChild(d);
  while(kf.children.length>5)kf.removeChild(kf.firstChild);
  setTimeout(function(){d.style.opacity='0';},3800);
  setTimeout(function(){if(d.parentNode)d.remove();},4500);
}
function flashVignette(){
  const v=document.getElementById('vignette');
  v.style.transition='none';
  v.style.opacity='0.85';
  clearTimeout(vigTO);
  vigTO=setTimeout(function(){v.style.transition='opacity .6s';v.style.opacity='0';},60);
}
function showHitmarker(kill){
  const hm=document.getElementById('hitmarker');
  hm.classList.toggle('kill',!!kill);
  hm.style.opacity='1';
  clearTimeout(hmTO);
  hmTO=setTimeout(function(){hm.style.opacity='0';},kill?260:130);
}

function drawMinimap(){
  const c=mmCtx;if(!c)return;
  const S=170,scale=S/(HALF*2+20);
  c.clearRect(0,0,S,S);
  c.fillStyle='#11150d';
  c.fillRect(0,0,S,S);
  c.strokeStyle='rgba(217,201,138,.25)';
  c.strokeRect(0.5,0.5,S-1,S-1);
  const tx=function(x){return (x+HALF+10)*scale;};
  const tz=function(z){return S-(z+HALF+10)*scale;};
  c.fillStyle='#39422f';
  for(const col of world.colliders){
    c.fillRect(tx(col.x)-1.5,tz(col.z)-1.5,col.r*scale*2+2,col.r*scale*2+2);
  }
  c.fillStyle='#c9a227';
  for(const p of world.destructibles){
    if(p.kind==='barrel'){c.fillRect(tx(p.x)-1.5,tz(p.z)-1.5,3,3);}
  }
  c.fillStyle='#555';
  for(const wr of world.wrecks){
    c.fillRect(tx(wr.x)-2.5,tz(wr.z)-2.5,5,5);
  }
  for(const e of enemies){
    if(e.dead)continue;
    c.fillStyle='#e04030';
    const pulse=2.4+Math.sin(elapsed*6)*0.7;
    c.beginPath();c.arc(tx(e.pos.x),tz(e.pos.z),pulse,0,6.29);c.fill();
  }
  if(player&&!player.dead){
    c.save();
    c.translate(tx(player.pos.x),tz(player.pos.z));
    c.rotate(-player.yaw);
    c.fillStyle='#8fce4a';
    c.beginPath();
    c.moveTo(0,-5.5);c.lineTo(4,4.5);c.lineTo(0,2.4);c.lineTo(-4,4.5);
    c.closePath();c.fill();
    c.restore();
  }
}

function startBattle(){
  initAudio();
  if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume();
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('pause').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('killfeed').innerHTML='';
  document.getElementById('floats').innerHTML='';
  bullets=[];effects=[];fxLights=[];delayed=[];floats=[];enemies=[];pendingSpawns=[];
  score=0;kills=0;shotsFired=0;shotsHit=0;dmgTakenTime=-99;
  wave=0;waveState='intermission';waveTimer=1.5;
  camYaw=0;camPitch=0.24;camDist=12;shakeAmt=0;
  buildWorld(MAP_DEFS[selMap]);
  const def=TANK_DEFS[selTank];
  player=new Tank(def,0,0,0,{startLoaded:true});
  player.yaw=0;
  gameState='playing';
  updateHpUI();updateTopUI();updateAmmoUI();
  startEngine();
  renderer.domElement.requestPointerLock();
  showBanner('GEFECHT BEGINNT','Verteidige dich gegen einlaufende Wellen');
}

function playerDestroyed(){
  gameState='dying';
  stopEngineFade();
  if(document.pointerLockElement)document.exitPointerLock();
  if(wave>best){best=wave;try{localStorage.setItem('pg_best',String(best));}catch(e){}}
  setTimeout(function(){
    gameState='gameover';
    const acc=shotsFired>0?Math.round(shotsHit/shotsFired*100):0;
    document.getElementById('goStats').innerHTML=
      'Überlebte Wellen:<span>'+wave+'</span><br>'+
      'Abschüsse:<span>'+kills+'</span><br>'+
      'Punkte:<span>'+score+'</span><br>'+
      'Trefferquote:<span>'+acc+'%</span><br>'+
      'Rekord (Wellen):<span>'+best+'</span>';
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('gameover').classList.remove('hidden');
  },1900);
}
function stopEngineFade(){
  if(engineGain){try{engineGain.gain.value=0;}catch(e){}}
}
function backToMenu(){
  gameState='menu';
  stopEngine();
  if(document.pointerLockElement)document.exitPointerLock();
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('pause').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
  rebuildMenuShowcase();
}

function openPause(){
  if(gameState!=='playing')return;
  gameState='paused';
  document.getElementById('pause').classList.remove('hidden');
  if(document.pointerLockElement)document.exitPointerLock();
  if(engineGain)engineGain.gain.value=0;
}
function resumeGame(){
  if(gameState!=='paused')return;
  gameState='playing';
  document.getElementById('pause').classList.add('hidden');
  renderer.domElement.requestPointerLock();
}

function buildMenuCards(){
  const tc=document.getElementById('tankCards');
  tc.innerHTML='';
  TANK_DEFS.forEach(function(d,i){
    const c=document.createElement('div');
    c.className='card'+(i===selTank?' sel':'');
    c.innerHTML='<div class="cname">'+d.name+'</div><div class="cnation">'+d.nation.toUpperCase()+'</div><div class="crole">'+d.role+'</div>'+
      '<div class="statrow"><span>TEMPO</span><div class="sbar"><i style="width:'+Math.round(d.speedBar*100)+'%"></i></div></div>'+
      '<div class="statrow"><span>PANZERUNG</span><div class="sbar"><i style="width:'+Math.round(d.armorBar*100)+'%"></i></div></div>'+
      '<div class="statrow"><span>FP</span><div class="sbar"><i style="width:'+Math.round(d.fpBar*100)+'%"></i></div></div>';
    c.onclick=function(){selTank=i;buildMenuCards();rebuildMenuShowcase();sndSwitch();initAudio();};
    tc.appendChild(c);
  });
  const mc=document.getElementById('mapCards');
  mc.innerHTML='';
  MAP_DEFS.forEach(function(m,i){
    const c=document.createElement('div');
    c.className='card'+(i===selMap?' sel':'');
    c.innerHTML='<div class="cname">'+m.name+'</div><div class="crole">'+m.desc+'</div>';
    c.onclick=function(){selMap=i;buildMenuCards();initAudio();sndSwitch();};
    mc.appendChild(c);
  });
}
function buildMenuScene(){
  menuScene=new THREE.Scene();
  menuScene.background=new THREE.Color(0x14170f);
  menuScene.fog=new THREE.Fog(0x14170f,18,60);
  menuScene.add(new THREE.HemisphereLight(0xfff4dc,0x3a3d2e,0.9));
  const dl=new THREE.DirectionalLight(0xffe9c4,1.3);
  dl.position.set(6,9,4);
  dl.castShadow=true;
  dl.shadow.mapSize.set(1024,1024);
  dl.shadow.camera.left=-8;dl.shadow.camera.right=8;dl.shadow.camera.top=8;dl.shadow.camera.bottom=-8;
  menuScene.add(dl);
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(6,6.6,0.5,40),new THREE.MeshStandardMaterial({color:0x2c3122,roughness:.9}));
  disc.position.y=-0.25;disc.receiveShadow=true;
  menuScene.add(disc);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:0x191d12,roughness:1}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-0.5;
  menuScene.add(floor);
  menuCam=new THREE.PerspectiveCamera(46,innerWidth/innerHeight,0.1,200);
  menuCam.position.set(7.5,3.6,8.5);
  menuCam.lookAt(0,1.6,0);
  rebuildMenuShowcase();
}
function rebuildMenuShowcase(){
  if(menuTank){menuScene.remove(menuTank);}
  const def=TANK_DEFS[selTank];
  menuTank=buildTankMesh(def,true).group;
  menuScene.add(menuTank);
}

function onResize(){
  if(renderer){
    renderer.setSize(innerWidth,innerHeight);
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    if(menuCam){menuCam.aspect=innerWidth/innerHeight;menuCam.updateProjectionMatrix();}
  }
}

function bindInput(){
  window.addEventListener('resize',onResize);
  document.addEventListener('pointerlockchange',function(){
    mouseLocked=document.pointerLockElement===renderer.domElement;
    if(!mouseLocked&&gameState==='playing')openPause();
  });
  document.addEventListener('mousemove',function(e){
    if(!mouseLocked||gameState!=='playing')return;
    camYaw=normAng(camYaw-e.movementX*0.0021);
    camPitch=clamp(camPitch-e.movementY*0.0016,-0.32,0.55);
  });
  document.addEventListener('mousedown',function(e){
    if(gameState==='playing'&&mouseLocked){
      if(e.button===0)player.tryFire(lastAim);
    }else if(gameState==='playing'&&!mouseLocked){
      renderer.domElement.requestPointerLock();
    }
  });
  document.addEventListener('wheel',function(e){
    if(gameState==='playing'){
      camDist=clamp(camDist+Math.sign(e.deltaY)*1.4,6,22);
    }
  },{passive:true});
  window.addEventListener('contextmenu',function(e){e.preventDefault();});
  window.addEventListener('keydown',function(e){
    keys[e.code]=true;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&gameState==='playing')e.preventDefault();
    if(gameState==='playing'){
      if(e.code==='Digit1'&&player.shell!=='AP')player.switchShell('AP');
      if(e.code==='Digit2'&&player.shell!=='HE')player.switchShell('HE');
      if(e.code==='Escape'){}
    }
    if(e.code==='Escape'){
      if(gameState==='playing')openPause();
      else if(gameState==='paused')resumeGame();
    }
  });
  window.addEventListener('keyup',function(e){keys[e.code]=false;});
  document.getElementById('startBtn').onclick=startBattle;
  document.getElementById('goAgain').onclick=startBattle;
  document.getElementById('goMenu').onclick=backToMenu;
  document.getElementById('pauseResume').onclick=resumeGame;
  document.getElementById('pauseMenu').onclick=backToMenu;
}

let hudTick=0;
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),0.05);
  if(gameState==='menu'){
    menuSpin+=dt*0.45;
    if(menuTank)menuTank.rotation.y=menuSpin;
    renderer.render(menuScene,menuCam);
    return;
  }
  if(gameState==='paused'){renderer.render(scene,camera);return;}
  elapsed+=dt;
  if(gameState==='playing'){
    updatePlayerInput(dt);
    player.move(dt);
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i];
      if(e.dead){enemies.splice(i,1);updateTopUI();continue;}
      e.updateAI(dt);
      e.move(dt);
      if(e.hpBar)e.hpBar.sprite.position.set(e.pos.x,e.pos.y+4.6,e.pos.z);
    }
    updateBullets(dt);
    updateWaveLogic(dt);
    updateCamera(dt);
    updateSun();
    if(engineGain){
      const sp=Math.abs(player.vel)/player.def.speed;
      engineOsc.frequency.value=52+sp*70;
      engineOsc2.frequency.value=54+sp*73;
      engineFilter.frequency.value=300+sp*420;
      engineGain.gain.value=0.05+sp*0.045;
    }
    updateHUD();
    drawMinimap();
  }
  for(let i=delayed.length-1;i>=0;i--){
    const d=delayed[i];
    d.t-=dt;
    if(d.t<=0){delayed.splice(i,1);try{d.fn();}catch(err){}}
  }
  updateEffects(dt);
  updateFloats(dt);
  renderer.render(scene,camera);
}

function main(){
  TEX_CIRCLE=circleTexture();
  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputEncoding=THREE.sRGBEncoding;
  document.getElementById('app').appendChild(renderer.domElement);
  camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.1,600);
  mmCtx=document.getElementById('minimap').getContext('2d');
  buildMenuScene();
  buildMenuCards();
  bindInput();
  animate();
}
main();
