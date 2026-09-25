# REVIEW rubric — Arcane Hand visual/UX polish loop

Assembled from the locked standards in 1_TECHNICAL_SPINE.md, 2_GAMEPLAY_DESIGN.md and 3_ART_DIRECTION.md.
Each checkpoint frame is graded Pass / Minor / Fail per item. A round is **clean** when no item is Fail
and no Minor is something a player would notice in normal play. Stop after two consecutive clean rounds.

## A. Readability (art direction: readability over fidelity)
A1  Every enemy type is distinguishable from terrain AND from towers by silhouette, not only colour.
A2  Towers read by element (shape language + colour) and rarity (plinth structure + gem count), not colour alone.
A3  Flyers read as airborne (altitude + detached shadow).
A4  Boss telegraphs are unmistakable and always drawn on top.
A5  Status effects (slow, burn, shield, elite ward/frenzy) are visible on the unit.
A6  Effects never hide enemies or lanes (cosmetic effects are cut first under load).

## B. Framing and UI
B1  The whole plot (portal to vault) is visible at the home view with no UI covering lanes.
B2  No text clips, wraps awkwardly, or overlaps other UI at 1366x768, 1920x1080 and 390x844.
B3  Toasts and banners never cover the active lane for longer than a moment.
B4  Every action shows its cost before you commit; disabled actions say why (tooltip/copy).
B5  The camera can always return home in one click.

## C. Game feel
C1  Merge result is a visible moment: where the sacrifice came from, what appeared, rarity of the result.
C2  Roll, place, enchant and wave start each have clear feedback.
C3  No previews of random outcomes anywhere (design rule).

## D. Integrity
D1  No console/page errors (fonts blocked in the test env are expected and excluded).
D2  Presentation changes never change simulation outcomes (same seed ⇒ same final score).
D3  Harness frames reflect live play (no time-compression artifacts).

## E. Fidelity against the locked target ("one step above Warcraft III")
Added after the first published build passed A–D "clean" while looking far below the target. A–D check
readability and bugs; they never asked whether the frame looks like the game we promised. E does.
Reference traits of Warcraft III (judged in words; no copyrighted imagery used): continuous terrain with
blended ground textures and doodads; multi-part animated units with readable anatomy; architectural buildings
with materials; spell effects that glow; a readable top-down camera.
E1  Terrain is continuous and textured (blended grass/dirt/rock/riverbed); no visible box tiles outside placement mode.
E2  Every creature is a multi-part model with animation (gait, arms, wings, crawl) and readable anatomy at close zoom.
E3  Towers are architecture with materials (stone, wood, metal, glass, glow) and rarity visibly escalates structure.
E4  Lighting has depth: real-time shadows on medium/high, sky-lit materials, tone mapping and grading.
E5  Effects glow (bloom on medium/high) and each element has its own projectile/impact identity.
E6  "One step above": at least two things Warcraft III did not have (e.g. real-time soft shadows, HDR bloom,
    PBR materials with sky reflections, shader water with glints and foam) while E1–E5 hold.
E7  Low tier keeps E1–E3 and E5 minus bloom; it may drop shadows and post, never unit readability.
Honest ceiling: hand-painted texture art and rigged character animation are authored-asset work;
procedural generation approaches but does not replace them.
