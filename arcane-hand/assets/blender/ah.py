"""Arcane Hand creature toolkit for headless Blender (pip install bpy).
Builds a creature from skinned skeleton bodies + modelled parts, rigs it (armature, automatic weights), bakes one painted
texture (material colour x ambient occlusion), and exports a compact mesh the game loads (assets/models/<name>.json + .jpg).
Blender axes: X = creature's right, Y = forward, Z = up. Game axes: (-X, Z, Y)."""
import bpy, bmesh, math, json, base64, pathlib, random
import numpy as np
from mathutils import Vector, Matrix, Euler
ROOT = pathlib.Path(__file__).resolve().parent.parent
TEX = ROOT / 'creature_tex'; OUT = ROOT / 'models'; OUT.mkdir(exist_ok=True)
C = lambda: bpy.context

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    random.seed(7)

def _link(o):
    C().collection.objects.link(o) if o.name not in C().collection.objects else None
    return o

def activate(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); C().view_layer.objects.active = o

def apply_all(o):
    activate(o)
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

def smooth(o, on=True):
    for p in o.data.polygons: p.use_smooth = on

# ---------------------------------------------------------------- shapes
def skin(name, nodes, edges, mirror=False, subdiv=2, smooth_shade=True):
    """nodes: list of (x, y, z, rx[, ry]); edges: index pairs. Mirror duplicates x>0 nodes to the left side."""
    me = bpy.data.meshes.new(name); me.from_pydata([n[:3] for n in nodes], edges, []); o = _link(bpy.data.objects.new(name, me))
    if mirror: mm = o.modifiers.new('mir', 'MIRROR'); mm.use_clip = True; mm.merge_threshold = 0.002
    sk = o.modifiers.new('skin', 'SKIN'); sk.use_smooth_shade = smooth_shade; sk.branch_smoothing = 0.6
    for i, n in enumerate(nodes):
        d = me.skin_vertices[''].data[i]; d.radius = (n[3], n[4] if len(n) > 4 else n[3]); d.use_root = (i == 0)
    if subdiv: s = o.modifiers.new('sub', 'SUBSURF'); s.levels = s.render_levels = subdiv
    apply_all(o); smooth(o, smooth_shade); return o

def ico(name, loc, scale, rot=(0, 0, 0), sub=3):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, location=loc, rotation=rot); o = C().object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(scale=True, rotation=True); smooth(o); return o

def sphere(name, loc, scale, rot=(0, 0, 0), seg=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc, rotation=rot); o = C().object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(scale=True, rotation=True); smooth(o); return o

def cone(name, a, b, r0, r1=0.0, seg=12, smooth_shade=True):
    a, b = Vector(a), Vector(b); d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r0, radius2=r1, depth=d.length, location=(a + b) / 2); o = C().object; o.name = name
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bpy.ops.object.transform_apply(rotation=True); smooth(o, smooth_shade); return o

def torus(name, loc, R, r, rot=(0, 0, 0), scale=(1, 1, 1), maj=32, mnr=10):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=maj, minor_segments=mnr, location=loc, rotation=rot); o = C().object; o.name = name
    o.scale = scale; bpy.ops.object.transform_apply(scale=True, rotation=True); smooth(o); return o

def ring_at(name, loc, axis, R, r, maj=28):
    o = torus(name, (0, 0, 0), R, r, maj=maj); q = Vector((0, 0, 1)).rotation_difference(Vector(axis).normalized())
    o.data.transform(Matrix.Translation(Vector(loc)) @ q.to_matrix().to_4x4()); o.data.update(); return o

