# Session-Log — HERMES-Trainer

Neueste Einträge zuerst.

## 2026-09-07 (3) — Eigene Seite je Feld der Abbildung (Phase × Modul)

**Auftrag:** «Detailseiten für jede Überschneidung von Phase und Modul, z. B. Projektsteuerung/Projektführung und Initialisierung. Auf der Detailseite sollten alle Elemente dargestellt werden, die dafür wichtig sind.» Nachtrag: erst eine Seite zum Test. Nach dem ersten Blick: «Die Seite sollte wirklich eine eigene Seite sein und nichts anderes zeigen als den Ausschnitt, allerdings mit allen Details.»

**Neue Route `#/feld?phase=…&modul=…`** (`js/feld.js`, `css/feld.css`) — eigene Seite, eigener Seitentitel, kein Diagramm. Zuerst als Zweig der Überblick-Ansicht gebaut, dann auf Rückmeldung hin herausgelöst; alte Links `#/ueberblick?phase=…&modul=…` leiten um. Die Seite ist datengetrieben: eine Implementierung bedient alle 69 belegten Kombinationen (von 72; leer sind IT-Betrieb×Initialisierung, IT-Betrieb×Abschluss, ISDS×Abschluss).

**Inhalt, alles aus den vorhandenen Feldern abgeleitet:**
- **Kopf:** Modul- und Phasen-Badges (ins Lexikon verlinkt), «in beiden Vorgehensweisen» bzw. «nur klassisch/agil», Kennzahlen (Aufgaben, Ergebnisse, Rollen, minimal geforderte Dokumente), je ein Satz zu Modul und Phase.
- **Ergebnisse:** Meilensteine zuerst — mit der Beschreibung aus `phase.meilensteine`, die genauer ist als die Definition des Ergebnisses —, dann Dokumente, Zustände, Checklisten; je Typ, «minimal gefordert» (wie auf der Karte nur bei `typ: "Dokument"`), Verantwortlich, Beteiligte und «Entsteht aus» — bewusst nur die erzeugenden Aufgaben **dieses** Felds (in der Umsetzung erscheint darum «Entscheid Projektabbruch treffen», nicht «Entscheid Projektabschluss treffen»).
- **Aufgaben:** Entscheidungsaufgaben gekennzeichnet, ebenso die phasenübergreifenden («auch in 5 weiteren Phasen», Titel nennt welche).
- **Rollen:** je Rolle Hierarchieebene, Kurzbeschreibung, «Verantwortlich für» und «Beteiligt an» mit allen Aufgaben und Ergebnissen des Felds; «beteiligt» lässt weg, was die Rolle ohnehin verantwortet (die Daten führen die verantwortliche Rolle meist auch unter `beteiligt`).
- **Nachbarfelder:** dasselbe Modul in den anderen Phasen, dieselbe Phase in den anderen Modulen, als Chips mit Anzahl — das Raster lässt sich damit durchlaufen, ohne zurück ins Diagramm zu müssen. Auch das leere Feld führt weiter.

**Zwei Module je Seite:** Die Abbildung fasst Projektsteuerung und Projektführung zu einer Spalte zusammen; `modul=` nimmt deshalb eine Liste. Bei mehreren Modulen trägt jeder Eintrag eine Modulmarke.

**`js/app.js` erweitert:** `view.titel` darf eine Funktion sein (der Titel wechselt mit dem Feld), `view.nav` sagt, welcher Menüpunkt markiert wird — bei `#/feld` bleibt «Überblick» aktiv.

**Cache-Falle, zweimal verloren:** `python3 -m http.server` sendet kein `Cache-Control`; Chrome hält `index.html` fest und lädt weiter die alten Skripte — die neue Route schien nicht zu existieren, obwohl der Code stimmte. Das `?v=`-Schema versioniert nur die referenzierten Dateien, nicht `index.html` selbst. Für Tests jetzt ein Server mit `Cache-Control: no-store`; im README steht der Hinweis.

**Getestet (lokal, Chrome, ohne Konsolenfehler):** Projektsteuerung/Projektführung × Initialisierung (7 Aufgaben, 13 Ergebnisse, 8 Rollen), Beschaffung × Konzept (ein Modul), Umsetzung (agil, 27 Ergebnisse), leeres Feld (IT-Betrieb × Initialisierung), ungültiger Link, Weiterleitung der alten Adresse, Navigation über die Nachbarfeld-Chips, simulierter Dark-Mode, 360 px ohne Horizontalscroll (das Fenster liess sich wieder nicht unter ~1470 px verkleinern, darum über eine Breitenbeschränkung gemessen), Rundgang durch alle Routen inklusive Alias `#/uebersicht`.

**Sonst:** `?v=` auf 2026-09-07d. README (Funktion «Feld», Technik, Cache-Hinweis) und SCHEMA (Abschnitt «Feld: eine Phase in einem Modul») ergänzt. `design/graph-steuerung/` (Claude-Design-Canvas vom 2026-09-04) mitgenommen, ohne den 2,6 MB grossen Export `graph-steuerung.html` — der steht neu in `.gitignore`.

**Offen:** Aus dem Diagramm führt noch kein Klick auf die Feldseiten — Modulköpfe und Phasenbalken öffnen weiterhin das Lexikon. Das UI der Feldseite soll als Nächstes in Claude Design entworfen werden; die Wahl «Feld» als Bezeichnung und die gemeinsame Seite für Projektsteuerung/Projektführung sind bis dahin nicht entschieden.

