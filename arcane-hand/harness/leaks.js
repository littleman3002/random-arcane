const A=require('../src/sim.js'); const {BasicBot}=require('./bots.js');
Object.assign(A.TUNE,{rewardMul:1.5,rollStep:2});
const byWave={};
for(let seed=100;seed<124;seed++){ const s=new A.Sim({seed}); const b=new BasicBot(s,seed);
  // record the type of each leaked monster by peeking before the leak happens
  const orig=s._leak.bind(s); s._leak=(i)=>{ const k=`w${s.waveIdx}:${A.MT_KEYS[s.m.type[i]]}${s.m.flags[i]&A.F_ELITE?'*':''}`; byWave[k]=(byWave[k]||0)+s.m.leak[i]; orig(i); };
  while(s.phase!=='victory'&&s.phase!=='defeat'&&s.tick<30*60*40){ b.act(s.tick); s.step(); s.drainEvents(); } }
console.log(Object.entries(byWave).sort((a,b)=>b[1]-a[1]).slice(0,14).map(([k,v])=>k+' '+v).join('\n'));
