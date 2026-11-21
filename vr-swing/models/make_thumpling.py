# Builds the Thumpling (Knuckle Grove's player critter) in Blender and exports thumpling.glb.
# Run:  blender --background --python make_thumpling.py      (or with the `bpy` Python module)
# Parts are separate objects so the game can pose them:
#   Torso  : body, belly, tail (no legs). Origin at the feet. Faces +Y in Blender (= -Z in three.js).
#   Head   : head, face, ears, leaf sprout. Origin at the point between the eyes.
#   ArmSeg : one fuzzy arm segment along +Z from 0 to 1 (the game stretches it).
#   Elbow  : the round joint between the two arm segments.
#   Paw    : the big mitten paw, origin at its centre, fingers toward +Y, palm toward -Z.
import bpy, bmesh, math, os, random, sys
from mathutils import Vector

random.seed(7)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'thumpling.glb')
for a in sys.argv:
    if a.endswith('.glb'): OUT = a
EYE_Z = 0.85

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def mat(name, rgb, rough=0.85, emit=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    col = tuple(int(rgb[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in col)
    b.inputs['Base Color'].default_value = (*lin, 1)
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*lin, 1)
        b.inputs['Emission Strength'].default_value = emit
    return m

FUR = mat('Fur', '#2fc6a3')
FUR_D = mat('FurDark', '#1f9c80')
CREAM = mat('Cream', '#ffe9c7')
PAD = mat('Pad', '#ff8fb1')
WHITE = mat('EyeWhite', '#ffffff', 0.3)
PUPIL = mat('Pupil', '#15161c', 0.2)
NOSE = mat('Nose', '#134c40', 0.4)
LEAF = mat('Leaf', '#6bd36b')
STEM = mat('Stem', '#3f8a3a')
CHEEK = mat('Cheek', '#ff7fa0')
CUFF = mat('Cuff', '#fff7ea')

def active():
    return bpy.context.view_layer.objects.active

def finish(o, m, fuzz=0.0, scale_fuzz=1.0, subdiv=0, seed=0):
    o.data.materials.clear(); o.data.materials.append(m)
    if subdiv:
        mod = o.modifiers.new('sub', 'SUBSURF'); mod.levels = subdiv; mod.render_levels = subdiv
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='sub')
    if fuzz:
        tex = bpy.data.textures.new('fuzz%d' % seed, 'CLOUDS'); tex.noise_scale = 0.06 * scale_fuzz; tex.noise_depth = 1
        mod = o.modifiers.new('fz', 'DISPLACE'); mod.texture = tex; mod.strength = fuzz; mod.mid_level = 0.5
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='fz')
    return o

def sphere(loc, scale, m, seg=16, rings=10, fuzz=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=loc, rotation=rot)
    o = active(); o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(o, m, fuzz)

def ico(loc, r, m, sub=2, fuzz=0.0, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc)
    o = active(); o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(o, m, fuzz)

def cone(loc, r1, r2, depth, m, rot=(0, 0, 0), verts=10):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    return finish(active(), m)

def join(objs, name, origin=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = active(); o.name = name; o.data.name = name
    if origin is not None:
        scene.cursor.location = origin
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        o.location = (0, 0, 0)
    for p in o.data.polygons: p.use_smooth = False
    return o

# ---------------- Torso: a round fuzzy bean with a belly (no legs: Thumplings get around on their paws) ----------------
parts = []
parts.append(ico((0, 0, 0.42), 1, FUR, sub=3, fuzz=0.035, scale=(0.27, 0.24, 0.3)))
parts.append(sphere((0, 0.15, 0.4), (0.18, 0.1, 0.21), CREAM, seg=14, rings=8))
parts.append(ico((0, -0.24, 0.25), 0.07, CREAM, sub=1, fuzz=0.02))  # fluffy tail
torso = join(parts, 'Torso', origin=(0, 0, 0))

# ---------------- Head: big round head, huge eyes, muzzle, round ears, leaf sprout ----------------
hz = 0.8
parts = [ico((0, 0, hz), 1, FUR, sub=3, fuzz=0.03, scale=(0.25, 0.23, 0.22))]
parts.append(sphere((0, 0.17, hz - 0.07), (0.11, 0.08, 0.07), CREAM, seg=14, rings=8))     # muzzle
parts.append(sphere((0, 0.245, hz - 0.035), (0.03, 0.022, 0.022), NOSE, seg=10, rings=6))  # nose
for s in (-1, 1):
    parts.append(sphere((s * 0.095, 0.185, hz + 0.05), (0.065, 0.05, 0.072), WHITE, seg=14, rings=10))
    parts.append(sphere((s * 0.09, 0.225, hz + 0.045), (0.036, 0.022, 0.044), PUPIL, seg=12, rings=8))
    parts.append(sphere((s * 0.08, 0.243, hz + 0.07), (0.011, 0.006, 0.011), WHITE, seg=8, rings=6))   # eye shine
    parts.append(sphere((s * 0.17, 0.16, hz - 0.04), (0.035, 0.01, 0.022), CHEEK, seg=8, rings=6))
    parts.append(sphere((s * 0.21, -0.01, hz + 0.13), (0.075, 0.035, 0.08), FUR_D, seg=12, rings=8, rot=(0, s * 0.5, 0)))   # ears
    parts.append(sphere((s * 0.215, 0.012, hz + 0.13), (0.048, 0.02, 0.052), PAD, seg=10, rings=6, rot=(0, s * 0.5, 0)))
    parts.append(sphere((s * 0.07, 0.21, hz + 0.125), (0.04, 0.012, 0.01), FUR_D, seg=8, rings=6, rot=(0, -s * 0.25, 0)))  # brows
# little smile: a thin curved bar
bpy.ops.mesh.primitive_torus_add(major_radius=0.035, minor_radius=0.008, location=(0, 0.235, hz - 0.085), rotation=(math.pi / 2, 0, 0), major_segments=16, minor_segments=6)
smile = active()
bm = bmesh.new(); bm.from_mesh(smile.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > -0.0], context='VERTS')  # keep the lower half (local coords)
bm.to_mesh(smile.data); bm.free()
parts.append(finish(smile, PUPIL))
# leaf sprout on top of the head
parts.append(cone((0, 0, hz + 0.25), 0.012, 0.008, 0.1, STEM))
for s in (-1, 1):
    parts.append(sphere((s * 0.06, 0, hz + 0.31), (0.07, 0.03, 0.012), LEAF, seg=12, rings=6, rot=(0, -s * 0.45, 0)))
