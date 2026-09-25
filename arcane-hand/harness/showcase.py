# Fidelity review frames: tower lineup (6 elements x rarities) and creature lineup, close camera. Usage: showcase.py <quality> <outprefix>
import sys, pathlib, json
from playwright.sync_api import sync_playwright
R = pathlib.Path(__file__).resolve().parent.parent; THREE=(R/'node_modules/three/build/three.min.js').read_bytes()
Qy = sys.argv[1] if len(sys.argv) > 1 else 'medium'; OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/show'
def route(r):
    u=r.request.url
    if 'three.min.js' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=__import__("os").environ.get("CHROME") or None, args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg=b.new_page(viewport={'width':1366,'height':768}); pg.route('**/*',route)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('CONSOLE '+m.text[:300]) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
    pg.add_init_script(f"localStorage.setItem('ah.settings.v1', JSON.stringify({{quality:'{Qy}'}}))")
    pg.goto(f'file://{R}/dist/index.html?seed=5&test'); pg.wait_for_timeout(1200)
    pg.evaluate("""(()=>{ const s=__ah.sim, E=AH.ELEMENTS, A=AH.ARCHES, AB=AH.ABILITIES;
      // row z=2: six elements at tiers 0..4 alternating; row z=5: same elements at higher tiers
      E.forEach((el,k)=>{ s.offer={el, arch:A[k%4], tier:k%3, ability:AB[k], paid:0}; s.apply({type:'place',owner:0,tx:3+k*2,tz:2}); });
      E.forEach((el,k)=>{ s.offer={el, arch:A[(k+1)%4], tier:2+(k%3), ability:k%2?null:AB[k+2], paid:0}; s.apply({type:'place',owner:0,tx:3+k*2,tz:3}); });
      document.querySelectorAll('#hud-top,#board,#cam,#dock,#pausebtn').forEach(e=>e.style.display='none');
      __ah.camTo(8.5, 3.2, 9); })()""")
    for _ in range(3): pg.evaluate("__ah.render(1/30)")
    pg.screenshot(path=OUT+'_towers.png', timeout=180000)
    for k, x in enumerate([4.0, 8.0, 12.0]):   # close-ups: two elements (both rarities) per frame
        pg.evaluate(f"__ah.camTo({x}, 3.0, 5.4, 0.55, 0.0)")
        for _ in range(2): pg.evaluate("__ah.render(1/30)")
        pg.screenshot(path=OUT+f'_towers_close{k}.png', timeout=180000)
    # creature lineup: spawn one of each type, freeze them in a row on the path at z=4
    pg.evaluate("""(()=>{ const s=__ah.sim; const types=['grub','skitter','dasher','bulwark','troll','wisp','knight','budling','boss'];
      types.forEach((t,k)=>{ const i=s.spawn(t, k===3?'frenzy':null, k===4?2:-1); const x=2.5+k*2.1; s.m.x[i]=s.m.px[i]=x; s.m.z[i]=s.m.pz[i]=4.5; s.m.tile[i]=4*22+Math.floor(x); s.m.dirx[i]=-1; s.m.dirz[i]=0; s.m.speed[i]=0.0001; if(k%3===1) s.m.hp[i]*=0.6; });
      s.phase='build'; s.countdown=999; __ah.camTo(10.9, 5.2, 10.5); })()""")
    for _ in range(4): pg.evaluate("__ah.render(1/30)")
    pg.screenshot(path=OUT+'_creatures.png', timeout=180000)
    pg.evaluate("__ah.camTo(6.7, 5.0, 5.2, 0.35, 0.25)")
    for _ in range(2): pg.evaluate("__ah.render(1/30)")
    pg.screenshot(path=OUT+'_creatures_close_a.png', timeout=180000)
    pg.evaluate("__ah.camTo(15.1, 5.0, 5.6, 0.35, 0.25)")
    for _ in range(2): pg.evaluate("__ah.render(1/30)")
    pg.screenshot(path=OUT+'_creatures_close_b.png', timeout=180000)
    print(json.dumps({'errs':errs, 'tris': pg.evaluate("JSON.stringify(__ah.debug.CRE.tris)")}))
    b.close()
