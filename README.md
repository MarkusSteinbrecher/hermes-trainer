# HERMES-Trainer

Lernwebsite zur Vorbereitung auf die HERMES-2022-Prüfung. Schwerpunkt: Begriffsverständnis und exakte HERMES-Terminologie, mit direkten Verweisen auf die offizielle HERMES-Dokumentation (hermes.admin.ch) bei jedem Begriff.

## Funktionen

Die Inhalte sind gestuft: zuerst das Wichtigste, dann die Kernpunkte, dann der vollständige Text der offiziellen Dokumentation.

- **Methode** — die Kapitel des Referenzhandbuchs (Methodenüberblick, Phasen, Szenarien, Module, Ergebnisse, Aufgaben, Rollen, Hinweise zur Anwendung); je Kapitel Kernaussagen und Prüfungsfallen (Stufe 1), eine Zusammenfassung (Stufe 2) und der vollständige Handbuchtext mit Kapitelnummern, Seitenzahlen und Abbildungen (Stufe 3)
- **Lexikon** — alle Methodenelemente (Phasen, Szenarien, Module, Aufgaben, Ergebnisse, Rollen, Grundbegriffe), durchsuchbar und filterbar, je Eintrag drei Stufen: Kurz (erster Satz und Fakten wie Verantwortung, Modul, Phasen, Ergebnistyp, minimal gefordert), Kernpunkte (Definition, Abgrenzung, Prüfungshinweis, Querverweise) und Handbuch (vollständige Beschreibung aus der offiziellen Dokumentation); jeder Eintrag verlinkt auf seine Seite auf hermes.admin.ch
- **Lernkarten** — Begriff ↔ Definition mit Selbsteinschätzung; nicht Gewusstes kommt wieder (Fortschritt lokal im Browser)
- **Quiz** — Multiple-Choice: kuratierte Prüfungsfragen, jede mit Belegzitat, Kapitel und Seite im Referenzhandbuch, plus automatisch aus dem Lexikon generierte Fragen

## Technik

Statische Website ohne Build-Schritt und ohne Abhängigkeiten (HTML/CSS/Vanilla-JS). Inhalte als JSON in `data/` (Schema: [SCHEMA.md](SCHEMA.md)); die Handbuchtexte in `data/handbuch/` und die Abbildungen in `assets/abb/` werden mit `tools/handbuch-import.py` von hermes.admin.ch importiert. Gehostet über GitHub Pages.

Lokal starten: `python3 -m http.server 8080` im Projektverzeichnis, dann http://localhost:8080 (ein Server ist nötig, weil die Seite die JSON-Dateien per `fetch` lädt).

### Werkzeuge (`tools/`)

- `handbuch-import.py --pdf-text rhb.txt` — importiert die offizielle Dokumentation von hermes.admin.ch nach `data/handbuch/` und `assets/abb/`; Kapitelnummern und Seitenzahlen stammen aus dem Inhaltsverzeichnis des Referenzhandbuchs (`pdftotext -layout HERMES-Projektmanagement.pdf rhb.txt`)
- `ergebnis-typen.py` — ergänzt `data/ergebnisse.json` um Ergebnistyp und «minimal gefordert» (Tabellen 16/17 des Handbuchs)
- `quiz-pruefen.py [--pdf-text rhb.txt]` — prüft `data/quizfragen.json` formal und verifiziert die Belegzitate gegen den Handbuchtext

Nach Inhaltsänderungen die Versionsangabe `DATEN_VERSION` in `js/data.js` und den `?v=`-Parameter der Asset-Links in `index.html` erhöhen, damit Browser keine veralteten Dateien aus dem Cache verwenden.

## Quellen

Alle Inhalte basieren auf der offiziellen HERMES-Methode der Schweizerischen Bundesverwaltung: [hermes.admin.ch](https://www.hermes.admin.ch/de/projektmanagement.html) (gemäss Impressum die führende Quelle) · [Referenzhandbuch Projektmanagement, Ausgabe 2022, 3. Auflage 09.03.2026 (PDF)](https://www.hermes.admin.ch/de/downloads.html), aus dem Kapitelnummern und Seitenzahlen stammen. HERMES ist ein offener Standard der Bundesverwaltung (eCH-0054); die Urheberrechte an der Dokumentation liegen bei der Schweizerischen Eidgenossenschaft. Diese Lernhilfe ist ein privates, inoffizielles Projekt; massgebend ist die offizielle Dokumentation.
