"""Build the 3D man (toon puppet matching ek-pinjare-mai man2d + owner model sheet) and export a skinned glTF.
Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/build_man.py
Blender axes: Z up, character faces -Y (glTF: +Z forward). Rest pose: standing, arms in a relaxed A.
Every garment is its own mesh so the site's ink pass outlines each piece, like the 2D drawing."""
import math
import os

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "site", "public", "media", "man", "man.glb")

# ---------------------------------------------------------------- joints (m)
J = dict(
    hips=(0, 0, 0.96), spine=(0, 0, 1.12), chest=(0, 0, 1.30), neck=(0, 0, 1.44), head=(0, 0, 1.48), top=(0, 0, 1.89),
)
for s, x in (("L", 1), ("R", -1)):
    J.update({
        f"sh.{s}": (x * 0.16, 0.0, 1.41), f"el.{s}": (x * 0.21, 0.015, 1.16), f"wr.{s}": (x * 0.235, -0.005, 0.93),
        f"fi.{s}": (x * 0.245, -0.015, 0.76),
        f"hip.{s}": (x * 0.088, 0.0, 0.93), f"kn.{s}": (x * 0.096, -0.01, 0.52), f"an.{s}": (x * 0.10, 0.015, 0.115),
        f"toe.{s}": (x * 0.105, -0.15, 0.04),
    })
V = lambda k: Vector(J[k])

BONES = [  # name, head, tail, parent
    ("hips", "hips", "spine", None), ("spine", "spine", "chest", "hips"), ("chest", "chest", "neck", "spine"),
    ("neck", "neck", "head", "chest"), ("head", "head", "top", "neck"),
]
for s in "LR":
    BONES += [
        (f"upperarm.{s}", f"sh.{s}", f"el.{s}", "chest"), (f"forearm.{s}", f"el.{s}", f"wr.{s}", f"upperarm.{s}"),
        (f"hand.{s}", f"wr.{s}", f"fi.{s}", f"forearm.{s}"),
        (f"thigh.{s}", f"hip.{s}", f"kn.{s}", "hips"), (f"shin.{s}", f"kn.{s}", f"an.{s}", f"thigh.{s}"),
        (f"foot.{s}", f"an.{s}", f"toe.{s}", f"shin.{s}"),
    ]

PAL = dict(skin="#F7A39F", tee="#3B2BB0", sleeve="#3B2BB0", pants="#3A49C9", boot="#141026", sole="#E8263F",
           lace="#FF2E4A", hair="#1A1438", hair_hi="#7FA6FF", collar="#B8B5F0", face="#F7A39F", ear="#F7A39F")


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1]


def material(name):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = srgb(PAL[name])
    bsdf.inputs["Roughness"].default_value = 1.0
    m.diffuse_color = srgb(PAL[name])
    return m


