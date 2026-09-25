# Moss Troll (reference: docs/concept/ref/troll.jpg). Hunched, huge shoulders, long arms, small forward head with tusks,
# moss mantle with toadstools, skull belt and torn loincloth, rag wraps, drags an iron-banded spiked log club.
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).parent)); from ah import *
reset()
M = dict(skin=mat('skin', 0x86AA72, 'skin_troll', 4.5, 0.78, noise=0.45, noise2=(0x2E4424, 0.65, 5)),
         moss=mat('moss', 0x98C070, 'moss', 7.0, 0.95, noise=0.5, noise2=(0x1E3410, 0.7, 11)), leather=mat('leather', 0xA89078, 'leather_rag', 5, 0.9, noise=0.4),
         bark=mat('bark', 0xC8B098, 'bark', 2.6, 0.9), iron=mat('iron', 0xA8A8B0, 'iron', 4, 0.42, 0.85), bone=mat('bone', 0xF2E8D2, 'bone', 5, 0.5),
         cap=mat('cap', 0xC8341E, None, rough=0.35, noise=0.15, spots=(0xF6F0E2, 16, 0.2)), stem=mat('stem', 0xEDE3D0, rough=0.6),
         blue=mat('blue', 0x5AC8FF, rough=0.3, glow=2.2), eye=mat('eye', 0xFFB030, rough=0.2, glow=2.8), dark=mat('dark', 0x1A120C, rough=0.6),
         claw=mat('claw', 0x3A3226, 'bone', 6, 0.35), hair=mat('hair', 0x5A5238, 'fur_dark', 4, 0.9), mouth=mat('mouth', 0x3A1418, rough=0.5))
# ---- body: skinned skeleton, mirrored
N = [(0, 0, 0.62, 0.2, 0.17), (0, 0.1, 0.8, 0.26, 0.22), (0, 0.16, 1.0, 0.3, 0.26), (0, 0.02, 1.22, 0.3, 0.25), (0, 0.28, 1.2, 0.12), (0, 0.36, 1.2, 0.1),
     (0.37, 0.1, 1.15, 0.2), (0.45, 0.14, 0.98, 0.165), (0.49, 0.18, 0.8, 0.12), (0.51, 0.22, 0.63, 0.14), (0.53, 0.25, 0.45, 0.095),
     (0.17, 0.02, 0.6, 0.16), (0.2, 0.08, 0.46, 0.165), (0.22, 0.13, 0.33, 0.125), (0.22, 0.08, 0.2, 0.12), (0.22, 0.02, 0.09, 0.09)]
E = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (3, 6), (6, 7), (7, 8), (8, 9), (9, 10), (0, 11), (11, 12), (12, 13), (13, 14), (14, 15)]
body = skin('body', N, E, mirror=True, subdiv=2); img_displace(body, 'skin_troll', 0.012, 3.0); lumpy(body, 0.012, 3.5); paint(body, M['skin'])
parts = []  # (obj, bone)
def P(o, m, bone): paint(o, M[m]); parts.append((o, bone)); return o
# pot belly and pecs
P(lumpy(ico('belly', (0, 0.2, 0.8), (0.22, 0.16, 0.18)), 0.01), 'skin', 'body')
for s in (1, -1): P(ico('pec', (s * 0.13, 0.28, 1.02), (0.15, 0.1, 0.12)), 'skin', 'body')
# ---- head (rigid to head bone)
H = 'head'
P(lumpy(ico('skull', (0, 0.45, 1.24), (0.15, 0.15, 0.14)), 0.015), 'skin', H)
P(ico('brow', (0, 0.55, 1.29), (0.145, 0.065, 0.05)), 'skin', H)
P(ico('nose', (0, 0.62, 1.2), (0.05, 0.07, 0.085), rot=(0.4, 0, 0)), 'skin', H)
P(ico('jaw', (0, 0.55, 1.1), (0.13, 0.11, 0.072)), 'skin', H)
P(ico('mouth', (0, 0.62, 1.13), (0.09, 0.03, 0.02)), 'mouth', H)
for s in (1, -1):
    P(tube('tusk', [(s * 0.07, 0.6, 1.11), (s * 0.09, 0.64, 1.17), (s * 0.085, 0.63, 1.23)], 0.024, 0.002), 'bone', H)
    P(cone('tooth', (s * 0.03, 0.645, 1.135), (s * 0.03, 0.65, 1.165), 0.011), 'bone', H)
    P(ico('eye', (s * 0.065, 0.575, 1.255), (0.024, 0.02, 0.02)), 'eye', H)
    P(ico('lid', (s * 0.065, 0.58, 1.275), (0.04, 0.025, 0.018), rot=(0, s * 0.3, 0)), 'skin', H)
    ear = cone('ear', (s * 0.12, 0.44, 1.27), (s * 0.29, 0.35, 1.35), 0.055, 0.0, seg=10); ear.scale = (1, 1, 0.45); activate(ear); bpy.ops.object.transform_apply(scale=True); P(ear, 'skin', H)
    P(torus('ring', (s * 0.19, 0.4, 1.3), 0.022, 0.005, rot=(0, math.pi / 2, 0)), 'iron', H)
