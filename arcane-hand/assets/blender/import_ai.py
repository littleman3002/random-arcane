"""Import an image-to-3D creature (TRELLIS .glb in assets/ai3d, made from docs/concept/ref/<name>.jpg) into the game format.
Orients and scales it, decimates to near/far LODs (UVs kept), tags animation regions (legs, arms, head, tail, body waves)
from the geometry, samples a glow mask from bright saturated texels, and writes assets/models/<name>.json + .jpg.
python3 assets/blender/import_ai.py <name> [preview.png]"""
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).parent)); from ah import *

# yaw: degrees about up to make the creature face +Y (Blender) = +Z (game).  size: ('h' height | 'l' length | 'w' width, value in tiles)
# rig: region rules.  glow: (min value, min saturation, strength)
CFG = {
  'troll':   dict(yaw=180, size=('h', 1.6), rig='biped_arms', glow=(0.7, 0.55, 1.4), near=12000, far=2200),
  'grub':    dict(yaw=180, size=('l', 1.35), rig='crawler', glow=(0.55, 0.5, 2.2), near=7000, far=1400),
  'skitter': dict(yaw=180, size=('w', 1.05), rig='spider', glow=(0.45, 0.55, 2.4), near=5000, far=1000),
  'dasher':  dict(yaw=90, size=('l', 1.45), rig='quad', glow=(0.75, 0.6, 2.2), near=7000, far=1400),
  'bulwark': dict(yaw=180, size=('l', 1.4), rig='quad_low', glow=(0.55, 0.45, 1.6), near=8000, far=1600),
  'wisp':    dict(yaw=180, size=('w', 1.2), rig='wings', glow=(0.6, 0.3, 1.6), near=6000, far=1200),
  'knight':  dict(yaw=180, size=('h', 1.55), rig='biped_arms', glow=(0.6, 0.6, 2.0), near=9000, far=1800),
  'budling': dict(yaw=180, size=('h', 1.1), rig='quad', glow=(0.75, 0.5, 2.2), near=7000, far=1400),
  'boss':    dict(yaw=180, size=('h', 3.3), rig='biped_arms', glow=(0.6, 0.5, 2.4), near=20000, far=4000),
}

def load(name, cfg):
    reset(); bpy.ops.import_scene.gltf(filepath=str(ROOT / 'ai3d' / f'{name}_trellis.glb'))
    ms = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in bpy.data.objects:
        if o.type != 'MESH': o.select_set(False)
    bpy.ops.object.select_all(action='DESELECT')
    for o in ms: o.select_set(True)
    C().view_layer.objects.active = ms[0]
    if len(ms) > 1: bpy.ops.object.join()
    o = C().object; o.parent = None; o.matrix_world = o.matrix_world.copy()
    o.data.transform(o.matrix_world); o.matrix_world = Matrix.Identity(4)
    o.data.transform(Matrix.Rotation(math.radians(cfg['yaw']), 4, 'Z'))
    co = np.array([v.co[:] for v in o.data.vertices]); lo, hi = co.min(0), co.max(0)
    k, val = cfg['size']; ext = {'h': hi[2] - lo[2], 'l': hi[1] - lo[1], 'w': hi[0] - lo[0]}[k]; s = val / ext
    o.data.transform(Matrix.Scale(s, 4) @ Matrix.Translation(Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))))
    for ob in list(bpy.data.objects):
        if ob != o: bpy.data.objects.remove(ob)
    return o

def base_image(o):
    for m in o.data.materials:
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image: return n.image
    return None