def finish(name, bm, mat, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(material(mat))
    for p in me.polygons:
        p.use_smooth = smooth
    return ob


def skin_mesh(name, verts, edges, radii, mat, subd=2, root=0):
    """Tube shapes from a joint graph (Skin modifier), applied to a plain mesh."""
    me = bpy.data.meshes.new(name + "_src")
    me.from_pydata([tuple(v) for v in verts], edges, [])
    ob = bpy.data.objects.new(name + "_src", me)
    bpy.context.collection.objects.link(ob)
    sk = ob.modifiers.new("skin", "SKIN")
    sk.branch_smoothing = 0.6
    for i, r in enumerate(radii):
        r = r if isinstance(r, (tuple, list)) else (r, r)
        me.skin_vertices[0].data[i].radius = r
        me.skin_vertices[0].data[i].use_root = i == root
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = subd
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    bm.from_mesh(ob.evaluated_get(dg).to_mesh())
    bpy.data.objects.remove(ob)
    return finish(name, bm, mat)


def lerp(a, b, t):
    return a + (b - a) * t

def ring(bm, c, hx, hy, ax, ay, n=24, p=3.0):
    """Superellipse section (exponent p: 2 round .. 4 boxy) centred at c, spanned by unit axes ax / ay."""
    out = []
    for i in range(n):
        t = i / n * 2 * math.pi
        ct, st = math.cos(t), math.sin(t)
        x = math.copysign(abs(ct) ** (2 / p), ct) * hx
        y = math.copysign(abs(st) ** (2 / p), st) * hy
        out.append(bm.verts.new(c + ax * x + ay * y))
    return out


def bridge(bm, rings):
    for r0, r1 in zip(rings, rings[1:]):
        n = len(r0)
        for i in range(n):
            bm.faces.new((r0[i], r0[(i + 1) % n], r1[(i + 1) % n], r1[i]))


def loft(name, secs, mat, cap_bottom=False, subd=1):
    """Vertical loft of (z, half-width x, half-depth y) superellipse sections."""
    bm = bmesh.new()
    rings = [ring(bm, Vector((0, 0, z)), hx, hy, Vector((1, 0, 0)), Vector((0, 1, 0))) for z, hx, hy in secs]
    bridge(bm, rings)
    if cap_bottom:
        bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return subsurf(name, bm, mat, subd)


def tube(name, a, b, secs, mat, subd=1):
    """Open tube from a to b; secs = (t, half-width, half-depth) along the axis (width across the body = x)."""
    d = (b - a).normalized()
    ax = Vector((0, -1, 0)).cross(d).normalized()                 # across (sideways-ish)
    ay = d.cross(ax).normalized()
    bm = bmesh.new()
    rings = [ring(bm, lerp(a, b, t), hx, hy, ax, ay, p=2.6) for t, hx, hy in secs]
    bridge(bm, rings)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return subsurf(name, bm, mat, subd)


def subsurf(name, bm, mat, subd):
    me = bpy.data.meshes.new(name + "_src")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name + "_src", me)
    bpy.context.collection.objects.link(ob)
    ob.modifiers.new("sub", "SUBSURF").levels = subd
    dg = bpy.context.evaluated_depsgraph_get()
    out = bmesh.new()
    out.from_mesh(ob.evaluated_get(dg).to_mesh())
    bpy.data.objects.remove(ob)
    return finish(name, out, mat)



# ---------------------------------------------------------------- body pieces
def build_body():
    objs = []
    # arms (skin): sleeve covers the upper arm, so the visible skin starts ~ mid upper arm
    for s in "LR":
        sh, el, wr, fi = V(f"sh.{s}"), V(f"el.{s}"), V(f"wr.{s}"), V(f"fi.{s}")
        # the forearm runs on past the wrist into the palm (weighted to the hand there), so the joint is one piece of
        # skin however the hand turns: no gap, no ink ring round the wrist
        _wr, kn, _ = hand_joints(s)
        pts = [lerp(sh, el, 0.22), lerp(sh, el, 0.55), el, lerp(el, wr, 0.35), wr, lerp(wr, kn, 0.5)]
        objs.append(skin_mesh(f"arm.{s}", pts, [(i, i + 1) for i in range(5)],
                              [0.062, 0.06, 0.05, 0.055, 0.042, 0.036], "skin"))
        objs.append(hand(s))
    objs.append(skin_mesh("neck", [V("chest") + Vector((0, 0.005, 0.06)), V("neck"), V("head") + Vector((0, 0.005, 0.05))],
                          [(0, 1), (1, 2)], [0.056, 0.054, 0.052], "skin"))
    # tee: boxy torso lofted from rounded-rect sections, square shoulders (2D tee is a box with straight sides)
    objs.append(loft("tee", [(0.90, 0.148, 0.098), (0.915, 0.148, 0.098), (1.12, 0.138, 0.092), (1.30, 0.154, 0.098), (1.37, 0.166, 0.096),
                             (1.405, 0.158, 0.09), (1.425, 0.112, 0.074), (1.434, 0.066, 0.058)], "tee", cap_bottom=True))
    for s, x in (("L", 1), ("R", -1)):                         # short boxy sleeves: open flared tubes, square at the shoulder
        sh, el = V(f"sh.{s}"), V(f"el.{s}")
        a, b = sh + Vector((-x * 0.03, 0, -0.035)), lerp(sh, el, 0.48)
        objs.append(tube(f"sleeve.{s}", a, b, [(0.0, 0.058, 0.06), (0.2, 0.066, 0.068), (1.0, 0.078, 0.076)], "tee"))
    # collar rib: a torus around the neck base
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=24, radius1=0.076, radius2=0.064, depth=0.03)
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((0, -0.004, 1.442)))
    objs.append(finish("collar", bm, "collar"))
    # jeans: pelvis + straight wide legs to the boot top
    for s in "LR":                                              # straight legs; the tee hem hides the waist
        verts = [V(f"hip.{s}") + Vector((0, 0, 0.05)), V(f"kn.{s}"), V(f"an.{s}") + Vector((0, -0.01, 0.06))]
        objs.append(skin_mesh(f"jeans.{s}", verts, [(0, 1), (1, 2)], [(0.085, 0.092), 0.07, 0.068], "pants"))
    for s in "LR":
        objs += boot(s)
    return objs


