/* Arcane Hand: Horde Defense — authoritative simulation.
   Pure data + systems. No rendering, no DOM, no wall-clock, no Math.random.
   Runs identically in Node (harness) and the browser. Fixed 30 Hz tick. */
(function (root) {
'use strict';

const TICK_HZ = 30, DT = 1 / TICK_HZ;

// ---------------------------------------------------------------- RNG
function hashStr(s, seed) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 0x85ebca6b); h = (h ^ (h >>> 13)) >>> 0; }
  return h >>> 0;
}
class Rng {
  constructor(seed) { this.s = seed >>> 0; }
  next() {
    const a = this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n) { return Math.floor(this.next() * n); }
  pick(a) { return a[this.int(a.length)]; }
}

// ---------------------------------------------------------------- content
const ELEMENTS = ['ember', 'tide', 'grove', 'void', 'storm', 'iron'];
const ARCHES = ['bolt', 'sniper', 'rapid', 'heavy'];
const TIERS = ['Normal', 'Rare', 'Superior', 'Special', 'Legendary'];
const ABILITIES = ['slow', 'burn', 'splash', 'chain', 'pierce', 'aura', 'skyward', 'shred'];
const ABILITY_INFO = {
  slow: 'Slow — hits slow the target by 45% for 2s',
  burn: 'Burn — hits set the target alight for 3s',
  splash: 'Splash — hits damage everything nearby',
  chain: 'Chain — hits bounce to 3 more enemies',
  pierce: 'Pierce — shots pass through up to 3 enemies',
  aura: 'Aura — towers within 2 tiles attack 25% faster',
  skyward: 'Skyward — double damage to flyers',
  shred: 'Shred — hits strip 4 armor for 4s',
};
const NAMES = {
  ember: { bolt: 'Cinder Post', sniper: 'Flare Spire', rapid: 'Spark Brazier', heavy: 'Magma Mortar' },
  tide: { bolt: 'Rill Totem', sniper: 'Frost Lance', rapid: 'Spray Fount', heavy: 'Tidal Crusher' },
  grove: { bolt: 'Thorn Post', sniper: 'Longbark', rapid: 'Bramble Nest', heavy: 'Oaken Ram' },
  void: { bolt: 'Rift Shard', sniper: 'Null Eye', rapid: 'Flicker Prism', heavy: 'Maw Obelisk' },
  storm: { bolt: 'Spark Rod', sniper: 'Sky Needle', rapid: 'Arc Coil', heavy: 'Thunder Drum' },
  iron: { bolt: 'Bolt Tower', sniper: 'Rune Ballista', rapid: 'Chain Repeater', heavy: 'Siege Cannon' },
};
const ARCH = { // Normal-tier base: dps roughly equal, shape differs
  bolt: { dmg: 10, rate: 1.0, range: 2.6 },
  sniper: { dmg: 23, rate: 0.48, range: 3.8 },
  rapid: { dmg: 4.6, rate: 2.35, range: 2.25 },
  heavy: { dmg: 31, rate: 0.37, range: 2.45 },
};
const ELEM = {
  ember: { dmg: 1.10, rate: 0.95 }, tide: { dmg: 1.0, rate: 1.0 }, grove: { dmg: 0.95, rate: 1.10 },
  void: { dmg: 0.90, rate: 1.0 }, storm: { dmg: 0.92, rate: 1.0 }, iron: { dmg: 1.0, rate: 1.0 },
};
const TIER_DMG = [1, 2.1, 4.5, 9.5, 20];
const ROLL_ODDS = [0.70, 0.22, 0.065, 0.013, 0.002];
const ROLL_ABILITY_CHANCE = 0.25;

const TUNE = { hpA: 0.30, hpB: 0.035, rewardMul: 1.5, rollStep: 2, waveBonus: 40, waveBonusStep: 10 };
const COST = {
  startGold: 250,
  roll: (n) => 50 + TUNE.rollStep * Math.min(n, 40),
  merge: [100, 160, 260, 420],
  gamble: 30, gambleChance: 0.10,
  addRandom: (n) => 100 + 25 * n,
  addTarget: (n) => 500 + 100 * n,
  sellFraction: 0.5,
};

const MT = {
  grub:    { hp: 40,  speed: 1.5, armor: 0, reward: 4,  size: 0.32, leak: 1, name: 'Grub' },
  skitter: { hp: 14,  speed: 2.0, armor: 0, reward: 1.5, size: 0.20, leak: 1, name: 'Skitterling' },
  dasher:  { hp: 30,  speed: 3.0, armor: 0, reward: 5,  size: 0.28, leak: 1, name: 'Dasher' },
  bulwark: { hp: 70,  speed: 1.1, armor: 6, reward: 8,  size: 0.40, leak: 2, name: 'Bulwark' },
  troll:   { hp: 160, speed: 0.9, armor: 1, reward: 12, size: 0.50, leak: 2, regen: 0.03, name: 'Moss Troll' },
  wisp:    { hp: 35,  speed: 1.7, armor: 0, reward: 6,  size: 0.28, leak: 1, flying: true, name: 'Wisp' },
  knight:  { hp: 60,  speed: 1.2, armor: 2, reward: 9,  size: 0.36, leak: 2, shield: 60, name: 'Warded Knight' },
  budling: { hp: 55,  speed: 1.3, armor: 0, reward: 5,  size: 0.36, leak: 1, split: 'skitter', splitN: 3, name: 'Budling' },
  boss:    { hp: 1800, speed: 0.55, armor: 5, reward: 300, size: 1.0, leak: 20, boss: true, name: 'Vault Breaker' },
};
const MT_KEYS = Object.keys(MT);

