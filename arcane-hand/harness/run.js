// Headless harness: rule tests, determinism, navigation, balance batches, simulation perf, memory.
// Usage: node --expose-gc harness/run.js [tests|balance|perf|memory|all]
const A = require('../src/sim.js');
const { BasicBot, RandomBot, StressBot } = require('./bots.js');
const out = { tests: [], balance: null, perf: null, memory: null };
const mode = process.argv[2] || 'all';
const T = (name, ok, detail) => { out.tests.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

function playRun(seed, BotCls, maxMin = 40, onTick) {
  const s = new A.Sim({ seed });
  const bot = new BotCls(s, seed);
  const maxT = maxMin * 60 * 30;
  while (s.tick < maxT && s.phase !== 'victory' && s.phase !== 'defeat') {
    bot.act(s.tick); s.step(); s.drainEvents(); if (onTick) onTick(s);
  }
  return { s, bot };
}

function tests() {
  // --- owner scope
  { const s = new A.Sim({ seed: 1 });
    const r = s.apply({ type: 'roll', owner: 1 });
    T('cross-plot action is rejected by the simulation', !r.ok && s.player.rolls === 0, r.reason); }
  { const s = new A.Sim({ seed: 1 }); s.apply({ type: 'roll', owner: 0 });
    s.apply({ type: 'place', owner: 0, tx: 5, tz: 2 }); const id = s.towers[0].id;
    s.towers[0].owner = 1;  // pretend another player's tower
    const r = s.apply({ type: 'sellTower', owner: 0, id });
    T('cannot touch a tower owned by another player', !r.ok, r.reason); }

  // --- placement validity
  { const s = new A.Sim({ seed: 2 }); s.apply({ type: 'roll', owner: 0 });
    const onPath = s.apply({ type: 'place', owner: 0, tx: 5, tz: 1 });
    const onRiver = s.apply({ type: 'place', owner: 0, tx: 11, tz: 2 });
    const ok = s.apply({ type: 'place', owner: 0, tx: 5, tz: 2 });
    T('placement rejects path and river, accepts build tile', !onPath.ok && !onRiver.ok && ok.ok); }

  // --- merge rules
  const mk = (s, x, z, tier, el = 'ember', arch = 'bolt', ability = null) => { s.offer = { el, arch, tier, ability, paid: 50 }; return s.apply({ type: 'place', owner: 0, tx: x, tz: z }).id; };
  { let neverHigher = true, alwaysUp = true, noPreviewPool = new Set();
    for (let seed = 1; seed <= 200; seed++) {
      const s = new A.Sim({ seed }); s.player.gold = 99999;
      const a = mk(s, 3, 2, 0), b = mk(s, 4, 2, 0), leg = mk(s, 5, 2, 4), sup = mk(s, 6, 2, 2);
      const r = s.apply({ type: 'merge', owner: 0, id: a });
      if (!r.ok) { alwaysUp = false; continue; }
      if (r.consumed !== b) neverHigher = false;
      if (!s.towers.find(t => t.id === leg) || !s.towers.find(t => t.id === sup)) neverHigher = false;
      const nt = s.towers.find(t => t.id === r.id); if (nt.tier !== 1) alwaysUp = false;
      noPreviewPool.add(nt.el + nt.arch);
    }
    T('merge consumes only a same-tier tower (never a higher tier)', neverHigher);
    T('base merge always yields exactly +1 tier', alwaysUp, `result variety seen: ${noPreviewPool.size}`);
  }
  { let min1 = true, hits = 0, n = 2000, placedAtClicked = true;
    for (let seed = 1; seed <= n; seed++) {
      const s = new A.Sim({ seed }); s.player.gold = 99999;
      const a = mk(s, 3, 2, 0, 'tide'), b = mk(s, 4, 2, 0, 'iron');
      const r = s.apply({ type: 'merge', owner: 0, id: a, gamble: true });
      const nt = s.towers.find(t => t.id === r.id);
      if (!nt || nt.tier < 1) min1 = false; if (nt && nt.tier === 2) hits++;
      if (nt && (nt.tx !== 3 || nt.tz !== 2)) placedAtClicked = false;
    }
    T('push-your-luck miss still gives the guaranteed +1', min1);
    T('push-your-luck hit rate ≈ 10%', Math.abs(hits / n - 0.10) < 0.02, `${(100 * hits / n).toFixed(1)}% over ${n}`);
    T('merged tower appears where the clicked tower was', placedAtClicked);
  }
  { const s = new A.Sim({ seed: 3 }); s.player.gold = 99999;
    const a = mk(s, 3, 2, 0), b = mk(s, 4, 2, 0); s.towers.find(t => t.id === b).locked = true;
    const r = s.apply({ type: 'merge', owner: 0, id: a });
    T('locked towers are never used as the random sacrifice', !r.ok, r.reason); }
  { // ability inheritance: none/none -> none, one -> lost, both -> fresh
    const cases = [[null, null, 'none'], ['slow', null, 'none'], [null, 'burn', 'none'], ['slow', 'burn', 'some']];
    let ok = true; const fresh = new Set();
    for (const [x, y, want] of cases) for (let seed = 1; seed <= 60; seed++) {
      const s = new A.Sim({ seed }); s.player.gold = 99999;
      const a = mk(s, 3, 2, 1, 'ember', 'bolt', x); mk(s, 4, 2, 1, 'grove', 'rapid', y);
      const r = s.apply({ type: 'merge', owner: 0, id: a }); const nt = s.towers.find(t => t.id === r.id);
      if (want === 'none' && nt.ability) ok = false;
      if (want === 'some') { if (!nt.ability) ok = false; else fresh.add(nt.ability); }
    }
    T('ability inheritance follows the four merge cases', ok, `fresh abilities seen when both had one: ${fresh.size}/8`);
  }
  { // add-ability: random targets only open slots; targeted respects choice; costs escalate per player
    const s = new A.Sim({ seed: 5 }); s.player.gold = 99999;
    const full = mk(s, 3, 2, 0, 'ember', 'bolt', 'slow'); const open = mk(s, 4, 2, 0);
    const c0 = s.player.gold; const r = s.apply({ type: 'addAbilityRandom', owner: 0 });
    const paid1 = c0 - s.player.gold;
    s.apply({ type: 'dropAbility', owner: 0, id: open }); const c1 = s.player.gold; s.apply({ type: 'addAbilityRandom', owner: 0 });
    const paid2 = c1 - s.player.gold;
    T('random enchant lands only on a tower with an open slot', r.ok && r.id === open);
    T('random enchant cost escalates (100 → 125)', paid1 === 100 && paid2 === 125, `${paid1}, ${paid2}`);
    const rt = s.apply({ type: 'addAbilityTarget', owner: 0, id: full });
    T('chosen-tower enchant refuses a tower that already has an ability', !rt.ok, rt.reason);
    s.apply({ type: 'dropAbility', owner: 0, id: full }); const c2 = s.player.gold;
    const rt2 = s.apply({ type: 'addAbilityTarget', owner: 0, id: full });
    T('chosen-tower enchant costs 500 and hits the chosen tower', rt2.ok && rt2.id === full && c2 - s.player.gold === 500);
    const one = s.towers.find(t => t.id === full); T('one ability per tower, ever', typeof one.ability === 'string');
  }

  // --- determinism across frame pacing (render rate must never change outcomes)
  { const seed = 42; const ref = playRun(seed, BasicBot, 12); const log = ref.bot.log;
    const replay = (frameDt, jitter) => {
      const s = new A.Sim({ seed }); let acc = 0, li = 0, f = 0; const cp = {};
      while (s.tick < ref.s.tick) {
        const dt = frameDt * (jitter ? (0.5 + ((f++ * 2654435761) >>> 0) % 1000 / 1000) : 1);
        acc += dt;
        while (acc >= A.DT && s.tick < ref.s.tick) {
          while (li < log.length && log[li][0] === s.tick) s.apply(log[li++][1]);
          s.step(); s.drainEvents(); acc -= A.DT;
          if (s.tick % 1800 === 0) cp[s.tick] = s.hash();
        }
      }
      cp.final = s.hash(); return cp;
    };
    const h30 = replay(1 / 30), h60 = replay(1 / 60), h144 = replay(1 / 144), hj = replay(1 / 50, true), head = replay(1);
    const same = JSON.stringify(h30) === JSON.stringify(h60) && JSON.stringify(h60) === JSON.stringify(h144) && JSON.stringify(h144) === JSON.stringify(hj) && JSON.stringify(hj) === JSON.stringify(head);
    T('identical outcome at 30/60/144/jittered/headless frame pacing', same, `${Object.keys(h30).length} checkpoints, final ${h30.final}`);
  }

  // --- restart resets authoritative state
  { const a = new A.Sim({ seed: 9 }); const b = new BasicBot(a, 9); for (let i = 0; i < 9000; i++) { b.act(a.tick); a.step(); } a.reset(); const fresh = new A.Sim({ seed: 9 });
    T('restart fully resets authoritative state', a.hash() === fresh.hash() && a.towers.length === 0 && a.player.gold === 250); }

  // --- navigation: every spawned monster is accounted for; nobody gets lost
  { let okAll = true, recov = 0, detail = [];
    for (const seed of [1, 2, 3, 4, 5]) {
      const { s } = playRun(seed, BasicBot, 40);
      const p = s.player, alive = s.alive;
      const deaths = s.stats.spawned - p.leaked - alive;
      recov += s.stats.navRecoveries;
      if (deaths < 0 || p.kills !== deaths) { okAll = false; detail.push(`seed ${seed}: spawned ${s.stats.spawned} kills ${p.kills} leaked ${p.leaked} alive ${alive}`); }
    }
    T('every spawned monster dies or reaches the vault (5 full runs)', okAll, detail.join('; '));
    T('no stuck-monster recoveries needed in normal play', recov === 0, `recoveries: ${recov}`); }
  { const s = new A.Sim({ seed: 3, stress: 1000 }); for (let i = 0; i < 30 * 90; i++) s.step();
    T('1,000-unit crowd flows for 90s with no lost monsters', s.stats.navRecoveries === 0 && s.alive === 1000, `alive ${s.alive}, recoveries ${s.stats.navRecoveries}`); }
  { // slow never permanently breaks navigation
    const s = new A.Sim({ seed: 3, stress: 400 }); new StressBot(s, 3).setup();
    for (const t of s.towers) t.ability = 'slow'; for (let i = 0; i < 30 * 120; i++) s.step();
    T('heavy slowing never strands monsters', s.stats.navRecoveries === 0, `recoveries ${s.stats.navRecoveries}`); }
  { // boss enters and completes every phase
    let phases = new Set(), killed = false;
    const s = new A.Sim({ seed: 11 }); s.waveIdx = 9; s.player.lives = 999;
    // a mid-strength Superior/Special board, so the test exercises boss mechanics rather than balance
    const tiles = require('./bots.js').buildTiles(s).sort((p, q) => require('./bots.js').coverage(s, q[0], q[1], 3) - require('./bots.js').coverage(s, p[0], p[1], 3)).slice(0, 18);
    tiles.forEach(([x, z], k) => { s.offer = { el: A.ELEMENTS[k % 6], arch: A.ARCHES[k % 4], tier: 2 + (k % 2), ability: A.ABILITIES[k % 8], paid: 0 }; s.apply({ type: 'place', owner: 0, tx: x, tz: z }); });
    for (let i = 0; i < 30 * 60 * 12 && s.phase !== 'victory' && s.phase !== 'defeat'; i++) { s.step();
      for (const e of s.drainEvents()) { if (e.t === 'telegraph') phases.add(e.kind); if (e.t === 'death' && e.boss) killed = true; } }
    T('boss telegraphs both phase changes', phases.has('summon') && phases.has('enrage'), [...phases].join(', '));
    T('boss can be defeated and the run reaches victory', killed && s.phase === 'victory', s.phase);
  }
  // --- random legal player: no exceptions, no soft locks, invariants hold
  { let crashes = 0, softlock = 0, neg = 0, rej = 0;
    for (let seed = 1; seed <= 12; seed++) {
      try { const { s, bot } = playRun(seed, RandomBot, 30, (s) => { if (s.player.gold < 0) neg++; }); rej += bot.rejects;
        if (s.phase === 'build' && s.countdown > 60) softlock++; }
      catch (e) { crashes++; console.log(e); }
    }
    T('random legal player: no crashes across 12 runs', crashes === 0);
    T('random legal player: gold never negative, no soft locks', neg === 0 && softlock === 0, `${rej} invalid actions correctly rejected`);
  }
}

function balance(n = 24) {
  const agg = (Bot) => {
    let wins = 0, waves = 0, leaks = 0, gambles = 0, merges = 0, ms = 0; const el = {}, ab = {}; const defeatAt = {};
    for (let seed = 100; seed < 100 + n; seed++) {
      const { s } = playRun(seed, Bot, 40);
      if (s.phase === 'victory') wins++; else defeatAt[s.waveIdx] = (defeatAt[s.waveIdx] || 0) + 1;
      waves += s.waveIdx; leaks += s.player.leaked; merges += s.player.merges; gambles += s.player.gambles;
      for (const k in s.stats.dmgByElement) el[k] = (el[k] || 0) + s.stats.dmgByElement[k];
      for (const k in s.stats.dmgByAbility) ab[k] = (ab[k] || 0) + s.stats.dmgByAbility[k];
      ms += s.tick / 30;
    }
    const tot = Object.values(el).reduce((a, b) => a + b, 0) || 1, tab = Object.values(ab).reduce((a, b) => a + b, 0) || 1;
    const pct = (o, t) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +(100 * v / t).toFixed(1)]));
    return { runs: n, winRate: +(wins / n).toFixed(2), avgWave: +(waves / n).toFixed(1), avgLeaks: +(leaks / n).toFixed(1),
      avgMerges: +(merges / n).toFixed(1), avgMinutes: +(ms / n / 60).toFixed(1), defeatAtWave: defeatAt, dmgShareByElement: pct(el, tot), dmgShareByAbility: pct(ab, tab) };
  };
  out.balance = { basic: agg(BasicBot), random: agg(RandomBot) };
  console.log(JSON.stringify(out.balance, null, 1));
}