for k in range(9):
    a = (k / 8 - 0.5) * 2.2; x = math.sin(a) * 0.12
    P(tube('hair', [(x, 0.42 + abs(x) * 0.3, 1.37), (x * 1.3, 0.34, 1.33), (x * 1.5, 0.28 - k % 3 * 0.02, 1.2 - (k % 3) * 0.05)], 0.018, 0.004), 'hair', H)
for o, b in parts:
    if b == 'head': o.data.transform(Matrix.Translation((0, 0.5, 1.2)) @ Matrix.Scale(1.25, 4) @ Matrix.Translation((0, -0.5, -1.2)))
# ---- moss mantle with toadstools and glowing blue mushrooms
rnd = random.Random(4)
for i in range(34):   # clumps over hump and shoulders
    u = rnd.uniform(-1, 1); v = rnd.uniform(0, 1); x = u * 0.44; y = 0.12 - v * 0.3; z = 1.37 - abs(u) ** 1.6 * 0.24 - v * 0.08
    r = rnd.uniform(0.07, 0.12); P(lumpy(ico('moss', (x, y, z), (r, r, r * 0.6), sub=2), 0.05, 12, seed=i), 'moss', 'body')
for k in range(46):   # hanging strands
    a = rnd.uniform(-math.pi * 0.95, math.pi * 0.05); x, y = math.cos(a) * 0.42, 0.02 + math.sin(a) * 0.22
    z = 1.26 - abs(x) * 0.25; L = rnd.uniform(0.08, 0.24)
    P(tube('strand', [(x, y, z), (x * 1.04, y - 0.01, z - L * 0.5), (x * 1.02 + rnd.uniform(-0.02, 0.02), y - 0.02, z - L)], 0.02, 0.004, res=3, bevel=4), 'moss', 'body')
def shroom(x, y, z, r, red):
    P(cone('st', (x, y, z), (x, y, z + r * 1.4), r * 0.3, r * 0.22, seg=10), 'stem', 'body')
    cap = sphere('cap', (x, y, z + r * 1.4), (r, r, r * 0.6)); bm = bmesh.new(); bm.from_mesh(cap.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < z + r * 1.4 - r * 0.1], context='VERTS'); bm.to_mesh(cap.data); bm.free()
    P(cap, 'cap' if red else 'blue', 'body')
for x, y, z, r in [(0.3, 0.02, 1.36, 0.07), (0.2, -0.06, 1.4, 0.045), (-0.05, -0.12, 1.45, 0.06), (-0.26, 0.0, 1.37, 0.05), (0.08, -0.02, 1.47, 0.035)]: shroom(x, y, z, r, True)
for x, y, z, r in [(-0.36, 0.1, 1.3, 0.025), (-0.33, 0.14, 1.28, 0.02), (0.4, 0.1, 1.27, 0.022), (-0.5, 0.2, 0.9, 0.018), (-0.51, 0.2, 0.87, 0.014)]: shroom(x, y, z, r, False)
# ---- loincloth, belt with skulls
skirt = cone('skirt', (0, 0.05, 0.75), (0, 0.08, 0.4), 0.28, 0.38, seg=32); skirt.scale = (1, 0.85, 1); activate(skirt); bpy.ops.object.transform_apply(scale=True)
bm = bmesh.new(); bm.from_mesh(skirt.data); bmesh.ops.delete(bm, geom=[f for f in bm.faces if abs(f.normal.z) > 0.9], context='FACES_ONLY')
bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True); bm.to_mesh(skirt.data); bm.free()
jag(skirt, 0.055, below=0.52, seed=5); mod = skirt.modifiers.new('sol', 'SOLIDIFY'); mod.thickness = 0.012; apply_all(skirt); smooth(skirt); P(skirt, 'leather', 'body')
P(torus('belt', (0, 0.03, 0.74), 0.265, 0.03, scale=(1, 0.86, 1)), 'leather', 'body')
for k in range(5):
    a = math.pi / 2 + (k - 2) * 0.42; x, y = math.cos(a) * 0.29, 0.03 + math.sin(a) * 0.25
    P(ico('skull', (x, y, 0.69), (0.042, 0.04, 0.046)), 'bone', 'body'); P(ico('jaw', (x, y + 0.012, 0.655), (0.028, 0.026, 0.018)), 'bone', 'body')
    for s in (1, -1): P(ico('sock', (x + s * 0.016 * math.sin(a), y + 0.03, 0.695), (0.012, 0.01, 0.012)), 'dark', 'body')
