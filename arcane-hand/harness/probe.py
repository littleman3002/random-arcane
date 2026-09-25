import sys, json, pathlib
from playwright.sync_api import sync_playwright
R = pathlib.Path(__file__).resolve().parent.parent
THREE = (R/'node_modules/three/build/three.min.js').read_bytes()
def route(r):
    u=r.request.url
    if 'three.min.js' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=__import__("os").environ.get("CHROME") or None, args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg=b.new_page(viewport={'width':1366,'height':768}); pg.route('**/*',route)
    pg.goto(f'file://{R}/dist/index.html?seed=42&test'); pg.wait_for_timeout(400)
    print(pg.evaluate(sys.argv[1]))
    b.close()
