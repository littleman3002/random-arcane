# Phone tap test: tap each tower on its body (not its base tile) and check the right one gets selected.
# Tall towers cover the tiles behind them, so picking by ground tile alone selects the wrong tower. Usage: python3 harness/taptest.py
import os, pathlib, json
from playwright.sync_api import sync_playwright
R = pathlib.Path(__file__).resolve().parent.parent; THREE = (R/'node_modules/three/build/three.min.js').read_bytes()
def route(r):
    u = r.request.url
    if 'three.min.js' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    return r.abort() if 'fonts.g' in u else r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    out = {}
    for name, vw, vh, mob in [('phone', 390, 844, True), ('desktop', 1366, 768, False)]:
        ctx = b.new_context(viewport={'width': vw, 'height': vh}, is_mobile=mob, has_touch=mob, device_scale_factor=2 if mob else 1)
        pg = ctx.new_page(); pg.route('**/*', route); pg.set_default_timeout(240000); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.add_init_script("localStorage.setItem('ah.settings.v1', JSON.stringify({quality:'low'}))")
        pg.goto(f'file://{R}/dist/index.html?seed=3&test'); pg.wait_for_timeout(800)
        ids = pg.evaluate("""(()=>{ const s=__ah.sim; const out=[]; for (const z of [2,5,8]) for (let x=4; x<=18; x+=2) { if (!s.canBuild(x,z)) continue;
            s.offer={el:AH.ELEMENTS[(x+z)%6], arch:AH.ARCHES[(x*3+z)%4], tier:(x+z)%5, ability:null, paid:0}; const r=s.apply({type:'place',owner:0,tx:x,tz:z}); if (r.ok) out.push(r.id); }
            __ah.camHome(); __ah.render(1/30); __ah.render(1/30); return out; })()""")
        ok = bad = skipped = 0; wrong = []; olds = []
        for tid in ids:
            x, y = pg.evaluate(f"(()=>{{ const t=__ah.sim.towers.find(t=>t.id==={tid}); return __ah.project(t.x, __ah.towerTop({tid}) * 0.62, t.z); }})()")
            if not (5 < x < vw - 5 and 5 < y < vh - 5) or pg.evaluate(f"document.elementFromPoint({x},{y})?.id") != 'view': skipped += 1; continue
            # only count towers whose body point is not hidden behind a nearer tower
            front = pg.evaluate(f"(()=>{{ const s=__ah.sim; __ah.select(null); return true; }})()")
            if mob: pg.touchscreen.tap(x, y)
            else: pg.mouse.click(x, y)
            pg.wait_for_timeout(60); pg.evaluate("__ah.render(1/30)")
            sel = pg.evaluate("__ah.ui.selected"); picked = pg.evaluate(f"__ah.pick({x},{y})"); old = pg.evaluate(f"__ah.pickOld({x},{y})"); olds.append(old == tid); pg.wait_for_timeout(520)
            if sel == tid: ok += 1
            else: bad += 1; wrong.append([tid, sel, picked])
        out[name] = {'towers': len(ids), 'tapped_ok': ok, 'wrong_or_none': bad, 'offscreen_or_under_ui': skipped, 'wrong': wrong[:10], 'old_tile_picking_would_be_right': sum(olds), 'errs': errs}
        ctx.close()
    print(json.dumps(out, indent=1))
    b.close()
