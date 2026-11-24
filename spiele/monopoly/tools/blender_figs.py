# Rendert die Monopoly-Figuren (6 Tokens), Haus und Hotel als Sprites.
# Aufruf: blender -b -P tools/blender_figs.py
# Ausgabe: frames/ (Einzelframes) — danach tools/pack_sprites.py baut figs/*.png
import bpy, math, os, sys
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frames')
os.makedirs(OUT, exist_ok=True)

RES = 176
FRAMES = 8

# ---------- Szene ----------
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = RES
scene.render.resolution_y = RES
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.resolution_percentage = 100
scene.render.image_settings.color_depth = '8'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast'

world = bpy.data.worlds.new('w')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.32, 0.36, 0.42, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.55

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def material(name, rgb, rough=0.55, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*[srgb_to_linear(c) for c in rgb], 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    return m

def box(name, loc, scale, mat, bevel=0.06, rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new('bv', 'BEVEL'); mod.width = bevel; mod.segments = 2
    if mat: o.data.materials.append(mat)
    if parent: o.parent = parent
    return o

def cyl(name, loc, radius, depth, mat, rot=(0, 0, 0), parent=None, bevel=0.0, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    if bevel:
        mod = o.modifiers.new('bv', 'BEVEL'); mod.width = bevel; mod.segments = 2
    if mat: o.data.materials.append(mat)
    if parent: o.parent = parent
    return o

def sph(name, loc, radius, mat, scale=(1, 1, 1), parent=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    if mat: o.data.materials.append(mat)
    if parent: o.parent = parent
    return o

def cone(name, loc, r1, r2, depth, mat, rot=(0, 0, 0), parent=None, vertices=8):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    if mat: o.data.materials.append(mat)
    if parent: o.parent = parent
    return o

def empt(name):
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    return o

# ---------- Materialien ----------
COLORS = [(0.91, 0.30, 0.24), (0.20, 0.59, 0.85), (0.95, 0.77, 0.06),
          (0.15, 0.68, 0.38), (0.61, 0.35, 0.71), (0.90, 0.49, 0.13)]
DARK = material('dunkel', (0.16, 0.13, 0.11), rough=0.8)
CREAM = material('creme', (0.94, 0.88, 0.76), rough=0.7)
GLASS = material('glas', (0.35, 0.55, 0.68), rough=0.25, metal=0.25)
RED2 = material('rot2', (0.55, 0.08, 0.10), rough=0.6)
WHITE = material('weiss', (0.95, 0.94, 0.9), rough=0.6)
BROWN = material('braun', (0.45, 0.28, 0.15), rough=0.7)
GREEN = material('gruen', (0.13, 0.55, 0.25), rough=0.65)
HRED = material('hrot', (0.72, 0.12, 0.14), rough=0.65)

# ---------- Token-Modelle (Front = -Y, also Richtung Kamera) ----------
def build_car(col):
    r = empt('car')
    box('body', (0, -0.02, 0.52), (0.58, 0.95, 0.26), col, 0.12, parent=r)
    box('cab', (0, 0.12, 0.86), (0.48, 0.55, 0.26), col, 0.10, parent=r)
    box('glass', (0, 0.12, 0.92), (0.50, 0.46, 0.16), GLASS, 0.06, parent=r)
    for x in (-0.55, 0.55):
        for y in (-0.52, 0.45):
            cyl('rad', (x, y, 0.30), 0.19, 0.14, DARK, rot=(0, math.pi / 2, 0), parent=r, bevel=0.02)
            cyl('nabe', (x * 1.001, y, 0.30), 0.075, 0.16, CREAM, rot=(0, math.pi / 2, 0), parent=r)
    for x in (-0.3, 0.3):
        sph('licht', (x, -0.94, 0.55), 0.09, CREAM, scale=(1, 0.5, 1), parent=r)
    box('kuehler', (0, -0.95, 0.52), (0.34, 0.05, 0.16), GLASS, 0.02, parent=r)
    return r

def build_hat(col):
    r = empt('hat')
    cyl('krempe', (0, 0, 0.42), 0.78, 0.14, DARK, parent=r, bevel=0.05, vertices=16)
    cyl('krone', (0, 0, 0.86), 0.47, 0.9, DARK, parent=r, bevel=0.09, vertices=16)
    cyl('band', (0, 0, 0.55), 0.485, 0.2, col, parent=r, vertices=16)
    cyl('deckel', (0, 0, 1.33), 0.47, 0.1, DARK, parent=r, bevel=0.04, vertices=16)
    return r

def build_dog(col):
    r = empt('dog')
    box('rumpf', (0, 0.08, 0.62), (0.36, 0.55, 0.30), col, 0.14, parent=r)
    sph('kopf', (0, -0.52, 0.95), 0.30, col, scale=(1, 1.05, 1), parent=r)
    box('schnauze', (0, -0.80, 0.88), (0.15, 0.2, 0.12), CREAM, 0.06, parent=r)
    sph('nase', (0, -0.98, 0.92), 0.06, DARK, parent=r)
    for x in (-0.2, 0.2):
        cone('ohr', (x, -0.45, 1.22), 0.14, 0.02, 0.34, DARK, rot=(0.35, 0, -x * 1.5), parent=r)
        sph('auge', (x * 0.55, -0.78, 1.02), 0.045, DARK, parent=r)
    for x in (-0.22, 0.22):
        for y in (-0.18, 0.42):
            cyl('bein', (x, y, 0.28), 0.09, 0.55, col, parent=r)
    cyl('schwanz', (0, 0.72, 0.85), 0.06, 0.45, col, rot=(0.7, 0, 0), parent=r)
    return r

def build_ship(col):
    r = empt('ship')
    box('rumpf', (0, 0.05, 0.45), (0.42, 1.0, 0.22), DARK, 0.09, parent=r)
    cone('bug', (0, -1.02, 0.45), 0.42, 0.02, 0.44, DARK, rot=(math.pi / 2, 0, 0), parent=r, vertices=12)
    box('deck', (0, 0.1, 0.62), (0.34, 0.85, 0.07), CREAM, 0.03, parent=r)
    box('kajuete', (0, 0.25, 0.78), (0.28, 0.4, 0.14), WHITE, 0.05, parent=r)
    cyl('schorn', (0, 0.35, 1.05), 0.15, 0.5, col, parent=r, bevel=0.02)
    cyl('schorn_top', (0, 0.35, 1.32), 0.155, 0.08, DARK, parent=r)
    cyl('mast', (0, -0.55, 1.0), 0.04, 0.8, BROWN, parent=r)
    box('segel', (0, -0.45, 1.05), (0.02, 0.18, 0.3), CREAM, 0.01, rot=(0, 0.15, 0), parent=r)
    return r

def build_boot(col):
    r = empt('boot')
    box('sohle', (0, -0.05, 0.18), (0.34, 0.8, 0.11), DARK, 0.05, parent=r)
    sph('kappe', (0, -0.72, 0.32), 0.26, col, scale=(1.05, 1.15, 0.8), parent=r)
    box('schaft', (0, 0.18, 0.75), (0.33, 0.42, 0.55), col, 0.1, parent=r)
    box('absatz', (0, 0.5, 0.3), (0.3, 0.28, 0.3), col, 0.05, parent=r)
    box('stulpe', (0, 0.18, 1.32), (0.37, 0.46, 0.1), DARK, 0.05, parent=r)
    return r

def build_basket(col):
    r = empt('basket')
    box('mulde', (0, 0.05, 0.62), (0.52, 0.62, 0.2), col, 0.07, parent=r)
    box('rand', (0, 0.05, 0.84), (0.58, 0.68, 0.05), BROWN, 0.02, parent=r)
    cyl('rad', (0, -0.68, 0.24), 0.21, 0.12, DARK, rot=(0, math.pi / 2, 0), parent=r, bevel=0.02)
    for x in (-0.42, 0.42):
        cyl('stiel', (x, 0.62, 0.42), 0.045, 0.6, BROWN, rot=(0.55, 0, 0), parent=r)
        cyl('bein', (x, 0.3, 0.16), 0.04, 0.32, DARK, parent=r)
    return r

def build_house():
    r = empt('house')
    box('wand', (0, 0, 0.32), (0.5, 0.5, 0.3), CREAM, 0.04, parent=r)
    cone('dach', (0, 0, 0.82), 0.68, 0.0, 0.45, GREEN, rot=(0, 0, math.pi / 4), parent=r, vertices=4)
    box('tuer', (0, -0.51, 0.26), (0.1, 0.02, 0.16), BROWN, 0.02, parent=r)
    for x in (-0.22, 0.22):
        box('fenster', (x, -0.51, 0.4), (0.09, 0.02, 0.09), GLASS, 0.01, parent=r)
    return r

def build_hotel():
    r = empt('hotel')
    box('wand', (0, 0, 0.45), (0.6, 0.55, 0.42), CREAM, 0.04, parent=r)
    cone('dach', (0, 0, 1.05), 0.78, 0.0, 0.5, HRED, rot=(0, 0, math.pi / 4), parent=r, vertices=4)
    box('tuer', (0, -0.56, 0.26), (0.13, 0.02, 0.2), BROWN, 0.02, parent=r)
    for x in (-0.26, 0.26):
        for z in (0.42, 0.68):
            box('fenster', (x, -0.56, z), (0.1, 0.02, 0.09), GLASS, 0.01, parent=r)
    return r

BUILDERS = [build_car, build_hat, build_dog, build_ship, build_boot, build_basket]

# ---------- Kamera & Licht ----------
cam_data = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = (0, -4.6, 2.1)
cam_data.lens = 58
def point_cam(target=(0, 0, 0.62)):
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
point_cam()

sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 3.2
sun.rotation_euler = (math.radians(38), math.radians(-12), math.radians(25))
scene.collection.objects.link(sun)
fill = bpy.data.objects.new('fill', bpy.data.lights.new('fill', 'AREA'))
fill.data.energy = 260
fill.data.size = 4
fill.location = (2.5, -2.5, 3.5)
fill.rotation_euler = (Vector((0, 0, 0.5)) - fill.location).to_track_quat('-Z', 'Y').to_euler()
scene.collection.objects.link(fill)

# ---------- Render ----------
# Richtungszeilen: 0=Süd(zur Kamera),1=West(links),2=Nord(weg),3=Ost(rechts)
ROTZ = [0, -90, 180, 90]

def hide(obj):
    obj.hide_render = True

def render_token(root, tag):
    for d, rotz in enumerate(ROTZ):
        root.rotation_euler = (0, 0, math.radians(rotz))
        for f in range(FRAMES):
            t = f / FRAMES
            bob = 0.13 * math.sin(2 * math.pi * t) ** 2
            pitch = math.radians(9) * math.sin(2 * math.pi * t)
            roll = math.radians(5) * math.sin(4 * math.pi * t)
            root.location = (0, 0, bob)
            root.rotation_euler.x = pitch
            root.rotation_euler.y = roll
            root.rotation_euler.z = math.radians(rotz)
            scene.render.filepath = os.path.join(OUT, f'{tag}_d{d}_f{f}.png')
            bpy.ops.render.render(write_still=True)
    root.location = (0, 0, 0)
    root.rotation_euler = (0, 0, 0)

mats = [material('tok%d' % i, COLORS[i], rough=0.5, metal=0.12) for i in range(6)]
for i, b in enumerate(BUILDERS):
    col = mats[i] if i != 1 else mats[1]
    root = b(col)
    render_token(root, f'tok{i}')
    for o in list(root.children):
        bpy.data.objects.remove(o)
    bpy.data.objects.remove(root)

for name, fn, tag in (('house', build_house, 'house'), ('hotel', build_hotel, 'hotel')):
    root = fn()
    root.rotation_euler = (0, 0, math.radians(-28))
    scene.render.filepath = os.path.join(OUT, f'{tag}.png')
    bpy.ops.render.render(write_still=True)
    for o in list(root.children):
        bpy.data.objects.remove(o)
    bpy.data.objects.remove(root)

print('FERTIG ->', OUT)
