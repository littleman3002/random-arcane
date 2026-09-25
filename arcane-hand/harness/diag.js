const A=require('../src/sim.js'); const {BasicBot}=require('./bots.js');
for (const seed of [100,101,102]) {
  const s=new A.Sim({seed}); const b=new BasicBot(s,seed); let lastW=0; const rows=[];
  while(s.phase!=='victory'&&s.phase!=='defeat'&&s.tick<30*60*40){ b.act(s.tick); s.step();
    for(const e of s.drainEvents()) if(e.t==='waveStart'){ const tiers=[0,0,0,0,0]; s.towers.forEach(t=>tiers[t.tier]++);
      const dps=s.towers.reduce((a,t)=>a+t.dmg*t.rate,0);
      rows.push(`w${e.wave} gold ${s.player.gold} lives ${s.player.lives} towers ${s.towers.length} tiers ${tiers.join('/')} dps ${dps.toFixed(0)} rolls ${s.player.rolls} rollCost ${s.rollCost()}`);} }
  console.log('seed',seed,s.phase,'at wave',s.waveIdx); console.log(rows.join('\n'));
}