const WAVES = [
  [{ t: 'grub', n: 18, gap: 0.9 }],
  [{ t: 'grub', n: 12, gap: 0.8 }, { t: 'skitter', n: 30, gap: 0.25 }],
  [{ t: 'dasher', n: 16, gap: 0.7 }, { t: 'grub', n: 14, gap: 0.7 }],
  [{ t: 'bulwark', n: 14, gap: 1.0 }, { t: 'grub', n: 14, gap: 0.6 }],
  [{ t: 'wisp', n: 18, gap: 0.7 }, { t: 'grub', n: 10, gap: 0.6 }, { t: 'wisp', n: 2, gap: 1.5, elite: 'ward' }],
  [{ t: 'troll', n: 8, gap: 1.6 }, { t: 'skitter', n: 40, gap: 0.2 }],
  [{ t: 'knight', n: 14, gap: 0.9 }, { t: 'budling', n: 12, gap: 0.9 }],
  [{ t: 'dasher', n: 20, gap: 0.4 }, { t: 'bulwark', n: 8, gap: 0.9, elite: 'frenzy' }, { t: 'wisp', n: 12, gap: 0.5 }],
  [{ t: 'skitter', n: 60, gap: 0.12 }, { t: 'troll', n: 6, gap: 1.2 }, { t: 'knight', n: 10, gap: 0.7 }, { t: 'wisp', n: 16, gap: 0.4 }],
  [{ t: 'grub', n: 20, gap: 0.5 }, { t: 'boss', n: 1, gap: 1 }, { t: 'knight', n: 8, gap: 1.2, elite: 'frenzy' }],
];
const WAVE_NAMES = ['First Crawl', 'The Swarm', 'Quickfeet', 'Iron Hides', 'Wings Over the Glade',
  'The Mending Ones', 'Shields and Seeds', 'Frenzied March', 'The Deluge', 'The Vault Breaker'];

function hpMul(w) { const k = w - 1; return 1 + TUNE.hpA * k + TUNE.hpB * k * k; }

// ---------------------------------------------------------------- map
const W = 22, H = 14;
const PATH_WP = [[0, 1], [19, 1], [19, 4], [2, 4], [2, 7], [19, 7], [19, 10], [2, 10], [2, 12], [21, 12]];
const RIVER_X = 11;
function buildMap() {
  const kind = new Uint8Array(W * H); // 0 build, 1 path, 2 river, 3 vault
  const order = [];
  for (let i = 0; i < PATH_WP.length - 1; i++) {
    const [ax, az] = PATH_WP[i], [bx, bz] = PATH_WP[i + 1];
    const sx = Math.sign(bx - ax), sz = Math.sign(bz - az);
    let x = ax, z = az;
    while (true) {
      const idx = z * W + x;
      if (!kind[idx]) { kind[idx] = 1; order.push(idx); }
      if (x === bx && z === bz) break;
      x += sx; z += sz;
    }
  }
  for (let z = 0; z < H; z++) { const idx = z * W + RIVER_X; if (!kind[idx]) kind[idx] = 2; }
  const vault = order[order.length - 1];
  kind[vault] = 3;
  // reverse BFS distance field from the vault over walkable tiles (path + vault)
  const dist = new Int32Array(W * H).fill(-1);
  const q = [vault]; dist[vault] = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi], cx = c % W, cz = (c / W) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const n = nz * W + nx;
      if (dist[n] >= 0 || (kind[n] !== 1 && kind[n] !== 3)) continue;
      dist[n] = dist[c] + 1; q.push(n);
    }
  }
  // cached flow direction: next tile toward the vault (shared by every monster)
  const next = new Int32Array(W * H).fill(-1);
  for (let i = 0; i < W * H; i++) {
    if (dist[i] <= 0) continue;
    const cx = i % W, cz = (i / W) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const n = nz * W + nx;
      if (dist[n] === dist[i] - 1) { next[i] = n; break; }
    }
  }
  const spawn = order[0];
  return { W, H, kind, dist, next, spawn, vault, order, pathLen: dist[spawn], riverX: RIVER_X };
}

// ---------------------------------------------------------------- simulation
const CAP = 6144;
const F_FLY = 1, F_BOSS = 2, F_ELITE = 4, F_FRENZY = 8, F_SPLIT = 16;

class Sim {
  constructor(opts = {}) {
    this.seed = (opts.seed >>> 0) || 1;
    this.opts = opts;
    this.map = buildMap();
    this.reset();
  }

  reset() {
    const s = this.seed;
    this.rng = {
      roll: new Rng(hashStr('roll', s)), merge: new Rng(hashStr('merge', s)),
      ability: new Rng(hashStr('ability', s)), wave: new Rng(hashStr('wave', s)),
      combat: new Rng(hashStr('combat', s)),
    };
    this.tick = 0;
    this.phase = 'build';           // build | wave | victory | defeat
    this.countdown = this.opts.firstCountdown != null ? this.opts.firstCountdown : 45;
    this.waveIdx = 0;               // index of the NEXT wave to start (0-based)
    this.endless = false;
    this.players = [{ id: 0, name: 'You', gold: COST.startGold, lives: 20, score: 0, leaked: 0, bossKills: 0, kills: 0,
      rolls: 0, addRandomUses: 0, addTargetUses: 0, merges: 0, gambles: 0, gambleHits: 0 }];
    this.plotOwner = 0;             // the single plot in the solo slice is owned by player 0
    this.offer = null;
    this.towers = []; this.towerById = new Map(); this.towerAt = new Int32Array(W * H).fill(-1);
    this.nextTowerId = 1;
    this.events = [];
    this.stats = { navRecoveries: 0, maxAlive: 0, spawned: 0, dmgByElement: {}, dmgByAbility: {}, killsByTower: {},
      overruns: 0, simMs: 0 };
    for (const e of ELEMENTS) this.stats.dmgByElement[e] = 0;
    // monster pool (structure of arrays)
    const f = () => new Float32Array(CAP);
    this.m = {
      alive: new Uint8Array(CAP), type: new Uint8Array(CAP), flags: new Uint8Array(CAP), gen: new Uint32Array(CAP),
      x: f(), z: f(), px: f(), pz: f(), hp: f(), maxHp: f(), armor: f(), shield: f(), maxShield: f(),
      speed: f(), lane: f(), tile: new Int32Array(CAP), key: f(), slowT: f(), burnT: f(), burnDps: f(),
      shredT: f(), immune: new Int8Array(CAP), reward: f(), leak: new Uint8Array(CAP), hitT: f(),
      lastKey: f(), stuckT: f(), frenzyBoost: new Uint8Array(CAP), bossPhase: new Uint8Array(CAP), enrage: f(),
      dirx: f(), dirz: f(), burnSrc: new Int32Array(CAP),
    };
    this.m.immune.fill(-1);
    this.free = []; for (let i = CAP - 1; i >= 0; i--) this.free.push(i);
    this.alive = 0; this.aliveList = new Int32Array(CAP); this.aliveN = 0;
    this.schedule = []; this.schedIdx = 0; this.waveTime = 0;
    this.cellStart = new Int32Array(W * H + 1); this.cellItems = new Int32Array(CAP);
    this.telegraphs = [];
    this.stressN = this.opts.stress | 0;
    if (this.stressN) { this.phase = 'wave'; this.countdown = 0; }
  }