FINGERS = ("idx", "mid", "rng", "pky")
HK = 1.35                                                         # 2D hands read big


def hand_joints(s):
    """Joint points of one hand: palm (wrist -> knuckles), four fingers [base, middle, tip], thumb [base, middle, tip]."""
    x = 1 if s == "L" else -1
    wr, fi = V(f"wr.{s}"), V(f"fi.{s}")
    d = (fi - wr).normalized()
    side, fwd, k = Vector((1, 0, 0)), Vector((0, -1, 0)), HK
    fingers = {}
    for i, off in enumerate((-0.03, -0.01, 0.01, 0.03)):          # index (front, -y) -> little (back)
        L = (0.07, 0.082, 0.078, 0.062)[i] * k
        b = wr + d * 0.075 * k + fwd * (-off * k)
        fingers[FINGERS[i]] = [b, b + d * L * 0.55, b + d * L]
    tb = wr + (d * 0.03 + fwd * 0.03 + side * x * -0.012) * k
    fingers["thb"] = [tb, tb + (d * 0.035 + fwd * 0.02) * k, tb + (d * 0.065 + fwd * 0.025) * k]
    return wr, wr + d * 0.07 * k, fingers


def hand(s):
    """Big cartoon hand hanging down: palm + four fingers + thumb, each finger on its own two bones."""
    k = HK
    wr, knuck, fingers = hand_joints(s)
    pts = [wr, knuck]
    edges = [(0, 1)]
    rad = [(0.032 * k, 0.024 * k), (0.046 * k, 0.022 * k)]
    for n in FINGERS:
        a = len(pts)
        pts += fingers[n]
        rad += [0.014 * k, 0.013 * k, 0.0115 * k]
        edges += [(1, a), (a, a + 1), (a + 1, a + 2)]
    a = len(pts)
    pts += fingers["thb"]
    rad += [0.017 * k, 0.014 * k, 0.012 * k]
    edges += [(0, a), (a, a + 1), (a + 1, a + 2)]
    return skin_mesh(f"hand.{s}", pts, edges, rad, "skin", subd=1)


def boot(s):
    an, toe = V(f"an.{s}"), V(f"toe.{s}")
    heel = Vector((an.x, 0.05, 0.06))
    pts = [an + Vector((0, 0, 0.09)), Vector((an.x, 0.02, 0.08)), Vector((toe.x, -0.07, 0.065)), Vector((toe.x, toe.y - 0.01, 0.06))]
    b = skin_mesh(f"boot.{s}", pts, [(0, 1), (1, 2), (2, 3)], [0.072, (0.078, 0.08), (0.075, 0.062), (0.066, 0.055)], "boot")
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(0.145, 0.26, 0.03), verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(an.x, -0.045, 0.02))
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.012, segments=2, affect="EDGES")
    sole = finish(f"sole.{s}", bm, "sole")
    return [b, sole]


