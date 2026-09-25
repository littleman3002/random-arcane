# Combat close-ups (projectiles in flight, impacts): python3 harness/combat.py <outprefix> [quality]
import sys, os, pathlib, json
from playwright.sync_api import sync_playwright
R = pathlib.Path(__file__).resolve().parent.parent; THREE = (R/'node_modules/three/build/three.min.js').read_bytes()
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/combat'; Qy = sys.argv[2] if len(sys.argv) > 2 else 'medium'
def route(r):
    u = r.request.url
    if 'three.min.js' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    return r.abort() if 'fonts.g' in u else r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    errs = []
    for k, (els, arch) in enumerate([(['ember', 'tide', 'grove'], ['bolt', 'sniper', 'heavy']), (['void', 'storm', 'iron'], ['rapid', 'heavy', 'bolt']), (['iron', 'ember', 'tide'], ['heavy', 'heavy', 'rapid'])]):
        pg = b.new_page(viewport={'width': 1280, 'height': 720}); pg.route('**/*', route); pg.set_default_timeout(240000)
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('CONSOLE ' + m.text[:300]) if m.type == 'error' and 'ERR_FAILED' not in m.text else None)
        pg.add_init_script(f"localStorage.setItem('ah.settings.v1', JSON.stringify({{quality:'{Qy}'}}))")
        pg.goto(f'file://{R}/dist/index.html?seed=11&test'); pg.wait_for_timeout(800)
        pg.evaluate("document.querySelectorAll('#hud-top,#board,#cam,#dock,#pausebtn,#setbtn,#camrot,#banner,#toasts').forEach(e=>e.style.display='none')")
        pg.evaluate(f"""(()=>{{ const s=__ah.sim, m=s.m; s.towers.slice().forEach(t=>{{ s.towerAt[t.tz*22+t.tx]=0; }}); s.towers.length=0;
          for(let i=0;i<m.alive.length;i++) m.alive[i]=0; s.alive=0; s.phase='build'; s.offer=null;
          const els={json.dumps(els)}, ar={json.dumps(arch)};
          els.forEach((el,j)=>{{ s.offer={{el, arch:ar[j], tier:2+j, ability:null, paid:0}}; s.apply({{type:'place',owner:0,tx:5+j*2,tz:2}}); }});
          for(let n=0;n<8;n++){{ const i=s.spawn(n%2?'troll':'bulwark', null, -1); const x=3+n*1.3; m.x[i]=m.px[i]=x; m.z[i]=m.pz[i]=4.5; m.tile[i]=4*22+Math.floor(x); m.dirx[i]=-1; m.dirz[i]=0; m.hp[i]=m.maxHp[i]=1e6; }}
          s.phase='wave'; __ah.camTo(7.2, 3.6, 6.2, 0.42, 0.25); }})()""")
        for _ in range(26): pg.evaluate("__ah.step(1); __ah.render(1/30)")
        pg.screenshot(path=f'{OUT}_{k}a.png')
        for _ in range(9): pg.evaluate("__ah.step(1); __ah.render(1/30)")
        pg.screenshot(path=f'{OUT}_{k}b.png')
        info = pg.evaluate('__ah.info()'); pg.close()
    print(json.dumps({'errs': errs, 'info': info}))
    b.close()