  get player() { return this.players[0]; }

  // ------------------------------------------------ actions (owner-scoped, validated)
  apply(a) {
    const r = this._apply(a);
    if (!r.ok) this.events.push({ t: 'reject', reason: r.reason, action: a.type });
    return r;
  }
  _apply(a) {
    if (!a || typeof a.type !== 'string') return { ok: false, reason: 'bad action' };
    if (a.owner !== this.plotOwner) return { ok: false, reason: 'You can only act on your own plot.' };
    const p = this.players[a.owner];
    if (this.phase === 'victory' || this.phase === 'defeat') {
      if (a.type !== 'continueEndless') return { ok: false, reason: 'The run is over.' };
    }
    const tower = a.id != null ? this.towers.find(t => t.id === a.id) : null;
    if (a.id != null && (!tower || tower.owner !== a.owner)) return { ok: false, reason: 'That tower is not yours.' };
    switch (a.type) {
      case 'roll': case 'reroll': {
        if (a.type === 'roll' && this.offer) return { ok: false, reason: 'Place or sell your rolled tower first.' };
        if (a.type === 'reroll' && !this.offer) return { ok: false, reason: 'Nothing to reroll.' };
        const cost = COST.roll(p.rolls);
        if (p.gold < cost) return { ok: false, reason: `Need ${cost} gold to roll.` };
        p.gold -= cost; p.rolls++;
        this.offer = this._rollTower(cost);
        this.events.push({ t: 'roll', tier: this.offer.tier, el: this.offer.el });
        return { ok: true };
      }
      case 'sellOffer': {
        if (!this.offer) return { ok: false, reason: 'Nothing to sell.' };
        p.gold += Math.floor(this.offer.paid * COST.sellFraction); this.offer = null;
        return { ok: true };
      }
      case 'place': {
        if (!this.offer) return { ok: false, reason: 'Roll a tower first.' };
        if (!this.canBuild(a.tx, a.tz)) return { ok: false, reason: 'You can’t build there.' };
        const o = this.offer; this.offer = null;
        const t = this._makeTower(a.owner, a.tx, a.tz, o.el, o.arch, o.tier, o.ability, o.paid);
        this.events.push({ t: 'place', id: t.id });
        return { ok: true, id: t.id };
      }
      case 'sellTower': {
        if (!tower) return { ok: false, reason: 'Select a tower.' };
        if (tower.locked) return { ok: false, reason: 'Unlock it before selling.' };
        p.gold += Math.floor(tower.invested * COST.sellFraction);
        this._removeTower(tower); this._recomputeAura();
        this.events.push({ t: 'sell', x: tower.x, z: tower.z });
        return { ok: true };
      }
      case 'lock': {
        if (!tower) return { ok: false, reason: 'Select a tower.' };
        tower.locked = !tower.locked; return { ok: true };
      }
      case 'merge': {
        if (!tower) return { ok: false, reason: 'Select a tower.' };
        if (tower.tier >= 4) return { ok: false, reason: 'Legendary towers can’t merge further.' };
        const partners = this.mergePartners(tower);
        if (!partners.length) return { ok: false, reason: `You need another unlocked ${TIERS[tower.tier]} tower.` };
        const gamble = !!a.gamble && tower.tier + 2 <= 4;
        const cost = COST.merge[tower.tier] + (gamble ? COST.gamble : 0);
        if (p.gold < cost) return { ok: false, reason: `Need ${cost} gold to merge.` };
        p.gold -= cost; p.merges++;
        const partner = partners[this.rng.merge.int(partners.length)];
        let up = 1;
        if (gamble) { p.gambles++; if (this.rng.merge.next() < COST.gambleChance) { up = 2; p.gambleHits++; } }
        const newTier = tower.tier + up;
        // 3–5 hidden possibilities: the two input elements x archetypes
        const pool = [];
        const els = tower.el === partner.el ? [tower.el] : [tower.el, partner.el];
        const archs = tower.arch === partner.arch ? [tower.arch, ARCHES[(ARCHES.indexOf(tower.arch) + 1) % 4], ARCHES[(ARCHES.indexOf(tower.arch) + 2) % 4]]
          : [tower.arch, partner.arch];
        for (const e of els) for (const ar of archs) pool.push([e, ar]);
        while (pool.length > 5) pool.pop();
        const [el, arch] = pool[this.rng.merge.int(pool.length)];
        // ability inheritance: only if BOTH inputs carried one; then rolled fresh
        let ability = null;
        if (tower.ability && partner.ability) ability = ABILITIES[this.rng.merge.int(ABILITIES.length)];
        const tx = tower.tx, tz = tower.tz, invested = tower.invested + partner.invested + cost;
        this._removeTower(tower); this._removeTower(partner);
        const nt = this._makeTower(a.owner, tx, tz, el, arch, newTier, ability, invested);
        this._recomputeAura();
        this.events.push({ t: 'merge', id: nt.id, from: [tower.id, partner.id], px: partner.x, pz: partner.z, jump: up, tier: newTier });
        return { ok: true, id: nt.id, jump: up, consumed: partner.id };
      }
      case 'addAbilityRandom': {
        const elig = this.towers.filter(t => t.owner === a.owner && !t.ability);
        if (!elig.length) return { ok: false, reason: 'Every tower already has an ability.' };
        const cost = COST.addRandom(p.addRandomUses);
        if (p.gold < cost) return { ok: false, reason: `Need ${cost} gold.` };
        p.gold -= cost; p.addRandomUses++;
        const t = elig[this.rng.ability.int(elig.length)];
        t.ability = ABILITIES[this.rng.ability.int(ABILITIES.length)];
        this._recomputeAura();
        this.events.push({ t: 'enchant', id: t.id, ability: t.ability });
        return { ok: true, id: t.id, ability: t.ability };
      }
      case 'addAbilityTarget': {
        if (!tower) return { ok: false, reason: 'Select a tower.' };
        if (tower.ability) return { ok: false, reason: 'Drop its ability first.' };
        const cost = COST.addTarget(p.addTargetUses);
        if (p.gold < cost) return { ok: false, reason: `Need ${cost} gold.` };
        p.gold -= cost; p.addTargetUses++;
        tower.ability = ABILITIES[this.rng.ability.int(ABILITIES.length)];
        this._recomputeAura();
        this.events.push({ t: 'enchant', id: tower.id, ability: tower.ability });
        return { ok: true, id: tower.id, ability: tower.ability };
      }
      case 'dropAbility': {
        if (!tower) return { ok: false, reason: 'Select a tower.' };
        if (!tower.ability) return { ok: false, reason: 'It has no ability.' };
        tower.ability = null; this._recomputeAura(); return { ok: true };
      }
      case 'startWave': {
        if (this.phase !== 'build') return { ok: false, reason: 'A wave is already running.' };
        this.countdown = 0; return { ok: true };
      }
      case 'continueEndless': {
        if (this.phase !== 'victory') return { ok: false, reason: 'Only after victory.' };
        this.endless = true; this.phase = 'build'; this.countdown = 30; return { ok: true };
      }
    }
    return { ok: false, reason: 'unknown action' };
  }

