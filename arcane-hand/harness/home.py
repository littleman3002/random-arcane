# Gameplay-zoom frames (what a player sees on load): python3 harness/home.py <outprefix> [quality]
# Places a lineup of towers, runs the bot into wave 3, then shoots the home view on phone and desktop.
import sys, os, pathlib, json
from playwright.sync_api import sync_playwright
R = pathlib.Path(__file__).resolve().parent.parent; THREE = (R/'node_modules/three/build/three.min.js').read_bytes()
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/home'; Qy = sys.argv[2] if len(sys.argv) > 2 else 'medium'
def route(r):
    u = r.request.url
    if 'three.min.js' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    return r.abort() if 'fonts.g' in u else r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    errs = []
    for name, vw, vh, mob in [('phone', 390, 844, True), ('desktop', 1366, 768, False)]:
        ctx = b.new_context(viewport={'width': vw, 'height': vh}, is_mobile=mob, has_touch=mob, device_scale_factor=2 if mob else 1)
        pg = ctx.new_page(); pg.route('**/*', route); pg.set_default_timeout(240000)
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('CONSOLE ' + m.text[:300]) if m.type == 'error' and 'ERR_FAILED' not in m.text else None)
        pg.add_init_script(f"localStorage.setItem('ah.settings.v1', JSON.stringify({{quality:'{Qy}'}}))")
        pg.goto(f'file://{R}/dist/index.html?seed=42&test'); pg.wait_for_timeout(800)
        pg.evaluate("""(()=>{ const s=__ah.sim, E=AH.ELEMENTS, A=AH.ARCHES, AB=AH.ABILITIES;
          const spots=[[4,2],[5,2],[6,2],[8,3],[9,3],[13,2],[14,3],[16,2],[4,5],[6,6],[9,5],[13,6],[15,5],[17,6]];
          spots.forEach(([x,z],k)=>{ s.offer={el:E[k%6], arch:A[k%4], tier:k%5, ability:k%3?AB[k%8]:null, paid:0}; s.apply({type:'place',owner:0,tx:x,tz:z}); });
          s.player.gold = 99999; })()""")
        pg.evaluate("__ah.act({type:'startWave'})"); pg.evaluate("__ah.step(30*14)")
        pg.evaluate("__ah.camHome()")
        for _ in range(4): pg.evaluate("__ah.render(1/30)")
        pg.screenshot(path=f'{OUT}_{name}.png')
        ctx.close()
    print(json.dumps({'errs': errs}))
    b.close()
