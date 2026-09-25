const A=require('../src/sim.js'); const {batch}=require('./ab.js');
const hp0=A.MT.boss.hp, ar0=A.MT.boss.armor;
const kept={rewardMul:1.5,rollStep:2};
for (const [label,hp,ar] of [['boss hp 4200->2800',2800,5],['boss hp 4200->2400',2400,5],['boss armor 5->2',4200,2],['boss hp 3000 + armor 3',3000,3]]){
  A.MT.boss.hp=hp; A.MT.boss.armor=ar; batch(label,kept); }
A.MT.boss.hp=hp0; A.MT.boss.armor=ar0;