  canBuild(tx, tz) {
    if (!(tx >= 0 && tz >= 0 && tx < W && tz < H) || tx !== (tx | 0) || tz !== (tz | 0)) return false;
    const i = tz * W + tx;
    return this.map.kind[i] === 0 && this.towerAt[i] < 0;
  }
  mergePartners(t) { return this.towers.filter(o => o !== t && o.owner === t.owner && o.tier === t.tier && !o.locked); }
  rollCost() { return COST.roll(this.player.rolls); }
  mergeCost(t, gamble) { return COST.merge[t.tier] + (gamble && t.tier + 2 <= 4 ? COST.gamble : 0); }

  _rollTower(paid) {
    const r = this.rng.roll;
    let x = r.next(), tier = 0;
    for (let i = 0; i < 5; i++) { if (x < ROLL_ODDS[i]) { tier = i; break; } x -= ROLL_ODDS[i]; tier = i; }
    const el = r.pick(ELEMENTS), arch = r.pick(ARCHES);
    const ability = r.next() < ROLL_ABILITY_CHANCE ? r.pick(ABILITIES) : null;
    return { el, arch, tier, ability, paid, name: NAMES[el][arch] };
  }
  _makeTower(owner, tx, tz, el, arch, tier, ability, invested) {
    const a = ARCH[arch], e = ELEM[el];
    const t = { id: this.nextTowerId++, owner, tx, tz, x: tx + 0.5, z: tz + 0.5, el, arch, tier, ability, locked: false,
      name: NAMES[el][arch], dmg: a.dmg * e.dmg * TIER_DMG[tier], rate: a.rate * e.rate * (1 + 0.05 * tier),
      range: a.range + 0.25 * tier, cd: 0.3, invested, auraBoost: 1, dmgDone: 0, kills: 0, placedTick: this.tick };
    this.towers.push(t); this.towerById.set(t.id, t); this.towerAt[tz * W + tx] = t.id;
    this._recomputeAura();
    return t;
  }
  _removeTower(t) {
    const i = this.towers.indexOf(t); if (i >= 0) this.towers.splice(i, 1); this.towerById.delete(t.id);
    this.towerAt[t.tz * W + t.tx] = -1;
  }
  _recomputeAura() {
    for (const t of this.towers) t.auraBoost = 1;
    for (const a of this.towers) if (a.ability === 'aura')
      for (const t of this.towers) if (t !== a && Math.hypot(t.x - a.x, t.z - a.z) <= 2.3) t.auraBoost = 1.25;
  }

