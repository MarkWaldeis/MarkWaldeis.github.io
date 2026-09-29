# FABWERK - Sorter-Modell (Gantry) fuer den Blender-Headless-Export
# Achsen: Spiel ist Y-up (glTF-Exporter wandelt Blender Z-up automatisch um).
import bpy, math, os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(OUT_DIR, '..', 'assets')
os.makedirs(ASSETS, exist_ok=True)
GLB = os.path.join(ASSETS, 'sorter.glb')
PREVIEW = os.path.join(OUT_DIR, 'sorter_preview.png')

# ---------- Szene leeren ----------
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for m in list(bpy.data.materials):
    bpy.data.materials.remove(m)

def mat(name, hexv, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    r = ((hexv >> 16) & 255) / 255
    g = ((hexv >> 8) & 255) / 255
    b = (hexv & 255) / 255
    bs.inputs['Base Color'].default_value = (r, g, b, 1)
    bs.inputs['Roughness'].default_value = 0.85
    if emit > 0:
        bs.inputs['Emission Color'].default_value = (r, g, b, 1)
        bs.inputs['Emission Strength'].default_value = emit
    return m

M_DARK   = mat('dark',  0x4a545f)
M_STEEL  = mat('steel', 0x55606e)
M_LANE   = mat('lane',  0x272e38)
M_GOLD   = mat('gold',  0xf6c453, emit=2.2)
M_TEAL   = mat('teal',  0x35d0ba, emit=0.8)
M_SILVER = mat('silver',0xcfd6de)

def box(name, w, h, d, x, y, z, m):
    # Spielkoordinaten: x=Ost, y=Hoehe, z=Sued -> Blender: (x, -z, y)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    o = bpy.context.object
    o.name = name
    o.scale = (w / 2, d / 2, h / 2)
    bpy.ops.object.transform_apply(scale=True)
    if m: o.data.materials.append(m)
    return o

def cyl(name, r, h, x, y, z, m, seg=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=h, location=(x, -z, y))
    o = bpy.context.object
    o.name = name
    if m: o.data.materials.append(m)
    return o

def sph(name, r, x, y, z, m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=r, location=(x, -z, y))
    o = bpy.context.object
    o.name = name
    if m: o.data.materials.append(m)
    return o

# ---------- Sorter-Gantry (1x1 Kachel, Mitte 0/0) ----------
# Bodenplatte
box('base', 0.94, 0.10, 0.94, 0, 0.05, 0, M_DARK)
# Durchlauf-Lane (Bandflaeche), x-Richtung = Durchlauf
box('lane', 0.94, 0.035, 0.58, 0, 0.115, 0, M_LANE)
# Seitenwangen der Lane
box('rail_l', 0.94, 0.10, 0.06, 0, 0.16, -0.32, M_STEEL)
box('rail_r', 0.94, 0.10, 0.06, 0, 0.16, 0.32, M_STEEL)
# Gantry-Pfosten (quer zur Laufrichtung) - reichen bis in den Traeger
box('post_l', 0.18, 0.76, 0.14, 0.0, 0.48, -0.38, M_STEEL)
box('post_r', 0.18, 0.76, 0.14, 0.0, 0.48, 0.38, M_STEEL)
# Querträger mit Mittelstück
box('beam', 0.22, 0.16, 0.90, 0.0, 0.84, 0, M_STEEL)
box('beam_cap', 0.26, 0.06, 0.30, 0.0, 0.95, 0, M_DARK)
# Scanner-Auge (dyn: pulsierend) unter dem Träger, haengt am Rim
sph('eye', 0.10, 0.0, 0.70, 0, M_GOLD)
cyl('eye_rim', 0.12, 0.05, 0.0, 0.755, 0, M_DARK, 12)
# Status-Leiste (teal) + Antennenstummel
box('status', 0.10, 0.05, 0.20, 0.0, 1.00, -0.30, M_TEAL)
cyl('antenna', 0.022, 0.30, 0.0, 1.12, 0.30, M_SILVER, 6)
sph('antenna_tip', 0.035, 0.0, 1.28, 0.30, M_TEAL)
# Kleine Seitenverkleidungen (Detail)
box('skirt_l', 0.40, 0.14, 0.05, 0.0, 0.07, -0.44, M_STEEL)
box('skirt_r', 0.40, 0.14, 0.05, 0.0, 0.07, 0.44, M_STEEL)

# ---------- Export GLB ----------
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=GLB, export_yup=True, export_apply=True)
print('GLB written:', GLB)

# ---------- Vorschau-Render ----------
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 640
scene.render.resolution_y = 640
scene.render.image_settings.file_format = 'PNG'
scene.world = bpy.data.worlds.new('w')
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.06, 0.08, 0.12, 1)
bg.inputs[1].default_value = 0.7

# Boden
box('preview_ground', 4, 0.05, 4, 0, -0.03, 0, mat('g', 0x84c161))

# Kamera (isometrisch, naeher)
bpy.ops.object.camera_add(location=(2.1, 1.7, 2.1))
cam = bpy.context.object
cam.data.lens = 45
def look(obj, tx=0, ty=0.45, tz=0):
    d = (tx - obj.location.x, ty - obj.location.y, tz - obj.location.z)
    import mathutils
    obj.rotation_euler = mathutils.Vector(d).to_track_quat('-Z', 'Y').to_euler()
look(cam)
scene.camera = cam

# Licht
bpy.ops.object.light_add(type='SUN', location=(2, 4, 1))
sun = bpy.context.object
sun.data.energy = 3.2
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
bpy.ops.object.light_add(type='POINT', location=(-1.5, 2, -1.5))
pt = bpy.context.object
pt.data.energy = 60

scene.render.filepath = PREVIEW
bpy.ops.render.render(write_still=True)
print('Preview written:', PREVIEW)

# .blend als Quelle ablegen
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, 'sorter.blend'))
print('Blend saved')
