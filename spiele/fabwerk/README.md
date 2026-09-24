# FABWERK - 3D Fabrik-Aufbau & Automatisierung

Ein vollstaendiges Fabrik-Aufbau-Spiel im Stil von Builderment als Browser-Spiel:
Low-Poly-3D mit Toon-Shading, isometrische Kamera, Foerderband-Logik, Crafting,
Forschungsbaum und Wirtschaft - komplett ohne Build-Step.

## Starten

Doppelklick auf `start.bat`
(oder manuell: `python -m http.server 8030` in diesem Ordner, dann http://localhost:8030 oeffnen)

Wichtig: Das Spiel muss ueber einen lokalen Webserver laufen (ES-Module), nicht per Doppelklick auf die index.html. Internetverbindung wird fuer Three.js (CDN) benoetigt.

## Steuerung

| Aktion | Desktop | Touch |
|---|---|---|
| Setzen/Auswaehlen | Linksklick | Tippen |
| Band-Kette verlegen | Linke Maustaste ziehen | 1 Finger ziehen (bei Band-Werkzeug) |
| Kamera schwenken | WASD / mittlere Taste ziehen / Rechtsklick-Ziehen | 1 Finger ziehen (ohne Werkzeug) |
| Kamera drehen 90 Grad | Q / E | Zwei Finger drehen oder Buttons |
| Zoom | Mausrad / +/- | Zwei Finger ziehen / Buttons |
| Ghost/Gebaeude drehen | R | Inspektor-Button |
| Abreißen | X oder Inspektor | Abriss im Inspektor |
| Pause / Tempo | Leertaste / Buttons oben | Buttons oben |
| Tech-Baum | T | Button oben |

## Gameplay-Kern

1. **Extraktor** auf eine Ressource setzen (Pfeil = Ausgang).
2. **Foerderband** zur Maschine ziehen - Baender fuellen Maschinen automatisch.
3. **Schmelzofen**: Rezept im Inspektor waehlen (Eisenerz zu Eisenbarren usw.).
4. **Labor** (steht am Start bereit!): BELIEBIGE Lieferungen bringen sofort
   Muenzen (60% Itemwert) UND Forschungspunkte - Rohstoffe wenig, hochwertige
   Waren viel. Frueher Start: Holz oder Eisenbarren ins Labor liefern.
5. **Markt**: zahlt den vollen Itempreis, aber keine Forschung.
6. **Montage** (per Technologie): Zahnräder, Draht, Schaltkreise, Motoren,
   Computer, Roboter - die teuerste Kette fuer maximale Forschung.
7. **Upgrades**: Maschinen im Inspektor bis Stufe IV verbessern (+50% pro Stufe).
8. Tech-Baum: 12 Technologien in 4 Stufen, von Montage bis Robotik.

Spezialbausteine: **Verteiler** (abwechselnd 2 Ausgaenge), **Unterfuehrung**
(gerade ziehen, 2-6 Kacheln, kreuzt andere Baender), **Greifer**
(uebertraegt hinten nach vorne).

Autosave alle 30 Sekunden + beim Schliessen des Tabs (localStorage).

## Architektur

```
index.html         UI-Markup + Styles + Importmap (three von CDN)
js/config.js       Spieldaten: Items, Rezepte, Gebaeude, Techs, Regeln
js/world.js        Weltgenerierung (Seed-RNG), Gebaeude-Fabrik, Save/Load
js/sim.js          Deterministische Simulation: Baender, Items, Maschinen, Greifer
js/render.js       Three.js: prozedurale Low-Poly-Assets, Toon-Shading,
                   Instancing (Baender/Items/Deko), Kamera, Geister-Presets
js/input.js        Maus/Touch/Tastatur: Bau-Werkzeuge, Pfad-Zug, Gesten
js/ui.js           HUD, Baumenu, Inspektor, Tech-Baum, Tutorial, Toasts
js/main.js         Game-Loop, Oekonomie-Hooks, Speichern
test/sim_test.mjs  Automatische Szenario-Tests der Kernsimulation
```

## Tests

```
node test/sim_test.mjs
```

Prueft: Erz-Ofen-Markt-Kette, Splitter-Alternanz, Unterfuehrungskreuzung,
Greiferkette, Labor-Forschung, Staurologik mit Mindestabstand, Save-Roundtrip.

## Performance-Notizen

- Items und Bänder werden als InstancedMesh gerendert (Zehntausende Objekte ok).
- Simulations-Tick ist dt-basiert; Item-Abstand verhindert Ueberlappungen.
- Schatten nur vom Sonnenlicht; Deko/Baender instanziert.
