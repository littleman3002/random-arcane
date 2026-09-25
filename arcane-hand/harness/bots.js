// Automated players. They only use sim.apply() — the same validated, owner-scoped API the UI uses.
const A = (typeof module !== 'undefined' && module.exports && typeof require === 'function') ? require('../src/sim.js') : globalThis.AH;
const { Rng, W, H } = A;

function buildTiles(sim) {
  const out = [];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (sim.canBuild(x, z)) out.push([x, z]);
  return out;
}
// how many path tiles a tower at (x,z) with range r would cover
function coverage(sim, x, z, r) {
  let c = 0; const k = sim.map.kind;
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    const tx = x + dx, tz = z + dz; if (tx < 0 || tz < 0 || tx >= W || tz >= H) continue;
    const kk = k[tz * W + tx]; if (kk !== 1 && kk !== 3) continue;
    if (Math.hypot(dx, dz) <= r) c++;
  }
  return c;
}

class BasicBot {
  constructor(sim, seed) { this.sim = sim; this.r = new Rng(seed ^ 0xbeef); this.log = []; }
  act(tick) {
    const s = this.sim, p = s.player;
    if (tick % 10 !== 0 || s.phase === 'victory' || s.phase === 'defeat') return;
    const doA = (a) => { a.owner = 0; const res = s.apply(a); if (res.ok) this.log.push([tick, a]); return res; };
    if (s.offer) {
      const r = A.ARCH[s.offer.arch].range + 0.25 * s.offer.tier;
      let best = null, bc = -1;
      for (const [x, z] of buildTiles(s)) { const c = coverage(s, x, z, r) * 10 - x * 0.01; if (c > bc) { bc = c; best = [x, z]; } }
      if (best && bc >= 20) { doA({ type: 'place', tx: best[0], tz: best[1] }); return; }
      doA({ type: 'sellOffer' }); return;
    }
    // merge when the board is getting full, or to finish pairs of ability towers
    const byTier = [[], [], [], [], []]; for (const t of s.towers) byTier[t.tier].push(t);
    if (s.towers.length >= 14 || buildTiles(s).length < 20) {
      for (let tier = 0; tier < 4; tier++) if (byTier[tier].length >= 2) {
        const worst = byTier[tier].slice().sort((a, b) => (a.ability ? 1 : 0) - (b.ability ? 1 : 0) || a.dmgDone - b.dmgDone)[0];
        const gamble = tier + 2 <= 4 && this.r.next() < 0.3;
        if (p.gold >= s.mergeCost(worst, gamble) + 40) { doA({ type: 'merge', id: worst.id, gamble }); return; }
      }
    }
    if (p.gold >= 380 && s.towers.some(t => !t.ability) && p.addRandomUses < 8) { doA({ type: 'addAbilityRandom' }); return; }
    if (p.gold >= s.rollCost() && s.towers.length < 26) { doA({ type: 'roll' }); return; }
  }
}

class RandomBot {
  constructor(sim, seed) { this.sim = sim; this.r = new Rng(seed ^ 0x1234); this.log = []; this.rejects = 0; }
  act(tick) {
    const s = this.sim, r = this.r;
    if (tick % 7 !== 0) return;
    const types = ['roll', 'reroll', 'sellOffer', 'place', 'sellTower', 'lock', 'merge', 'addAbilityRandom', 'addAbilityTarget', 'dropAbility', 'startWave', 'continueEndless'];
    const type = r.pick(types);
    const a = { type, owner: r.next() < 0.03 ? 1 : 0 };  // occasionally try to act on someone else's plot
    if (s.towers.length && ['sellTower', 'lock', 'merge', 'addAbilityTarget', 'dropAbility'].includes(type)) a.id = r.pick(s.towers).id;
    if (type === 'merge') a.gamble = r.next() < 0.5;
    if (type === 'place') { a.tx = r.int(W + 2) - 1; a.tz = r.int(H + 2) - 1; }
    const res = s.apply(a);
    if (res.ok) this.log.push([tick, a]); else this.rejects++;
  }
}

class StressBot { // maximises towers, abilities and effects
  constructor(sim, seed) { this.sim = sim; this.r = new Rng(seed ^ 0x5555); }
  setup() {
    const s = this.sim; let k = 0;
    const tiles = buildTiles(s).sort((a, b) => coverage(s, b[0], b[1], 2.6) - coverage(s, a[0], a[1], 2.6));
    for (const [x, z] of tiles.slice(0, 40)) {
      s.offer = { el: A.ELEMENTS[k % 6], arch: A.ARCHES[k % 4], tier: k % 5, ability: A.ABILITIES[k % 8], paid: 0 };
      s.apply({ type: 'place', owner: 0, tx: x, tz: z }); k++;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { BasicBot, RandomBot, StressBot, buildTiles, coverage };
else Object.assign(globalThis.AH, { BasicBot, RandomBot, StressBot });
