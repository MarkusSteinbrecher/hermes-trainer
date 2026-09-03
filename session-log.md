# Session-Log — HERMES-Trainer

Neueste Einträge zuerst.

## 2026-09-03 — Kritische Durchsicht: Handbuch vollständig und gestuft, Quiz geprüft und erweitert

**Auftrag:** (1) Die Dokumentation aus dem Handbuch soll vollständig auf der Website sein, aber gestuft — zuerst das Wichtigste, Details bei Bedarf. (2) Quizfragen teilweise falsch/unvollständig. (3) Weitere Verbesserungen erlaubt.

**Quelle gesichert:** Referenzhandbuch Projektmanagement, Ausgabe 2022, 3. Auflage 09.03.2026 (PDF, 248 S.) heruntergeladen und mit `pdftotext -layout` extrahiert; laut Impressum ist hermes.admin.ch die führende Quelle («Digital First»), der Text ist identisch. Urheberrecht: Schweizerische Eidgenossenschaft (BK/DTI), offener Standard eCH-0054 — Verwendung zum Eigengebrauch; auf der Site so deklariert.

**Handbuch-Import (`tools/handbuch-import.py`):** Eigener Mini-DOM-Parser (nur stdlib) liest alle Seiten von hermes.admin.ch (8 Kapitel-/Übersichtsseiten, 8 Hinweis-Unterseiten, 220 Elementseiten) in strukturierte Blöcke (p, ul/ol mit Titelzeilen, Tabellen mit ✓-Zellen, Abbildungen). Kapitelnummern und Seitenzahlen kommen aus dem PDF-Inhaltsverzeichnis (417 Einträge), zugeordnet in Dokumentreihenfolge mit Ebenenregel. 47 SVG-Abbildungen lokal in `assets/abb/` (vier eingebettete Rasterbilder >250 KB nur verlinkt). Ergebnis: `data/handbuch/kapitel.json` (190 KB) + `elemente-<kategorie>.json` (alle 220 Elemente mit Kapitel/Seite), lazy geladen.

**Gestufte Darstellung:**
- Neue Ansicht **Methode** (ersetzt «Übersicht», Alias bleibt): Hub mit Phasenmodell und acht Kapitelkarten; je Kapitel Stufe 1 Kernaussagen + Prüfungsfallen (`data/kernaussagen.json`, 17 Einheiten inkl. der acht Hinweis-Themen, 67 Belegzitate wörtlich verifiziert), Stufe 2 Zusammenfassung mit Belegstellen, Stufe 3 vollständiger Handbuchtext als aufklappbare Teile/Gruppen mit Kapitelnummer und Seite, Begriffe in Listen/Tabellen auf das Lexikon verlinkt; Direktlink `#/methode?kapitel=hinweise&teil=7.4.5`.
- **Lexikon** je Karte drei Stufen (global vorwählbar, per Karte umschaltbar): Kurz = erster Satz + Faktenzeile (Verantwortlich, Modul, Phasenstreifen I K R E U A, Ergebnistyp, «minimal gefordert», «zwingend in jedem Projekt»), Kernpunkte = bisherige Details, Handbuch = Volltext nachgeladen (Grundbegriffe: kuratierte Details + Link ins Kapitel).
- Ergebnisse tragen jetzt `typ` (54 Dokumente, 18 Checklisten, 21 Zustände, 17 Meilensteine) und `minimalGefordert` (39 Dokumente) aus Tabellen 16/17 (`tools/ergebnis-typen.py`).

**Quiz:** Alle 60 Fragen von zwei unabhängigen Agenten gegen den Handbuchtext geprüft (Wahrheitsquelle nur das Handbuch): keine markierte Lösung war falsch, aber 19 korrigiert und 3 ersetzt — sachlich falsche Nebenbehauptungen in Erklärungen (q-004, q-018, q-029, q-041), prüfungsfremde Zählfragen (q-010, q-012, q-022 «sechs Phasen insgesamt» steht nirgends), zwei vertretbare Lösungen (q-034), Giveaways durch Länge/Wortwiederholung (q-013, q-016, q-035, q-055), falsche Quellen-URL (q-020), Sammeloption (q-048). Jede Frage hat neu `beleg` (Zitat, Kapitel, Seite), im Quiz nach der Antwort und in der Auswertung sichtbar. `tools/quiz-pruefen.py` prüft Form und Zitate (satzweise, Tabellenparaphrasen erlaubt). Generator: Maskierung beugungssicher (Szenario/Szenarien, Studie/Studien — vorher Lösung sichtbar), Kürzung an Satzgrenze, neue Typen (Ergebnis→Rolle, Aufgabe→Modul, minimal gefordertes Dokument erkennen), Mischung 2/3 kuratiert.