  // ------------------------------------------------ waves
  _buildSchedule(w) {
    const def = w < WAVES.length ? WAVES[w] : this._endlessWave(w);
    const list = []; const r = this.rng.wave;
    def.forEach((g, gi) => {
      const ward = g.elite === 'ward' ? r.int(ELEMENTS.length) : -1;
      for (let k = 0; k < g.n; k++) list.push({ time: gi * 4 + k * g.gap, type: g.t, elite: g.elite || null, ward });
    });
    list.sort((a, b) => a.time - b.time || MT_KEYS.indexOf(a.type) - MT_KEYS.indexOf(b.type));
    return list;
  }
  _endlessWave(w) {
    const r = this.rng.wave, pool = ['grub', 'skitter', 'dasher', 'bulwark', 'troll', 'wisp', 'knight', 'budling'];
    const g = [];
    for (let i = 0; i < 3; i++) { const t = r.pick(pool); g.push({ t, n: t === 'skitter' ? 40 : 14, gap: t === 'skitter' ? 0.15 : 0.6, elite: r.next() < 0.3 ? (r.next() < 0.5 ? 'ward' : 'frenzy') : undefined }); }
    if ((w + 1) % 5 === 0) g.push({ t: 'boss', n: 1, gap: 1 });
    return g;
  }
  waveName(w) { return w < WAVE_NAMES.length ? WAVE_NAMES[w] : `Endless ${w + 1}`; }
  waveTotal() { return WAVES.length; }

  spawn(type, elite, ward, atTile, atX, atZ) {
    if (!this.free.length) return -1;
    const i = this.free.pop(), m = this.m, d = MT[type], ti = MT_KEYS.indexOf(type);
    const w = Math.max(1, this.stressN ? 3 : this.waveIdx);
    let hp = d.hp * hpMul(w) * (elite ? 2.5 : 1);
    m.alive[i] = 1; m.type[i] = ti; m.gen[i]++;
    m.flags[i] = (d.flying ? F_FLY : 0) | (d.boss ? F_BOSS : 0) | (elite ? F_ELITE : 0) | (elite === 'frenzy' ? F_FRENZY : 0) | (d.split ? F_SPLIT : 0);
    m.hp[i] = m.maxHp[i] = hp; m.armor[i] = d.armor + (w > 6 ? 1 : 0);
    m.shield[i] = m.maxShield[i] = (d.shield || 0) * hpMul(w);
    m.speed[i] = d.speed; m.reward[i] = d.reward * TUNE.rewardMul * (1 + 0.06 * (w - 1)) * (elite ? 3 : 1);
    m.leak[i] = d.leak * (elite ? 2 : 1);
    m.immune[i] = ward >= 0 ? ward : -1;
    m.lane[i] = (this.rng.wave.next() - 0.5) * (d.boss ? 0 : 0.5);
    m.slowT[i] = m.burnT[i] = m.burnDps[i] = m.shredT[i] = m.hitT[i] = 0;
    m.stuckT[i] = 0; m.bossPhase[i] = 0; m.enrage[i] = 1; m.frenzyBoost[i] = 0;
    const map = this.map;
    if (atTile != null) {
      m.tile[i] = atTile; m.x[i] = atX; m.z[i] = atZ;
    } else {
      const sx = map.spawn % W, sz = (map.spawn / W) | 0;
      m.tile[i] = map.spawn; m.x[i] = sx - 0.6; m.z[i] = sz + 0.5 + m.lane[i];
    }
    m.px[i] = m.x[i]; m.pz[i] = m.z[i];
    m.dirx[i] = 1; m.dirz[i] = 0;
    m.key[i] = m.lastKey[i] = map.dist[m.tile[i]] + 1;
    this.alive++; this.stats.spawned++;
    if (this.alive > this.stats.maxAlive) this.stats.maxAlive = this.alive;
    return i;
  }

  _kill(i, byTower) {
    const m = this.m, p = this.player;
    m.alive[i] = 0; this.alive--; this.free.push(i);
    const type = MT_KEYS[m.type[i]];
    if (!this.stressN) {
      p.gold += Math.round(m.reward[i]); p.kills++; p.score += Math.round(m.reward[i] * 10);
      if (m.flags[i] & F_BOSS) { p.bossKills++; p.score += 5000; }
    }
    if (byTower) byTower.kills++;
    this.events.push({ t: 'death', i, x: m.x[i], z: m.z[i], type, boss: !!(m.flags[i] & F_BOSS), elite: !!(m.flags[i] & F_ELITE) });
    if (m.flags[i] & F_SPLIT) {
      const d = MT[type];
      for (let k = 0; k < d.splitN; k++) {
        const j = this.spawn(d.split, null, -1, m.tile[i], m.x[i] + (k - 1) * 0.15, m.z[i] + (k - 1) * 0.15);
        if (j >= 0) m.lane[j] = (k - 1) * 0.2;
      }
    }
  }