def regions(co, rig):
    """-> limb id (int array), weight (0..1), pivot per limb {id: (x,y,z)} in Blender coordinates."""
    n = len(co); limb = np.zeros(n, np.int32); w = np.zeros(n); piv = {}
    x, y, z = co[:, 0], co[:, 1], co[:, 2]; H = z.max(); Lf, Lb = y.max(), y.min(); W = np.abs(x).max()
    ramp = lambda v, a, b: np.clip((v - a) / (b - a), 0, 1)
    def put(mask, lid, wt, p): limb[mask] = lid; w[mask] = wt[mask]; piv[lid] = p
    if rig in ('quad', 'quad_low'):
        hip = H * (0.42 if rig == 'quad' else 0.3); legs = z < hip
        for lid, sx, front in ((1, -1, 1), (2, 1, 1), (3, -1, 0), (4, 1, 0)):
            m = legs & ((x < 0) if sx < 0 else (x >= 0)) & ((y > (Lf + Lb) / 2) if front else (y <= (Lf + Lb) / 2))
            if m.any(): c = co[m].mean(0); put(m, lid, ramp(hip - z, 0, hip * 0.7) * ramp(np.abs(x), W * 0.04, W * 0.22) * ramp(np.abs(y - (Lf + Lb) / 2), 0.01, (Lf - Lb) * 0.12), (c[0], c[1], hip))
        head = (y > Lb + (Lf - Lb) * 0.72) & ~legs; put(head, 5, ramp(y, Lb + (Lf - Lb) * 0.72, Lf) ** 0.8, (0, Lb + (Lf - Lb) * 0.72, co[head, 2].mean() if head.any() else H * 0.6))
        tail = (y < Lb + (Lf - Lb) * 0.2) & ~legs; put(tail, 6, ramp(-y, -(Lb + (Lf - Lb) * 0.2), -Lb), (0, Lb + (Lf - Lb) * 0.2, co[tail, 2].mean() if tail.any() else H * 0.5))
    elif rig == 'biped_arms':
        hip = H * 0.42; sh = H * 0.8
        # measure the torso half-width at chest height: arms hang outside it, legs sit inside it
        chest = co[(z > H * 0.55) & (z < H * 0.7)]; tw = np.percentile(np.abs(chest[:, 0]), 60) if len(chest) else W * 0.35
        legs = (z < hip) & (np.abs(x) < tw)
        for lid, sx in ((1, -1), (2, 1)):
            m = legs & ((x < 0) if sx < 0 else (x >= 0))
            if m.any(): c = co[m].mean(0); put(m, lid, ramp(hip - z, 0, hip * 0.8) * ramp(np.abs(x), tw * 0.05, tw * 0.3) * ramp(tw - np.abs(x), 0, tw * 0.2), (c[0], c[1], hip))
        for lid, sx in ((7, 1), (8, -1)):
            m = (sx * x > tw) & (z < sh)
            if m.any(): put(m, lid, ramp(sx * x, tw, tw * 1.35) * ramp(sh - z, 0, H * 0.25), (sx * tw, co[m, 1].mean(), sh))
        head = (z > H * 0.74) & (np.abs(x) < tw * 0.8) & (y > (Lf + Lb) / 2 - 0.05)
        put(head, 5, ramp(z, H * 0.74, H * 0.9) * ramp(tw * 0.8 - np.abs(x), 0, tw * 0.25), (0, co[head, 1].mean() if head.any() else 0, H * 0.76))
    elif rig == 'crawler':
        L = Lf - Lb
        for i, lid in enumerate((14, 13, 12, 11)):
            a, b = Lb + L * i / 4, Lb + L * (i + 1) / 4; m = (y >= a) & (y <= b + 1e-6); put(m, lid, np.ones(n), (0, (a + b) / 2, H * 0.4))
        head = y > Lb + L * 0.8; put(head, 5, ramp(y, Lb + L * 0.8, Lf), (0, Lb + L * 0.8, H * 0.45))
    elif rig == 'spider':
        # legs are the thin parts low around the body; the abdomen and head stay rigid
        cy = (Lf + Lb) / 2; r = np.hypot(x, (y - cy) * 0.8)
        body_r = np.percentile(r[z > H * 0.45], 70) if (z > H * 0.45).any() else W * 0.3
        leg = (r > body_r * 0.9) & (z < H * 0.8)
        ang = np.arctan2(y - cy, x); grp = (np.floor((ang + math.pi) / (math.pi / 4)).astype(int)) % 2
        for lid, g in ((15, 0), (16, 1)):
            m = leg & (grp == g); put(m, lid, ramp(r, body_r * 0.9, body_r * 1.5), (0, cy, H * 0.45))
    elif rig == 'wings':
        for lid, sx in ((9, -1), (10, 1)):
            m = sx * x > W * 0.18; put(m, lid, ramp(sx * x, W * 0.12, W * 0.5), (sx * W * 0.12, 0, H * 0.55))
    return limb, w, piv

