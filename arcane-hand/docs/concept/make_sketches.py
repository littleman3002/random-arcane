# Concept sheet for the nine creatures (colored ink sketches, SVG). The 3D models in src/r_creatures.js are built to match.
# python3 docs/concept/make_sketches.py  -> docs/concept/<name>.svg and docs/concept/sheet.html
import math, pathlib
OUT = pathlib.Path(__file__).parent
INK = '#1c1224'

class Art:
    _k = 0
    def __init__(self): Art._k += 1; self.pre = f'c{Art._k}'; self.defs = []; self.body = []; self.n = 0
    def grad(self, light, base, dark, cx=35, cy=28):
        self.n += 1; gid = f'{self.pre}g{self.n}'
        self.defs.append(f'<radialGradient id="{gid}" cx="{cx}%" cy="{cy}%" r="80%"><stop offset="0" stop-color="{light}"/><stop offset=".45" stop-color="{base}"/><stop offset="1" stop-color="{dark}"/></radialGradient>')
        return f'url(#{gid})'
    def lgrad(self, a, b, x2=0, y2=1):
        self.n += 1; gid = f'{self.pre}g{self.n}'
        self.defs.append(f'<linearGradient id="{gid}" x1="0" y1="0" x2="{x2}" y2="{y2}"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>')
        return f'url(#{gid})'
    def add(self, s): self.body.append(s)
    def E(self, cx, cy, rx, ry, fill, rot=0, sw=3, extra=''):
        self.add(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" transform="rotate({rot} {cx:.1f} {cy:.1f})" fill="{fill}" stroke="{INK}" stroke-width="{sw}" {extra}/>')
    def C(self, cx, cy, r, fill, sw=3, extra=''): self.add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}" stroke="{INK}" stroke-width="{sw}" {extra}/>')
    def P(self, d, fill, sw=3, extra=''): self.add(f'<path d="{d}" fill="{fill}" stroke="{INK}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round" {extra}/>')
    def L(self, d, color, w, extra=''): self.add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round" {extra}/>')
    def limb(self, pts, color, w0, w1=None):   # inked, tapered limb along a polyline
        w1 = w0 if w1 is None else w1; n = len(pts) - 1
        for k in range(n):
            (ax, ay), (bx, by) = pts[k], pts[k + 1]; w = w0 + (w1 - w0) * (k + 0.5) / n
            self.L(f'M{ax},{ay} L{bx},{by}', INK, w + 6); self.L(f'M{ax},{ay} L{bx},{by}', color, w)
    def glow(self, inner): self.add(f'<g filter="url(#{self.pre}glow)">{inner}</g>')
    def gc(self, cx, cy, r, color, core='#ffffff'):
        self.glow(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{color}"/><circle cx="{cx}" cy="{cy}" r="{r*0.45:.1f}" fill="{core}" opacity=".85"/>')
    def shadow(self, cx, rx, cy=392, ry=14): self.add(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#000" opacity=".28"/>')
    def svg(self, title):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">'
                f'<defs><filter id="{self.pre}glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
                f'<radialGradient id="{self.pre}bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#3a4a3c"/><stop offset="1" stop-color="#18201a"/></radialGradient>{"".join(self.defs)}</defs>'
                f'<rect width="600" height="450" fill="url(#{self.pre}bg)"/><rect y="392" width="600" height="58" fill="#2a2a20" opacity=".6"/>'
                f'{"".join(self.body)}<text x="20" y="36" font-family="Georgia, serif" font-size="26" fill="#efe3c2">{title}</text></svg>')

def grub():
    a = Art(); a.shadow(300, 210)
    skin = a.grad('#EFC0D8', '#B9739E', '#5E2E54'); plate = a.grad('#A868B8', '#4E2358', '#1A0A22'); bone = a.grad('#FFF8EA', '#EADCC0', '#A08A68')
    segs = [(118, 350, 24, 22), (158, 340, 33, 31), (207, 328, 43, 41), (264, 317, 51, 49), (325, 309, 56, 54), (384, 305, 54, 52)]
    for cx, cy, rx, ry in segs:                                   # stubby legs
        for dx in (-rx * 0.35, rx * 0.3): a.P(f'M{cx+dx-8},{cy+ry*0.6} L{cx+dx-5},390 L{cx+dx+7},390 L{cx+dx+9},{cy+ry*0.6} Z', '#6E3F64', 2.5)
    for k, (cx, cy, rx, ry) in enumerate(segs):
        a.E(cx, cy, rx, ry, skin)
        a.add(f'<ellipse cx="{cx}" cy="{cy+ry*0.5}" rx="{rx*0.86}" ry="{ry*0.42}" fill="#F4DCC8" opacity=".9"/>')
        for r in (0.3, 0.55): a.L(f'M{cx-rx*0.7},{cy+ry*r} Q{cx},{cy+ry*(r+0.28)} {cx+rx*0.7},{cy+ry*r}', '#C89A98', 2)
        a.P(f'M{cx-rx*1.04},{cy+ry*0.12} Q{cx-rx*0.2},{cy-ry*1.55} {cx+rx*1.04},{cy+ry*0.08} Q{cx},{cy-ry*0.3} {cx-rx*1.04},{cy+ry*0.12} Z', plate)
        a.L(f'M{cx-rx*1.0},{cy+ry*0.1} Q{cx},{cy-ry*0.3} {cx+rx*1.0},{cy+ry*0.06}', '#E8B850', 4)
        for s in (-0.45, 0.05, 0.5): a.L(f'M{cx+rx*s-6},{cy-ry*0.55} q6,-10 12,0', '#2A1030', 2)
        a.P(f'M{cx-7},{cy-ry*1.02} L{cx-2},{cy-ry*1.02-22-k*2} L{cx+9},{cy-ry*1.0} Z', bone, 2.5)
        a.gc(cx + rx * 0.05, cy + ry * 0.18, 5 + k * 0.6, '#5FF2D6')
    a.gc(92, 348, 10, '#5FF2D6'); a.P('M84,344 L58,336 L86,356 Z', '#2A1030', 2.5)
    # head: armored helm, bone horns, sickle mandibles, amber eye cluster, feathered antennae
    a.L('M462,262 C478,214 512,196 548,204', INK, 7); a.L('M462,262 C478,214 512,196 548,204', '#5A2A66', 3)
    for t in range(6): x = 478 + t * 12; a.L(f'M{x},{226 - t*4} l6,-10 M{x},{226 - t*4} l10,4', '#7A4A86', 2)
    a.gc(552, 204, 9, '#C8A0FF')
    a.E(452, 316, 50, 42, a.grad('#B07AA8', '#7E4F74', '#3A1A38'))
    a.P('M402,312 Q420,236 504,268 Q520,284 508,300 Q470,284 402,312 Z', plate)
    a.L('M404,308 Q470,280 508,296', '#E8B850', 4)
    a.P('M430,266 C412,236 392,222 364,222 C388,232 402,250 414,276 Z', bone, 2.5); a.P('M458,258 C450,226 436,206 410,196 C430,212 438,236 442,264 Z', bone, 2.5)
    a.add(f'<g filter="url(#{a.pre}glow)"><ellipse cx="496" cy="330" rx="14" ry="9" fill="#FF5A7A"/></g>')
    a.P('M482,328 C532,330 562,300 556,264 C546,294 522,314 486,314 Z', bone)
    a.P('M480,340 C528,356 566,344 570,312 C556,338 522,344 482,330 Z', bone)
    for x, y, r in [(484, 296, 8), (474, 290, 6), (494, 288, 5.5), (466, 300, 5)]: a.gc(x, y, r, '#FFB43A')
    return a.svg('Gloomgrub')

def spider():
    a = Art(); a.shadow(330, 220)
    far = [[(380, 282), (498, 214), (572, 372)], [(362, 284), (446, 214), (500, 374)], [(332, 287), (262, 214), (212, 374)], [(318, 290), (198, 222), (108, 372)]]
    near = [[(372, 292), (472, 180), (548, 388)], [(356, 296), (420, 196), (470, 392)], [(336, 300), (292, 192), (252, 392)], [(324, 302), (236, 198), (160, 390)]]
    for legs, col, band in ((far, '#140E1C', '#5A3A8A'), (near, '#2E2240', '#A866E8')):
        for hip, knee, foot in legs:
            mid = (knee[0] + (foot[0] - knee[0]) * 0.55, knee[1] + (foot[1] - knee[1]) * 0.55)
            a.limb([hip, knee], col, 11, 9); a.limb([knee, mid], col, 8, 7); a.limb([mid, foot], '#E6D6F4' if col != '#140E1C' else '#8A7A9A', 6, 3)
            a.C(*knee, 7, band, 2.5); a.C(*mid, 5, band, 2)
    ab = a.grad('#5A3A78', '#241430', '#07030C')
    a.E(208, 222, 118, 90, ab, -14)
    a.glow('<path d="M150,170 C180,200 170,240 200,260 M200,260 C230,240 260,250 280,230 M170,250 C190,290 240,300 250,280 M130,220 C150,230 160,260 150,290 M230,160 C230,190 250,200 270,196" fill="none" stroke="#B45CFF" stroke-width="3"/>')
    a.glow('<path d="M200,142 L226,156 L200,170 L212,156 Z M232,150 L258,160 L232,172 L244,160 Z" fill="#FF3A6A"/>')
    for x, y in [(140, 160), (170, 138), (260, 150), (290, 180), (120, 200)]: a.L(f'M{x},{y} l-4,-14', '#6A4A8A', 2)
    a.E(340, 280, 62, 42, a.grad('#5A4870', '#2E2238', '#110A18'), -6)
    a.E(404, 286, 36, 31, a.grad('#5A4870', '#3A2A48', '#140C1C'))
    a.P('M414,306 C424,322 426,336 416,348 C432,336 436,318 426,302 Z', '#EADCC8', 2.5); a.P('M398,308 C404,324 402,338 392,346 C410,338 414,322 410,304 Z', '#EADCC8', 2.5)
    for x, y, r in [(418, 276, 8.5), (402, 272, 7.5), (430, 284, 5), (392, 282, 4.5), (410, 262, 4), (426, 266, 4)]: a.gc(x, y, r, '#FF3A2A', '#FFD0C0')
    return a.svg('Skitterling')

def hound():
    a = Art(); a.shadow(300, 200)
    fur = a.grad('#F08A50', '#B8492C', '#5A1C10'); dark = '#3A1810'; bone = a.grad('#FFF8EA', '#EADFC8', '#A89878')
    a.limb([(205, 250), (170, 305), (160, 340), (178, 386)], '#7A2A18', 16, 9); a.limb([(345, 262), (338, 322), (330, 386)], '#7A2A18', 15, 9)   # far legs
    a.P('M150,232 C120,210 96,170 78,140', 'none', 0); a.L('M150,228 C118,208 98,176 84,146', INK, 18); a.L('M150,228 C118,208 98,176 84,146', '#B8492C', 12)
    a.add(f'<g filter="url(#{a.pre}glow)"><path d="M84,150 C60,140 58,110 76,86 C74,108 92,104 90,84 C104,104 104,130 84,150 Z" fill="#FF8A2A"/><path d="M84,142 C72,132 74,116 82,104 C84,118 94,122 84,142 Z" fill="#FFE070"/></g>')
    a.P('M140,236 C136,194 186,176 236,190 C282,202 300,168 352,160 C404,152 426,196 416,246 C408,284 372,294 342,284 C302,272 262,266 232,278 C192,292 146,280 140,236 Z', fur)
    a.P('M236,262 C270,250 316,262 348,280 C320,290 280,282 240,286 Z', '#EAC08A', 0)
    for x in (180, 208, 238, 268, 300, 330, 362):
        a.P(f'M{x},{182 - (x-180)*0.1} C{x+10},{205} {x-2},{225} {x+8},{245} C{x-6},{226} {x-10},{205} {x-6},{186} Z', '#2E0F0A', 0)
    for k in range(7):
        x, y = 334 + k * 13, 170 - k * 6
        a.P(f'M{x-8},{y+8} L{x-2},{y-30} L{x+8},{y+6} Z', dark, 2.5); a.glow(f'<path d="M{x-4.5},{y-12} L{x-2},{y-30} L{x+3},{y-12} Z" fill="#FF8A2A"/>')
    a.L('M372,168 C380,196 392,214 406,222', INK, 12); a.L('M372,168 C380,196 392,214 406,222', '#4A3222', 7)
    for k in range(4): a.P(f'M{376+k*9},{186+k*10} l10,-4 l-4,10 Z', '#C8C8D0', 1.5)
    a.P('M392,172 C418,148 464,152 486,168 L534,184 C546,190 544,206 530,212 L474,218 C442,228 404,216 394,196 Z', fur)
    a.P('M470,214 L528,212 C522,226 496,236 470,232 Z', dark, 2.5); a.glow('<path d="M478,218 L520,214 C512,224 494,228 478,226 Z" fill="#FF6A2A"/>')
    for x in (484, 496, 508, 518): a.P(f'M{x},212 l3,9 l3,-9 Z', '#F4ECDC', 1.2)
    a.P('M402,176 C428,152 470,160 492,176 L474,188 C452,180 426,182 404,194 Z', bone, 2.5)
    a.L('M430,168 l8,10 M450,164 l4,12', '#8A7A5A', 1.8)
    a.C(534, 194, 6, '#151010', 2)
    a.P('M430,160 C412,120 380,96 344,96 C372,110 396,132 414,170 Z', bone, 2.5); a.P('M452,158 C446,126 424,100 396,90 C418,110 432,134 436,164 Z', bone, 2.5)
    for k in range(4): a.L(f'M{366+k*12},{103+k*6} l6,6', '#8A7A5A', 2)
    a.P('M408,176 L396,148 L422,168 Z', dark, 2.5)
    a.glow('<path d="M458,180 L476,176 L470,186 Z" fill="#FFB03A"/>')
    a.limb([(214, 246), (188, 300), (172, 336), (196, 386)], '#B8492C', 20, 10)
    a.limb([(356, 256), (362, 322), (372, 386)], '#B8492C', 19, 10)
    for x, y in [(196, 386), (372, 386)]: a.E(x + 8, y, 16, 7, dark, 0, 2.5)
    return a.svg('Cinder Hound')

def tortoise():
    a = Art(); a.shadow(300, 220)
    skin = a.grad('#B8C4A0', '#7A8660', '#3A4230'); bronze = a.grad('#E8B070', '#A07A44', '#3E2814', 40, 20)
    for x, c in [(170, '#4A5238'), (400, '#4A5238')]: a.P(f'M{x-22},292 L{x-26},388 L{x+26},388 L{x+22},292 Z', c)
    a.P('M470,262 C500,250 520,250 540,262', 'none', 0)
    a.P('M456,282 C470,256 500,240 528,248 L520,300 C500,300 476,300 456,300 Z', skin)
    a.E(540, 262, 38, 32, skin)
    a.P('M510,244 C520,222 560,216 580,238 C570,244 540,244 510,250 Z', a.grad('#E0E6F0', '#9AA2B0', '#4A505A'))
    a.P('M548,226 L584,196 L566,236 Z', a.grad('#FFE0A0', '#C8904A', '#6A4020'), 2.5)
    a.P('M566,262 C584,262 590,276 578,290 C574,280 566,276 556,276 Z', '#D8C890', 2.5)
    a.gc(552, 254, 6, '#FFD86A')
    for x in (548, 556, 564, 572): a.L(f'M{x-14},{272} q4,6 8,0', '#3A4230', 1.8)
    a.P('M104,300 C104,168 196,104 292,104 C394,104 480,166 480,300 Z', bronze)
    hexes = [(292, 142, 34), (230, 170, 30), (354, 170, 30), (180, 222, 28), (292, 206, 36), (404, 222, 28), (236, 262, 30), (348, 262, 30), (146, 272, 22), (440, 272, 22)]
    for cx, cy, r in hexes:
        pts = ' '.join(f'{cx + r*math.cos(math.pi/3*k + math.pi/6):.1f},{cy + r*0.8*math.sin(math.pi/3*k + math.pi/6):.1f}' for k in range(6))
        a.add(f'<polygon points="{pts}" fill="#7A5A30" stroke="{INK}" stroke-width="2.5"/>')
        pts2 = ' '.join(f'{cx + r*0.78*math.cos(math.pi/3*k + math.pi/6):.1f},{cy - 3 + r*0.62*math.sin(math.pi/3*k + math.pi/6):.1f}' for k in range(6))
        a.add(f'<polygon points="{pts2}" fill="{bronze}" stroke="#4FA08A" stroke-width="3" opacity=".95"/>')
        a.glow(f'<circle cx="{cx}" cy="{cy-3}" r="{r*0.28:.1f}" fill="none" stroke="#6FE8FF" stroke-width="3"/>')
    a.P('M96,292 L488,292 L488,310 L96,310 Z', '#3E4046')
    for k in range(9): x = 110 + k * 46; a.C(x, 301, 3.5, '#C8904A', 1.5); a.P(f'M{x+14},{296} L{x+23},{318} L{x+30},{296} Z', '#8A8C94', 2)
    a.P('M190,120 C200,96 250,96 262,112 C250,124 210,126 190,120 Z', '#5E8A3A')
    for x, h in [(212, 34), (228, 46), (244, 30)]: a.glow(f'<path d="M{x-6},{112} L{x},{112-h} L{x+6},{112} Z" fill="#C890FF" stroke="{INK}" stroke-width="1.5"/>')
    a.L('M322,106 L316,40', '#5A3A22', 4); a.P('M316,42 L276,52 L290,62 L276,72 L316,70 Z', '#9A2A2A', 2.5); a.gc(300, 58, 4, '#F2C94C')
    for x in (140, 440): a.P(f'M{x-24},292 L{x-28},388 L{x+28},388 L{x+24},292 Z', skin); a.E(x, 332, 22, 14, '#5A606C', 0, 2.5)
    for x in (140, 440):
        for d in (-16, 0, 16): a.P(f'M{x+d-5},384 l5,10 l5,-10 Z', '#E8DCC0', 1.5)
    return a.svg('Ironback')

def troll():
    a = Art(); a.shadow(320, 220)
    skin = a.grad('#A8CCBE', '#5E7A72', '#24382F'); moss = a.grad('#9AD060', '#5E8A3A', '#26401A')
    a.limb([(248, 170), (220, 260), (230, 350)], '#3E5A52', 40, 30); a.E(232, 366, 30, 24, '#3E5A52', 0)   # far arm
    a.limb([(290, 300), (270, 350), (262, 386)], '#4A6058', 36, 30); a.limb([(356, 300), (376, 350), (384, 386)], '#5E7A72', 38, 32)
    a.E(262, 386, 34, 12, '#3E5A52', 0); a.E(392, 386, 36, 12, '#5E7A72', 0)
    a.P('M196,190 C186,122 256,86 330,96 C408,106 440,158 428,220 C418,286 382,322 320,322 C256,322 208,292 200,250 Z', skin)
    a.P('M300,250 C330,236 390,244 404,270 C398,304 366,318 330,316 C300,306 288,276 300,250 Z', '#8CA89A', 2.5)
    for x, y, r in [(240, 150, 16), (280, 196, 12), (226, 230, 14), (346, 210, 10), (250, 276, 10)]: a.add(f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r*0.7}" fill="#3E5A2E" opacity=".65"/>')
    a.glow('<path d="M356,256 l6,22 M372,252 l-2,24 M388,262 l-8,18" stroke="#7CFF6A" stroke-width="3"/>')
    a.P('M276,296 L400,292 L396,340 L366,332 L340,344 L312,330 L284,340 Z', '#6A4A30', 2.5)
    a.L('M272,296 L404,290', '#4A3222', 8); a.P('M330,284 l16,0 l0,14 l-16,0 Z', '#D8A848', 2)
    for x in (300, 380): a.C(x, 312, 9, '#F0E4C8', 2); a.C(x - 3, 310, 2, '#100808', 0); a.C(x + 3, 310, 2, '#100808', 0)
    a.P('M196,150 C200,110 250,92 300,98 C360,100 408,120 424,150 C400,166 370,150 340,160 C300,150 270,172 240,160 C220,170 200,166 196,150 Z', moss)
    for x in range(210, 420, 26): a.P(f'M{x},{158 + (x%3)*3} l4,16 l6,-14 Z', '#34521E', 1.5)
    for x, y, r, col in [(246, 112, 22, '#C83A2A'), (278, 104, 14, '#D84A2A'), (390, 126, 10, '#4AB8FF')]:
        a.P(f'M{x-4},{y+r*0.4} L{x-3},{y+r*1.2} L{x+4},{y+r*1.2} L{x+4},{y+r*0.4} Z', '#EDE3D0', 2)
        if col == '#4AB8FF': a.glow(f'<path d="M{x-r},{y+r*0.5} Q{x},{y-r*0.8} {x+r},{y+r*0.5} Z" fill="{col}" stroke="{INK}" stroke-width="2"/>')
        else:
            a.P(f'M{x-r},{y+r*0.5} Q{x},{y-r*0.9} {x+r},{y+r*0.5} Z', col, 2.5)
            for dx, dy in [(-r*0.4, 0), (r*0.25, -r*0.25), (r*0.5, r*0.2)]: a.C(x + dx, y + dy, r * 0.13, '#F6EEE0', 0)
    a.E(430, 186, 38, 36, skin)
    a.P('M398,170 C416,150 450,150 468,166 C448,170 420,172 398,178 Z', '#3E5A52', 2.5)
    a.P('M452,176 C476,176 486,200 474,218 C466,212 454,206 448,194 Z', '#4A6058', 2.5)
    a.P('M402,204 C420,222 460,224 472,208 C466,228 430,236 408,222 Z', '#3E5A52', 2.5)
    for x in (430, 458): a.P(f'M{x},{214} C{x+2},{196} {x+8},{188} {x+12},{186} C{x+8},{196} {x+8},{206} {x+8},{216} Z', '#F0E4C8', 2)
    a.gc(446, 178, 5, '#FFC03A')
    a.P('M402,178 L352,160 L398,194 Z', '#5E7A72', 2.5)
    for k in range(4): a.P(f'M{412+k*10},{156} l4,-20 l6,18 Z', '#2E3A22', 1.5)
    a.add('<circle cx="474" cy="214" r="6" fill="none" stroke="#D8A848" stroke-width="3"/>')
    a.limb([(404, 170), (440, 250), (456, 318)], '#5E7A72', 42, 34)
    for y in (300, 314): a.E(454, y, 22, 7, '#8A7050', 0, 2)
    a.E(462, 344, 32, 28, skin)
    a.P('M470,330 L560,368 C572,372 574,388 560,392 L468,366 Z', a.lgrad('#8A6A48', '#4A3220'))
    for x in (500, 530): a.P(f'M{x},{338 + (x-470)*0.4} l6,34 l8,-2 l-6,-34 Z', '#46484E', 1.5)
    for x, y in [(548, 360), (560, 350), (572, 372), (540, 388)]: a.P(f'M{x},{y} l10,-12 l2,14 Z', '#9A9AA0', 1.5)
    return a.svg('Moss Troll')

def wisp():
    a = Art(); a.add('<ellipse cx="300" cy="400" rx="110" ry="10" fill="#000" opacity=".2"/>')
    hw = a.grad('#FFE0F8', '#D8A8F0', '#6A4AA8', 40, 40); fw = a.grad('#F4FAFF', '#B8D4FF', '#4A5CB0', 30, 40)
    a.glow('<path d="M250,250 C220,300 230,350 270,372 M262,248 C250,320 290,352 330,360" fill="none" stroke="#9FE8FF" stroke-width="4"/>')
    a.P('M268,226 C200,230 150,280 170,330 C200,340 240,300 262,262 Z', hw)
    a.P('M190,318 C176,346 172,370 190,392 C194,366 200,346 214,330 Z', hw, 2.5); a.gc(190, 390, 6, '#FFFFFF', '#FFFFFF')
    a.P('M330,224 C400,226 450,270 438,320 C410,332 370,300 342,260 Z', hw)
    a.P('M280,214 C220,120 140,90 76,112 C60,170 110,220 180,236 C220,244 256,234 280,222 Z', fw)
    a.P('M76,112 C60,170 110,220 180,236 C150,210 110,170 96,118 Z', '#3A4A9A', 2)
    a.glow('<path d="M270,214 C220,170 170,140 110,126 M262,220 C210,200 160,190 120,176 M250,226 C220,226 190,222 160,212" fill="none" stroke="#9FE8FF" stroke-width="2.2"/>')
    a.C(168, 170, 26, '#FF9A3A', 2.5); a.C(168, 170, 16, '#1A1030', 2); a.gc(168, 170, 6, '#FFFFFF')
    a.P('M330,212 C400,130 480,110 540,136 C548,192 500,232 432,244 C390,250 352,238 330,222 Z', fw)
    a.P('M540,136 C548,192 500,232 432,244 C470,216 510,186 522,140 Z', '#3A4A9A', 2)
    a.glow('<path d="M340,212 C390,170 440,146 510,146 M348,218 C400,200 450,194 494,194 M356,226 C390,228 420,228 450,222" fill="none" stroke="#9FE8FF" stroke-width="2.2"/>')
    a.C(450, 180, 24, '#FF9A3A', 2.5); a.C(450, 180, 15, '#1A1030', 2); a.gc(450, 180, 6, '#FFFFFF')
    ab = a.lgrad('#F4F8FF', '#8A9AD8', 1, 0)
    a.P('M290,236 C284,270 290,300 300,316 C312,300 318,270 312,236 Z', ab)
    for y in (254, 272, 290): a.L(f'M{292 + (y-254)*0.1},{y} Q301,{y+6} {310 - (y-254)*0.1},{y}', '#5A6AC0', 3)
    a.gc(300, 322, 13, '#BFF4FF')
    a.E(300, 214, 30, 30, a.grad('#FFFFFF', '#EAF2FF', '#9AAAD0'))
    for k in range(10): ang = k / 10 * math.pi * 2; x, y = 300 + 30 * math.cos(ang), 214 + 30 * math.sin(ang); a.P(f'M{x-5},{y} L{x + 10*math.cos(ang)},{y + 10*math.sin(ang)} L{x+5},{y} Z', '#F4F8FF', 1.5)
    a.E(302, 176, 24, 22, a.grad('#FFFFFF', '#EAF2FF', '#9AAAD0'))
    for x in (290, 316): a.E(x, 176, 10, 12, a.grad('#6A7AC8', '#10203A', '#05060C', 30, 25), 0, 2); a.C(x - 3, 171, 2.5, '#fff', 0)
    for s in (-1, 1):
        a.L(f'M{302 + s*8},158 C{302 + s*20},120 {302 + s*44},108 {302 + s*66},110', '#E0E8FF', 3)
        for t in range(5): x = 302 + s * (16 + t * 10); y = 132 - t * 4; a.L(f'M{x},{y} l{s*-6},-10 M{x},{y} l{s*8},-6', '#E0E8FF', 1.5)
        a.gc(302 + s * 66, 110, 6, '#BFF4FF')
    for x, y in [(210, 130), (400, 110), (360, 330)]: a.glow(f'<path d="M{x},{y-12} L{x+6},{y} L{x},{y+12} L{x-6},{y} Z" fill="#E0FFFF"/>')
    return a.svg('Moonmoth Wisp')

def knight():
    a = Art(); a.shadow(300, 170)
    steel = a.grad('#F4F8FF', '#9AA8C4', '#3A4460'); cape = a.lgrad('#B02838', '#4A0E16'); gold = a.grad('#FFF0B0', '#E0B458', '#7A5420')
    a.P('M262,150 C220,200 180,300 150,388 L260,380 C280,300 300,220 312,160 Z', cape)
    a.L('M200,300 C210,330 220,360 224,382 M230,240 C236,300 244,340 248,378', '#6A1420', 2.5)
    for x0 in (268, 318): a.P(f'M{x0},288 L{x0-6},340 L{x0+2},384 L{x0+30},384 L{x0+26},340 L{x0+24},288 Z', steel); a.E(x0 + 10, 338, 13, 11, steel, 0, 2.5)
    a.P('M258,176 C258,150 280,138 300,138 C322,138 344,150 344,176 L332,262 C326,282 276,282 268,262 Z', steel)
    a.glow('<path d="M280,168 C294,184 306,184 320,168 M300,184 L300,236 M282,210 C292,222 308,222 318,210" fill="none" stroke="#E8C060" stroke-width="2"/>')
    a.P('M278,262 L324,262 L318,330 L300,340 L284,330 Z', '#22306A'); a.L('M284,328 L300,338 L318,328', '#E0B458', 3)
    a.P('M300,280 L312,296 L300,312 L288,296 Z', gold, 2); a.gc(300, 296, 5, '#7FE8FF')
    a.L('M268,262 L334,262', '#4A3222', 8); a.P('M294,256 l12,0 l0,12 l-12,0 Z', gold, 2)
    for x, s in [(252, -1), (350, 1)]:
        for k in range(3): a.P(f'M{x - s*26},{148 + k*12} Q{x},{126 + k*12} {x + s*26},{156 + k*14} L{x + s*20},{168 + k*12} Q{x},{146 + k*12} {x - s*20},{160 + k*12} Z', steel if k else a.grad('#DDE6F8', '#6A7898', '#2A3040'), 2.5)
        a.L(f'M{x - s*24},{152} Q{x},{130} {x + s*24},{160}', '#E0B458', 3)
    a.P('M276,138 C274,96 286,78 302,78 C318,78 330,96 328,138 Z', steel)
    a.glow('<path d="M280,108 L324,108 M302,100 L302,128" stroke="#7FE8FF" stroke-width="4"/>')
    a.L('M302,78 L302,130', '#E0B458', 4)
    a.P('M300,80 C290,52 262,44 236,62 C258,60 272,70 282,88 Z', '#C0302A', 2.5)
    for s in (-1, 1): a.P(f'M{302 + s*26},{104} C{302 + s*44},{84} {302 + s*48},{64} {302 + s*42},{52} C{302 + s*34},{70} {302 + s*30},{84} {302 + s*26},{94} Z', '#F0F2F8', 2)
    a.P('M170,190 C170,176 196,168 222,172 C246,176 256,188 256,200 L248,300 C240,340 212,356 196,360 C184,340 176,320 172,300 Z', a.grad('#4A60B0', '#22306A', '#0C1230'))
    a.L('M174,194 C176,184 198,176 222,180 C246,184 252,194 252,204 L244,300 C236,336 212,350 196,354 C184,336 178,318 176,300 Z', '#E0B458', 4)
    a.L('M212,182 L204,350 M178,256 L248,262', '#E0B458', 5); a.gc(208, 258, 10, '#7FE8FF'); a.add('<circle cx="208" cy="258" r="18" fill="none" stroke="#7FE8FF" stroke-width="2" opacity=".7"/>')
    a.limb([(346, 176), (372, 224), (392, 250)], '#9AA8C4', 20, 17); a.C(394, 252, 13, steel)
    a.P('M388,236 L402,226 L470,110 L480,96 L476,116 L410,238 Z', a.lgrad('#FFFFFF', '#AEB8C8', 1, 0), 2.5)
    a.glow('<path d="M404,228 L472,112" stroke="#7FE8FF" stroke-width="2.5"/>')
    a.P('M378,226 L414,250 L420,242 L384,218 Z', gold, 2); a.gc(399, 234, 4, '#7FE8FF'); a.C(384, 262, 6, gold, 2)
    return a.svg('Warded Knight')

def bloom():
    a = Art(); a.shadow(300, 150)
    for pts in [[(250, 320), (214, 356), (196, 390)], [(280, 330), (270, 362), (262, 392)], [(330, 330), (344, 364), (356, 392)], [(356, 318), (396, 352), (414, 388)]]: a.limb(pts, '#6A4A2A', 14, 6)
    lobes = [(206, 262, 52, 88), (246, 258, 56, 96), (300, 256, 62, 100), (354, 258, 56, 96), (394, 262, 52, 88)]
    pk = a.grad('#FFC060', '#D07A24', '#6A3010', 40, 30)
    for cx, cy, rx, ry in lobes: a.E(cx, cy, rx, ry, pk)
    for x in (226, 272, 328, 374): a.L(f'M{x},{176} Q{x + (x-300)*0.08},{262} {x},{350}', '#5E8A2A', 5)
    a.P('M270,162 C282,150 318,150 330,162 L322,178 L278,178 Z', '#4E6A2A')
    a.P('M244,228 L276,212 L270,248 Z', '#2A1206', 2.5); a.P('M356,228 L324,212 L330,248 Z', '#2A1206', 2.5)
    a.glow('<path d="M250,230 L272,219 L268,242 Z M350,230 L328,219 L332,242 Z" fill="#FFD060"/>')
    a.P('M240,286 L262,300 L276,288 L290,304 L304,290 L318,304 L332,288 L346,300 L362,286 C356,318 330,332 300,332 C270,332 246,318 240,286 Z', '#2A1206', 2.5)
    a.glow('<path d="M250,292 L262,304 L276,294 L290,308 L304,296 L318,308 L332,294 L346,304 L354,294 C346,316 326,326 300,326 C276,326 256,316 250,292 Z" fill="#FFC040"/>')
    leaf = a.grad('#C8F080', '#5E9A3A', '#244A1A', 40, 60)
    for ang in (-150, -115, -65, -30, -90):
        r = math.radians(ang); x, y = 300 + 130 * math.cos(r), 160 + 110 * math.sin(r)
        a.P(f'M300,164 C{300 + 60*math.cos(r-0.4)},{164 + 60*math.sin(r-0.4)} {x},{y} {x},{y} C{x},{y} {300 + 60*math.cos(r+0.4)},{164 + 60*math.sin(r+0.4)} 300,164 Z', leaf)
        a.L(f'M300,164 L{x},{y}', '#A8E070', 2)
    for k in range(8):
        r = k / 8 * math.pi * 2; x, y = 300 + 26 * math.cos(r), 118 + 16 * math.sin(r)
        a.E(x, y, 20, 11, a.grad('#FFFFFF', '#F4A8D0', '#C04A8A', 20, 50), math.degrees(r), 2)
    a.gc(300, 118, 11, '#FFE070')
    for k in range(5): a.glow(f'<circle cx="{286 + k*7}" cy="{102 - (k%2)*4}" r="2.5" fill="#FFF4A0"/>')
    for x, y in [(188, 200), (412, 196), (440, 240)]:
        a.L(f'M{x},{y - 40} L{x},{y - 18}', '#4E8A2E', 2)
        a.E(x, y, 14, 20, a.grad('#6A3A88', '#3A1E48', '#12081C'), 0, 2.5); a.glow(f'<path d="M{x-6},{y-8} Q{x},{y} {x-4},{y+10} M{x+6},{y-8} Q{x+2},{y+2} {x+5},{y+10}" stroke="#B45CFF" stroke-width="2" fill="none"/>')
    return a.svg('Bloomling')

def golem():
    a = Art(); a.shadow(300, 240)
    stone = a.grad('#8A7E98', '#3C3644', '#15121A'); st2 = a.grad('#9A8EA8', '#4A4454', '#1A1620'); lava = '#FF7A2A'
    a.P('M218,318 L208,388 L270,388 L262,318 Z', st2); a.P('M330,318 L322,388 L386,388 L378,318 Z', st2)
    a.limb([(170, 170), (132, 260), (118, 330)], '#2E2A36', 56, 48); a.P('M84,318 C80,296 110,286 138,290 C166,296 170,330 158,378 C130,392 94,388 86,370 Z', st2)
    for x, h in [(214, 60), (250, 84), (292, 96), (334, 80), (370, 58)]: a.glow(f'<path d="M{x-16},{128} L{x},{128-h} L{x+16},{128} Z" fill="#B06AF0" stroke="{INK}" stroke-width="2"/>')
    a.P('M150,190 C140,120 220,90 300,92 C390,94 460,124 452,196 C446,260 420,320 360,332 C300,344 230,340 190,312 C160,290 154,240 150,190 Z', stone)
    a.glow('<path d="M190,160 L214,190 L204,230 L230,262 M404,150 L380,186 L394,222 L372,262 L382,300 M236,300 L262,286 L290,306 M170,250 L196,264" fill="none" stroke="#FF6A1A" stroke-width="4" stroke-linejoin="round"/>')
    a.add(f'<circle cx="300" cy="206" r="44" fill="none" stroke="{INK}" stroke-width="12"/><circle cx="300" cy="206" r="44" fill="none" stroke="#5A5C64" stroke-width="7"/>')
    a.glow('<path d="M300,164 L330,206 L300,250 L270,206 Z" fill="#FF9A3A"/><path d="M300,180 L316,206 L300,232 L284,206 Z" fill="#FFF0A0"/>')
    for k in range(9): x, y = 196 + k * 26, 150 + k * 20 + (k % 2) * 4; a.add(f'<ellipse cx="{x}" cy="{y}" rx="{10 if k%2 else 5}" ry="{5 if k%2 else 10}" fill="none" stroke="{INK}" stroke-width="7"/><ellipse cx="{x}" cy="{y}" rx="{10 if k%2 else 5}" ry="{5 if k%2 else 10}" fill="none" stroke="#8A8C94" stroke-width="3.5"/>')
    a.E(300, 124, 48, 38, st2)
    for s in (-1, 1):
        a.P(f'M{300 + s*30},{104} C{300 + s*76},{64} {300 + s*110},{110} {300 + s*84},{150} C{300 + s*66},{174} {300 + s*44},{150} {300 + s*62},{132} C{300 + s*74},{120} {300 + s*58},{100} {300 + s*36},{118} Z', a.grad('#6A5A7A', '#241C2A', '#0A080E'), 3)
        for t in range(4): a.L(f'M{300 + s*(50 + t*12)},{94 + t*4} l{s*6},{8}', '#5A4A6A', 2)
    a.glow('<path d="M280,122 L294,126 L282,132 Z M320,122 L306,126 L318,132 Z" fill="#FFB04A"/>')
    a.P('M272,140 L328,140 L322,156 L278,156 Z', '#1E1A24', 2.5)
    for x in (282, 294, 306, 318): a.P(f'M{x},140 l4,8 l4,-8 Z', '#E8DCC8', 1)
    for cx, s in [(176, -1), (430, 1)]:
        a.E(cx, 160, 58, 44, st2)
        a.P(f'M{cx - 50},{140} Q{cx},{104} {cx + 50},{140} L{cx + 40},{150} Q{cx},{124} {cx - 40},{150} Z', '#5A606C', 2.5)
        for k in range(3): a.P(f'M{cx - 30 + k*30},{128 - (k==1)*4} l{4},{-26} l{8},{24} Z', '#9A9CA4', 2)
    a.limb([(432, 176), (474, 258), (482, 318)], '#3C3644', 58, 50)
    a.add(f'<ellipse cx="480" cy="296" rx="34" ry="14" fill="#5A5C64" stroke="{INK}" stroke-width="3"/>')
    a.P('M444,324 C440,300 470,290 500,294 C530,300 536,330 526,376 C498,392 460,390 450,372 Z', st2)
    a.glow('<path d="M470,330 L484,350 L476,370 M500,316 L494,340" stroke="#FF6A1A" stroke-width="3.5" fill="none"/>')
    for k in range(3): a.add(f'<ellipse cx="{506}" cy="{318 + k*18}" rx="6" ry="10" fill="none" stroke="#8A8C94" stroke-width="3"/>')
    for x in (462, 486, 510): a.glow(f'<path d="M{x-7},{296} L{x},{278} L{x+7},{296} Z" fill="#C890FF"/>')
    return a.svg('Vault Breaker')

ART = [('grub', grub), ('skitter', spider), ('dasher', hound), ('bulwark', tortoise), ('troll', troll), ('wisp', wisp), ('knight', knight), ('budling', bloom), ('boss', golem)]
if __name__ == '__main__':
    cells = []
    for name, fn in ART:
        svg = fn(); (OUT / f'{name}.svg').write_text(svg); cells.append(f'<div>{svg}</div>')
    (OUT / 'sheet.html').write_text('<!doctype html><meta charset="utf-8"><title>Arcane Hand creature concepts</title><style>body{margin:0;background:#101410}main{display:grid;grid-template-columns:repeat(3,600px);gap:6px;padding:6px}</style><main>' + ''.join(cells) + '</main>')
    print('wrote', len(ART), 'sketches')