# ---------------------------------------------------------------- head, ears, hair
HS = 1.35                                         # head scale: the sheet's big cartoon head
HC = Vector((0, -0.01, 1.645))                    # head centre
FX = 0.125                                        # face half-width (x) at HS=1; 2D face is ~as wide as tall
FACE_W = [(1.0, 0.70), (0.80, 0.94), (0.55, 1.0), (0.30, 1.0), (0.12, 0.98), (-0.10, 0.92), (-0.30, 0.76), (-0.42, 0.50)]


def face_width(t):
    """Half-width factor from the 2D FACE polygon (t = height above centre / 0.12: crown 1 -> chin -1)."""
    t = max(min(t, FACE_W[0][0]), FACE_W[-1][0])
    for (t0, w0), (t1, w1) in zip(FACE_W, FACE_W[1:]):
        if t1 <= t <= t0:
            return lerp(w1, w0, (t - t1) / (t0 - t1))
    return FACE_W[-1][1]


def build_head():
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=28, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co
        # wide skull, square jaw, flat chin: squeeze x/y below the cheekbones following the 2D face outline
        # a plain ellipsoid already follows the 2D FACE outline (2D: half-widths 1 / .88 / .56 at 0 / -.5 / -.85);
        # the flattened bottom below gives the square chin
        v.co = Vector((x * FX, y * 0.115, z * 0.135)) * HS + HC
    # flatten the chin bottom
    for v in bm.verts:
        if v.co.z < HC.z - 0.118 * HS:
            v.co.z = HC.z - 0.118 * HS + (v.co.z - (HC.z - 0.118 * HS)) * 0.25
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        back = f.normal.y > 0.35
        for l in f.loops:
            co = l.vert.co
            l[uv].uv = (0.03, 0.03) if back else (0.5 + co.x * 0.112 / FX / (0.30 * HS), 0.5 + (co.z - HC.z) / (0.30 * HS))
    head = finish("head", bm, "face")
    ears = []
    for s, x in (("L", 1), ("R", -1)):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=1.0)
        bmesh.ops.scale(bm, vec=Vector((0.014, 0.022, 0.032)) * HS, verts=bm.verts)
        bmesh.ops.translate(bm, verts=bm.verts, vec=HC + Vector((x * (FX - 0.006), 0.012, -0.005)) * HS)
        ears.append(finish(f"ear.{s}", bm, "ear"))
    return [head] + ears


