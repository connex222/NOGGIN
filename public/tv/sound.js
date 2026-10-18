'use strict';
// Local-first TV-only audio: dedicated /sounds file -> optional named substitute -> synthesised Web Audio.
// The soundtrack works without third-party files, CDNs, cookies or audio permissions beyond a TV click.
class NogginSound {
 constructor(){this.context=null;this.enabled=false;this.muted=localStorage.getItem('noggin-muted')!=='false';this.volume=Math.max(0,Math.min(1,Number(localStorage.getItem('noggin-volume')??'.55')));this.master=null;this.files=new Set();this.music=null;this.timer=null;this.lastSound='';this.loadManifest();}
 async loadManifest(){try{const r=await fetch('/sounds/sound-manifest.json');if(r.ok){const x=await r.json();if(Array.isArray(x.files))this.files=new Set(x.files);}}catch{}}
 async unlock(){const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('Audio unsupported');this.context ||= new C();await this.context.resume();if(!this.master){this.master=this.context.createGain();this.master.connect(this.context.destination);}this.enabled=true;this.apply();}
 apply(){if(this.master)this.master.gain.setTargetAtTime(this.muted?0:this.volume*.33,this.context.currentTime,.025);}
 setVolume(v){this.volume=Math.max(0,Math.min(1,Number(v)));localStorage.setItem('noggin-volume',String(this.volume));this.apply();}
 setMuted(v){this.muted=Boolean(v);localStorage.setItem('noggin-muted',String(this.muted));this.apply();if(this.muted)this.stopMusic();}
 beep(freq,duration=.16,style='sine',delay=0,amp=.35){if(!this.enabled||this.muted)return;const ctx=this.context,start=ctx.currentTime+delay;
  const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=style;osc.frequency.setValueAtTime(freq,start);gain.gain.setValueAtTime(.001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.001,amp),start+.013);gain.gain.exponentialRampToValueAtTime(.001,start+duration);osc.connect(gain).connect(this.master);osc.start(start);osc.stop(start+duration+.03);
 }
 synth(name){const notes=(steps,kind='triangle')=>{steps.forEach(([p,t,d=.18],i)=>this.beep(p,d,kind,t,.20));};
  switch(name){
   case 'sfx-join':return notes([[440,0],[660,.11],[880,.22]]);
   case 'sfx-dice-roll':return notes([[150,0,.10],[220,.08,.10],[310,.16,.10],[490,.24,.10]],'square');
   case 'sfx-hop':return this.beep(540,.085,'sine');
   case 'sfx-reel':return notes([[220,0],[330,.1],[440,.2],[550,.3]],'sawtooth');
   case 'sfx-reel-stop':return notes([[700,0],[490,.09],[810,.19]]);
   case 'sfx-countdown':case 'sfx-tick':return this.beep(700,.12,'square');
   case 'sfx-go':return notes([[800,0],[1080,.1],[1380,.2]],'square');
   case 'sfx-correct':case 'sfx-spark-gain':return notes([[620,0],[820,.12],[1050,.23]]);
   case 'sfx-wrong':case 'sfx-spark-lose':return notes([[330,0],[250,.13],[175,.25]],'sawtooth');
   case 'sfx-buzz':return notes([[110,0,.28],[100,.15,.19]],'square');
   case 'sfx-gunshot':case 'sfx-boom':return notes([[90,0,.37],[68,.10,.30]],'sawtooth');
   case 'sfx-swap':return notes([[450,0],[620,.08],[950,.16]],'sine');
   case 'sfx-showdown':return notes([[250,0,.24],[375,.14,.23],[500,.28,.30],[750,.43,.40]],'sawtooth');
   case 'sfx-crowd-cheer':return notes([[523,0,.2],[659,.12,.23],[784,.24,.25],[1046,.36,.35]],'triangle');
   case 'sfx-crowd-aww':return notes([[500,0,.28],[400,.16,.28],[290,.32,.35]],'triangle');
   case 'mus-victory':return notes([[523,0,.25],[659,.20,.25],[784,.42,.25],[1046,.7,.6]],'triangle');
   default:return this.beep(420,.16);
  }
 }
 play(name,fallback=''){if(!this.enabled||this.muted)return;const clip=`${name}.mp3`,sub=fallback?`${fallback}.mp3`:'';
  const available=this.files.has(clip)?clip:(this.files.has(sub)?sub:null);
  if(!available){this.synth(name);return;}
  const audio=new Audio(`/sounds/${encodeURIComponent(available)}`);audio.volume=this.volume;let done=false;
  audio.onerror=()=>{if(!done){done=true;this.synth(name);}};
  audio.play().catch(()=>{if(!done){done=true;this.synth(name);}});
 }
 startMusic(which){if(this.music===which)return;this.stopMusic();this.music=which;if(!this.enabled||this.muted)return;
  const themes={lobby:[392,494,587,784],board:[294,370,440,587],tension:[165,196,220,247]};const arr=themes[which];if(!arr)return;
  let i=0;const note=()=>{if(this.muted||!this.enabled)return;this.beep(arr[i++%arr.length],.33,'sine',0,.055);};note();this.timer=setInterval(note,430);
 }
 stopMusic(){if(this.timer)clearInterval(this.timer);this.timer=null;this.music=null;}
}
window.NogginSound=NogginSound;