def tube(name, pts, r0, r1=None, res=6, bevel=10):
    """tapered tube along points (horns, tusks, tails, vines, toes)."""
    r1 = r0 if r1 is None else r1; cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1; cu.bevel_resolution = bevel // 2; cu.use_fill_caps = True
    sp = cu.splines.new('NURBS'); sp.points.add(len(pts) - 1); sp.use_endpoint_u = True; sp.order_u = min(4, len(pts)); sp.resolution_u = res
    for i, p in enumerate(pts): t = i / (len(pts) - 1); sp.points[i].co = (*p, 1); sp.points[i].radius = r0 + (r1 - r0) * t
    o = _link(bpy.data.objects.new(name, cu)); activate(o); bpy.ops.object.convert(target='MESH'); o = C().object; smooth(o); return o

def lumpy(o, amount, scale=6.0, seed=1):
    """noise-displace an organic surface (warts, rock, moss clumps)."""
    tex = bpy.data.textures.new(o.name + 'n', 'CLOUDS'); tex.noise_scale = 1 / scale; tex.noise_depth = 2
    m = o.modifiers.new('lump', 'DISPLACE'); m.texture = tex; m.strength = amount; m.mid_level = 0.5; m.texture_coords = 'OBJECT'
    apply_all(o); return o

def img_displace(o, texname, amount, scale=4.0):
    """surface relief from one of the Grok textures (skin bumps, bark, scales)."""
    im = bpy.data.images.load(str(TEX / f'{texname}.png'), check_existing=True)
    tex = bpy.data.textures.new(o.name + 'd', 'IMAGE'); tex.image = im
    if not o.data.uv_layers: activate(o); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.cube_project(cube_size=1 / scale); bpy.ops.object.mode_set(mode='OBJECT')
    m = o.modifiers.new('rel', 'DISPLACE'); m.texture = tex; m.strength = amount; m.mid_level = 0.5; m.texture_coords = 'UV'
    apply_all(o)
    while o.data.uv_layers: o.data.uv_layers.remove(o.data.uv_layers[0])
    return o

def jag(o, amount, axis=2, below=None, seed=3):
    """ragged edges: jitter vertices (optionally only those below a height) for torn cloth."""
    rnd = random.Random(seed)
    for v in o.data.vertices:
        if below is None or v.co[axis] < below: v.co += Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * amount
    return o