  // ------------------------------------------------ the fixed tick
  step() {
    const m = this.m, map = this.map, p = this.player;
    this.tick++;
    // phase control
    if (this.phase === 'build') {
      this.countdown -= DT;
      if (this.countdown <= 0) this._startWave();
    }
    if (this.phase === 'wave') {
      this.waveTime += DT;
      if (this.stressN) {
        while (this.alive < this.stressN && this.free.length) {
          const types = ['grub', 'skitter', 'dasher', 'bulwark', 'wisp', 'knight', 'troll'];
          const i = this.spawn(types[this.stats.spawned % types.length], this.stats.spawned % 53 === 0 ? 'ward' : null, 1);
          // spread them along the whole path so the benchmark is a real crowd
          if (i >= 0) this._placeAlongPath(i, (this.stats.spawned * 0.61803) % 1);
        }
      } else {
        while (this.schedIdx < this.schedule.length && this.schedule[this.schedIdx].time <= this.waveTime) {
          const s = this.schedule[this.schedIdx++];
          this.spawn(s.type, s.elite, s.ward);
        }
      }
    }
    // alive list (stable order by pool index keeps iteration deterministic)
    let n = 0;
    for (let i = 0; i < CAP; i++) if (m.alive[i]) this.aliveList[n++] = i;
    this.aliveN = n;
    const list = this.aliveList;

    // frenzy auras (5 Hz)
    if (this.tick % 6 === 0) {
      for (let k = 0; k < n; k++) m.frenzyBoost[list[k]] = 0;
      for (let k = 0; k < n; k++) { const i = list[k]; if (!(m.flags[i] & F_FRENZY)) continue;
        for (let q = 0; q < n; q++) { const j = list[q]; const dx = m.x[j] - m.x[i], dz = m.z[j] - m.z[i]; if (dx * dx + dz * dz < 4) m.frenzyBoost[j] = 1; } }
    }

    // movement + status (every tick)
    for (let k = 0; k < n; k++) {
      const i = list[k];
      m.px[i] = m.x[i]; m.pz[i] = m.z[i];
      if (m.hitT[i] > 0) m.hitT[i] -= DT;
      if (m.slowT[i] > 0) m.slowT[i] -= DT;
      if (m.shredT[i] > 0) m.shredT[i] -= DT;
      const regen = MT[MT_KEYS[m.type[i]]].regen;
      if (regen && m.burnT[i] <= 0) m.hp[i] = Math.min(m.maxHp[i], m.hp[i] + m.maxHp[i] * regen * DT);
      if (m.burnT[i] > 0) {
        m.burnT[i] -= DT;
        this._damageRaw(i, m.burnDps[i] * DT, null, 'burn');
        if (!m.alive[i]) continue;
      }
      let spd = m.speed[i] * m.enrage[i] * (m.slowT[i] > 0 ? 0.55 : 1) * (m.frenzyBoost[i] ? 1.25 : 1);
      let step = spd * DT;
      let guard = 0;
      while (step > 0 && guard++ < 4) {
        const ti = m.tile[i];
        const tx = ti % W, tz = (ti / W) | 0;
        // steer to target tile centre offset by lane (perpendicular to travel)
        const cx = tx + 0.5 - m.dirz[i] * m.lane[i], cz = tz + 0.5 + m.dirx[i] * m.lane[i];
        const dx = cx - m.x[i], dz = cz - m.z[i], d = Math.hypot(dx, dz);
        if (d <= step) {
          m.x[i] = cx; m.z[i] = cz; step -= d;
          if (ti === map.vault) { this._leak(i); break; }
          const nt = map.next[ti];
          if (nt < 0) { m.tile[i] = map.vault; continue; }
          const ndx = (nt % W) - tx, ndz = ((nt / W) | 0) - tz;
          m.dirx[i] = ndx; m.dirz[i] = ndz; m.tile[i] = nt;
        } else { m.x[i] += dx / d * step; m.z[i] += dz / d * step; step = 0; }
      }
      if (!m.alive[i]) continue;
      const ti = m.tile[i];
      m.key[i] = map.dist[ti] + Math.hypot((ti % W) + 0.5 - m.x[i], ((ti / W) | 0) + 0.5 - m.z[i]);
    }

    // stuck detection (1 Hz): no route progress for 6s => documented recovery
    if (this.tick % 30 === 0) {
      for (let k = 0; k < n; k++) { const i = list[k]; if (!m.alive[i]) continue;
        if (m.key[i] < m.lastKey[i] - 0.05) { m.lastKey[i] = m.key[i]; m.stuckT[i] = 0; continue; }
        m.stuckT[i] += 1;
        if (m.stuckT[i] >= 6) { // recovery: snap to current target tile centre, rejoin shared route
          const ti = m.tile[i]; m.x[i] = (ti % W) + 0.5; m.z[i] = ((ti / W) | 0) + 0.5;
          m.stuckT[i] = 0; m.lastKey[i] = m.key[i]; this.stats.navRecoveries++;
          this.events.push({ t: 'navRecovery', i, tile: ti });
        } }
    }

    // spatial hash (counting sort into tile cells)
    this._rebuildGrid();

    // towers
    for (const t of this.towers) {
      t.cd -= DT * t.auraBoost;
      if (t.cd > 0) continue;
      if ((this.tick + t.id) % 3 !== 0) continue;     // targeting at 10 Hz
      const target = this._findTarget(t);
      if (target < 0) { t.cd = 0; continue; }
      this._fire(t, target);
      t.cd += 1 / t.rate; if (t.cd < 0) t.cd = 0;
    }

    // boss logic + telegraphs
    for (let k = 0; k < this.telegraphs.length; k++) {
      const tg = this.telegraphs[k]; tg.t -= DT;
      if (tg.t <= 0) { this._resolveTelegraph(tg); this.telegraphs.splice(k--, 1); }
    }
    for (let k = 0; k < n; k++) { const i = list[k]; if (!m.alive[i] || !(m.flags[i] & F_BOSS)) continue;
      const f = m.hp[i] / m.maxHp[i];
      if (m.bossPhase[i] === 0 && f < 0.66) { m.bossPhase[i] = 1; this._telegraph(i, 'summon'); }
      else if (m.bossPhase[i] === 1 && f < 0.33) { m.bossPhase[i] = 2; this._telegraph(i, 'enrage'); } }

    // wave completion
    if (this.phase === 'wave' && !this.stressN && this.schedIdx >= this.schedule.length && this.alive === 0 && !this.telegraphs.length) {
      const w = this.waveIdx;
      p.gold += TUNE.waveBonus + TUNE.waveBonusStep * w; p.score += 200 * w;
      this.events.push({ t: 'waveClear', wave: w });
      if (w >= WAVES.length && !this.endless) { this.phase = 'victory'; p.score += p.lives * 50; this.events.push({ t: 'victory' }); }
      else { this.phase = 'build'; this.countdown = 25; }
    }
  }

