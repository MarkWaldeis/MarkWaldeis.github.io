// Prozedurale Soundeffekte per WebAudio - keine Audiodateien nötig.
const KEY='fabwerk_audio';
let ac=null, master=null;
let muted=false;
try{ muted=localStorage.getItem(KEY)==='off'; }catch(e){}

function ensure(){
  if(ac) return true;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return false;
    ac=new AC();
    master=ac.createGain();
    master.gain.value=muted?0:0.55;
    master.connect(ac.destination);
  }catch(e){ return false; }
  return true;
}

// Bei erster Nutzer-Interaktion aufrufen (Autoplay-Policy)
export function unlock(){
  if(!ensure()) return;
  if(ac.state==='suspended') ac.resume();
}

export function setMuted(m){
  muted=!!m;
  try{ localStorage.setItem(KEY,muted?'off':'on'); }catch(e){}
  if(master) master.gain.setTargetAtTime(muted?0:0.55,ac.currentTime,0.02);
}
export function isMuted(){ return muted; }
export function toggleMuted(){ setMuted(!muted); return !muted; }

function env(t0,a,d,peak){
  const g=ac.createGain();
  g.gain.setValueAtTime(0.0001,t0);
  g.gain.linearRampToValueAtTime(peak,t0+a);
  g.gain.exponentialRampToValueAtTime(0.0001,t0+a+d);
  g.connect(master);
  return g;
}

function tone(freq,dur,type='sine',vol=0.2,delay=0,slideTo=null){
  const t0=ac.currentTime+delay;
  const o=ac.createOscillator();
  o.type=type;
  o.frequency.setValueAtTime(freq,t0);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1,slideTo),t0+dur);
  o.connect(env(t0,0.006,dur,vol));
  o.start(t0); o.stop(t0+dur+0.05);
}

function noise(dur,freq=1200,vol=0.15,delay=0,q=1){
  const t0=ac.currentTime+delay;
  const n=Math.max(1,Math.floor(ac.sampleRate*dur));
  const buf=ac.createBuffer(1,n,ac.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
  const src=ac.createBufferSource(); src.buffer=buf;
  const f=ac.createBiquadFilter(); f.type='bandpass'; f.frequency.value=freq; f.Q.value=q;
  src.connect(f); f.connect(env(t0,0.004,dur,vol));
  src.start(t0);
}

function seq(notes,type='triangle',vol=0.18,gap=0.09,dur=0.12){
  notes.forEach((f,i)=>tone(f,dur,type,vol,i*gap));
}

let lastCoin=0, lastRp=0;

export function sfx(name){
  if(muted||!ensure()) return;
  if(ac.state==='suspended'){ ac.resume(); }
  const now=performance.now();
  switch(name){
    case 'place':    tone(240,0.07,'square',0.12,0,180); noise(0.05,2400,0.06); break;
    case 'belt':     noise(0.04,1800,0.05); tone(200,0.04,'square',0.06); break;
    case 'rotate':   tone(420,0.04,'square',0.08,0,520); break;
    case 'demolish': noise(0.16,600,0.16,0,0.8); tone(120,0.12,'sawtooth',0.08,0,70); break;
    case 'select':   tone(520,0.05,'sine',0.09); break;
    case 'coin':
      if(now-lastCoin<380) return; lastCoin=now;
      tone(880,0.07,'triangle',0.14); tone(1320,0.1,'triangle',0.12,0.06);
      break;
    case 'rp':
      if(now-lastRp<450) return; lastRp=now;
      tone(660,0.09,'sine',0.1,0,780); break;
    case 'error':    tone(160,0.14,'sawtooth',0.1,0,110); break;
    case 'research': seq([523,659,784],'triangle',0.16,0.08,0.14); break;
    case 'contract': seq([523,659,784,1047],'triangle',0.18,0.09,0.16); break;
    case 'victory':
      seq([523,659,784,1047,784,1047,1319],'triangle',0.2,0.12,0.22);
      noise(0.5,4000,0.05,0.3,0.6);
      break;
    case 'click':    tone(700,0.025,'sine',0.06); break;
    case 'tool':     tone(500,0.04,'sine',0.07,0,640); break;
    case 'upgrade':  seq([392,523,659],'triangle',0.14,0.06,0.1); break;
  }
}
