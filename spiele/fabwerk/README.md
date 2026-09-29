# FABWERK - 3D Fabrik-Aufbau & Automatisierung

Ein vollstaendiges Fabrik-Aufbau-Spiel im Stil von Builderment als Browser-Spiel:
Low-Poly-3D mit Toon-Shading, isometrische Kamera, Foerderband-Logik, Crafting,
Forschungsbaum, Auftrags-Kampagne und Wirtschaft - komplett ohne Build-Step.

## Starten

Doppelklick auf `start.bat`
(oder manuell: `python -m http.server 8030` in diesem Ordner, dann http://localhost:8030 oeffnen)

Wichtig: Das Spiel muss ueber einen lokalen Webserver laufen (ES-Module), nicht per Doppelklick auf die index.html. Internetverbindung wird fuer Three.js (CDN) benoetigt.

## Spielablauf

- **Hauptmenue**: Neues Spiel / Weiterspielen (Save wird erkannt), Hilfe, Ton-Schalter.
- **Kampagne**: 12 Auftraege (Taste G) von Eisenbarren bis Roboter - der letzte
  Auftrag gewinnt (Sieg-Screen mit Statistik, danach geht die Fabrik weiter).
- **Pause-Menue** (Esc): Weiterspielen, Auftraege, Hilfe, Speichern, Hauptmenue, Neues Spiel.
- **Autosave** alle 30 s + bei Tab-Wechsel/Schliessen (localStorage, Version 2).

## Steuerung

| Aktion | Desktop | Touch |
|---|---|---|
| Setzen/Auswaehlen | Linksklick | Tippen |
| Band-Kette verlegen | Linke Maustaste ziehen | 1 Finger ziehen (bei Band-Werkzeug) |
| Kamera schwenken | WASD / mittlere Taste ziehen / Rechtsklick-Ziehen | 1 Finger ziehen (ohne Werkzeug) |
| Kamera drehen 90 Grad | Q / E | Zwei Finger drehen oder Buttons |
| Zoom | Mausrad / +/- | Zwei Finger ziehen / Buttons |
| Ghost/Gebaeude drehen | R | Inspektor-Button |
| Abreißen | X oder Abriss-Tab / Inspektor | Abriss-Tab im Baumenue |
| Pause / Tempo | Leertaste / Buttons oben | Buttons oben |
| Tech-Baum | T | Button oben |
| Auftraege | G | Button oben / Ziel-Tracker |
| Pausenmenue | Esc | - |

## Gameplay-Kern

1. **Extraktor** auf eine Ressource setzen (Pfeil = Ausgang). Vorkommen:
   Eisen, Kupfer, Stein, Kohle, Holz, Sand.
2. **Foerderband** zur Maschine ziehen - Baender fuellen Maschinen automatisch.
3. **Schmelzofen**: Erze zu Barren, Stein zu Ziegel, Sand zu Glas,
   Eisen+Kohle zu Stahl.
4. **Labor** (steht am Start bereit!): Lieferungen bringen sofort
   Muenzen (60% Itemwert) UND Forschungspunkte - Rohstoffe wenig, hochwertige
   Waren viel.
5. **Markt**: zahlt den vollen Itempreis, aber keine Forschung.
6. **Montage** (per Technologie): Bretter, Zahnräder, Draht, Schaltkreise,
   Solarpanels, Motoren, Computer, Roboter - die teuerste Kette.
7. **Upgrades**: Maschinen/Greifer im Inspektor bis Stufe IV (+50% pro Stufe).
8. **Tech-Baum**: 16 Technologien in 5 Stufen - freischaltbare Rezepte
   (Montage bis Robotik) und Tempo-Verstaerker.

Spezialbausteine: **Verteiler** (abwechselnd geradeaus+links), **Sorter**
(Forschung: filtert ein Item nach links, Rest geradeaus), **Unterfuehrung**
(gerade ziehen, 2-6 Kacheln, kreuzt andere Baender), **Greifer**
(uebertraegt hinten nach vorne).

## Architektur

```
index.html         UI-Markup + Styles + Importmap (three von CDN)
js/config.js       Spieldaten: Items, Rezepte, Gebaeude, Techs, Auftraege
js/world.js        Weltgenerierung (Seed-RNG), Gebaeude-Fabrik, Save/Load v2
js/sim.js          Deterministische Simulation: Baender, Items, Maschinen, Greifer
js/render.js       Three.js: prozedurale Low-Poly-Assets, Toon-Shading,
                   Instancing (Baender/Items/Deko), Kamera, GLB-Sorter mit Fallback
js/input.js        Maus/Touch/Tastatur: Bau-Werkzeuge, Pfad-Zug, Gesten, Tips
js/ui.js           HUD, Baumenu, Inspektor, Tech-Baum, Auftraege, Tutorial,
                   Menue/Pause/Sieg/Confirm, Toasts
js/audio.js        Prozedurale WebAudio-SFX (keine Audiodateien)
js/main.js         Game-Loop, Oekonomie/Auftrags-Hooks, Spielzustand-Flow
assets/menu_art.jpg  Hauptmenue-Keyart (Bildgenerierung)
assets/sorter.glb    Sorter-Modell aus Blender (tools/make_sorter.py)
tools/               Blender-Quelle (make_sorter.py, sorter.blend), Smoke-Test
test/sim_test.mjs  Automatische Szenario-Tests der Kernsimulation
```

## Tests

```
node test/sim_test.mjs
```

Prueft: Erz-Ofen-Markt-Kette, Labor-Forschung, Splitter-Alternanz,
Unterfuehrungskreuzung, Greiferkette, Staurologik, Save-Roundtrip,
Tech-Gating, Vertragskonsistenz.

## Performance-Notizen

- Items und Bänder werden als InstancedMesh gerendert (Zehntausende Objekte ok).
- Simulations-Tick ist dt-basiert; Item-Abstand verhindert Ueberlappungen.
- Schatten nur vom Sonnenlicht; Deko/Baender instanziert.
- Sorter kommt als GLB (Blender-Export); prozeduraler Fallback, falls der
  Download fehlschlaegt.