## 2026-09-07 (2) — Überblick: Originalabbildung statt Nachbau

**Rückmeldung:** «Soll mehr wie das Original aussehen. Beschreibungstext oben weg. Im Grunde dasselbe, nur interaktiv.»

**Kern der Änderung:** Die selbst gebaute Matrix Phasen × Module ist weg. Gezeigt wird jetzt die Originalabbildung — die SVG-Datei, die der Handbuch-Import aus hermes.admin.ch nach `assets/abb/` gelegt hat. Sie wird unverändert eingesetzt (Kästen, Pfeile, Iterationsschleifen, Phasenbalken, gestrichelte Phasengrenzen), darüber liegt eine unsichtbare Trefferschicht.

**Wie die Verbindung zu den Daten entsteht** (alles zur Laufzeit, keine zusätzliche Datendatei):
- Kästen werden an ihren Farben erkannt: Ergebnis `#DCEBFA`, Zustand weiss auf `#DCEBFA`-Kontur, Modulkopf schwarze Kontur ohne Füllung, Phasenbalken `#B7D5F1`/`#D9D9D9`/`#EBC9C7`.
- Der Office-Export zerlegt jede Beschriftung in Fragmente («Projekt-» / «initialisierungs-» / «auftrag»). Jedes Fragment gehört zum **kleinsten** Kasten, der es umschliesst — sonst schluckt die Sammelfläche «Phasenunabhängig» die zwölf Kästen darin. Für den Abgleich fallen alle Trennzeichen weg.
- Geometrie aus den `transform`-Attributen (`translate`, `matrix`), nicht aus `getBBox()`: das misst auch in verborgenen Tabs richtig — siehe den Messfehler vom 2026-09-04 (5).
- Ergebnis: **98 von 99 Kästen** verbunden (80 Ergebnisse, 12 Modulköpfe, 6 Phasenbalken). Ohne Eintrag bleibt nur die Sammelfläche «Phasenunabhängig», die keins ist.
- Sechs Kästen heissen in der Grafik anders als im Lexikon; sie stehen als Tabelle `ABWEICHENDE_BESCHRIFTUNG` im Kopf der Datei: «Geschäftsmod.-beschreibung», «Produkt entwickelt/angepasst», «System entwickelt/parametrisiert», «Testen». Zwei Kästen stehen für je zwei Elemente («Projektentscheide» → Steuerung und Führung; die Spalte «Projektsteuerung/Projektführung» → beide Module); das Schwebefenster sagt das ausdrücklich.

**Interaktion:** Zeigen (Maus und Tastatur) öffnet das Schwebefenster — jetzt auch über Modulköpfen und Phasenbalken, mit Kurzfassung, Typ, «minimal gefordert» bzw. «zwingend in jedem Projekt», Verantwortung, Beteiligten, Modulen, Phasen und Meilensteinen. Klick öffnet die Detailseite (Ergebnis im Überblick, Modul und Phase im Lexikon). Die Trefferfläche ist ein Rechteck mit Deckkraft 0 — `fill: none` würde keine Zeigeereignisse fangen.

**Leiste statt Filter:** Vorgehensweise und Ergebnistyp sind weggefallen — die Abbildung zeigt beide Vorgehensweisen ohnehin nebeneinander (blaue Phasen klassisch, rosa Balken «Umsetzung» agil), und Meilensteine und Checklisten kommen darin nicht als Kästen vor. Geblieben sind Rollenauswahl, «Minimal gefordert» (blasst alles andere ab), Zoom 50–250 % (die Vorlage setzt 9-Punkt-Schrift) und Zurücksetzen.

**Text weg:** Einleitungsabsätze und Lead gestrichen. Es bleiben Überschrift, Leiste, Diagramm, Bildunterschrift und zwei Anschlusslinks.

**Dark Mode:** Die Abbildung ist eine gedruckte Grafik mit schwarzer Beschriftung; sie behält in beiden Farbschemata ihren hellen Grund, sonst wäre sie unlesbar. Nur die Umgebung folgt dem Schema.