def rebake(src, name, target, size=1024):
    """seam-free copy of src, decimated to `target` tris, fresh UVs, colour baked from the full-detail source."""
    for m in src.data.materials:                     # glTF imports can carry metallic = 1, which bakes a black diffuse colour
        b = m.node_tree.nodes.get('Principled BSDF')
        if b:
            for l in list(b.inputs['Metallic'].links): m.node_tree.links.remove(l)
            b.inputs['Metallic'].default_value = 0.0
    low = src.copy(); low.data = src.data.copy(); C().collection.objects.link(low); activate(low)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=0.0015); bpy.ops.object.mode_set(mode='OBJECT')
    low.data.calc_loop_triangles(); n = len(low.data.loop_triangles)
    if target < n: dm = low.modifiers.new('dec', 'DECIMATE'); dm.ratio = target / n; dm.use_collapse_triangulate = True; apply_all(low)
    while low.data.uv_layers: low.data.uv_layers.remove(low.data.uv_layers[0])
    low.data.uv_layers.new(name='UV'); activate(low); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.002, area_weight=0.8); bpy.ops.uv.pack_islands(rotate=True, margin=0.003); bpy.ops.object.mode_set(mode='OBJECT')
    smooth(low)
    img = bpy.data.images.new(name + '_bake', size, size); low.data.materials.clear(); m = bpy.data.materials.new('bake'); m.use_nodes = True
    t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = img; m.node_tree.nodes.active = t; low.data.materials.append(m)
    sc = C().scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 4; sc.render.bake.margin = 8
    sc.render.bake.use_selected_to_active = True; sc.render.bake.cage_extrusion = 0.04; sc.render.bake.max_ray_distance = 0.12
    bpy.ops.object.select_all(action='DESELECT'); src.select_set(True); low.select_set(True); C().view_layer.objects.active = low
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
    sc.render.bake.use_selected_to_active = False
    ao = bpy.data.images.new(name + '_ao', size, size); t.image = ao; sc.cycles.samples = 48
    bpy.ops.object.select_all(action='DESELECT'); activate(low); bpy.ops.object.bake(type='AO')
    c = np.array(img.pixels[:]).reshape(-1, 4); a = np.array(ao.pixels[:]).reshape(-1, 4)[:, :1]
    c[:, :3] *= 0.6 + 0.4 * a ** 1.3; img.pixels[:] = c.ravel()                                   # soft contact shadows in crevices
    return low, img