# ---------------------------------------------------------------- materials (baked into one texture per creature)
def mat(name, color=(1, 1, 1), tex=None, tscale=3.0, rough=0.7, metal=0.0, glow=0.0, noise=0.25, noise2=None, spots=None):
    """color multiplies the texture; noise adds large-scale variation; noise2 = (color, amount, scale) mottles in a second colour;
    spots = (color, scale, threshold) Voronoi dots (toadstool caps). glow is stored per vertex for the game's emissive."""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links
    bsdf = N['Principled BSDF']; bsdf.inputs['Roughness'].default_value = rough; bsdf.inputs['Metallic'].default_value = 0.0  # metal/glow go to the game per vertex; baking wants plain albedo
    tc = N.new('ShaderNodeTexCoord'); col = N.new('ShaderNodeRGB'); col.outputs[0].default_value = (*srgb(color), 1)
    out = col.outputs[0]
    if tex:
        mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (tscale,) * 3; L.new(tc.outputs['Object'], mp.inputs['Vector'])
        it = N.new('ShaderNodeTexImage'); it.image = bpy.data.images.load(str(TEX / f'{tex}.png'), check_existing=True); it.projection = 'BOX'; it.projection_blend = 0.3
        L.new(mp.outputs['Vector'], it.inputs['Vector']); mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1
        L.new(it.outputs['Color'], mx.inputs[6]); L.new(out, mx.inputs[7]); out = mx.outputs[2]
    if noise2:
        c2, amt, sc = noise2; nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = sc; L.new(tc.outputs['Object'], nz.inputs['Vector'])
        rp = N.new('ShaderNodeValToRGB'); rp.color_ramp.elements[0].position = 0.5; rp.color_ramp.elements[1].position = 0.62; L.new(nz.outputs['Fac'], rp.inputs['Fac'])
        mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; L.new(rp.outputs['Color'], mx.inputs['Factor']); mx.inputs['Factor'].default_value = amt
        c2n = N.new('ShaderNodeRGB'); c2n.outputs[0].default_value = (*srgb(c2), 1); L.new(out, mx.inputs[6]); L.new(c2n.outputs[0], mx.inputs[7])
        mul = N.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = amt; L.new(rp.outputs['Color'], mul.inputs[0]); L.new(mul.outputs[0], mx.inputs['Factor']); out = mx.outputs[2]
    if spots:
        c2, sc, th = spots; vo = N.new('ShaderNodeTexVoronoi'); vo.feature = 'DISTANCE_TO_EDGE' if False else 'F1'; vo.inputs['Scale'].default_value = sc; L.new(tc.outputs['Object'], vo.inputs['Vector'])
        rp = N.new('ShaderNodeValToRGB'); rp.color_ramp.elements[0].position = th; rp.color_ramp.elements[1].position = th + 0.04; rp.color_ramp.elements[0].color = (1, 1, 1, 1); rp.color_ramp.elements[1].color = (0, 0, 0, 1)
        L.new(vo.outputs['Distance'], rp.inputs['Fac']); mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; L.new(rp.outputs['Color'], mx.inputs['Factor'])
        c2n = N.new('ShaderNodeRGB'); c2n.outputs[0].default_value = (*srgb(c2), 1); L.new(out, mx.inputs[6]); L.new(c2n.outputs[0], mx.inputs[7]); out = mx.outputs[2]
    if noise:
        nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.5; L.new(tc.outputs['Object'], nz.inputs['Vector'])
        mr = N.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 1 - noise; mr.inputs['To Max'].default_value = 1 + noise * 0.6; L.new(nz.outputs['Fac'], mr.inputs['Value'])
        mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1
        cm = N.new('ShaderNodeCombineColor'); [L.new(mr.outputs[0], cm.inputs[i]) for i in range(3)]; L.new(out, mx.inputs[6]); L.new(cm.outputs[0], mx.inputs[7]); out = mx.outputs[2]
    L.new(out, bsdf.inputs['Base Color'])
    m['glow'] = glow; m['rough'] = rough; m['metal'] = metal
    return m

def srgb(c):
    if isinstance(c, int): c = ((c >> 16) & 255, (c >> 8) & 255, c & 255)
    c = [v / 255 if max(c) > 1 else v for v in c]
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c)

def paint(objs, m):
    for o in (objs if isinstance(objs, (list, tuple)) else [objs]): o.data.materials.clear(); o.data.materials.append(m)

# ---------------------------------------------------------------- rig
LIMB = {'leg_fl': 1, 'leg_fr': 2, 'leg_bl': 3, 'leg_br': 4, 'head': 5, 'tail': 6, 'arm_l': 7, 'arm_r': 8, 'wing_l': 9, 'wing_r': 10,
        'seg1': 11, 'seg2': 12, 'seg3': 13, 'seg4': 14, 'sleg_a': 15, 'sleg_b': 16, 'ant': 17, 'orbit': 20, 'float': 21, 'cape': 23}
def rig(body, rigid, bones):
    """bones: name -> (head, tail, parent). body gets automatic weights; rigid = [(obj, bone)] follow one bone exactly.
    Returns the joined mesh (vertex groups = bone names) and bone heads (pivots)."""
    ad = bpy.data.armatures.new('rig'); arm = _link(bpy.data.objects.new('rig', ad)); activate(arm); bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for n, (h, t, par) in bones.items():
        b = ad.edit_bones.new(n); b.head = h; b.tail = t; eb[n] = b
    for n, (h, t, par) in bones.items():
        if par: eb[n].parent = eb[par]
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); arm.select_set(True); C().view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for o, bn in rigid:
        vg = o.vertex_groups.new(name=bn); vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    bpy.ops.object.select_all(action='DESELECT')
    for o, _ in rigid: o.select_set(True)
    body.select_set(True); C().view_layer.objects.active = body; bpy.ops.object.join()
    piv = {n: tuple(h) for n, (h, t, par) in bones.items()}
    body.modifiers.clear(); body.parent = None; bpy.data.objects.remove(arm)
    return body, piv

