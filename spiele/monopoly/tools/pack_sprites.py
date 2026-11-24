#!/usr/bin/env python3
# Packt die Blender-Einzelframes zu Sprite-Sheets:
#   figs/fig-<i>.png  -> 8 Spalten (Laufzyklus) x 4 Zeilen (Richtungen)
#   figs/house.png, figs/hotel.png -> Einzelbilder (auf Inhalt zugeschnitten)
import os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
FRAMES_DIR = os.path.join(HERE, 'frames')
OUT_DIR = os.path.join(HERE, '..', 'figs')
os.makedirs(OUT_DIR, exist_ok=True)

CELL = 176
FRAMES = 8
DIRS = 4

def trim(img, pad=6):
    bbox = img.getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(img.width, r + pad); b = min(img.height, b + pad)
    return img.crop((l, t, r, b))

for i in range(6):
    sheet = Image.new('RGBA', (CELL * FRAMES, CELL * DIRS))
    for d in range(DIRS):
        for f in range(FRAMES):
            src = os.path.join(FRAMES_DIR, f'tok{i}_d{d}_f{f}.png')
            img = Image.open(src).convert('RGBA')
            sheet.paste(img, (f * CELL, d * CELL))
    out = os.path.join(OUT_DIR, f'fig-{i}.png')
    sheet.save(out, optimize=True)
    print(out, sheet.size)

for tag in ('house', 'hotel'):
    img = Image.open(os.path.join(FRAMES_DIR, f'{tag}.png')).convert('RGBA')
    img = trim(img)
    img.save(os.path.join(OUT_DIR, f'{tag}.png'), optimize=True)
    print(tag, img.size)
