# HERMES-Trainer

Lernwebsite zur Vorbereitung auf die HERMES-2022-Prüfung. Schwerpunkt: Begriffsverständnis und exakte HERMES-Terminologie, mit direkten Verweisen auf die offizielle HERMES-Dokumentation (hermes.admin.ch) bei jedem Begriff.

## Funktionen

- **Lexikon** — alle Methodenelemente (Phasen, Szenarien, Module, Aufgaben, Ergebnisse, Rollen, Grundbegriffe), durchsuchbar und filterbar; jeder Eintrag verlinkt auf seine Seite in der offiziellen Dokumentation
- **Lernkarten** — Begriff ↔ Definition mit Selbsteinschätzung; nicht Gewusstes kommt wieder (Fortschritt lokal im Browser)
- **Quiz** — Multiple-Choice: kuratierte Prüfungsfragen plus automatisch aus dem Lexikon generierte Fragen
- **Übersicht** — Phasenmodell, Module und Rollen auf einen Blick

## Technik

Statische Website ohne Build-Schritt und ohne Abhängigkeiten (HTML/CSS/Vanilla-JS). Inhalte als JSON in `data/` (Schema: [SCHEMA.md](SCHEMA.md)). Gehostet über GitHub Pages.

Lokal starten: `python3 -m http.server 8080` im Projektverzeichnis, dann http://localhost:8080 (ein Server ist nötig, weil die Seite die JSON-Dateien per `fetch` lädt).

## Quellen

Alle Inhalte basieren auf der offiziellen HERMES-Methode der Schweizerischen Bundesverwaltung: [hermes.admin.ch](https://www.hermes.admin.ch/de/projektmanagement.html) · [Referenzhandbuch (PDF)](https://www.hermes.admin.ch/de/downloads.html). HERMES ist ein offener Standard der Bundesverwaltung; diese Lernhilfe ist ein privates, inoffizielles Projekt.