# ---------------------------------------------------------------- bake + export
def bake_and_export(name, o, piv, size=1024, near_tris=9000, far_tris=1800, preview=None, ref=None, sat=1.25, gain=1.0):
    sc = C().scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.render.bake.margin = 6
    activate(o); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.002, area_weight=0.8)
    bpy.ops.uv.select_all(action='SELECT'); bpy.ops.uv.average_islands_scale(); bpy.ops.uv.pack_islands(rotate=True, margin=0.0025); bpy.ops.object.mode_set(mode='OBJECT')
    col = bpy.data.images.new(name + '_col', size, size); ao = bpy.data.images.new(name + '_ao', size, size)
    def target(img):
        for m in o.data.materials:
            n = m.node_tree.nodes.get('bake') or m.node_tree.nodes.new('ShaderNodeTexImage'); n.name = 'bake'; n.image = img; m.node_tree.nodes.active = n
    target(col); bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
    sc.cycles.samples = 64; target(ao); bpy.ops.object.bake(type='AO')
    c = np.array(col.pixels[:]).reshape(size, size, 4); a = np.array(ao.pixels[:]).reshape(size, size, 4)[..., :1]
    out = c.copy(); out[..., :3] = c[..., :3] * (0.18 + 0.82 * a ** 1.4)                 # both images hold linear values here
    lin2s = lambda x: np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(np.clip(x, 0, 1), 1 / 2.4) - 0.055)
    lum = out[..., :3].mean(-1, keepdims=True); out[..., :3] = np.clip((lum + (out[..., :3] - lum) * sat) * gain, 0, 1)   # grade for the game's warm dusk light
    out[..., :3] = lin2s(out[..., :3]); res = bpy.data.images.new(name + '_tex', size, size); res.colorspace_settings.name = 'Non-Color'
    res.pixels[:] = out.ravel(); res.filepath_raw = str(OUT / f'{name}.jpg'); res.file_format = 'JPEG'; sc.render.image_settings.quality = 88; res.save()
    o.data.calc_loop_triangles(); full = len(o.data.loop_triangles); lods = {}
    for key, tgt in (('near', near_tris), ('far', far_tris)):
        ob = o.copy(); ob.data = o.data.copy(); _link(ob)
        if tgt < full: dm = ob.modifiers.new('dec', 'DECIMATE'); dm.ratio = tgt / full; apply_all(ob)
        lods[key] = ob
    data = {'name': name, 'pivots': {LIMB[k]: to_game(v) for k, v in piv.items() if k in LIMB}}
    for key, ob in lods.items(): data[key] = pack(ob)
    (OUT / f'{name}.json').write_text(json.dumps(data))
    if preview: render_preview(lods['near'], res, preview, ref)
    for ob in lods.values(): bpy.data.objects.remove(ob)
    return data

def to_game(v): return [-v[0], v[2], v[1]]

