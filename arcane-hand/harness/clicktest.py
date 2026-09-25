# Real mouse spam-click test against the live game loop (the UI refreshes while you click).
import pathlib, json
from playwright.sync_api import sync_playwright
R = pathlib.Path(__file__).resolve().parent.parent; THREE=(R/'node_modules/three/build/three.min.js').read_bytes()
def route(r):
    u=r.request.url
    if 'three.min.js' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    return r.abort() if 'fonts.g' in u else r.continue_()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=__import__("os").environ.get("CHROME") or None, args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg=b.new_page(viewport={'width':1366,'height':768}); pg.route('**/*',route); pg.set_default_timeout(120000)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('ah.settings.v1', JSON.stringify({quality:'low'}))")
    pg.goto(f'file://{R}/dist/index.html?seed=3&autostart'); pg.wait_for_timeout(2500)
    pg.evaluate("""(()=>{ const s=__ah.sim; s.player.gold=999999; window.__log=[]; const o=s.apply.bind(s); s.apply=(a)=>{ window.__log.push(a.type); return o(a); };
      const tiles=[[3,2],[4,2],[5,2],[6,2],[7,2],[8,2],[9,2],[3,3],[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[3,5],[4,5]];
      tiles.forEach(([x,z],k)=>{ const tier = k<2 ? 0 : 1 + ((k-2)%3); s.offer={el:AH.ELEMENTS[k%6],arch:'bolt',tier,ability:AH.ABILITIES[k%8],paid:50}; o({type:'place',owner:0,tx:x,tz:z}); });
      __ah.select(s.towers[0].id); window.__log=[]; window.__ev=[];
      for (const t of ['pointerdown','pointerup','click']) document.addEventListener(t, (e)=>{ const el=e.target; window.__ev.push(t[5]||t[0] + ':' + (el.id || (el.closest('[id]')||{}).id || el.tagName) + (el.isConnected?'':'(detached)')); }, true); })()""")
    pg.wait_for_timeout(600)
    clicks = 0
    for k in range(14):
        box = pg.evaluate("(()=>{ const r=document.querySelector('#b-merge').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]; })()")
        under = pg.evaluate(f"(()=>{{ const e=document.elementFromPoint({box[0]},{box[1]}); return e ? (e.id||e.className||e.tagName) + ' in ' + (e.closest('[id]')||{{}}).id : 'none'; }})()")
        if False: print('click', k, 'at', [round(v) for v in box], 'under:', under, 'selected:', pg.evaluate('__ah.ui.selected'), 'sig:', pg.evaluate("document.querySelector('#sel-panel').dataset.sig"))
        pg.mouse.move(box[0], box[1]); pg.mouse.down(); pg.wait_for_timeout(90); pg.mouse.up(); clicks += 1; pg.wait_for_timeout(160)
    res = pg.evaluate("(()=>({ log: window.__log, merges: __ah.sim.player.merges, drops: window.__log.filter(t=>t==='dropAbility').length, sells: window.__log.filter(t=>t==='sellTower').length }))()")
    tiers = pg.evaluate('__ah.sim.towers.find(t=>t.id===__ah.ui.selected)?.tier')
    print('selected tower tier at end:', tiers)
    print(json.dumps({'clicks': clicks, 'mergeActionsReceived': res['log'].count('merge'), 'successfulMerges': res['merges'], 'accidentalDrops': res['drops'], 'accidentalSells': res['sells'], 'errs': errs}))
    b.close()
