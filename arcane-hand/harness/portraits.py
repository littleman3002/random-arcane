# Creature portraits (3/4 front view, close), tiled into one contact sheet: python3 harness/portraits.py <out.png> [quality]
import sys, os, io, pathlib, json
from playwright.sync_api import sync_playwright
from PIL import Image
R = pathlib.Path(__file__).resolve().parent.parent; THREE = (R/'node_modules/three/build/three.min.js').read_bytes()
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/portraits.png'; Qy = sys.argv[2] if len(sys.argv) > 2 else 'medium'
TYPES = ['grub', 'skitter', 'dasher', 'bulwark', 'troll', 'wisp', 'knight', 'budling', 'boss']
def route(r):
    u = r.request.url
    if 'three.min.js' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    return r.abort() if 'fonts.g' in u else r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={'width': 640, 'height': 480}); pg.route('**/*', route); pg.set_default_timeout(240000)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(f"localStorage.setItem('ah.settings.v1', JSON.stringify({{quality:'{Qy}'}}))")
    pg.goto(f'file://{R}/dist/index.html?seed=5&test'); pg.wait_for_timeout(1000)
    pg.evaluate("document.querySelectorAll('#hud-top,#board,#cam,#dock,#pausebtn,#setbtn,#camrot,#banner,#toasts').forEach(e=>e.style.display='none')")
    tiles = []
    for k, t in enumerate(TYPES):
        h = pg.evaluate(f"""(()=>{{ const s=__ah.sim, m=s.m; for(let i=0;i<m.alive.length;i++) m.alive[i]=0; s.alive=0;
          const i=s.spawn('{t}', null, -1); const x=6.5, z=4.5; m.x[i]=m.px[i]=x; m.z[i]=m.pz[i]=z; m.tile[i]=4*22+6; m.dirx[i]=-1; m.dirz[i]=0; m.speed[i]=0.0001;
          s.phase='build'; s.countdown=999; const H=__ah.debug.CRE.TYPE['{t}'][3], hov=__ah.debug.CRE.TYPE['{t}'][2];
          __ah.camTo(x, z, 1.4 + H * 1.25, 0.28, -0.95); __ah.cam.tyFix = hov + H * 0.45; return H; }})()""")
        for _ in range(3): pg.evaluate("__ah.render(1/30)")
        tiles.append(Image.open(io.BytesIO(pg.screenshot())))
    b.close()
sheet = Image.new('RGB', (640 * 3, 480 * 3))
for k, im in enumerate(tiles): sheet.paste(im, ((k % 3) * 640, (k // 3) * 480))
sheet.save(OUT); print(json.dumps({'errs': errs}))