  _placeAlongPath(i, frac) {
    const map = this.map, m = this.m, k = Math.floor(frac * (map.order.length - 2)) + 1;
    const ti = map.order[k];
    m.tile[i] = map.next[ti] >= 0 ? map.next[ti] : ti;
    m.x[i] = m.px[i] = (ti % W) + 0.5; m.z[i] = m.pz[i] = ((ti / W) | 0) + 0.5;
    const nt = m.tile[i]; m.dirx[i] = (nt % W) - (ti % W); m.dirz[i] = ((nt / W) | 0) - ((ti / W) | 0);
    m.key[i] = m.lastKey[i] = map.dist[ti];
  }

  _startWave() {
    if (this.stressN) return;
    this.schedule = this._buildSchedule(this.waveIdx); this.schedIdx = 0; this.waveTime = 0;
    this.waveIdx++; this.phase = 'wave';
    this.events.push({ t: 'waveStart', wave: this.waveIdx, name: this.waveName(this.waveIdx - 1),
      boss: this.schedule.some(s => s.type === 'boss') });
  }

  _leak(i) {
    const m = this.m, p = this.player;
    if (this.stressN) { // benchmark crowd: recycle to the start of the route
      const map = this.map, sx = map.spawn % W, sz = (map.spawn / W) | 0;
      m.tile[i] = map.spawn; m.x[i] = m.px[i] = sx + 0.5; m.z[i] = m.pz[i] = sz + 0.5; m.dirx[i] = 1; m.dirz[i] = 0;
      m.lastKey[i] = m.key[i] = map.dist[map.spawn]; return;
    }
    p.lives -= m.leak[i]; p.leaked++;
    m.alive[i] = 0; this.alive--; this.free.push(i);
    this.events.push({ t: 'leak', n: m.leak[i], boss: !!(m.flags[i] & F_BOSS) });
    if (p.lives <= 0 && this.phase !== 'defeat') { p.lives = 0; this.phase = 'defeat'; this.events.push({ t: 'defeat' }); }
  }