def build_hair():
    """Messy shag: a shell over the skull cut by a hairline curve, jagged pointed locks along the edge,
    a swept fringe of pointed locks over the brow, crown tufts. Highlights are separate thin strands."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=1.0)
    R = Vector((0.152, 0.140, 0.162)) * HS
    C = HC + Vector((0, 0.016, 0.028)) * HS

    def edge_h(az):
        """Lowest z (normalised -1..1) the hair reaches at azimuth az (0 = front/-y, pi = back)."""
        f = abs(math.cos(az / 2))                      # 1 front, 0 back
        k = min(max((f - 0.80) / 0.17, 0.0), 1.0)
        return lerp(-0.80, 0.40, k * k * (3 - 2 * k))   # fringe at the brow only; side locks hang to the jaw, back to the nape

    kill = [v for v in bm.verts if v.co.z < edge_h(math.atan2(v.co.x, -v.co.y)) - 0.02]
    bmesh.ops.delete(bm, geom=kill, context="VERTS")
    # pointed locks: every other boundary vertex pulled down / out
    bnd = [v for v in bm.verts if v.is_boundary]
    bnd.sort(key=lambda v: math.atan2(v.co.x, -v.co.y))
    for i, v in enumerate(bnd):
        az = math.atan2(v.co.x, -v.co.y)
        front = abs(math.cos(az / 2))
        L = (0.16 + 0.12 * ((i * 7) % 3) / 2) * (0.8 if front > 0.8 else 0.75 if front > 0.35 else 1.2)
        if i % 2 == 0:
            v.co.z -= L
            v.co.x *= 1.06
            v.co.y *= 1.06
    for v in bm.verts:                                   # irregular volume
        n = math.sin(v.co.x * 9.1) * math.cos(v.co.y * 7.3 + v.co.z * 5.0)
        v.co *= 1.0 + 0.05 * n
        v.co = Vector((v.co.x * R.x, v.co.y * R.y, v.co.z * R.z)) + C
    # a single-sided shell (drawn double-sided on the site): a solidified inner layer would grow its own ink hull
    # inward-out and black out the whole hair, highlights included
    hair = finish("hair", bm, "hair")

    # crown tufts + flyaways
    tufts = []
    for i, (az, el, ln) in enumerate(((-0.6, 0.85, 0.05), (0.2, 0.95, 0.06), (0.9, 0.8, 0.05), (2.6, 0.7, 0.045), (-2.4, 0.75, 0.05))):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=5, radius1=0.022, radius2=0.0, depth=ln)
        d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))).normalized()
        q = Vector((0, 0, 1)).rotation_difference(d)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=q.to_matrix())
        base = C + Vector((d.x * R.x, d.y * R.y, d.z * R.z)) * 0.98
        bmesh.ops.translate(bm, verts=bm.verts, vec=base + d * ln * 0.4)
        tufts.append(bm)
    big = bmesh.new()
    for b in tufts:
        me = bpy.data.meshes.new("t")
        b.to_mesh(me)
        big.from_mesh(me)
        bpy.data.meshes.remove(me)
        b.free()
    big.free()

    # highlight strands: thin blue ribbons lying on the shell, following the locks (2D hair_hi lines)
    strands = bmesh.new()
    tree = BVHTree.FromObject(hair, bpy.context.evaluated_depsgraph_get())

    def on_hair(p):
        """Push p out to the outermost hair surface along the ray from the skull centre, then lift it clear."""
        d = (p - C).normalized()
        hit = tree.ray_cast(C + d * 0.5, -d)                     # from outside, inward: first hit = outer skin
        return hit[0] + d * 0.004 if hit[0] else p
    for az0, z0, z1, w in ((-0.95, 0.8, -0.35, 0.016), (-0.4, 0.92, 0.42, 0.015), (0.4, 0.92, 0.42, 0.014),
                           (1.0, 0.8, -0.35, 0.016), (1.55, 0.6, -0.6, 0.015), (-1.55, 0.6, -0.6, 0.015)):
        ring = []
        for k in range(7):
            t = k / 6
            z = lerp(z0, z1, t)
            az = az0 + 0.15 * t * (1 if az0 > 0 else -1)
            h = math.sqrt(max(1 - z * z, 0.0))
            dirn = Vector((math.sin(az) * h, -math.cos(az) * h, z))
            p = on_hair(C + Vector((dirn.x * R.x, dirn.y * R.y, dirn.z * R.z)))
            side = Vector((math.cos(az), math.sin(az), 0)) * w * (1 - 0.6 * t)
            ring.append((strands.verts.new(on_hair(p - side)), strands.verts.new(on_hair(p + side))))
        for (a, b), (c, d) in zip(ring, ring[1:]):
            strands.faces.new((a, b, d, c))
    hi = finish("hair_hi", strands, "hair_hi", smooth=True)
    return [hair, hi]


# ---------------------------------------------------------------- armature + weights
FINGER_BONES = []                                                 # name, head, tail, parent (points, not joint keys)
for _s in "LR":
    _wr, _kn, _f = hand_joints(_s)
    for _n, (_a, _b, _c) in _f.items():
        FINGER_BONES += [(f"{_n}1.{_s}", _a, _b, f"hand.{_s}"), (f"{_n}2.{_s}", _b, _c, f"{_n}1.{_s}")]

def build_armature():
    arm = bpy.data.armatures.new("rig")
    ob = bpy.data.objects.new("man", arm)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    for name, h, t, parent in BONES + FINGER_BONES:
        b = arm.edit_bones.new(name)
        b.head, b.tail = (V(h), V(t)) if isinstance(h, str) else (h, t)
        b.align_roll(Vector((0, 0, 1)) if name.startswith("foot") else Vector((0, -1, 0)))   # local Z faces forward: bends are local-X turns
        if parent:
            b.parent = arm.edit_bones[parent]
            b.use_connect = (Vector(b.head) - Vector(arm.edit_bones[parent].tail)).length < 1e-4
    bpy.ops.object.mode_set(mode="OBJECT")
    return ob


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


def weight(ob, rig, bones):
    """Smooth weights over a short candidate list: inverse distance^4 to each bone segment, top 2 kept."""
    segs = {n: (V(h), V(t)) for n, h, t, _ in BONES if n in bones}
    segs.update({n: (h, t) for n, h, t, _ in FINGER_BONES if n in bones})
    for n in bones:                                              # the hand bone only owns the palm (wrist -> knuckles)
        if n.startswith("hand."):
            wr, kn, _ = hand_joints(n[-1])
            segs[n] = (wr, kn)
    groups = {n: ob.vertex_groups.new(name=n) for n in bones}
    for v in ob.data.vertices:
        d = sorted(((seg_dist(v.co, *segs[n]), n) for n in bones))[:2]
        w = [1 / (x + 1e-3) ** 4 for x, _ in d]
        s = sum(w)
        for (x, n), wi in zip(d, w):
            if wi / s > 0.02:
                groups[n].add([v.index], wi / s, "REPLACE")
    ob.parent = rig
    mod = ob.modifiers.new("rig", "ARMATURE")
    mod.object = rig


# ---------------------------------------------------------------- main
def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rig = build_armature()
    body = build_body()
    head = build_head()
    hair = build_hair()
    for ob in body + head + hair:
        n = ob.name
        if n.startswith("arm."):
            s = n[-1]
            weight(ob, rig, ["chest", f"upperarm.{s}", f"forearm.{s}", f"hand.{s}"])
        elif n.startswith("hand."):
            weight(ob, rig, [f"hand.{n[-1]}"] + [f"{f}{i}.{n[-1]}" for f in FINGERS + ("thb",) for i in (1, 2)])
        elif n == "tee":
            weight(ob, rig, ["hips", "spine", "chest", "upperarm.L", "upperarm.R"])
        elif n.startswith("sleeve."):
            weight(ob, rig, ["chest", f"upperarm.{n[-1]}"])
        elif n == "collar":
            weight(ob, rig, ["chest"])
        elif n == "neck":
            weight(ob, rig, ["chest", "neck", "head"])
        elif n.startswith("jeans."):
            weight(ob, rig, ["hips", f"thigh.{n[-1]}", f"shin.{n[-1]}"])
        elif n.startswith(("boot.", "sole.")):
            weight(ob, rig, [f"foot.{n[-1]}"] if not n.startswith("boot.") else [f"shin.{n[-1]}", f"foot.{n[-1]}"])
        else:                                            # head, ears, hair: rigid on the head bone
            weight(ob, rig, ["head"])
    for ob in body + head + hair:
        print(f"{ob.name:12s} verts {len(ob.data.vertices):5d}")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_skins=True, export_animations=False,
                              export_apply=False, export_yup=True, export_texcoords=True, export_normals=True,
                              export_materials="EXPORT", export_image_format="NONE")
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "build-cache", "man.blend"))
    print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB")


main()
