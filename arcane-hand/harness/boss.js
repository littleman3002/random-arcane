const A=require('../src/sim.js'); const {BasicBot}=require('./bots.js');
Object.assign(A.TUNE,{rewardMul:1.5,rollStep:2});
const rows=[];
for(let seed=100;seed<112;seed++){ const s=new A.Sim({seed}); const b=new BasicBot(s,seed); let info=null;
  const orig=s._leak.bind(s); s._leak=(i)=>{ if(s.m.flags[i]&A.F_BOSS) info={hpLeft:(s.m.hp[i]/s.m.maxHp[i]*100).toFixed(0)+'%',phase:s.m.bossPhase[i]}; orig(i); };
  while(s.phase!=='victory'&&s.phase!=='defeat'&&s.tick<30*60*40){ b.act(s.tick); s.step(); s.drainEvents(); }
  const dps=s.towers.reduce((a,t)=>a+t.dmg*t.rate,0); const tiers=[0,0,0,0,0]; s.towers.forEach(t=>tiers[t.tier]++);
  rows.push(`seed ${seed} ${s.phase} boss ${info?JSON.stringify(info):'killed'} rawDps ${dps.toFixed(0)} tiers ${tiers.join('/')} void ${s.towers.filter(t=>t.el==='void').length} shred ${s.towers.filter(t=>t.ability==='shred').length}`); }
console.log(rows.join('\n'));