def export(name, preview=None):
    cfg = CFG[name]; o = load(name, cfg)
    near, img = rebake(o, name, cfg['near'])
    far = near.copy(); far.data = near.data.copy(); C().collection.objects.link(far); near.data.calc_loop_triangles()
    dm = far.modifiers.new('dec', 'DECIMATE'); dm.ratio = cfg['far'] / len(near.data.loop_triangles); apply_all(far)
    W = Hh = img.size[0]; px = np.array(img.pixels[:]).reshape(Hh, W, 4)[..., :3]                   # byte image: values are already sRGB
    data = {'name': name}; vmin, smin, gs = cfg['glow']
    for key, ob in (('near', near), ('far', far)):
        me = ob.data; me.calc_loop_triangles(); uvl = me.uv_layers.active.data
        co = np.array([v.co[:] for v in me.vertices]); limb, wt, piv = regions(co, cfg['rig'])
        if key == 'near': data['pivots'] = {int(k): to_game(v) for k, v in piv.items()}
        verts, idx, keyd = [], [], {}
        for tri in me.loop_triangles:
            for li in tri.loops:
                l = me.loops[li]; vi = l.vertex_index; uv = uvl[li].uv; k = (vi, round(uv[0], 5), round(uv[1], 5))
                if k not in keyd:
                    t = px[min(Hh - 1, max(0, int(uv[1] * Hh))), min(W - 1, max(0, int(uv[0] * W)))]; mx, mn = t.max(), t.min()
                    sat = (mx - mn) / mx if mx > 1e-4 else 0
                    g = gs * min(1, (mx - vmin) / 0.15) if (mx > vmin and sat > smin) else 0.0
                    n = me.vertices[vi].normal
                    keyd[k] = len(verts); verts.append((to_game(co[vi]), to_game(n), (uv[0], uv[1]), int(limb[vi]), float(wt[vi]), g, (0.72, 0.0)))
                idx.append(keyd[k])
        data[key] = packv(verts, idx)
    from PIL import Image
    # match the concept art's average colour (per channel), measured on the foreground of docs/concept/ref/<name>.jpg
    ref = np.asarray(Image.open(ROOT.parent / f'docs/concept/ref/{name}.jpg').convert('RGB')).reshape(-1, 3) / 255.; bg = ref[:50].mean(0); ref = ref[np.abs(ref - bg).sum(1) > 0.25].mean(0)
    used = px.reshape(-1, 3); used = used[used.sum(1) > 0.03].mean(0); gain = np.sqrt(np.clip(ref / np.maximum(used, 1e-3), 0.7, 3.0)) * cfg.get("gain", 1.0)   # halfway: the game lights brighter than the painting
    out = np.clip(px * gain * np.array([0.96, 1.0, 1.07]), 0, 1)                                # slight cool bias: the game's sun is warm
    print(name, 'colour gain', gain.round(2))
    Image.fromarray((np.flipud(out) * 255).astype(np.uint8)).save(str(OUT / f'{name}.jpg'), quality=86)
    (OUT / f'{name}.json').write_text(json.dumps(data))
    ng = sum(1 for v in [0]); print(name, 'tris', data['near']['tris'], data['far']['tris'], 'height', round(float(np.array([v.co[2] for v in near.data.vertices]).max()), 2), flush=True)
    if preview:
        bpy.data.objects.remove(o); img2 = bpy.data.images.load(str(OUT / f'{name}.jpg')); render_preview(near, img2, preview, ROOT.parent / f'docs/concept/ref/{name}.jpg')

def packv(verts, idx):
    P = np.array([v[0] for v in verts], np.float32); lo, hi = P.min(0), P.max(0); q = np.round((P - lo) / np.maximum(hi - lo, 1e-6) * 65535).astype(np.uint16)
    b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
    return {'n': len(verts), 'lo': lo.tolist(), 'hi': hi.tolist(), 'pos': b64(q),
            'nor': b64(np.round(np.array([v[1] for v in verts]) * 127).astype(np.int8)), 'uv': b64(np.round(np.clip(np.array([v[2] for v in verts]), 0, 1) * 65535).astype(np.uint16)),
            'limb': b64(np.array([v[3] for v in verts], np.uint8)), 'w': b64(np.round(np.array([v[4] for v in verts]) * 255).astype(np.uint8)),
            'glow': b64(np.round(np.clip(np.array([v[5] for v in verts]) / 4, 0, 1) * 255).astype(np.uint8)),
            'rm': b64(np.round(np.array([v[6] for v in verts]) * 255).astype(np.uint8)), 'idx': b64(np.array(idx, np.uint16 if len(verts) < 65536 else np.uint32)), 'tris': len(idx) // 3}

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.endswith('.png')]; pv = [a for a in sys.argv[1:] if a.endswith('.png')]
    for k, n in enumerate(args): export(n, pv[0].replace('.png', f'_{n}.png') if pv else None)