  _rebuildGrid() {
    const m = this.m, cs = this.cellStart, items = this.cellItems, list = this.aliveList, n = this.aliveN;
    cs.fill(0);
    const cellOf = (i) => { let cx = Math.floor(m.x[i]), cz = Math.floor(m.z[i]); if (cx < 0) cx = 0; if (cz < 0) cz = 0; if (cx >= W) cx = W - 1; if (cz >= H) cz = H - 1; return cz * W + cx; };
    for (let k = 0; k < n; k++) { const i = list[k]; if (m.alive[i]) cs[cellOf(i) + 1]++; }
    for (let c = 0; c < W * H; c++) cs[c + 1] += cs[c];
    const fill = cs.slice(0, W * H);
    for (let k = 0; k < n; k++) { const i = list[k]; if (m.alive[i]) items[fill[cellOf(i)]++] = i; }
  }
  _query(x, z, r, cb) {
    const m = this.m, cs = this.cellStart, items = this.cellItems, r2 = r * r;
    const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(W - 1, Math.floor(x + r));
    const z0 = Math.max(0, Math.floor(z - r)), z1 = Math.min(H - 1, Math.floor(z + r));
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      const c = cz * W + cx;
      for (let k = cs[c]; k < cs[c + 1]; k++) { const i = items[k]; if (!m.alive[i]) continue;
        const dx = m.x[i] - x, dz = m.z[i] - z; if (dx * dx + dz * dz <= r2) cb(i); }
    }
  }
  _findTarget(t) {
    const m = this.m; let best = -1, bk = 1e9;
    this._query(t.x, t.z, t.range, (i) => { const k = m.key[i] - ((m.flags[i] & F_BOSS) && t.ability !== 'splash' ? 0.5 : 0); if (k < bk) { bk = k; best = i; } });
    return best;
  }

  _mult(t, i) {
    const m = this.m; let mul = 1;
    if (m.immune[i] >= 0 && ELEMENTS[m.immune[i]] === t.el) mul *= 0.1;
    if (m.flags[i] & F_FLY) mul *= t.ability === 'skyward' ? 2 : (t.el === 'storm' ? 1 : 0.6);
    return mul;
  }
  _fire(t, i) {
    const m = this.m;
    let dmg = t.dmg;
    let crit = false;
    if (t.el === 'storm' && this.rng.combat.next() < 0.15) { dmg *= 2; crit = true; }
    this.events.push({ t: 'shot', id: t.id, el: t.el, tier: t.tier, ab: t.ability, x: t.x, z: t.z, tx: m.x[i], tz: m.z[i], i, // i: presentation only (aim height)
      fly: !!(m.flags[i] & F_FLY), crit, arch: t.arch });
    this._hit(t, i, dmg * this._mult(t, i), true);
    const ab = t.ability;
    if (ab === 'splash') {
      const cx = m.x[i], cz = m.z[i];
      const hits = []; this._query(cx, cz, 1.05, (j) => { if (j !== i) hits.push(j); });
      for (const j of hits) if (m.alive[j]) this._hit(t, j, dmg * 0.5 * this._mult(t, j), false, 'splash');
      this.events.push({ t: 'splash', x: cx, z: cz, el: t.el });
    } else if (ab === 'chain') {
      let cur = i, amt = dmg * 0.7; const done = new Set([i]); const pts = [[m.x[i], m.z[i]]];
      for (let h = 0; h < 3; h++) {
        let nx = -1, nd = 1e9; const cx = m.x[cur], cz = m.z[cur];
        this._query(cx, cz, 1.8, (j) => { if (done.has(j)) return; const d = (m.x[j] - cx) ** 2 + (m.z[j] - cz) ** 2; if (d < nd) { nd = d; nx = j; } });
        if (nx < 0) break;
        done.add(nx); pts.push([m.x[nx], m.z[nx]]);
        this._hit(t, nx, amt * this._mult(t, nx), false, 'chain'); amt *= 0.7; cur = nx;
      }
      if (pts.length > 1) this.events.push({ t: 'chain', pts, el: t.el });
    } else if (ab === 'pierce') {
      const ux = m.x[i] - t.x, uz = m.z[i] - t.z, L = Math.hypot(ux, uz) || 1, dx = ux / L, dz = uz / L;
      const ex = t.x + dx * (L + 2), ez = t.z + dz * (L + 2);
      const cand = [];
      this._query((t.x + ex) / 2, (t.z + ez) / 2, (L + 2) / 2 + 0.4, (j) => { if (j === i) return;
        const px = m.x[j] - t.x, pz = m.z[j] - t.z, along = px * dx + pz * dz; if (along < 0 || along > L + 2) return;
        const perp = Math.abs(px * dz - pz * dx); if (perp < 0.4) cand.push([along, j]); });
      cand.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      for (let c = 0; c < Math.min(3, cand.length); c++) { const j = cand[c][1]; if (m.alive[j]) this._hit(t, j, dmg * 0.8 * this._mult(t, j), false, 'pierce'); }
      this.events.push({ t: 'pierce', x: t.x, z: t.z, ex, ez, el: t.el });
    }
  }
  _hit(t, i, amount, primary, via) {
    const m = this.m;
    if (!m.alive[i]) return;
    const ab = t.ability;
    if (primary || ab === 'splash' || ab === 'chain' || ab === 'pierce') {
      if (ab === 'slow') m.slowT[i] = 2;
      if (ab === 'burn') { m.burnT[i] = 3; m.burnDps[i] = Math.max(m.burnDps[i], t.dmg * t.rate * 0.35); m.burnSrc[i] = t.id; }
      if (ab === 'shred') m.shredT[i] = 4;
    }
    // shield first (Iron +50%), then armor (Void ignores; shred -4)
    let dmg = amount;
    if (m.shield[i] > 0) {
      const sd = dmg * (t.el === 'iron' ? 1.5 : 1);
      if (sd <= m.shield[i]) { m.shield[i] -= sd; this._credit(t, sd, via); m.hitT[i] = 0.12; return; }
      const used = m.shield[i]; m.shield[i] = 0; dmg = (sd - used) / (t.el === 'iron' ? 1.5 : 1);
      this._credit(t, used, via);
      this.events.push({ t: 'shieldBreak', x: m.x[i], z: m.z[i] });
    }
    if (t.el !== 'void') {
      const armor = Math.max(0, m.armor[i] - (m.shredT[i] > 0 ? 4 : 0));
      dmg = Math.max(dmg * 0.2, dmg - armor);
    }
    this._damageRaw(i, dmg, t, via);
  }
  _credit(t, d, via) {
    if (!t) return;
    t.dmgDone += d; this.stats.dmgByElement[t.el] += d;
    const k = via || t.ability || 'base'; this.stats.dmgByAbility[k] = (this.stats.dmgByAbility[k] || 0) + d;
  }
  _damageRaw(i, dmg, t, via) {
    const m = this.m;
    if (!t && via === 'burn') t = this.towerById.get(m.burnSrc[i]) || null;
    const d = Math.min(dmg, m.hp[i]);
    m.hp[i] -= dmg; m.hitT[i] = 0.12;
    this._credit(t, d, via);
    if (m.hp[i] <= 0) this._kill(i, t);
  }
  _telegraph(i, kind) {
    const m = this.m;
    this.telegraphs.push({ i, gen: m.gen[i], kind, t: 2.0, x: m.x[i], z: m.z[i] });
    this.events.push({ t: 'telegraph', kind, i, x: m.x[i], z: m.z[i], dur: 2.0 });
  }
  _resolveTelegraph(tg) {
    const m = this.m, i = tg.i;
    if (!m.alive[i] || m.gen[i] !== tg.gen) return;
    if (tg.kind === 'summon') {
      m.shield[i] = m.maxShield[i] = m.maxHp[i] * 0.2;
      for (let k = 0; k < 12; k++) { const j = this.spawn('skitter', null, -1, m.tile[i], m.x[i] + Math.cos(k) * 0.4, m.z[i] + Math.sin(k) * 0.4); if (j >= 0) m.lane[j] = ((k % 5) - 2) * 0.12; }
      this.events.push({ t: 'bossPhase', phase: 2, x: m.x[i], z: m.z[i] });
    } else {
      m.enrage[i] = 1.6; m.armor[i] += 4;
      this.events.push({ t: 'bossPhase', phase: 3, x: m.x[i], z: m.z[i] });
    }
  }

  // ------------------------------------------------ helpers for harness / UI
  drainEvents() { const e = this.events; this.events = []; return e; }
  hash() {
    const m = this.m; let h = 2166136261 >>> 0;
    const mix = (v) => { h = Math.imul(h ^ (v | 0), 16777619) >>> 0; };
    mix(this.tick); mix(this.player.gold); mix(this.player.lives); mix(this.alive); mix(this.waveIdx); mix(this.player.score);
    for (let i = 0; i < CAP; i++) if (m.alive[i]) { mix(i); mix(m.x[i] * 1000); mix(m.z[i] * 1000); mix(m.hp[i] * 100); mix(m.shield[i] * 100); }
    for (const t of this.towers) { mix(t.id); mix(t.tier); mix(ELEMENTS.indexOf(t.el)); mix(ABILITIES.indexOf(t.ability)); mix(t.dmgDone); }
    return h.toString(16);
  }
  towerCount() { return this.towers.length; }
}

const API = { TUNE, Sim, Rng, TICK_HZ, DT, W, H, ELEMENTS, ARCHES, TIERS, ABILITIES, ABILITY_INFO, NAMES, MT, MT_KEYS, WAVES, COST,
  F_FLY, F_BOSS, F_ELITE, F_FRENZY, F_SPLIT, CAP, TIER_DMG, ARCH };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.AH = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
