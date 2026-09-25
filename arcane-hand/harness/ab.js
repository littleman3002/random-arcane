// A/B balance: apply ONE tuning change, rerun the identical seed batch, compare.
const A=require('../src/sim.js'); const {BasicBot,RandomBot}=require('./bots.js');
const base = {...A.TUNE};
function batch(label, tune, n=24, Bot=BasicBot){ Object.assign(A.TUNE, base, tune);
  let wins=0, wave=0, leaks=0, merges=0; const defeat={};
  for(let seed=100;seed<100+n;seed++){ const s=new A.Sim({seed}); const b=new Bot(s,seed);
    while(s.phase!=='victory'&&s.phase!=='defeat'&&s.tick<30*60*40){ b.act(s.tick); s.step(); s.drainEvents(); }
    if(s.phase==='victory') wins++; else defeat[s.waveIdx]=(defeat[s.waveIdx]||0)+1; wave+=s.waveIdx; leaks+=s.player.leaked; merges+=s.player.merges; }
  console.log(label.padEnd(34), 'win', (wins/n).toFixed(2), 'avgWave', (wave/n).toFixed(1), 'leaks', (leaks/n).toFixed(1), 'merges', (merges/n).toFixed(1), 'defeats', JSON.stringify(defeat));
  Object.assign(A.TUNE, base); }
module.exports={batch};
if (require.main===module){ const cfgs=JSON.parse(process.argv[2]||'[]'); for(const [l,t] of cfgs) batch(l,t); }