head = join(parts, 'Head', origin=(0, 0.06, EYE_Z))

# ---------------- Arm segment (unit length along +Z) and elbow ----------------
bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=1, depth=1, location=(0, 0, 0.5))
seg = active()
bm = bmesh.new(); bm.from_mesh(seg.data)
bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 0.5], cuts=4)
for v in bm.verts:
    t = v.co.z + 0.5
    r = 0.052 - 0.012 * t
    lump = 1 + 0.12 * math.sin(v.co.x * 40 + t * 17) * math.cos(v.co.y * 37 + t * 9)
    if abs(v.co.x) > 1e-4 or abs(v.co.y) > 1e-4:
        d = Vector((v.co.x, v.co.y, 0)).normalized()
        v.co.x, v.co.y = d.x * r * lump, d.y * r * lump
bm.to_mesh(seg.data); bm.free()
seg.location = (0, 0, 0)
scene.cursor.location = (0, 0, -0.5); bpy.context.view_layer.objects.active = seg
bpy.ops.object.select_all(action='DESELECT'); seg.select_set(True)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); seg.location = (0, 0, 0)
finish(seg, FUR); seg.name = 'ArmSeg'; seg.data.name = 'ArmSeg'
for p in seg.data.polygons: p.use_smooth = False

elbow = ico((0, 0, 0), 0.05, FUR, sub=2, fuzz=0.008)
elbow.name = 'Elbow'; elbow.data.name = 'Elbow'
for p in elbow.data.polygons: p.use_smooth = False

# ---------------- Paw: big mitten with three fingers, a thumb, pink beans and a fluffy cuff ----------------
parts = [ico((0, 0, 0), 1, FUR, sub=2, fuzz=0.008, scale=(0.065, 0.075, 0.052))]
for i, x in enumerate((-0.034, 0, 0.034)):
    parts.append(sphere((x, 0.07, -0.004), (0.026, 0.032, 0.024), FUR, seg=10, rings=8))
    parts.append(sphere((x, 0.075, -0.027), (0.014, 0.016, 0.008), PAD, seg=8, rings=6))
parts.append(sphere((-0.06, 0.025, 0.012), (0.024, 0.03, 0.022), FUR, seg=10, rings=8, rot=(0, 0, 0.5)))   # thumb
parts.append(sphere((0, 0.0, -0.046), (0.034, 0.03, 0.01), PAD, seg=10, rings=6))                          # palm bean
bpy.ops.mesh.primitive_torus_add(major_radius=0.045, minor_radius=0.019, location=(0, -0.065, 0), rotation=(math.pi / 2, 0, 0), major_segments=14, minor_segments=7)
parts.append(finish(active(), CUFF, fuzz=0.006))
paw = join(parts, 'Paw', origin=(0, 0, 0))

# ---------------- save + export ----------------
bpy.ops.wm.save_as_mainfile(filepath=OUT.replace('.glb', '.blend'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True)
for o in (torso, head, seg, elbow, paw):
    print(o.name, len(o.data.polygons), 'faces')
print('exported', OUT)