function perf() {
  const res = {};
  for (const N of [250, 500, 1000, 2500, 5000]) {
    const s = new A.Sim({ seed: 7, stress: N }); new StressBot(s, 7).setup();
    for (let i = 0; i < 90; i++) s.step(); // warm up + fill
    const times = [];
    for (let i = 0; i < 900; i++) { const t0 = process.hrtime.bigint(); s.step(); s.drainEvents(); times.push(Number(process.hrtime.bigint() - t0) / 1e6); }
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    res[N] = { avgTickMs: +avg.toFixed(3), p99TickMs: +times[Math.floor(times.length * 0.99)].toFixed(3), maxTickMs: +times[times.length - 1].toFixed(3), alive: s.alive, towers: s.towers.length, recoveries: s.stats.navRecoveries };
    console.log(N, JSON.stringify(res[N]));
  }
  out.perf = res;
}

function memory() {
  const samples = [];
  for (let r = 0; r < 12; r++) {
    playRun(500 + r, BasicBot, 20);
    if (global.gc) global.gc();
    samples.push(+(process.memoryUsage().heapUsed / 1048576).toFixed(1));
  }
  const first = samples.slice(2, 5).reduce((a, b) => a + b) / 3, last = samples.slice(-3).reduce((a, b) => a + b) / 3;
  out.memory = { heapMBAfterEachRun: samples, growthMB: +(last - first).toFixed(1) };
  T('no continuous heap growth over 12 back-to-back runs', last - first < 5, `${samples.join(' → ')} MB`);
}

if (mode === 'tests' || mode === 'all') tests();
if (mode === 'balance' || mode === 'all') balance();
if (mode === 'perf' || mode === 'all') perf();
if (mode === 'memory' || mode === 'all') memory();
const fails = out.tests.filter(t => !t.ok).length;
require('fs').writeFileSync(`${__dirname}/../docs/harness_${mode}.json`, JSON.stringify(out, null, 1));
console.log(`\n${out.tests.length - fails}/${out.tests.length} tests passed`);