**Getestet (lokal, http://localhost:8765, Chrome, ohne Konsolenfehler):** 98 Trefferflächen; Schwebefenster über Ergebnis, Modulkopf und Phasenbalken; Klick auf «Studie» öffnet `#/ueberblick?id=ergebnis-studie`; Rollenauswahl «Anwendervertreter» (6 verantwortet, 50 beteiligt) färbt das ganze Diagramm; «Minimal gefordert»; Zoom 100/125/156 % samt Fensterposition nach seitlichem Blättern; simulierter Dark-Mode; schmales Layout durch Abschalten der 70-rem-Regel.

**Sonst:** `?v=` auf 2026-09-07c. README nachgeführt.

## 2026-09-07 — Neue Seite «Überblick»: Ergebnisdiagramm interaktiv

**Auftrag:** Graph vorerst beiseite. Eine neue Seite auf Basis von <https://www.hermes.admin.ch/en/project-management/method-overview.html> — derselbe Inhalt, aber interaktiv: beim Zeigen auf ein Ergebnis erscheinen Details und die beteiligten Rollen, beim Klick öffnet eine Detailseite.

**Was die Quellseite trägt:** Kern ist Abbildung 1, «Gesamtbild der HERMES-Module und der wesentlichen Ergebnisse entlang der Phasen» — eine Matrix aus Phasenbändern (Zeilen) und Modulen (Spalten) mit den Ergebnissen in den Zellen. Der Fliesstext der Seite (Was ist HERMES-PM, Projektgrössen/Sizing/Tailoring, Anwendung in der Praxis, Schnittstellen, agiles Entwicklungsmanagement, Programmmanagement) steht bereits vollständig in der Ansicht **Methode**, Kapitel A/B; er wurde deshalb nicht ein zweites Mal geschrieben, sondern verlinkt.

**Neue Route `#/ueberblick`** (`js/ueberblick.js`, `css/ueberblick.css`), in der Navigation zwischen Graph und Methode:
- **Matrix** Phasen × Module aus den vorhandenen Daten — ein Ergebnis erscheint in jeder Zelle, die zugleich in seiner Phasen- und seiner Modulliste steht; dieselbe Zuordnung wie im Graph, es werden keine Beziehungen ergänzt. Module ohne Ergebnis in der gewählten Vorgehensweise fallen als Spalte weg.
- **Steuerung:** Vorgehensweise (klassisch fünf Phasen / agil drei Phasen), Umfang (alle / nur minimal gefordert), Ergebnistyp (Meilenstein, Dokument, Zustand, Checkliste — mindestens einer bleibt aktiv), Rollenauswahl, Zurücksetzen. Zustand in `localStorage` (`hermes-trainer:ueberblick`).
- **Rollenauswahl** färbt die Matrix: verantwortlich kräftig, beteiligt umrandet, der Rest tritt zurück; darüber eine Zeile «verantwortlich für n · beteiligt an m».
- **Zeigen** (Maus und Tastatur) öffnet ein Schwebefenster mit Kurzfassung, Typ, «minimal gefordert», Verantwortlich, Beteiligte, Module und Phasen; der Chip verweist währenddessen per `aria-describedby` darauf.
- **Klick** öffnet `#/ueberblick?id=…`: Lexikonkarte (`HT.karte.bauen`, Stufe Kernpunkte, Querverweise auf Ergebnisse bleiben im Überblick), «Im Lexikon»-Knopf und ein kleines Raster «Position im Ergebnisdiagramm».
- **Ergebnistyp über Form und Farbe** (Raute, Rechteck, Kreis, Kontur-Quadrat), nie über Farbe allein; Legende über dem Diagramm. Eigene Tokens für hell und dunkel, Schriftfarbe auf den Typfarben über `--ub-auf`.
- **Mobile zuerst:** unter 60 rem wird die Matrix zu einer Liste je Phase (Modulname als Zwischentitel, leere Zellen entfallen); ab 60 rem klappt dasselbe DOM über `display: contents` in das Raster auf, mit klebender Modulkopfzeile und klebender Phasenspalte in einer scrollenden Bühne.
- Einleitungsabsätze zu Abbildung 1 werden aus `data/handbuch/kapitel.json` (Teil A.1) nachgeladen, die Originalabbildung liegt in einem Aufklapper.

**Getestet (lokal, http://localhost:8765, Chrome, ohne Konsolenfehler):** klassisch 105 / agil 106 / nur minimal gefordert 54 Ergebnisse, 291 Chips; Schwebefenster per Maus und per Fokusereignis (inkl. `aria-describedby` beim Fokus und dessen Entfernen beim Verlassen); Detailseite mit Positionsraster; klebende Kopfzeile und Phasenspalte beim Blättern in beide Richtungen; simulierter Dark-Mode; schmales Layout durch Abschalten der 60-rem-Regeln geprüft.

**Bekannte Grenze:** Die klebende Modulkopfzeile gehört zur scrollenden Bühne. Blättert man die Seite so weit, dass die Bühne oben aus dem Sichtfeld läuft, verschwindet sie unter der Kopfleiste der Anwendung. Abgemildert (Legende über das Diagramm gezogen, Bühne auf 72 vh), nicht beseitigt — dafür müsste die Kopfzeile aus dem Scrollbereich gelöst und horizontal synchronisiert werden.

**Sonst:** `?v=` auf 2026-09-07b erhöht (der Browser lieferte im Test noch die alten Dateien aus dem Cache); README um den Abschnitt «Überblick» ergänzt. `DATEN_VERSION` unverändert — an `data/` wurde nichts geändert.

**Nicht gemacht:** Nicht committet und nicht gepusht. Die Graph-Arbeit im Arbeitsverzeichnis bleibt unangetastet.

## 2026-09-04 (5) — Detailsicht im Graph öffnet nicht (Sponsor-Meldung): nicht reproduziert, offen

**Meldung:** Klick auf einen Knoten im Graph zeigt keine Detailsicht. Nachtrag im Verlauf: bei Mouse-over erscheint die Textbox, beim Klick passiert nichts; Vermutung des Sponsors, es hänge daran, dass die Spalte rechts vorher mit ✕ geschlossen wurde.

**Ergebnis: nicht reproduziert.** Die Detailsicht ist vorhanden und funktioniert in Chrome — belegt:
- Alle 197 Knoten haben einen Eintrag (`HT.daten.eintragMitId`), keiner läuft ins Leere.
- Breites Layout, echter Mausklick nach dem Laden: Spalte 384 px, Karte vollständig, `&id=` in der Adresse.
- Schmales Layout bei 900 px (sichtbares iframe): Blatt fährt hoch, y 207–740 bündig im Sichtfeld, Inhalt vollständig. **Damit ist das schmale Layout erstmals geprüft** — es war seit dem Umbau als ungeprüft vermerkt.
- Reihenfolge Öffnen → ✕ → anderer Knoten: 384 px / 1 px / 384 px, jeweils mit passender `id`. Das Schliessen sperrt nichts aus.
- Keine Konsolenfehler. Tooltip hat `pointer-events: none`, fängt also keine Klicks ab. Zugschwelle beim Verschieben liegt bei 8 px.

**Zwei Fehldiagnosen unterwegs, beide zurückgenommen — Ursache derselbe Messfehler.**
1. «Transition auf `grid-template-columns` bleibt bei Fortschritt 0 stehen»: In der Chrome-Automatisierung ist `document.visibilityState` `"hidden"` und `document.timeline.currentTime` bleibt 0 — Transitions werden angelegt, aber nie getickt, `getComputedStyle` liefert dauerhaft den Startwert. Sieht exakt aus wie ein Browserfehler. Gültig messen: `browser_batch` mit eingeschobenen Screenshots, die erzwingen einen Bildaufbau. Auch iframe-Prüfstände nur **sichtbar** aufsetzen, ausgelagerte (`left:-9999px`) sind gedrosselt.
2. «Nach dem Schliessen reagiert kein Klick mehr»: nach dem Schliessen passt sich der Graph neu ein, die Knoten verschieben sich — fest verdrahtete Klickkoordinaten treffen danach ins Leere. Position vor jedem Klick messen; `computer`-Koordinaten liegen im Screenshot-Raum (1552 px), nicht im Sichtfeld (1470 px), Faktor 1,056.

Ausserdem: `resize_window` unter ~1470 px wird in dieser Umgebung stillschweigend ignoriert (`innerWidth` bleibt stehen) — schmale Layouts nur über ein sichtbares iframe mit gesetzter Breite prüfen.

**Geändert:** nur die Versionsmarke in `index.html` (`?v=2026-09-04i` → `j`), damit ein veralteter Browser-Cache als Ursache ausscheidet. Kein Eingriff in `js/graph.js`, `js/graph-zeichnen.js` oder `css/graph.css`.

**Offen — nächster Schritt beim Sponsor.** Der Deep-Link `#/graph?id=rolle-projektleiter` öffnet die Detailsicht ohne jeden Klick und trennt die beiden Möglichkeiten: erscheint die Karte, liegt der Fehler allein im Klickweg; erscheint sie nicht, im Aufbau der Karte. Offene Angaben: verwendeter Browser (bisher nur Chrome geprüft), ob der Graph beim Klicken minimal verrutscht (dann verschluckt die 8-px-Zugschwelle den Klick), ob nach dem Klick tatsächlich `&id=` in der Adresse steht, und ob Tab + Enter auf einem Knoten die Karte öffnet (umgeht den Zeigerweg vollständig).

**Idee, unabhängig von der Ursache:** Der Klickweg scheitert heute stumm — `auswaehlen()` ruft `detailZeigen()` ohne Absicherung, eine Ausnahme dort hinterlässt keine Spur auf der Oberfläche. Ein sichtbarer Fehlerzustand im Detailfeld würde solche Meldungen in einem Schritt klären.

## 2026-09-04 (4) — Graph-Seite: eine Leiste, Swimlane, Meilensteine, volle Beschreibung

**Anlass:** Über dem Graphen standen drei Leisten übereinander — Kopfzeile der Anwendung (52 px), Werkzeugleiste, Auswahlleiste, zusammen rund 150 px, bevor der Graph anfing. Sponsor: auf eine minimieren.

**Eine Leiste, 50 px.** Die Kopfzeile der Anwendung ist auf der Graph-Route ausgeblendet (`body[data-route="graph"] .topbar`); die Marke `H ▾` in der Leiste öffnet die Hauptnavigation als Popover — dieselben Routen und Icons wie die mobile Navigationsleiste, die unverändert bleibt. Danach Ansicht, Vorgehensweise bzw. Szenario, Auswahl-Chips, Quer-Filter, Zurücksetzen; rechts Suche, Darstellung, Legende, Zoom. Der Graph beginnt jetzt bei y = 50 statt y = 190, die Seite füllt den Viewport exakt (kein Seitenscroll mehr).

**Was dafür weichen musste:** Das Suchfeld ist ein Lupenknopf mit Popover (Feld und Trefferliste darin, Fokus springt hinein). Der Statustext («alle Module · klassisch, Phase Initialisierung · 10 Rollen, 13 Aufgaben, 22 Ergebnisse · 72 Verbindungen») stand als Fliesstext in der Leiste und nimmt dort am meisten Platz — er steht neu zuoberst in der Legende und bleibt in der Leiste als `.nur-sr`-Live-Bereich für Screenreader. «Einpassen» ist ein Icon. Das Label «PHASEN»/«MODULE» der alten Auswahlleiste entfällt, es wiederholte nur die Ansicht.

**Die Chips laufen in einer Zeile und scrollen seitwärts** (`chips--auswahl`, versteckte Scrollleiste wie die Streifen-Chips im Lexikon); eine Blende an der rechten Kante zeigt an, dass weitere folgen — bei zwölf Modulen bliebe von der Leiste sonst nichts übrig. Passt die Auswahl in die Zeile, liegt die Blende über leerem Raum.

**Ansicht als Icon, Phasen als Chevrons (Nachgang zum selben Umbau):** «Nach Phasen / Nach Modulen» steht als zwei Icons in der Leiste — Fahne und Baustein-Stapel, dieselben Zeichen wie Phase und Modul im Lexikon; der Name steckt in `aria-label` und Titel. Das Segment schrumpft damit von 230 px auf 88 px, und die vorher gebaute «enge» Notlösung (Klasse `graph-leiste--eng` samt `ResizeObserver`, die die Beschriftung bei offenem Detailfeld kürzte) ist ersatzlos entfallen — der gewonnene Platz reicht auch mit Detailfeld. Die Phasen-Chips sind ein **Chevron-Band** in der Reihenfolge der Vorgehensweise: `clip-path`-Polygon mit 10 px Spitze, die Einkerbung des Nachfolgers greift 8 px darüber, das ergibt eine gleichmässige Fuge von 2 px. Kein Rahmen (clip-path schneidet ihn an den Schrägen an), darum Fläche statt Kontur — und der Fokusring als innerer Schatten, weil `clip-path` auch das `outline` abschneidet. Module bleiben Chips: sie sind keine Folge.

**Schmal (< 700 px):** drei kurze Zeilen statt vier — oben Marke, Ansicht und Werkzeuge, darunter das Chevron-Band bzw. die Modul-Chips, zuunterst Vorgehensweise/Szenario, Quer-Filter und Zurücksetzen; zusammen 134 px statt vorher 218 px. Die Zoomstufen `−`/`+` sind dort ausgeblendet (auf dem Touchgerät zoomt man mit zwei Fingern), «Einpassen» bleibt.

**Popover vereinheitlicht:** alle sechs (Navigation, Suche, Umfang, Szenario, Darstellung, Legende) liegen in der Tabelle `POPS` mit Titel, Inhalt und auslösendem Knopf; «Klick daneben schliesst» liest die Auslöser daraus, statt sie aufzuzählen. `.gpop--links` verankert das Menü unter der Marke am linken Rand.

**Meilensteine sichtbar von den übrigen Ergebnissen getrennt:** Sie bleiben Ergebnisse (Ergebnistyp «Meilenstein»), sind im Ablauf aber die Quality Gates — darum ein **Sechseck** statt der Dokumentform, eine **Raute** statt des Dokument-Icons, kräftigere Kontur und kein doppeltes Typ-Symbol mehr hinter dem Namen. Der Knoten wird für die beiden Spitzen breiter; die Legende sagt es in einem Satz.

**Klick zeigt die ganze Beschreibung:** Das Detailfeld öffnete die Lexikonkarte auf Stufe «Kurz» — ein Satz, danach musste man erst «Handbuch» drücken. Neu startet es auf Stufe 2: vollständiger Handbuchtext mit Kapitel und Seite, Abgrenzung, Prüfungshinweis, Verantwortlich/Beteiligt und Beziehungstabelle. Die Stufenknöpfe klappen es wieder ein. Dazu: die Zugschwelle im Graphen von 4 auf 8 px erhöht — darunter zählte ein Klick, der auf dem Trackpad ein paar Pixel wandert, als Zug und wurde verschluckt (ein systematisches Klickversagen liess sich nicht reproduzieren, Knotenklicks funktionierten im Test zuverlässig).

**Swimlane statt Zwischentiteln:** Die Phase bzw. das Modul stand als kleiner Text über der jeweiligen Aufgabengruppe. Neu ist die Fläche ein Swimlane: **Rollen** als durchgehende Spalte ganz links, daneben die **Bahnbeschriftung** (Name plus «n Aufgaben · m Ergebnisse»), rechts davon **Aufgaben** und **Ergebnisse**, jede in ihrer Bahn. Die Bahnen laufen von oben nach unten in der Reihenfolge der Methode und sind abwechselnd getönt (`.gbahn`, eigene Ebene hinter Kanten und Knoten). Ein Ergebnis liegt in der Bahn der Aufgabe, die es erzeugt — so bleibt die Kante «erzeugt» waagrecht; ohne erzeugende Aufgabe zählt seine eigene erste Phase bzw. sein erstes Modul.

**Rollen bekommen keine Bahn** — Entscheid des Sponsors nach Rückfrage. Sie tragen in `data/rollen.json` weder Phase noch Modul (nur `ebene`), eine Zuordnung wäre erfunden. Sie stehen darum links ausserhalb der Bänder; die Leserichtung «wer tut was, was entsteht» bleibt erhalten.

**Layout-Details:** Die Bahnhöhe ist `max(Aufgaben, Ergebnisse)` der Bahn; die kürzere Spalte sitzt darin mittig, sonst klafft unter den Aufgaben eine Lücke, wenn eine Bahn viel mehr Ergebnisse hat (Projektsteuerung: 7 zu 17). Sind Aufgaben *und* Ergebnisse ausgeblendet, fällt das Layout auf schlichte Spalten zurück (`einfacheSpalten`). Die Kantenberechnung ist in `kantenBauen` ausgelagert, weil beide Wege sie brauchen.

**Geprüft:** alle sechs Routen ohne Konsolenfehler; Kopfzeile erscheint auf den anderen Routen unverändert; Swimlane in Phasen- (klassisch 5 Bahnen, agil 3) und Modulansicht, nur Ergebnisse sichtbar (Bahnen aus den Ergebnissen), nur Rollen sichtbar (Rückfall), Auswahl und Hervorhebung, Dark Mode; Meilensteine in Phasen- und Modulansicht als Sechseck, Detailfeld öffnet mit vollem Handbuchtext (Kap. 4.4.4.5, S. 81 beim Meilenstein Durchführungsfreigabe); Graph-Seite füllt den Viewport ohne Seitenscroll; Navigation, Suche, Legende mit Statuszeile, Modulansicht mit zwölf scrollenden Chips, Chevron-Band klassisch (5) und agil (3), Detailfeld einzeilig sowie Dark Mode geprüft. Asset-Version `?v=2026-09-04i`.

## 2026-09-04 (3) — Kategorie-Icons statt Kennbuchstaben

**Anlass:** Die Methodenelemente waren mit Kennbuchstaben codiert (R/A/E im Knotenkreis und in der Icon-Leiste des Graphen); die Lexikon-Badges und Filterchips trugen nur Text. Gewünscht waren Icons.

**Ein Satz für alle sieben Methodenelemente**, zentral in `js/ui.js` (`KAT_PFADE`, `HT.ui.katPfade`, `HT.ui.katSymbol`): Phase Fahne, Szenario Weg mit Pfeil, Modul Baustein-Stapel, Aufgabe Zahnrad, Ergebnis Dokument mit Eselsohr, Rolle Person, Grundbegriff Glühbirne. Gleiche Strichführung wie die bestehenden Navigations-Icons (24er-Raster, Kontur, `currentColor`), damit die Farbe aus dem umgebenden Element kommt und Light/Dark ohne Zusatzregeln stimmt.

**Verwendet an allen Stellen, wo die Kategorie sichtbar ist:** Knotenkreis im Graph (`gk__ikone`, in den 16-px-Kreis skaliert, `graph-zeichnen.js`), Icon-Leiste, Legende, Graph-Suche und Verbindungsgruppen im Detailfeld (`gswatch`), Lexikon-Badges (`HT.ui.badge`, auch auf der Lernkartenrückseite), Filterchips von Lexikon, Lernkarten und Quiz sowie die Kapitelkarten der Methode (farbige Kachel in der Kategoriefarbe). `glyph` ist aus `js/graph-modell.js` verschwunden.

**Zeichnerische Feinarbeit:** die Icons müssen bei 11–12 px im Knoten lesbar sein. Zahnrad zuerst als Speichenstern (las sich wie ein Sternchen), dann als Ring mit Nabe (bei 12 px ein Fleck), schliesslich Ring mit sechs Zähnen ohne Nabe; das Dokument-Icon hat seine zwei Textlinien verloren, weil sie bei dieser Grösse verschmolzen. `.gswatch svg` skaliert relativ (65 %), damit die 18-, 20- und 22-px-Varianten der Leiste ohne eigene Regeln passen.

**Geprüft:** alle sechs Routen im Browser ohne Konsolenfehler, Icons in Graph (Knoten, Leiste, Legende, Suche, Detail), Lexikon, Lernkarten, Quiz und Methode sichtbar. Asset-Version auf `?v=2026-09-04d` erhöht (`DATEN_VERSION` unverändert — die JSON-Daten wurden nicht angefasst).

## 2026-09-04 (2) — Graph auf drei Elemente reduziert, Seitenleiste ersetzt

**Anlass:** Die linke Steuerung der Graph-Seite war zu kompliziert — acht Aufklapp-Abschnitte, rund anderthalb Bildschirme Scrollen, und der wichtigste Schalter (welche Inhaltstypen zeige ich?) steckte mittendrin. Erst als Entwurf neu gedacht (Claude-Design-Canvas, Arbeitsdateien in `design/graph-steuerung/`), dann eingebaut.

**Neues Modell (Entscheid des Sponsors):** Der Graph enthält nur noch **Rollen, Aufgaben und Ergebnisse** — wer tut was, und was entsteht dabei. Phasen, Module und Szenarien sind keine Knoten mehr, sondern der **Umfang**: zwei Ansichten («Nach Phasen» / «Nach Modulen») gruppieren die Aufgabenspalte, das jeweils andere Kriterium bleibt als zusätzlicher Filter, ein Szenario wählt seine Module vor. Die Daten tragen das: 68 von 71 Aufgaben hängen an genau einem Modul, 55 von 71 an genau einer klassischen Phase — Gruppieren ist also fast überschneidungsfrei. Vier Beziehungen bleiben: verantwortlich, beteiligt, erzeugt, «Rolle verantwortet Ergebnis» (voreingestellt aus). Mit dem Modell fielen die Kategorien Phase/Szenario/Modul/Grundbegriff aus dem Graphen (Grundbegriffe haben dort keine Entsprechung mehr — der Knopf «Im Graph» fehlt bei ihnen jetzt).

**Fokus-Ansicht und Phasenmatrix gestrichen.** Fokus lebt als Klick-Hervorhebung weiter (gewählter Knoten samt Nachbarn hell, Rest gedimmt); die Meilenstein-Tabelle entfällt ersatzlos. Meilensteine bleiben als Ergebnisse vom Typ ◆ sichtbar.

**Steuerung:** Seitenleiste ersatzlos weg. Kopfzeile trägt Ansicht, Suche, Status, Darstellung und Legende; darunter eine Zeile Auswahl (Vorgehensweise bzw. Szenario, Chips mit Aufgabenzahl, Gegenkriterium als Filterknopf, Zurücksetzen). Auf der Fläche eine Icon-Leiste: drei Zeichen für die Elementtypen mit Anzahl, darunter vier Linien für die Verbindungen — dieselben Formen, Farben und Kennbuchstaben wie am Knoten, damit ist die Leiste zugleich die Legende. Doppelklick auf einen Knoten schränkt auf sein Modul ein. Adresse trägt den Zustand (`?ansicht=…&vorgehen=…&phase=A,B&modul=X,Y&id=…`); nennt ein Link einen Umfang, gilt genau dieser statt des gespeicherten.

**Beim Prüfen gefunden und behoben:** Rollen hingen an der *sichtbaren* Aufgabenspalte (Aufgaben ausblenden liess auch alle Rollen verschwinden) — sie leiten sich jetzt aus dem ganzen Umfang ab. `?id=<Rolle>` stürzte ab, weil Rollen kein `phasen`-Feld haben. Die Sammeleinträge «Checklisten» und «Meilensteine» (Ergebnisse ohne Phasenangabe) erschienen in jedem Umfang — sie bleiben jetzt dem Lexikon vorbehalten. Im Hintergrundtab blieb der Graph leer, weil `requestAnimationFrame` dort nicht läuft: Timeout-Rückfall plus Neu-Einpassen beim Sichtbarwerden. Dazu ein leerer Zustand auf der Fläche, wenn eine Auswahl nichts trifft.

**Geprüft:** alle Routen und Deep-Links (`?id=` für Aufgabe/Ergebnis/Rolle/Modul/Phase/Grundbegriff, `?szenario=`, `?modul=A,B`, alte `?modus=phasen` und `?kat=`) ohne Konsolenfehler; Layoutlogik zusätzlich headless über alle Schaltzustände gerechnet. **Nicht geprüft:** das schmale Layout (Icon-Leiste liegend, Detail als Blatt von unten) — das Browserfenster liess sich in dieser Umgebung nicht unter ~1470 px verkleinern.

**Offen:** Der Entwurf im Canvas zeigt die Icons in der Reihenfolge A/E/R, eingebaut ist R/A/E passend zu den Spalten. `js/ui.js` hat neu `symbol()` (aus `app.js` herausgezogen, beide nutzen es).

## 2026-09-04 — Neuaufbau der Präsentation: Graph der Methodenelemente als Einstieg

**Auftrag:** Seite komplett überarbeiten, Inhalte aus der Quelle identisch lassen, Fokus auf Präsentation: intuitiv zeigen, welche Inhalte HERMES beschreibt und wie sie zusammenhängen (Graph), mit UI-Komponenten zum Ein- und Ausblenden. Lokal testen, noch nicht auf GitHub Pages.

**Graph (neue Startansicht `#/graph`):**
- `js/graph-modell.js`: Knoten = 259 Einträge, Kanten aus den Querverweisen der Daten (Szenario→Module, Modul→Phasen, Aufgabe→Ergebnisse/Rollen/Module/Phasen, Ergebnis→Rollen/Module/Phasen, Phase→Meilensteine, Grundbegriff→Elemente; «beteiligt» ohne die bereits verantwortliche Rolle). Acht Beziehungstypen mit Lesart aus beiden Richtungen («verantwortlich» / «verantwortlich für»). Filter (Szenario, Phase, Vorgehensweise, Module, Ergebnistyp, Rollenebene, nur minimal gefordert / Entscheidungsaufgaben / zwingende Module); Rollen erscheinen bei aktiven Filtern nur mit sichtbarer Verbindung. Umfeld eines Knotens nach Kategorie und Beziehung gruppiert, je Gruppe auf 12 gekappt («+ n weitere anzeigen»).
- `js/graph-zeichnen.js`: reines SVG. Spaltenlayout (Szenarien | Module | Aufgaben | Ergebnisse | Rollen, Aufgaben/Ergebnisse nach Modul gruppiert, S-Kurven; sehr hohe Graphen oben bündig), Fächerlayout für den Fokus (Ring, Überschriften als eigene Plätze, Überlappungen je Seite auseinandergeschoben, Querverbindungen als Bögen). Knotenform je Kategorie (Phase Zeitpfeil, Szenario Sechseck, Aufgabe Parallelogramm, Ergebnis Dokument mit Eselsohr, Rolle Pille, Modul Kasten, Grundbegriff gestrichelt), Kennbuchstabe, Phasenstreifen I K R E U A, Ergebnistyp-Symbol. Verschieben/Zoomen mit Maus, Rad, zwei Fingern; Hervorhebung der Nachbarschaft bei Hover/Klick; Tastatur (Tab, Enter).
- `js/graph.js`: drei Ansichten (Struktur, Fokus, Phasen-Matrix mit Meilensteinzeile wie Abb. 101), Seitenleiste mit Kategorie-Chips (Zähler je Ansicht), Beziehungsschaltern, Filtern, Suche (fokussiert), sechs Beispielen, Legende; Detailfeld mit der Lexikonkarte (identische Inhalte via `js/karte.js`) und der vollständigen Verbindungsliste; Pfad «Zurück zu». Zustand in localStorage, Deep-Links `#/graph?id=…`, `?modus=…`, `?kat=…`, `?szenario=…`, `?phase=…`, `?modul=…`. Auf breiten Bildschirmen drei Spalten (Detail klappt nur bei Auswahl auf), schmal Schublade und Bottom-Sheet.
- Farben: sechs Kategoriefarben für Light mit dem Dataviz-Validator über alle Paare geprüft (Lichtheit, Chroma, Farbfehlsichtigkeit, Normalsicht bestanden; Kontrast unter 3:1 bei Teal/Gold nur mit Beschriftung zulässig, Knoten sind immer beschriftet). Für Dark die nächstliegenden Stufen im Band; dort bleiben Magenta/Teal und Gold/Orange unter Deutanopie nah, darum Form + Buchstabe als zweite Codierung. HQ-Design-System (Terminal-Dark, Monospace) bewusst nicht übernommen: Lernseite bleibt mobile-first, Light/Dark, Systemschrift, ohne Abhängigkeiten.

**Sonst:** `js/karte.js` aus dem Lexikon herausgelöst (Lexikon und Graph rendern dieselbe Karte, «Im Graph»-Knopf je Eintrag); Methode-Hub und Kapitelseiten verlinken in den Graph; Über-Seite nachgeführt; Satzende-Erkennung ignoriert jetzt «(z. B.» / «(u. a.» / «(d. h.» (Kurzfassungen brachen vorher dort ab). Versionen (`?v=`, `DATEN_VERSION`) auf 2026-09-04. README/SCHEMA ergänzt (Abschnitt «Graph»). Wiki-Projektseite nachgeführt (im HQ-Repo weiterhin uncommitted).

**Getestet (lokal, http://127.0.0.1:8080):** Chrome 1440 px und 500 px, ohne Konsolenfehler: Struktur (Standard 17 Elemente/34 Kanten; Beispiel Beschaffung 26/90; alles 214/1002), Fokus (IT-Adaption, Projektleiter mit Kappung, Aufgabe im simulierten Dark-Mode), Phasenmatrix, Schublade/Sheet mobil, Lexikon-Karte mit Graph-Link, Methode-Hub, Rundgang durch alle Routen.

**Nicht gemacht / offen:** Nicht committet und nicht gepusht (Auftrag: erst lokal prüfen). Ideen: Tiefe 2 im Fokus, Barycenter-Sortierung gegen Kreuzungen in der Struktur, Druckansicht des Graphen, Grundbegriffe untereinander verknüpfen (in den Daten nicht erfasst).

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

**Veröffentlicht:** Commit `7c28eb6` auf `main` gepusht; GitHub Pages nach 20 s aktualisiert (verifiziert: 120 Fragen mit Beleg, Kapiteltexte, Kernaussagen und Abbildungen werden live ausgeliefert).

**Offen / Ideen:** Programmmanagement-Anhang und Leitfaden Agilität als weitere Kapitel importieren; Spaced Repetition für Lernkarten; Grundbegriffe mit eigenem Handbuchtext hinterlegen (derzeit kuratierte Details + Kapitel-Link); vier grosse Rasterabbildungen nur verlinkt. Vier parallele Agenten liefen in ein Sitzungslimit und wurden per Nachricht fortgesetzt — bei grossen Prüfaufträgen künftig gestaffelt starten.

## 2026-08-27 — Projektaufbau: Site komplett, QA bestanden

**Von null auf fertige Site in einer Session**, koordiniert über Opus-Agenten: Skeleton + Datenschema (SCHEMA.md als Kontrakt), dann parallel drei Inhaltsagenten (Phasen/Szenarien/Module/Grundbegriffe · Aufgaben · Ergebnisse/Rollen) und ein Frontend-Agent; anschliessend Quiz-Agent (60 kuratierte Prüfungsfragen) und unabhängiger QA-Agent.

**Inhalte:** 259 Methodenelemente (6 Phasen, 5 Szenarien, 12 Module, 39 Grundbegriffe, 71 Aufgaben, 110 Ergebnisse, 16 Rollen) + 60 Quizfragen. Jede Quellen-URL auf hermes.admin.ch per Abruf verifiziert (233/233 HTTP 200, Titelabgleich); 1821 Querverweise konsistent. Fachliche Befunde: HERMES 2022 hat 6 definierte Phasen (5 klassisch/3 agil, nicht 4); keine agilen Szenario-Varianten; «Anwendungsgebiet»/«Partizipation»/«hybrid» existieren nicht; 17 Checklisten vs. 16 Meilensteine (kein Meilenstein Projektabbruch).

**Frontend:** statisch, ohne Build/Abhängigkeiten, Hash-Routing; Lexikon (Suche mit Umlauttoleranz, Kategorie-Filter, Quellenlink je Eintrag), Lernkarten (localStorage), Quiz (kuratiert + generiert mit Begriffsmaskierung), Übersicht (beide Vorgehensweisen). QA: 0 XSS (kein innerHTML), 0 Konsolenfehler, kein Horizontalscroll bei 320/375/768 px, GH-Pages-tauglich (relative Pfade, .nojekyll).

**QA-Runde:** Blocker behoben (Übersicht zeigte 4-Phasen-Modell — genau die Prüfungsfalle), Quiz-Antwort-Leaks geschlossen (Wortbestandteil-Maskierung, uneindeutige Fragen verworfen), Antwortlängen-Giveaways ausbalanciert. Bekannte Restpunkte: Zitattreue bei 2 Grundbegriff-Definitionen (Montage/Kürzung, sachlich korrekt), 2 selbst geprägte Grundbegriff-Labels, Präfix-Hinweis bei Komposita im generierten Quiz (bewusst belassen).

**Veröffentlicht:** Repo `MarkusSteinbrecher/hermes-trainer` (public) erstellt, GH Pages ab `main` aktiviert — live unter https://markussteinbrecher.github.io/hermes-trainer/ (verifiziert: Assets und Daten laden, Lexikon rendert 259 Einträge).