def pack(o):
    me = o.data; me.calc_loop_triangles(); uvl = me.uv_layers.active.data
    gidx = {g.index: g.name for g in o.vertex_groups}; mats = me.materials
    verts, idx, key = [], [], {}
    for tri in me.loop_triangles:
        mt = mats[tri.material_index] if mats else None; g = mt.get('glow', 0.0) if mt else 0.0; rm = (mt.get('rough', 0.7), mt.get('metal', 0.0)) if mt else (0.7, 0.0)
        for li in tri.loops:                                  # (-x, z, y) is two reflections = a rotation: winding is kept
            l = me.loops[li]; v = me.vertices[l.vertex_index]; uv = uvl[li].uv; n = v.normal if tri.use_smooth else tri.normal
            k = (l.vertex_index, round(uv[0], 4), round(uv[1], 4), round(g, 2), rm)
            if k not in key:
                best, bw, tot = 0, 0.0, 0.0
                for ge in v.groups:
                    nm = gidx.get(ge.group); tot += ge.weight
                    if nm in LIMB and ge.weight > bw: best, bw = LIMB[nm], ge.weight
                key[k] = len(verts); verts.append((to_game(v.co), to_game(n), (uv[0], uv[1]), best, (bw / tot) if tot > 0 else 0.0, g, rm))
            idx.append(key[k])
    P = np.array([v[0] for v in verts], np.float32); lo, hi = P.min(0), P.max(0); q = np.round((P - lo) / np.maximum(hi - lo, 1e-6) * 65535).astype(np.uint16)
    b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
    return {'n': len(verts), 'lo': lo.tolist(), 'hi': hi.tolist(), 'pos': b64(q),
            'nor': b64(np.round(np.array([v[1] for v in verts]) * 127).astype(np.int8)), 'uv': b64(np.round(np.clip(np.array([v[2] for v in verts]), 0, 1) * 65535).astype(np.uint16)),
            'limb': b64(np.array([v[3] for v in verts], np.uint8)), 'w': b64(np.round(np.array([v[4] for v in verts]) * 255).astype(np.uint8)),
            'glow': b64(np.round(np.clip(np.array([v[5] for v in verts]) / 4, 0, 1) * 255).astype(np.uint8)), 'rm': b64(np.round(np.array([v[6] for v in verts]) * 255).astype(np.uint8)), 'idx': b64(np.array(idx, np.uint16 if len(verts) < 65536 else np.uint32)), 'tris': len(idx) // 3}

def render_preview(o, img, path, ref=None, size=520):
    """3/4 front (like the concept art), side, and the game's top-down 3/4 camera; the reference image goes on the left."""
    m = bpy.data.materials.new('preview'); m.use_nodes = True; N = m.node_tree.nodes; t = N.new('ShaderNodeTexImage'); t.image = img
    img.colorspace_settings.name = 'sRGB'; m.node_tree.links.new(t.outputs['Color'], N['Principled BSDF'].inputs['Base Color']); N['Principled BSDF'].inputs['Roughness'].default_value = 0.7
    me = o.data; me.materials.clear(); me.materials.append(m)
    for p in me.polygons: p.material_index = 0
    for ob in list(bpy.data.objects):
        if ob.type == 'MESH' and ob != o: ob.hide_render = True
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]; ctr = sum(bb, Vector()) / 8; rad = max((v - ctr).length for v in bb)
    cd = bpy.data.cameras.new('c'); cd.lens = 50; cam = _link(bpy.data.objects.new('c', cd))
    sd = bpy.data.lights.new('s', 'SUN'); sd.energy = 3.2; sun = _link(bpy.data.objects.new('s', sd)); sun.rotation_euler = (0.7, 0.3, -0.6)
    w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.58, 0.62, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
    sc = C().scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.world = w; sc.camera = cam; sc.render.resolution_x = sc.render.resolution_y = size; sc.cycles.samples = 32
    from PIL import Image
    tiles = []
    for k, (az, el) in enumerate([(1.0, 0.2), (1.5708, 0.05), (-0.6, 0.85)]):
        d = rad * 2.7; loc = ctr + Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))) * d
        cam.location = loc; cam.rotation_mode = 'QUATERNION'; cam.rotation_quaternion = (ctr - loc).to_track_quat('-Z', 'Y')
        f = str(path) + f'.{k}.png'; sc.render.filepath = f; sc.render.image_settings.file_format = 'PNG'; bpy.ops.render.render(write_still=True); tiles.append(Image.open(f).convert('RGB'))
    if ref:
        r = Image.open(ref).convert('RGB'); r.thumbnail((size, size)); bg = Image.new('RGB', (size, size), (140, 148, 158)); bg.paste(r, ((size - r.width) // 2, (size - r.height) // 2)); tiles.insert(0, bg)
    sheet = Image.new('RGB', (size * len(tiles), size))
    for k, t in enumerate(tiles): sheet.paste(t, (k * size, 0))
    sheet.save(str(path))
