# Low-angle review frames: python3 harness/views.py <quality> <prefix> <steps>
import sys, pathlib, json
from playwright.sync_api import sync_playwright
R = pathlib.Path(__file__).resolve().parent.parent; THREE=(R/'node_modules/three/build/three.min.js').read_bytes()
q, pre, steps = sys.argv[1], sys.argv[2], int(sys.argv[3])
VIEWS = sys.argv[4] if len(sys.argv) > 4 else 'river,fight,horizon'
def route(r):
    u=r.request.url
    if 'three.min.js' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    return r.abort() if 'fonts.g' in u else r.continue_()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=__import__("os").environ.get("CHROME") or None, args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg=b.new_page(viewport={'width':1366,'height':768}); pg.route('**/*',route); pg.set_default_timeout(240000)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('CONSOLE '+m.text[:300]) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
    pg.add_init_script(f"localStorage.setItem('ah.settings.v1', JSON.stringify({{quality:'{q}'}}))")
    pg.goto(f'file://{R}/dist/index.html?seed=42&test'); pg.wait_for_timeout(800)
    pg.evaluate("__ah.setBot(true)"); pg.evaluate(f"__ah.step({steps})")
    pg.evaluate("document.querySelectorAll('#hud-top,#board,#cam,#dock,#pausebtn,#toasts').forEach(e=>e.style.visibility='hidden')")
    shots = {
      'river':   "__ah.camTo(11.5, 8.6, 4.2, 0.2, 0.35)",
      'fight':   "(()=>{ const s=__ah.sim, m=s.m; let best=-1,bx=0; for(let i=0;i<6144;i++) if(m.alive[i] && m.x[i]>bx && m.x[i]<18){bx=m.x[i];best=i;} if(best<0) return __ah.camTo(8,7,4,0.15,0.6); __ah.camTo(m.x[best], m.z[best], 3.6, 0.13, 0.7); })()",
      'horizon': "__ah.camTo(6, 9, 9, 0.12, 2.4)",
      'bridge':  "__ah.camTo(11.5, 4.5, 3.4, 0.18, 1.35)",
      'towers':  "__ah.camTo(6, 12.2, 4.2, 0.2, 0.2)",
      'vault':   "__ah.camTo(20.6, 11.4, 5.5, 0.22, 0.5)",
      'portal':  "__ah.camTo(-0.3, 1.8, 4.5, 0.2, -0.9)",
    }
    for name in VIEWS.split(','):
        pg.evaluate(shots[name])
        for _ in range(3): pg.evaluate("__ah.render(1/20)")
        pg.screenshot(path=f'{pre}_{name}.png')
    print(json.dumps({'errs': errs}))
    b.close()
