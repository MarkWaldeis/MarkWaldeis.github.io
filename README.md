# Kabinett

Die Seite, auf der die fertigen Spiele, Szenen und Websites liegen.

Live: https://markwaldeis.github.io/

## Ein Projekt dauerhaft hinzufügen

1. Statische Dateien nach `spiele/dein-name/` legen. Die Startseite heißt `index.html`.
2. In `projects.json` einen Eintrag ergänzen:

```json
{
  "id": "dein-name",
  "title": "Anzeigename",
  "kind": "Spiel",
  "tags": ["3D"],
  "blurb": "Ein Satz, was man dort tut.",
  "href": "spiele/dein-name/index.html"
}
```

`kind` ist `Spiel`, `Szene` oder `Website`. Ein Projekt, das nur woanders liegt, bekommt die volle `https://`-Adresse. `"play": "external"` öffnet es als Link statt in der Spielfläche, zum Beispiel ein Windows-Spiel.

3. Committen und nach `main` schieben. GitHub Pages veröffentlicht den Stand von selbst.

## Nur auf diesem Rechner

Unten auf der Seite hängt „Neues Projekt an die Wand“ einen Link in den Browser. Der erscheint nicht auf anderen Geräten. „Eigene Einträge als JSON“ speichert diese Liste, damit sie sich in `projects.json` übernehmen lässt.

Ordner mit `node_modules`, Unity-`Library`, Python-Umgebungen oder `.env` gehören nicht in dieses Repo.