**60 neue Fragen (q-061–q-120):** von einem weiteren Agenten nur aus dem Handbuch geschrieben, mit Themenverteilung über alle Kapitel (Schwerpunkte, die bisher fehlten: Methodenüberblick, Hinweise zur Anwendung — Governance, Reporting, Nachhaltigkeit, Finanzen, Planung, Realisierungseinheiten, Integration — sowie Rollengruppen der Stammorganisation, Dokument/Zustand, Tabelle 16). Bestand jetzt 120 Fragen, richtige Antwort gleichverteilt über die Positionen (31/31/29/29), alle Belegzitate im Handbuch lokalisiert (Listen- und Tabellenzitate satzweise).

**Sonst:** Datenabrufe und Asset-Links versioniert (`DATEN_VERSION`, `?v=`), weil der Browser im Test veraltete JSON-Dateien aus dem Cache nahm; Route «Übersicht» → «Methode» (Alias bleibt gültig), Startseite ist die Methode; «Über» erklärt Quellen, Auflage und Urheberrecht; README/SCHEMA nachgeführt (neue Felder `kurz`, `typ`, `minimalGefordert`, `beleg`, Schema von `data/kernaussagen.json` und `data/handbuch/`). Browser-Check ohne Konsolenfehler (Methode-Hub, Kapitelseiten inkl. Tabellen/Abbildungen, Lexikon alle drei Stufen, Quiz, Lernkarten, Über). Wiki: Projektseite `projects/hermes-trainer` angelegt (Methode «Quellimport + gestufte Darstellung + belegtes Quiz»), noch nicht committet.

**Offen / Ideen:** Programmmanagement-Anhang und Leitfaden Agilität als weitere Kapitel importieren; Spaced Repetition für Lernkarten; Grundbegriffe mit eigenem Handbuchtext hinterlegen (derzeit kuratierte Details + Kapitel-Link); vier grosse Rasterabbildungen nur verlinkt. Vier parallele Agenten liefen in ein Sitzungslimit und wurden per Nachricht fortgesetzt — bei grossen Prüfaufträgen künftig gestaffelt starten.

## 2026-08-27 — Projektaufbau: Site komplett, QA bestanden

**Von null auf fertige Site in einer Session**, koordiniert über Opus-Agenten: Skeleton + Datenschema (SCHEMA.md als Kontrakt), dann parallel drei Inhaltsagenten (Phasen/Szenarien/Module/Grundbegriffe · Aufgaben · Ergebnisse/Rollen) und ein Frontend-Agent; anschliessend Quiz-Agent (60 kuratierte Prüfungsfragen) und unabhängiger QA-Agent.

**Inhalte:** 259 Methodenelemente (6 Phasen, 5 Szenarien, 12 Module, 39 Grundbegriffe, 71 Aufgaben, 110 Ergebnisse, 16 Rollen) + 60 Quizfragen. Jede Quellen-URL auf hermes.admin.ch per Abruf verifiziert (233/233 HTTP 200, Titelabgleich); 1821 Querverweise konsistent. Fachliche Befunde: HERMES 2022 hat 6 definierte Phasen (5 klassisch/3 agil, nicht 4); keine agilen Szenario-Varianten; «Anwendungsgebiet»/«Partizipation»/«hybrid» existieren nicht; 17 Checklisten vs. 16 Meilensteine (kein Meilenstein Projektabbruch).

**Frontend:** statisch, ohne Build/Abhängigkeiten, Hash-Routing; Lexikon (Suche mit Umlauttoleranz, Kategorie-Filter, Quellenlink je Eintrag), Lernkarten (localStorage), Quiz (kuratiert + generiert mit Begriffsmaskierung), Übersicht (beide Vorgehensweisen). QA: 0 XSS (kein innerHTML), 0 Konsolenfehler, kein Horizontalscroll bei 320/375/768 px, GH-Pages-tauglich (relative Pfade, .nojekyll).

**QA-Runde:** Blocker behoben (Übersicht zeigte 4-Phasen-Modell — genau die Prüfungsfalle), Quiz-Antwort-Leaks geschlossen (Wortbestandteil-Maskierung, uneindeutige Fragen verworfen), Antwortlängen-Giveaways ausbalanciert. Bekannte Restpunkte: Zitattreue bei 2 Grundbegriff-Definitionen (Montage/Kürzung, sachlich korrekt), 2 selbst geprägte Grundbegriff-Labels, Präfix-Hinweis bei Komposita im generierten Quiz (bewusst belassen).

**Veröffentlicht:** Repo `MarkusSteinbrecher/hermes-trainer` (public) erstellt, GH Pages ab `main` aktiviert — live unter https://markussteinbrecher.github.io/hermes-trainer/ (verifiziert: Assets und Daten laden, Lexikon rendert 259 Einträge).
