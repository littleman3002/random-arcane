import re, pathlib
R = pathlib.Path(__file__).parent
css = (R/'src/style.css').read_text(); sim = (R/'src/sim.js').read_text(); bots = (R/'harness/bots.js').read_text(); game = (R/'src/game.js').read_text()
render = ''.join((R/f'src/{f}.js').read_text() for f in ['r_util','r_sky','r_post','r_world','r_creatures','r_towers','r_fx','r_grass','r_river'])
bots = "(function(){\n" + bots + "\n})();"
pebbles = (R/'src/pebbles.b64').read_text().strip()
import json, base64
models = {}
enabled = [l.strip() for l in (R/'assets/models/ENABLED').read_text().splitlines() if l.strip() and not l.startswith('#')] if (R/'assets/models/ENABLED').exists() else []
for f in sorted((R/'assets/models').glob('*.json')):   # creatures built in Blender (assets/blender/*.py); only those listed in assets/models/ENABLED ship
    if f.stem not in enabled: continue
    d = json.loads(f.read_text()); d['tex'] = 'data:image/jpeg;base64,' + base64.b64encode(f.with_suffix('.jpg').read_bytes()).decode(); models[d['name']] = d
models_js = json.dumps(models)
NOTICE = '''<!--
Arcane Hand: Horde Defense. Third-party notices:
Clearwater (c) 2026 Lumaris. MIT License. https://github.com/Aureliengmz/clearwater
three-stylized (c) 2026 Steve245270533. MIT License. https://github.com/Steve245270533/three-stylized
three.js (c) 2010-2021 three.js authors. MIT License.
MIT License: Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to
whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this
permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED
"AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
-->'''
html = f'''<!doctype html>
{NOTICE}
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Arcane Hand: Horde Defense</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@400;500;700;800&family=Grenze+Gotisch:wght@500;700&display=swap" rel="stylesheet">
<style>{css}</style></head>
<body><div id="app"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>{sim}</script>
<script>{bots}</script>
<script>window.AHR = window.AHR || {{}}; AHR.MODELS3D = {models_js};</script>
<script>{render}</script>
<script>AHR.PEBBLES = "{pebbles}";</script>
<script>{game}</script>
</body></html>'''
(R/'dist/index.html').write_text(html)
(R/'index.html').write_text(html)  # repo root copy: GitHub Pages serves this as the playable game
print('built', len(html)//1024, 'KB')
