# Arcane Hand: Horde Defense — build log (vertical-slice prototype)

## Decisions
- Browser prototype (Three.js r128 + deterministic JS sim) because Godot/Unity can't run in this environment. The sim has zero rendering/DOM code, so it can move to the chosen engine; presentation only reads state and writes via validated, owner-scoped `sim.apply()`.
- 30 Hz fixed tick (lowest candidate that felt right; sim cost is tiny), render interpolation, bounded catch-up (8 steps, overruns counted), separate RNG streams (roll/merge/ability/wave/combat) plus a cosmetic-only stream.
- Navigation: reverse-BFS distance field from the vault with cached next-tile flow; per-monster lane offsets instead of pairwise separation; 1 Hz stuck detection with documented snap recovery (0 recoveries observed).
- Flying is soft: most towers deal 60% to flyers; Storm towers and the Skyward ability hit fully.

## Balance loop (24 identical seeds; one change at a time)
| change | basic-bot win | avg wave | kept |
|---|---|---|---|
| baseline | 0% | 7.7 | — |
| kill rewards x1.5 | 0% | 8.3 | yes (merges 3.2→7.5) |
| roll price step 4→2 | 0% | 9.2 | yes |
| wave-9 trolls not elite (were 364 of lives lost) | 0% | 9.9 | yes |
| boss base HP 4200→1800 | 54% | 9.9 | yes |
Rejected: hp-growth curve, wave bonus x2, boss armor 5→2 (each weaker or no win-rate gain).
Random-action bot: 0% (dies wave 2). No element above 23% of total damage.

## Measurements (container: 1 vCPU Xeon 2.1 GHz — reference $500 laptop UNVERIFIED)
Sim tick avg/p99 ms: 250u 0.04/0.06 · 1000u 0.13/0.28 · 5000u 0.60/0.78 (varies ±50% run to run).
1000 units: 73 draw calls, instanced. Heap flat over 12 runs (growth 0.1 MB).
On-device FPS: UNVERIFIED (only a CPU software rasterizer here, ~4 fps, not representative).

## Visual polish rounds (seed 42 checkpoints unless noted; graded vs REVIEW.md)
- R0: black instanced meshes (r128 sizes instanceColor from .count) → full-capacity buffers; sRGB wash-out removed; dark death puffs → light dust; harness flooded frames with stale events → drains like live play.
- R1: camera fitted to UI-free area (boss was hidden under dock); bulwarks bronze shells (grey boxes read as Iron towers); compact scoreboard; enemy eyes 96→8 tris (~190k tris saved at 1000 units).
- R2: lighting down (neon grass); stronger build-tile glow; toasts off the lanes.
- R3/R4: merge moment payoff — light pillar in result rarity colour + streak from the consumed tower.
- R5: phone 390x844 — distance-scaled fog, portrait camera rotated 90°, compact dock/scoreboard. (Phone is door-open only, not a target.)
- R6 clean (1366x768 + 1920x1080). R7 adversarial clean (seed 101, 1024x768, victory path). Stopped after two clean rounds.
Every round kept the identical final score on seed 42 (50,906): presentation never touched the sim.

## Open items
- Status tints (slow/burn) not verified at default zoom; A5 unconfirmed.
- Reviews done by the building assistant in separate passes, not independent reviewers.
- Real-hardware profiling, save/load of an in-progress run, audio, co-op networking: not started.

## Fidelity rebuild (after user review: "about six steps down from Warcraft III")
Root cause: the polish rubric (REVIEW A–D) graded readability and bugs, never fidelity against the locked
target, so primitive art passed seven "clean" rounds. Added REVIEW section E. Simulation untouched
(25/25 tests; same seed-42 final score 50,906 before and after).
- World: continuous heightfield terrain, height-aware splat of 4 procedural textures, carved path and river
  channel, shader water (depth tint, ripples, fresnel, sun glint, bank foam), 3 tree species x2, rocks,
  mushrooms, flowers, wind-swayed grass cards, stone plot wall, plank bridges, portal arch + vortex, vault.
- Creatures: 9 multi-part models, limb-tagged; walk/crawl/flap/arm-swing/tail/death animated in the vertex
  shader (GPU), 2 LODs each. Glow driven by base colour, not by status/hit tint.
