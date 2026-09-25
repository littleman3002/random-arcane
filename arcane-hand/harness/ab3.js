const A=require('../src/sim.js'); const {batch}=require('./ab.js');
const kept={rewardMul:1.5,rollStep:2}; const b0={...A.MT.boss};
for (const [label,o] of [['boss hp 2000',{hp:2000}],['boss hp 2400 + speed 0.55->0.45',{hp:2400,speed:0.45}],['boss hp 1800',{hp:1800}]]){
  Object.assign(A.MT.boss,b0,o); batch(label,kept); }
Object.assign(A.MT.boss,b0);