# ---- hands, wraps, feet
for s, arm in ((-1, 'arm_r'), (1, 'arm_l')):
    wx, wy = s * 0.52, 0.26
    for k in range(3): P(torus('wrap', (wx, wy, 0.47 + k * 0.045), 0.085, 0.022, rot=(0.2, 0, s * 0.1)), 'leather', arm)
    P(lumpy(ico('hand', (wx + s * 0.01, wy + 0.04, 0.36), (0.085, 0.09, 0.1)), 0.008), 'skin', arm)
    if s < 0:   # open clawed hand
        for f in range(4):
            fx = wx + s * (-0.04 + f * 0.03); pts = [(fx, wy + 0.08, 0.34), (fx + s * 0.005, wy + 0.1, 0.26), (fx, wy + 0.06, 0.2)]
            P(tube('finger', pts, 0.02, 0.014), 'skin', arm); P(cone('claw', pts[-1], (fx, wy + 0.02, 0.16), 0.013), 'claw', arm)
    else:       # fist gripping the club
        for f in range(4): P(ico('knuckle', (wx + s * (-0.03 + f * 0.022), wy + 0.1, 0.36 - f * 0.012), (0.024, 0.03, 0.026)), 'skin', arm)
for s, leg in ((1, 'leg_fl'), (-1, 'leg_fr')):
    fx = s * 0.22
    for k in range(3): P(torus('awrap', (fx, 0.02, 0.1 + k * 0.045), 0.095, 0.024), 'leather', leg)
    P(lumpy(ico('foot', (fx, 0.08, 0.05), (0.1, 0.15, 0.06)), 0.01), 'skin', leg)
    for t in range(3):
        tx = fx + s * (t - 1) * 0.055; P(ico('toe', (tx, 0.2, 0.04), (0.035, 0.05, 0.035)), 'skin', leg); P(cone('tclaw', (tx, 0.23, 0.035), (tx, 0.28, 0.01), 0.018), 'claw', leg)
# ---- the club, dragged in the right hand (Blender -X)
a, b = Vector((0.54, 0.3, 0.42)), Vector((0.68, 1.06, 0.08)); d = (b - a).normalized()
log = cone('club', a, b, 0.045, 0.125, seg=16, smooth_shade=True); img_displace(log, 'bark', 0.01, 3); P(log, 'bark', 'arm_l')
for f in (0.55, 0.86): r = 0.045 + (0.125 - 0.045) * f + 0.012; P(ring_at('band', a + (b - a) * f, d, r, 0.018), 'iron', 'arm_l')
side = d.cross(Vector((0, 0, 1))).normalized(); up = side.cross(d).normalized()
for k in range(14):
    f = 0.6 + (k // 7) * 0.24 + (k % 2) * 0.05; ang = k * 2.39; r = 0.045 + (0.125 - 0.045) * f
    n = side * math.cos(ang) + up * math.sin(ang); base = a + (b - a) * f + n * r * 0.9
    P(cone('spike', base, base + n * 0.075, 0.018), 'iron', 'arm_l')
# ---- rig: bones at the joints; legs/arms/head swing, everything else rides the body
bones = {'body': ((0, 0, 0.6), (0, 0, 1.1), None),
         'leg_fl': ((0.15, 0.0, 0.62), (0.21, 0.02, 0.1), 'body'), 'leg_fr': ((-0.15, 0.0, 0.62), (-0.21, 0.02, 0.1), 'body'),
         'arm_l': ((0.36, 0.1, 1.16), (0.52, 0.25, 0.44), 'body'), 'arm_r': ((-0.36, 0.1, 1.16), (-0.52, 0.25, 0.44), 'body'),
         'head': ((0, 0.3, 1.2), (0, 0.52, 1.26), 'body')}
troll, piv = rig(body, parts, bones)
out = pathlib.Path(sys.argv[-1]) if sys.argv[-1].endswith('.png') else None
d = bake_and_export('troll', troll, piv, size=1024, near_tris=9000, far_tris=1800, preview=out, ref=ROOT.parent / 'docs/concept/ref/troll.jpg', sat=1.35, gain=0.78)
print('troll tris near', d['near']['tris'], 'far', d['far']['tris'])
