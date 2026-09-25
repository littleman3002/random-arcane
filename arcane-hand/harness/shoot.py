# Visual harness: seeded, reproducible checkpoint frames. Usage: python3 harness/shoot.py <tag> [w h]
import sys, json, pathlib
from playwright.sync_api import sync_playwright
R = pathlib.Path(__file__).resolve().parent.parent
import os
SEED = int(os.environ.get('SEED', '42'))
TAG = sys.argv[1] if len(sys.argv) > 1 else 'r0'
VW, VH = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1366, 768)
THREE = (R/'node_modules/three/build/three.min.js').read_bytes()
OUT = R/'shots'/TAG; OUT.mkdir(parents=True, exist_ok=True)
errors = []
def route(r):
    u = r.request.url
    if 'three.min.js' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    import os
    QUAL = os.environ.get('QUAL', 'medium')
    b = p.chromium.launch(executable_path=__import__("os").environ.get("CHROME") or None, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    def newpage():
        pg = b.new_page(viewport={'width': VW, 'height': VH})
        pg.route('**/*', route)
        pg.add_init_script(f"localStorage.setItem('ah.settings.v1', JSON.stringify({{quality:'{QUAL}'}}))")
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
        pg.set_default_timeout(240000)
        return pg
    pg = newpage()
    def shot(name): pg.screenshot(path=str(OUT/f'{name}.png'), timeout=240000)
    def R_(n=1):
        for _ in range(n): pg.evaluate('__ah.render(1/60)')
    # 01 title
    pg.goto(f'file://{R}/dist/index.html?seed=42'); pg.wait_for_timeout(3000); shot('01_title')
    # checkpoints driven in test mode (sim only advances when the harness steps it)
    pg.close(); pg = newpage()
    pg.goto(f'file://{R}/dist/index.html?seed={SEED}&test'); pg.wait_for_timeout(500)
    pg.evaluate("__ah.act({type:'roll'})"); pg.evaluate("__ah.hover(5,2)"); R_(1); shot('02_first_roll_offer')
    pg.evaluate("__ah.act({type:'place',tx:5,tz:2})"); R_(1)
    pg.evaluate("__ah.setBot(true)"); pg.evaluate("__ah.step(30*60)"); R_(1); shot('03_wave1_midfight')
    pg.evaluate("__ah.step(30*240)"); R_(1)
    s = pg.evaluate("(()=>{const s=__ah.sim; return {phase:s.phase, wave:s.waveIdx, towers:s.towers.length, gold:s.player.gold}})()")
    shot('04_build_phase_board')
    tid = pg.evaluate("__ah.sim.towers.slice().sort((a,b)=>b.tier-a.tier||b.id-a.id)[0].id")
    pg.evaluate(f"__ah.select({tid})"); R_(1); shot('05_tower_selected')
    # merge (force gold so the checkpoint is reachable deterministically)
    r = pg.evaluate("(()=>{const s=__ah.sim; s.player.gold+=500; const t=s.towers.find(t=>s.mergePartners(t).length); if(!t) return null; __ah.select(t.id); return t.id})()")
    if r:
        pg.evaluate(f"document.querySelector('#b-merge').click()"); R_(1); shot('06_merge_moment')
    pg.evaluate("__ah.step(30*60*6)"); R_(1)
    info = pg.evaluate("__ah.info()")
    shot('07_midrun_horde')
    pg.evaluate("__ah.step(30*60*6)"); R_(1); shot('08_late_run')
    end = pg.evaluate("__ah.sim.phase")
    pg.evaluate("__ah.step(30*60*10)"); R_(1); shot('09_end_state')
    final = pg.evaluate("(()=>{const s=__ah.sim; return {phase:s.phase, wave:s.waveIdx, lives:s.player.lives, score:s.player.score}})()")
    # 10 stress 1000 with perf overlay (swiftshader: CPU rendering, NOT representative of a real GPU)
    pg.close(); pg = newpage()
    pg.goto(f'file://{R}/dist/index.html?seed=7&stress=1000&debug'); pg.wait_for_timeout(15000); shot('10_stress_1000')
    perf = pg.evaluate("document.querySelector('#perf').textContent")
    b.close()
print(json.dumps({'errors': errors[:20], 'midState': s, 'info': info, 'final': final, 'stressPerf': perf}, indent=1))
