# Deeptrail Rabbit Hole

Deeptrail Rabbit Hole ist eine Idee für eine App, die freie Recherche aus Interesse als navigierbaren Graphen festhält. Themen, Quellen und ihre Zusammenhänge sollen erhalten bleiben, statt in einer Sammlung offener Browser-Tabs zu verschwinden.

## Idee

Eine Recherche beginnt mit einem Ausgangsthema. Von dort aus lassen sich Links, Personen, Begriffe, Orte, Medien und Quellen als Einträge hinzufügen und direkt im Graphen miteinander verbinden.

Die App soll es ermöglichen,

- besuchte und noch offene Recherchepfade zu unterscheiden,
- an jedem Knoten kurze eigene Notizen zu hinterlegen und
- später nachzuvollziehen, wie der Weg von Thema A zu Thema Z führte.

## Ziel

Rabbit Holes durch Wikipedia, Reddit und das Web sollen als dauerhafte, navigierbare Wissensspur erhalten bleiben.

## Status

Prototyp, pausiert. Es gibt eine Web-App (Vite, React, React Flow) mit Graph, Status offen/besucht, Notizen, Weg vom Ausgangsthema und Export/Import als JSON; gespeichert wird nur im localStorage des Browsers.

Pausiert ist das Projekt, weil die Recherche automatisch im Hintergrund mitgeloggt werden soll und noch offen ist, wie (vermutlich per Browser-Erweiterung). Von Hand gepflegte Einträge sind nicht das Ziel.

```
npm install
npm run dev     # Entwicklungsserver
npm test        # Unit-Tests
```