- Towers: element architecture, rarity escalation (wood platform → stone → banners → rune ring → gilded crown),
  archetype weapons, ability props; static parts baked per parent+material (338 → 180 draws with 18 towers, low).
- Lighting/post: linear workflow, sky PMREM image-based light, sun shadows (2048 medium / 4096 high),
  HDR target + 2-level bloom + ACES + grade + vignette on medium/high; low renders direct with calibrated exposure.
- Effects: two instanced billboard particle systems; per-element projectiles, trails, impacts, lightning,
  dust, souls, merge spiral, ambient emitters; cut first under load.
Bugs found by the loop: env map written unencoded into PMREM's RGBE target (all lit surfaces black);
low tier 2.8x overexposed (three's ACES /0.6 vs post x0.6); crowd LOD kept ~700 units at full detail
(1.46M → 564k tris at 1,000 units on low, 31 draws); telegraph harness artifact; a comment that ate a brace.
Measured (container, CPU rasterizer; real-GPU frame rate UNVERIFIED): 1,000 units low 564k tris / 31 draws,
medium 677k / 54 draws.

## Close-camera quality push ("2.5x"; user: ~300 on screen at gameplay zoom, 1,000 only zoomed out)
- Camera: gameplay zoom default (pitch 37°→57° with distance), damped motion, Overview toggle (O), focus centred
  between HUD and dock via projection view offset, shadow frustum follows the camera, clickable minimap.
- Creatures rebuilt (3–7k tris near / 0.4–1.3k far): anatomy detail, per-part roughness/metal, rim light, hit
  flinch, idle breathing, real shadows on medium+; per-unit frustum culling; full detail capped at 300.
- Towers: element rune circles, lit windows, pulsing lava cracks, cloth-wave banners, muzzle flashes, rim light.
- World: blended-height bump relief, riverbed caustics, path-edge pebbles, butterflies, pollen, falling leaves,
  birds (overview only), tilt-shift depth of field at gameplay zoom.
Found by the loop: status tints bloomed pale creatures to white; dock hid the bottom lane (fixed by view offset);
creature crowd drew off-screen units; harness left frozen corpses during bulk steps (frames overstated density —
redone); birds clipped the lens at low camera heights; phone gameplay zoom too tight; boss too small / too pale.
Measured (container CPU rasterizer; real-GPU frame rate UNVERIFIED): typical wave (~100 alive) ~0.2–0.7M tris;
1,000-unit stress at gameplay zoom 3.37M tris / 72 draws medium. Simulation untouched: seed-42 final score 50,906.

## Dusk overhaul + WC3-style camera + panel click fix
- Research: Clearwater (MIT) water shading adapted; three-stylized (MIT) blade grass ported to r128; WC3 camera
  fields/tricks (Hive Workshop) as the camera spec; XMorph Defense as the fidelity/min-spec benchmark. See CREDITS.md.
- Atmosphere: dusk sky shared by dome, IBL, mountains and water; twin moons, stars, aurora, cloud banks; horizon forest.
- Ground: ~60k instanced blades (medium), flattened under towers; wet mud with sky-reflecting puddles.
- River/bridges: refraction onto pebble bed, absorption, glints, specks, pier foam + wakes, shadows; extruded stone
  arch bridges (merged per material), instanced lantern crystals; walkers follow the deck arch.
- Camera: orbit/tilt to near eye level, focus rises to unit height, FOV widens when low, ground/water/tower collision,
  follow (double-click), Action Cam (C), trauma shake, Space = latest alert.
- Close-up: dissolve deaths, firing recoil/flare, Aether Core vault, portal runestones.
- UI bug (user report): tower panel was rebuilt via innerHTML 10x/s -> lost clicks, flicker, Drop landing under a
  spam-clicked Merge. Now built once per selection with fixed slots, in-place updates, Drop/Sell confirm, post-change
  guard; merge selects its result before the refresh (the hidden-panel gap sent clicks to the map and deselected).
  Verified: 14/14 real mouse clicks land; chain Normal->Legendary 4/4 merges, 0 accidental drops/sells (2 runs).
Bugs caught by the loop: water shader compile failure ("11.5.0") invisible to the harness until it listened for
console errors (it does now); low-tier exposure; bridges ~200 draws -> merged.
Integrity: full 10-checkpoint run (low tier) — no errors, seed-42 final score 50,906; 25/25 rules tests.

## Scale + fidelity pass ("you have to be super zoomed in to see anything")
User asks: everything bigger (creatures, towers, map), creatures ~1/4 of a tower instead of ~1/10, taller/wider towers
with a gap between neighbours (hard to tap on a phone), far more detailed "custom" creatures and towers, bigger and
better projectiles, easier camera rotation. Simulation untouched: 25/25 rules tests; seed-42 checkpoint run final score
50,906 (same as before); headless seed-42 BasicBot run identical before/after. The only sim edit is a presentation-only
`i` field on the `shot` event (aim height).
- Scale: towers ~1.5x taller with chunkier bodies, footprint cut from 1.1 tiles (neighbours touched) to 0.86 tiles.
  Creatures authored at world size, ~2x larger (Grub 0.74 tall, Troll 1.54, Boss 3.4). Default camera much closer:
  about 6-7 tiles across on a phone (was the whole plot), about 13 on desktop. Overview (O / "All") still shows everything.
- Creatures rebuilt (9 models): two-tone procedural surface patterns baked per part (stripes, spots, scales, belly
  tone, glowing veins, mottle, ribs, hot tips, petals) with fine grain noise; new animation tags (antennae, orbiting
  shards, floating pods, billowing cape). Gloomgrub, Skitterling, Cinder Hound, Ironback, Moss Troll, Moonmoth Wisp,
  Warded Knight, Bloomling, Vault Breaker. Near LOD ~4.5-15k tris, far LOD ~1-3k; full detail capped at 180 units.
- Towers rebuilt: Magma Spire (buttresses, lava channels, horned brazier), Tidecaller lighthouse (arched windows,
  balcony, waterfalls, coral crown), Elder treant (twisted trunk, roots, treehouse, flowering vines, lantern fruit),
  Obsidian monolith (levitating segments, counter-rotating rune rings, an eye that tracks targets), Tempest coil
  (copper coils, ceramic insulators, pipes, spinning gear, caged storm orb), Bastion keep (buttresses, hoarding,
  heraldic shields, door, flag). Rarity: plinth steps, corner lanterns / braziers / gilded obelisks, banners at the
  back, floating rune ring, crown and halo. Weapons per archetype (crossbow, ballista, gatling, cannon; focus crystal,
  lens lance, spinning tri-emitter, mortar). Ability props on a post at the front corner. Small multi-colour parts
  merge into one "kit" mesh per moving group (per-vertex colour, roughness, metalness, glow), so draw calls barely
  moved (+1 per tower).
- Projectiles: real 3D models flying nose-first — fireball, magma boulder, ice lance, droplet, water orb, thorn
  spear, seed pod, void shard, void orb, arrow/ballista bolt, cannonball — with larger trails (smoke, sparkles,
  leaves), shockwave impacts for heavies, thicker branching lightning.
- Input: towers are picked by a ray against each tower's column (tall towers cover the tile behind them; the old
  tile pick selected the wrong tower for a tap on the body: 0/23 vs 19/23 in harness/taptest.py, the rest being
  towers genuinely hidden behind nearer ones). Camera pad (bottom right, right edge on phones): tap to turn 45° or
  tilt a notch, hold to keep going. Two-finger sideways swipe rotates on touch; Shift+drag, Shift+wheel and a
  sideways trackpad scroll rotate on desktop. Phone scoreboard no longer overlaps the camera buttons.
- New harness tools: home.py (gameplay-zoom frames, phone + desktop), portraits.py (creature contact sheet),
  combat.py (projectiles in flight), taptest.py (tap selection).
Measured (container CPU rasterizer; real-GPU frame rate UNVERIFIED): checkpoint 07 (wave 8, 26 towers) 700 draws /
1.4M tris medium. 1,000-unit stress with 36 towers at gameplay zoom: 657 draws / 4.7M tris low (was 620 / 2.7M).
