# Session-Log — HERMES-Trainer

Neueste Einträge zuerst.

## 2026-09-11 — Trainer: Chip aus belegtem Kasten wieder herausziehen

**Auftrag:** «Wenn ich einen Kasten per Drag-and-drop auf einen leeren Kasten gezogen habe, kann ich ihn nicht mehr entfernen. Ich muss die Möglichkeit haben, ihn wegzuziehen und woanders zu droppen.»

**Umsetzung:** Die Zieh-Logik in `js/trainer.js` ist jetzt eine gemeinsame Funktion `ziehen(ev, chip, quelle)` für Chips im Pool (`chipZiehbar`) und belegte Kästen (`zielZiehbar`). Aus einem belegten Kasten lässt sich der Chip mit der Maus herausziehen: Loslassen auf einem anderen Kasten verschiebt ihn (ein belegter tauscht wie bisher), Loslassen irgendwo sonst legt ihn in den Pool zurück. Der Kasten wird während des Zugs blass gestrichelt, der Cursor ist «grab». Der Klick, der auf ein Loslassen auf demselben Kasten folgt, wird verschluckt (`ziel.gezogen`, beim nächsten `zeichnen()` zurückgesetzt), damit er den Chip nicht ungewollt löst. Der Klick auf einen belegten Kasten legt den Chip weiterhin zurück; Hinweistext und Kastenbeschreibung sagen das. Touch bleibt beim Antippen.

**Geprüft** lokal mit synthetischen Pointer-Ereignissen (Chromes Drag löst kein pointerup aus): Chip → Kasten, Kasten → Pool, Kasten → anderer Kasten, Zurückfallen auf denselben Kasten plus Folge-Klick (bleibt belegt), echter Klick löst; kein Geist bleibt hängen, keine Konsolenfehler.

## 2026-09-11 — Kopfzeile: Beta-Pille

**Auftrag:** «Ergänze auch noch eine Beta-Version-Pille in der Top-Navigation.»

**Umsetzung:** `marke__beta` in `index.html` neben dem Schriftzug meinHERMES: runde Pille, 18 px hoch, Akzentrahmen auf hellem Akzentgrund, «BETA» in Versalien; Tooltip «Diese Anwendung ist noch in Entwicklung — Rückmeldungen sind willkommen.» Stil in `css/style.css`. Geprüft lokal, keine Konsolenfehler.

## 2026-09-11 — Graph: Leiste ohne «Phasen» und «Szenario», runde Suchleiste

**Auftrag:** «Entferne den Phasen- und Szenario-Filter, wir haben ja den allgemeinen Filter links, und mach eine schöne Searchbar mit abgerundeten Ecken.»

**Umsetzung:** Die Knöpfe «Szenario ▾» und «Phasen/Module: … ▾» samt ihren Popovern (`querInhalt`, `szenarioInhalt`, POPS-Einträge) sind weg; Szenarien und die Querauswahl bleiben in «Alle Filter». Die Leiste besteht jetzt aus Ansicht, «Alle Filter», Suchfeld, Umfang-Chips, Fokus-Chip und «Zurücksetzen» (in der Phasenansicht zusätzlich klassisch/agil). Suchfeld als Pille (`border-radius: 999px`) mit Lupe links, leicht getönt, beim Fokus weiss mit Akzentring; Trefferliste mit 14 px Radius, Schatten und abgerundeten Zeilen. CSS der entfernten Knöpfe bereinigt.

**Geprüft** lokal: Leiste, Suche «Steuer» (Modul zuerst, dann Aufgaben/Ergebnisse) mit aufgeklappter Liste, keine Konsolenfehler.

## 2026-09-11 — Graph: Suchleiste statt Modul-Chips

**Auftrag:** «Entferne die Module in der Navigationsleiste auf der Graph-Seite und ergänze eine Searchbar. Wenn ich nach einem Element, einem Modul oder einer Phase suche, werden nur diese Elemente und die mit einer Verbindung dazu angezeigt.»

**Umsetzung:** Die Modul-Chips (in der Phasenansicht das Phasenband) sind aus der Leiste weg; an ihrer Stelle steht ein Suchfeld (`gleiste-suche`) mit Trefferliste als Ausklappmenü. Die Suche (`leisteTrefferZeichnen()` in `js/graph.js`) findet Module und Phasen (zuerst, höchstens vier) und Elemente; Namenstreffer haben Vorrang, der Volltext über Definitionen greift nur, wenn kein Name passt — sonst stand «Abschluss» unter «Projektf». Ein Treffer wirkt so (`suchtrefferAnwenden()`): Modul → Umfang nur dieses Modul; Phase → Umfang nur diese Phase, die Vorgehensweise wechselt bei Bedarf (Umsetzung ist agil); Element → Fokus wie beim Klick. Enter nimmt den ersten Treffer, Escape leert das Feld, Klick daneben schliesst die Liste. Gewählte Module und Phasen erscheinen als Chips mit × neben dem Suchfeld (`gumfang`, Stil des Fokus-Chips in Neutralfarben); «Alle Filter» und «Phasen/Module: … ▾» bleiben für Mehrfachauswahl. Schmal (< 700 px) nimmt das Suchfeld die ganze Zeile.

**Geprüft** lokal: «Projektf» → nur Projektführung als Treffer, Enter zeigt 5 Rollen, 11 Aufgaben, 19 Ergebnisse mit Chip; «Konz» → Phase Konzept zuerst, dann Konzept-Elemente; «Auftragg» → Fokus auf die Rolle. Keine Konsolenfehler.

## 2026-09-11 — Graph: Fokus zeigt nur direkte Verbindungen, kompakt

**Auftrag:** «Wenn ich auf eine Rolle klicke, sollten nur die Elemente angezeigt werden, die mit der Rolle eine Verbindung haben. Diese Elemente sollten auf die Seite zusammengezogen werden. Und ich muss das wieder deaktivieren können.»

**Befund:** Der Fokus vom Vortag nahm eine zweite Stufe mit (bei einer Rolle auch die Ergebnisse ihrer Aufgaben), liess die Modul-/Phasenbahnen des ganzen Graphen stehen und dimmte beim Überfahren des geklickten Elements alles Übrige — das sah nach «alles noch da, nur ausgegraut» aus.

**Umsetzung:** `fokusMenge()` in `js/graph-modell.js` liefert nur noch das Element und seine direkten Nachbarn. Im Fokus geben die Spalten keine `gruppeVon` mehr zurück, darum fällt `layoutSpalten()` auf `einfacheSpalten()` zurück: drei schlichte, vertikal zentrierte Spalten ohne Bahnen. Einpassen im Fokus mit `minZoom` 0,35 (statt 0,6), damit auch 24 Ergebnisse untereinander in die Fläche passen. Über dem fokussierten Element wird nichts mehr gedimmt. Neuer Hinweis unten mittig auf der Fläche (`gfokus-hinweis`) mit Text und Knopf «Fokus aufheben»; er wird beim Einpassen wie die Icon-Leisten freigehalten. Escape hebt den Fokus auf (wenn kein Popover offen ist). Nach dem Aufheben bleibt das Element nur umrandet (`auswahlZeigen()`), der Rest wird nicht mehr gedimmt — Dimmen gibt es nur noch beim Überfahren.

**Geprüft** lokal: Fokus «Auftraggeber» zeigt 1 Rolle, 19 Aufgaben, 24 Ergebnisse in drei Spalten, vollständig eingepasst; Aufheben per Banner, Chip, Detailknopf oder Escape bringt den ganzen Graphen ungedimmt zurück. Keine Konsolenfehler. Live: nach dem Push mit `curl` und im Browser bestätigt.

## 2026-09-10 — Graph: farbige Verbindungen, Klick fokussiert und passt ein

**Auftrag:** «Mach die Linien doch wieder farbig, so wie wir es vorher hatten. Die kleinen Phasen-Kästchen in den Elementen machen wir dunkelgrau und nicht schwarz. Und wenn wir ein Element anklicken: alles andere ausblenden, die verlinkten Elemente zeigen und die Ansicht passend zoomen.»

**Umsetzung:** Verbindungen wieder in den Farben der Quelle (`css/graph.css`): Rosé der Rolle für «verantwortlich», «beteiligt», «verantwortet das Ergebnis», Orange der Aufgabe für «erzeugt»; die Grau-Variablen sind weg. Phasenmodell im Knoten: aktive Phasen `--gk-phase-aktiv` (#5a5656) statt Schwarz, Texte in Darstellung und Legende angepasst. Ein Klick auf einen Knoten ruft jetzt `fokusSetzen()` statt `auswaehlen()`: nur das Element mit seiner Nachbarschaft bleibt stehen, Detailfeld geht auf, Ansicht wird eingepasst (im Fokus bis Zoom 1,6). Zweiter Klick auf das fokussierte Element hebt den Fokus auf und stellt die vorherige Phasen-/Modulauswahl wieder her (`umfangVorFokus`); Klick auf einen Nachbarn verschiebt den Fokus. Tooltip sagt «Klick: nur dieses Element mit seinen Verbindungen».

**Einpassen:** `einpassen()` in `js/graph-zeichnen.js` hält die beiden Icon-Leisten frei (`rueckrufe.freihalten()` liefert die Elemente; jede Leiste schneidet die Fläche an der Seite ab, wo es am wenigsten kostet — schmale Spalte links/rechts, flache Reihe unten). Ein `ResizeObserver` auf dem SVG passt neu ein, solange die Ansicht seit dem letzten Einpassen nicht von Hand verschoben oder gezoomt wurde — damit stimmt der Ausschnitt auch, wenn das Detailfeld nach dem Zeichnen aufgeht (beim Laden mit `fokus=` in der Adresse blieb er vorher auf der vollen Breite berechnet). Zoom-Knopf «Einpassen» und der Nachlauf nach dem Detailfeld nutzen dieselben Optionen (`einpassOptionen()`).

**Geprüft** im Browser (localhost, Modulansicht): Klick auf «Entscheid Phasenfreigabe treffen» zeigt 5 Rollen, 1 Aufgabe, 4 Ergebnisse eingepasst; zweiter Klick bringt den ganzen Graphen zurück; Klick auf «Auftraggeber» im Fokus wechselt den Fokus; keine Konsolenfehler.

## 2026-09-10 — Graph: Werkzeuge als rechte Icon-Leiste auf der Fläche

**Auftrag:** «Nimm die Icons, die wir in der Top Navigation ganz rechts haben (+/- etc.) und füge sie in die Graph Seite selber ein. Ähnlich wie die Box die wir links haben, nur dafür auf der rechten Seite.»

**Umsetzung:** `railRechtsBauen()` in `js/graph.js` legt `grail grail--rechts` mit Filter, Suche, Darstellung, Legende und darunter dem Zoom (−, +, Einpassen) rechts oben auf die Fläche; die Knöpfe entstehen weiterhin in `leisteBauen()`, damit `POPS` sie über `refs` findet. Die Leiste darüber enthält nur noch Ansicht, «Alle Filter», Auswahl und Zurücksetzen. Popover rücken um die Leistenbreite nach links (`right: calc(1.5rem + 54px)`, auch `gpop--breit`). Unter 700 px liegt die rechte Leiste als Reihe unten, der Zoom liegend.

## 2026-09-10 — Umbenennung in «meinHERMES», Ko-fi-Link

**Auftrag:** «Schau mal in das rrradio repository, dort haben wir das Kofi Logo von mir auf der Seite. Ergänze das auf der HERMES Seite. Und lass uns die Seite "meinHERMES" nennen.»

- **Ko-fi:** Becher-Logo aus `~/Code/rrradio/public/kofi-cup.png` nach `assets/bild/kofi-cup.png` kopiert. Link rechts in der Kopfzeile (`.kofi`, auch auf dem Telefon sichtbar, da die Kopfzeile bleibt), Textlink in der Fusszeile, Abschnitt «Unterstützen» auf der Über-Seite. Ziel wie bei rrradio: `https://ko-fi.com/rrradio`.
- **Name:** Titel, Marke (jetzt ohne Versalien, 16 px), `document.title`-Suffix, Über-Seite, Notizen-Export (Dateiname `meinhermes-notizen-…`, Markdown-Titel, Fehlermeldung), README, SCHEMA und die Kopfkommentare aller JS/CSS-Dateien. Bewusst unverändert: Repository-Name, `localStorage`-Präfix `hermes-trainer:` und die Kennung `app: "hermes-trainer"` in Notizen-Dateien — sonst verlören Nutzer Lernstand und Import-Kompatibilität.
- Versionsmarke `?v=2026-09-10d`.

## 2026-09-10 — Graph: graue Verbindungen, grössere Knoten, Phasenmodell im Knoten, grössere Spaltentitel

**Auftrag:** «ändere die Farbe der Linien zu hell- und dunkelgrau; mach die Boxen der Aufgaben und Ergebnisse grösser und die Zuordnung zu den Phasen (die kleinen Rechtecke) sollten wie in der HERMES Übersicht dargestellt werden — Initialisierung in der Mitte, Konzept, Realisierung, Einführung oben, Umsetzung unten und Abschluss wieder in der Mitte. Die Boxen sollten schwarz sein oder hellgrau. Der Text der Überschriften oben ist zu klein.»

**Umsetzung (`js/graph-zeichnen.js`, `css/graph.css`, `js/graph.js`):**
- **Verbindungen grau:** `--gkante-dunkel` (#3f3c3c) für «verantwortlich» und «erzeugt», `--gkante-hell` (#b3afaf) für «beteiligt» (gestrichelt) und «verantwortet das Ergebnis» (gepunktet); Legende und Icon-Leiste folgen über dieselben Variablen. Rot und Violett der Kanten sind weg, die Knoten behalten ihre Kategorienfarbe.
- **Knoten grösser:** `KNOTEN_HOEHE` 28 → 36, Beschriftung 12 → 14 px (Messschrift angepasst), Glyph-Radius 8 → 10, Meilenstein-Spitze 10 → 12, Typsymbol 11 → 13 px.
- **Phasenmodell statt Streifen:** `PHASEN_ZELLEN` bildet die HERMES-Grafik nach — Initialisierung über die volle Höhe (20 px), dann Konzept · Realisierung · Einführung oben und Umsetzung darunter über dieselbe Breite, rechts Abschluss über die volle Höhe. Zelle 7 px, Lücke 1.5 px, Streifen 41 px breit. Inaktiv hellgrau (#d9d6d6), Phasen des Elements schwarz (`--text`). Nachtrag auf Wunsch: Initialisierung und Abschluss gleich hoch wie die übrigen Felder (halbe Höhe) und mittig zwischen den beiden Reihen (`MITTIG`). Beschriftung in Darstellung («Phasenmodell im Knoten») und Legende angepasst.
- **Spaltentitel:** `.gtext--spalte` 12 → 16 px, Bahnname 12 → 14, Zähler 11 → 12, Kopfzeile 6 px höher gesetzt.
- Versionsmarke `?v=2026-09-10c`.

**Test:** Browser, Phase Initialisierung: keine Konsolenfehler, Auswahl «Projekt steuern» hebt Nachbarn und Kanten in Dunkelgrau hervor, Rest gedimmt.

## 2026-09-10 — Graph: Popover «Alle Filter» mit allen Filtern untereinander

**Auftrag:** «Auf der Graph Seite: erstelle ein Popup mit allen Filtern auf einer Seite, Phasen, Szenarien, etc. Alle aufgelistet untereinander, so dass man einfach und schnell alle Phasen oder einzelne auswählen kann.» Nachtrag: «Mach das Popup so, das es die gesamte breite der Seite nutzt und die Elemente nebeneinander sind und leichter auswählbar (ohne scrollen zu müssen).»

**Nachtrag volle Breite:** `POPS.alle.breit` → `popZeichnen()` setzt `gpop--breit` (links und rechts .75rem, Breite auto; Regel als `.gpop.gpop--breit`, sonst gewinnt die Breitenangabe von `.gpop`). Inhalt als `gaf-raster` mit sechs Spuren (1.2 / 1 / 1.5 / 2.9 / 1.3 / 1.3 fr): Ansicht+Vorgehensweise · Phasen · Szenarien · Module in zwei Reihen (`gs-liste--zwei`) · Elemente+Verbindungen · Darstellung; Fusszeile mit Hinweis, «Auswahl zurücksetzen», «Fertig». Bei 1470×743 ist das Popover 441 px hoch und scrollt nicht. Unter 1400 px drei Spuren, unter 700 px zwei (Module einreihig). Szenario-Zähler nur als Zahl (Text «5 Module» sprengte die Spur), Modulnamen brechen nicht mehr mitten im Wort (`overflow-wrap: break-word`).

**Umsetzung (`js/graph.js`, `css/graph.css`):** Neuer Knopf «Alle Filter ▾» in der Leiste direkt nach der Ansicht, öffnet den Popover `alle` (gleicher Mechanismus wie Suche, Szenario, Darstellung). Inhalt in Abschnitten mit Titelzeile: Ansicht (Nach Phasen / Nach Modulen), Vorgehensweise (Klassisch / Agil), Phasen als Häkchenliste mit Aufgabenzahl und Link «Alle Phasen», Szenarien als Radioliste (nochmals wählen hebt auf), Module als Häkchenliste mit «Alle Module», Elemente (Rollen/Aufgaben/Ergebnisse mit Zahl), Verbindungen, Darstellung, unten «Auswahl zurücksetzen» und «Fertig». Jedes Häkchen wirkt sofort; Leiste, Icon-Leiste und URL zeigen dieselbe Auswahl.
- **«Alle» = leere Liste** im Modell: die Liste zeigt dann jedes Häkchen gesetzt; ein Häkchen wegnehmen behält die übrigen (Liste = alle ausser diesem); sind wieder alle gesetzt, wird die Liste leer. Szenarien setzen nur die Module, wechseln die Ansicht nicht (anders als der alte Szenario-Knopf).
- **Popover bleibt beim Neuaufbau stehen:** `popZeichnen()` hält `scrollTop` und stellt den Fokus über `data-fokus` wieder her; erster Fokus nur beim Öffnen (`popFokusNoetig`).
- **Fehler in der Klick-daneben-Logik behoben:** Der Dokument-Listener lief die Elternkette von `ev.target` hoch — ein Knopf, der in seinem eigenen Klick den Popover neu aufbaut, hängt dann nicht mehr im Dokument, die Kette endet im Leeren, der Popover ging zu. Jetzt `ev.composedPath()` (Pfad zum Zeitpunkt des Ereignisses). Das betraf schon vorher die Chips im «Module: alle ▾»-Popover.
- `index.html`: `?v=2026-09-10b` — der Trainer-Fix von heute Nachmittag war noch unter `…10a` gepusht, also möglicherweise gecacht.

**Test:** Browser, skriptgesteuert (Häkchen, Szenario, Alle-Links, Ansicht, Vorgehen, Elemente, Verbindungen, Fertig) — Zustand in Leiste, Rail und URL konsistent, Popover bleibt offen. `javascript_tool` blockt die *Ausgabe*, sobald sie nach Query-String aussieht (`location.hash` mit `?ansicht=`); das Skript läuft trotzdem — Ergebnisse ohne Hash formulieren. Gespeicherter Graph-Zustand des Sponsors auf den Standard zurückgesetzt (Initialisierung, klassisch).

## 2026-09-10 — Trainer: Prüflogik über alle Übungen geprüft, Geist unter der Maus, Abschluss vollständig

**Auftrag:** «Ich ziehe die richtigen Elemente auf die Boxen und wenn ich prüfen klicke, zeigt es an, dass es falsch ist. Checke das bitte nochmal über alles. … Kann der Kasten direkt unter der Maus sein? Der Reset Knopf funktioniert auch noch nicht.»

**Befund:** Die Prüflogik (`passt`, Ziel-IDs aus `abbildung.js`) ist korrekt — im Browser alle 18 Übungen skriptgesteuert mit der aufgedeckten Lösung belegt, überall 100 % (Phasen 8/27/29/11/5/67, Module 16/4/10/7/12/3/6/5/5/7/5, Gesamtbild 80). Zwei echte Fehler dahinter:
- **Phase Abschluss war unlösbar (max. 4/5):** «Projekterfahrungen» ragt in der Grafik über den Abschluss-Balken hinaus in die Zeile darüber. Die Mitte lag im Fenster (→ Ziel gezählt), die linke obere Ecke nicht (→ `versatz()` null, kein Zielrechteck, Originaltext blieb sichtbar). Neu `fensterWeiten()`: jedes Fenster nimmt Kästen, deren Mitte darin liegt, ganz auf; berührende Fenster verschmelzen; Zielzahl danach neu gezählt.
- **Geist 41 px über dem Zeiger** (`translate(-50%, -140%)`): wer den Geist auf den Kasten legt, lässt mit dem Zeiger einen Kasten tiefer los — im Initialisierungs-Stapel (37 px Abstand) landet der Chip dann daneben. Das erklärt die «falschen» Prüfungen. Neu: Griffpunkt beim `pointerdown` gemerkt, Geist in Chipgrösse an derselben Stelle unter dem Zeiger; Trefferprüfung weiterhin am Zeiger.
- **Reset** funktioniert im aktuellen Stand (Commit `caf15d2` hatte ihn repariert); vermutlich noch die gecachte Fassung auf GitHub Pages (`index.html` max-age 600). Nebenbei: `gezogen`-Sperre klebte nach einem Treffer am Chip (Knopf wird ersetzt, Klick kommt nie) — erster Klick nach dem Zurücklegen ging verloren; Sperre fällt jetzt beim Neuaufbau des Chips.

**Test-Notiz:** Im Hintergrundtab drosselt Chrome `setTimeout` auf 1/s — Testskripte ohne Timer schreiben (MessageChannel zum Yielden). Testbestwerte aus `localStorage` (`hermes-trainer:trainer`) wieder entfernt; der Sponsor hatte noch keine.

## 2026-09-10 — Persönliche Notizen: Markieren, Kommentieren, freie Notizen, Sichern als Datei

**Auftrag:** «Können wir die Seite so personalisieren, dass der User Textpassagen highlighten, Kommentare ergänzen kann? Im Browser speichern und lokal sichern.» Nach Rückfrage: ja zu Lernstand im Export und zu freien Notizen ohne Textbezug.

**Neues Modul `js/notizen.js` + `css/notizen.css`, Route `#/notizen` (Nav zwischen Quiz und Über):**
- **Markieren:** Text auswählen → Blase mit vier Farben und «Kommentar» (Blase reagiert auf `selectionchange`, Knöpfe fangen `mousedown` ab, damit die Auswahl nicht kollabiert). Klick auf eine Markierung öffnet einen schwebenden Editor (Kommentar mit Autosave, Farbe, Löschen, Esc). Kommentierte Markierungen tragen eine feste Unterkante.
- **Verankerung** nach W3C-Web-Annotation (TextQuoteSelector): `exact` + 32 Zeichen `prefix`/`suffix`, Ort = nächster Block mit `data-nz-ort`. Positionen im Block über `Range.toString()`-Längen, wiedergefunden per `indexOf` (Kontext → Zitat allein → beste Kontextübereinstimmung). Textknoten werden gesplittet und in `<mark>` gehüllt, beim Neu-Anwenden erst ausgepackt und `normalize()`t. Ein `MutationObserver` auf `#view` (nur childList, eigene Änderungen per Zähler stumm) legt alles nach jedem Aufbau und Nachladen neu — die Ansichten setzen nur Attribute.
- **Orte:** Lexikonkarte (`#/lexikon?id=`, `karte.js`), Kapitelteil (`#/methode?kapitel=&teil=`) und Kapitel (`methode.js`), Inhaltsseite des Überblicks mit demselben Ort wie die Karte (`ueberblick.js`) — eine Markierung dort erscheint auch auf der Karte, sobald deren Stufe «Handbuch» geladen ist.
- **Verwaist** wird eine Markierung nur in einem Block mit `data-nz-komplett` — sonst hätte jede Karte in Stufe «Kurz» alle Handbuch-Markierungen als verloren geführt. Karte setzt es nach dem Nachladen, Kapitelteile tragen es ab Erstellung, das Kapitel nach dem Füllen, der Überblick sobald der Handbuchtext da ist.
- **Freie Notizen:** `HT.notizen.panel(ort, titel)` ist ein `<details>` «Meine Notizen · n» mit Textareas (Autosave, Höhe wächst mit) und der Liste der Markierungen des Orts (Klick springt hin). Kapitelende, Inhaltsseite des Überblicks, Lexikonkarte (dort kompakt, ohne eigene Linie).
- **Seite «Notizen»:** nach Ort gruppiert, Notizen editierbar, Markierungen mit Zitat, Kommentar und Sprunglink `…&nz=<id>` (scrollt und blitzt), Löschen je Eintrag. Export JSON (Notizen + Lernstand `lernkarten`, `quiz-statistik`, `quiz-konfig`, `trainer`) und Markdown über Blob-URL; Import per `FileReader`, Zusammenführen nach ID (neueres `geaendert` gewinnt), Lernstand optional (Häkchen). «Alle Notizen löschen» zweistufig, kein `confirm()`.

**Beim Prüfen gefunden:** Der Klick «Kommentar» in der Blase öffnete den Editor und schloss ihn im selben Ereignis wieder (Dokument-Listener «Klick ausserhalb»); Klicks aus der Blase zählen jetzt nicht als «ausserhalb». Der Zähler im Panel aktualisierte sich nicht, solange das Textfeld den Fokus hat (Panel wird dann bewusst nicht neu gebaut) — der Zähler wird separat gesetzt.

**Geprüft (lokal, Chrome 1568 px und 390-px-iframe, keine Konsolenfehler):** Kapitel Ergebnisse: Auswahl → Blase → Kommentar-Editor → Farbe Grün → Fertig; Markierung überlebt Neuladen; Notizenseite listet sie, Sprunglink führt hin; freie Notiz am Kapitelende; Lexikonkarte mit kompakter Zeile, Deep-Link scrollt weiterhin; Überblick: Auswahl im Lead, Blau — dieselbe Markierung erscheint auf der Lexikonkarte, sobald die Stufe «Handbuch» geladen ist; Import headless geprüft (gleiche Datei: 0 neu, geänderter Eintrag mit jüngerem Datum gewinnt, fremde Datei wird abgewiesen); untere Navigation mit neun Einträgen passt bei 390 px. Die Testnotizen und die Trainer-Quote aus dem Vortag wurden am Ende aus localStorage entfernt. README, Über-Seite, Cache-Marke `?v=2026-09-10a`. Nicht committet.

**Offen / Ideen:** Markierungen in Kernaussagen des Hubs und in Quiz-Belegen (kein `data-nz-ort`); Touch: die Blase erscheint bei Auswahl auf dem Telefon, das native Kontextmenü liegt aber darüber — echtes Gerät prüfen; Suche auf der Notizenseite; Markierungen beim Export als Markdown mit Kapitel-/Seitenangabe.

## 2026-09-09 (12) — Trainer: offene Punkte — Deckel über Beschriftung, Suche im Pool, schmales Layout

**Auftrag:** «continue» — weiter mit den offenen Punkten aus Eintrag (11).

**Schmales Layout geprüft — und dafür ein Weg gefunden:** Das Chrome-Fenster lässt sich hier nicht unter ~1470 px verkleinern, aber eine Hilfsseite mit `<iframe width=390>` auf die lokale App (eigener Server auf Port 8081, Datei im Scratchpad) zeigt das Telefon-Layout samt Media-Queries und unterer Navigation. Befund: das Gerüst stapelt korrekt (Kopf, Bühne, Seite), aber «Passend» skalierte eine Phasenzeile auf ein Drittel — Arial 9 bei 3 px, unlesbar. Jetzt gilt unter 900 px ein Mindestmass von 0,8 für den Grundmassstab (`LESBAR`), die Bühne scrollt seitlich; dazu ist die Bühne dort auf 58 vh begrenzt, damit der Weg Chip → Kasten kürzer bleibt.

**Beim Prüfen gefunden:** Unter dem Kasten «Integrations- und Installationsanleitung» (IT-System, Realisierung) lugte «anleitung» hervor — auch im breiten Layout. Der Office-Export setzt die vierte Zeile mit der Grundlinie unter den Kastenrand (`abbildung.js` lässt bis 6 Einheiten Toleranz zu), der Deckel deckte nur das Rechteck. Der Deckel reicht jetzt von der obersten Grundlinie − 7,5 bis zur untersten + 2,5, mindestens aber über den Kasten; dafür rechnet `inWurzelkoordinaten` auch die Textfragmente um (vorher nur x/y/w/h).

**Suche im Pool:** Ab zwölf Chips (`SUCHE_AB`) steht ein Suchfeld über dem Pool — dasselbe `.suche__feld` wie im Lexikon, Zähler «n von m Chips», umlaut- und diakritikatolerant («losung» trifft «Lösungsarchitektur»), Esc und ✕ leeren, Zurücksetzen/Nochmals leert mit. Das native ✕ des `type=search` stand doppelt neben unserem — global für `.suche__feld` ausgeblendet (betrifft auch das Lexikon).

**Beim Prüfen gefunden (2), Altlast aus Eintrag 11:** «Nochmals» und «Zurücksetzen» leerten Pool und Zähler, die Bühne behielt aber Auswertung und Etiketten — `zuruecksetzen()` rief `uebungStarten()` auf und bekam neue Zielobjekte ohne die Verweise auf die SVG-Elemente (`gruppe`, `etikett`, `titel`), die `zeichnen()` dann übersprang. Jetzt werden die bestehenden Ziele und Chips zurückgestellt statt neu gebaut.

**Geprüft (lokal, Chrome 1568 px und im 390/760-px-iframe, keine Konsolenfehler):** Deckel über «…anleitung» passgenau; Suchfeld erscheint bei 12 Chips, «losung» → 2 von 12, «system» → 3 von 12, natives ✕ weg; mit Filter Chip antippen → Kasten → Prüfen: 1 von 12 richtig, Auswertung und Etiketten stimmen; schmal: Konzept in lesbarer Grösse mit Seitenscroll, Hub, IT-System bei 760 px einspaltig, untere Navigation frei. **Nicht geprüft:** der Reset nach dem Fix an `zuruecksetzen()` — die Chrome-Erweiterung verlor danach dreimal die Verbindung (die Logik ist überschaubar: `zeichnen()` setzt Klasse und Etikett jedes Ziels aus dem Zustand). Hinweis: im Browser des Sponsors steht durch den Test «Beste 1/12» beim Modul IT-System in localStorage (`trainer`). README nachgeführt, Cache-Marke `?v=2026-09-09m`. Nicht committet.

**Offen / Ideen (unverändert):** Modulköpfe und Phasenbalken wahlweise leeren; Übung «Rollen»; Wiki-Projektseite in HQ ist geändert, aber nicht committet.

## 2026-09-09 (11) — Neue Ansicht «Trainer»: Ausschnitte der Abbildung zum Zuordnen

**Auftrag:** Auf Basis des Überblicks eine Reihe von Seiten als Ausschnitt aus der Gesamtmethode (Phasen wie Initialisierung, Konzept; jedes Modul). Je Seite die Elemente der Übersicht ohne Inhalt, ein Pool dieser Elemente zum Hineinziehen und Zuordnen; am Ende die Lösung mit richtig/falsch.

**Gemeinsame Grundlage ausgelagert:** `js/abbildung.js` (`HT.abbildung.holen/lesen/masse/kaesten`) trägt jetzt, was der Überblick an der Grafik macht — Laden, Farben, Kastenerkennung aus den `transform`-Matrizen, Beschriftung aus den Textfragmenten, Zuordnung zum Lexikon samt der Tabelle abweichender Beschriftungen. `js/ueberblick.js` nutzt es (Verhalten unverändert, im Browser geprüft). Der Rad-Zoom mit Zieh-Verschiebung aus der Vormittagssitzung liegt als `HT.ui.radZoomAnbinden` in `js/ui.js`.

**Trainer (`js/trainer.js`, `css/trainer.css`, Route `#/trainer` zwischen Überblick und Methode):**
- Übungen werden zur Laufzeit aus der Geometrie der Grafik abgeleitet, nichts ist hart codiert: Phasenbalken → Zeilen (5 klassische Phasen, Umsetzung als grösste zuletzt), Modulköpfe → Spalten (gleichnamige Köpfe vereint — Projektsteuerung/Projektführung steht zweimal; eine Spalte reicht bis zum nächsten anderen Kopf darunter, darum umfasst Projektgrundlagen nur die Initialisierung), dazu das Gesamtbild. 18 Übungen; Zählprobe stimmig: Phasen 8+27+29+11+5 = Module 16+4+10+7+12+3+6+5+5+7+5 = Gesamtbild 80 Kästen.
- Ein Ausschnitt ist ein Raster aus Fenstern: je Zeile × Spalte ein verschachteltes `<svg>` mit eigenem `viewBox` auf eine gemeinsame Kopie der Grafik (`<defs>` + `<use>`); so stehen Phasenbalken und Modulspalte nebeneinander, obwohl sie in der Grafik weit auseinander liegen, und über einer Phasenzeile bleibt die Kopfzeile der Module (nur wenn sie nicht ohnehin in der Zeile liegt — bei Konzept liegt sie drin). Gepunktete Linien markieren die Schnittkanten. Die Kästen werden dafür einmal in Wurzelkoordinaten umgerechnet — die erste Gruppe der Grafik trägt `translate(-7 -6)`, was im Überblick nie auffiel, weil die Trefferschicht dort in dieser Gruppe liegt.
- Je Ergebniskasten: Deckel in der Originalfüllung (weiss bei Zuständen), `<foreignObject>` mit dem Etikett in Arial 9 und den Umbrüchen des Drucks (Textfragmente zeilenweise gefügt, Bindestrich am Zeilenende bleibt Umbruchstelle), Trefferfläche mit `title`/`aria-label` und Tastatur (Tab, Enter/Leertaste).
- Pool: Chips alphabetisch (Lexikonnamen, gleichnamige Kästen haben je einen Chip; Prüfung über die Eintrags-ID, darum passt jeder in jeden gleichnamigen Kasten). Ziehen mit Maus/Stift (Dokument-Listener, Geist am Zeiger, Ziel unter dem Zeiger hervorgehoben, Klick nach dem Zug wird geschluckt; ein Zug ohne Zwischenbewegung zählt über den Weg bis zum Loslassen), auf Touch nur Antippen (Chip, dann Kasten — ein Zug stritte mit dem Scrollen des Pools). Klick auf belegten Kasten legt zurück, Chip auf belegten Kasten tauscht.
- Prüfen: grün/rot/grau gestrichelt, richtiger Name in jedem Kasten, daneben «Falsch gelegt» (durchgestrichen → richtig, verlinkt) und «Offen geblieben»; beste Quote je Übung in localStorage (`trainer`), auf den Karten der Übersicht mit Haken bei voller Punktzahl. Knöpfe Prüfen/Zurücksetzen bzw. Nochmals, dazu «Nächste: …». Zoom −/+/Passend (Passend berücksichtigt Breite und Fensterhöhe — Modulspalten sind hoch), Rad um den Zeiger, Ziehen verschiebt.

**Geprüft (lokal, Chrome 1552 px, keine Konsolenfehler):** Übersicht mit 18 Karten; Konzept (Kopfzeile ohne Initialisierungsköpfe, Deckel passgenau), IT-System (Phasenbalken + Spalte), Gesamtbild; Antippen-Zuordnung, Prüfen mit einem richtigen und einem falschen Chip (Auswertung, Farben, Listen); Überblick nach der Auslagerung unverändert (Klick auf Projektmanagementplan, Siegel + Download). Ziehen nur mit synthetischen Pointer-Ereignissen verifiziert — die `left_click_drag`-Aktion der Chrome-Automatisierung lässt die Maustaste nicht los (kein `pointerup`), echte Mausbedienung nicht simulierbar. Bekannt: der erste Klick nach `navigate` geht verloren (wie im Überblick).

**Sonst:** README (Absatz Trainer, Technik-Absatz zu `abbildung.js`/Fenster-Raster), Über-Seite, Cache-Marke `?v=2026-09-09l`. Nicht committet.

**Offen / Ideen:** Modulköpfe und Phasenbalken wahlweise ebenfalls leeren (dann kämen sie in den Pool); Übung «Rollen» (wer verantwortet welches Ergebnis) im selben Muster; schmales Layout nicht geprüft; Chips auf Touch-Geräten sehr lang bei 80 Kästen — eventuell Suche im Pool.

## 2026-09-09 (10) — Überblick: Kopfzeile mit Zeichen statt Text, Rad-Zoom auf Bühne und Beziehungsbild

**Auftrag:** (1) Der Link auf die Dokumentvorlage stand als eigener Handbuchabschnitt im Text der Inhaltsseite — ganz nach oben, nur als Download-Icon. (2) Die Wortmarke «Minimal gefordert» oben ebenfalls als Icon. (3) Zoomen mit dem Mausrad im Beziehungsfenster unten und in der Übersicht links.

**Kopfzeile (`js/ueberblick.js`, `inhaltZeichnen`):** Rechts in der Kicker-Zeile ein Block `ub-kopf__zeichen`: Siegel (roter Kreis mit Haken) für «Minimal gefordert» bzw. «Zwingend in jedem Projekt» (Module), daneben ein Download-Icon, das den ersten `download`-Block aus dem Handbuchtext trägt (`href`, `download`, Tooltip mit Dateiname und Grösse). Der Wortlaut steht jeweils in `title` und `aria-label`. Im Text werden `download`-Blöcke übersprungen; der Abschnitt «Dokumentenvorlage» entfällt damit ganz (er bestand nur aus dem Link). Die Überschreibungen für `.hb-vorlage` auf dieser Route sind aus `css/ueberblick.css` raus. `HT.ui.downloadElement` bleibt für Lexikon/Methode.

**Rad-Zoom (`radZoomAnbinden`):** Eine Hilfe für beide scrollenden Flächen: das Rad zoomt um den Zeiger (Massstab ändern, dann so scrollen, dass der Punkt unter dem Zeiger bleibt — dieselbe Faktorformel wie im grossen Graph); weil das Rad damit nicht mehr scrollt, verschiebt Ziehen mit gedrückter Maustaste die Fläche (Schwelle 8 px, Pointer Capture, Klick danach wird in der Capture-Phase geschluckt, Touch bleibt nativ). Bühne: über `zoomSetzen`, die Knöpfe unten rechts zeigen den Wert mit. Beziehungsbild: Breite des `svg.ub-gb` zwischen 0,4- und 3-facher Zeichnungsbreite (`data-breite`), ab dem ersten Zoom ohne die CSS-Grenze «höchstens Spaltenbreite»; der Zoom überlebt das Nachzeichnen, wenn der Handbuchtext eintrifft. Wenn die Fläche nicht selbst scrollt (schmales Layout, Druck), greift nichts — sonst stünde das Rad für die Seite still.

**Geprüft (lokal, Chrome 1552 px):** Projektmanagementplan (Siegel + Download, Text nur noch «Inhalt»), Phasenbericht, Modul Projektsteuerung (Siegel «Zwingend»), Zustand Organisation aktiviert (keine Zeichen). Rad: Bühne 95 → 149 % mit Scroll-Ausgleich, Beziehungsbild 493 → 558 px; Ziehen verschiebt beide Flächen, Klick auf ein Feld danach wählt weiterhin aus. Keine Konsolenfehler. Cache-Marke `?v=2026-09-09k`. Hinweis für künftige Tests: die `scroll`-Aktion der Chrome-Automatisierung löst keine `wheel`-Ereignisse aus — Rad-Handler per `dispatchEvent(new WheelEvent(…))` prüfen.

**Nicht gemacht:** nicht committet (kein Auftrag). Schmales Layout nicht geprüft (Fenster lässt sich hier nicht verkleinern).

## 2026-09-09 (9) — Überblick: Phasen und Module als Filterchips

**Auftrag:** «Im Filter fehlt noch etwas Wichtiges: ich muss in der Lage sein, schnell und intuitiv Phasen und Module an-/abzuwählen für meine Ansicht.» Vorher: «Wenn ein Filter aktiv ist, sollten Elemente, die nicht im Filter enthalten sind, ausgegraut, aber sichtbar sein.»

**Umsetzung:** Die Steuerung des Überblicks hat nach dem Modus einen Block «Filter»: Phasen (Reihenfolge der Vorgehensweise) und Module (Reihenfolge der Methode) als Chips zum An- und Abwählen, darunter das Szenario, oben rechts «Zurücksetzen», sobald etwas gewählt ist. Leer heisst alle. `imAuswahl(feld)`: ein Ergebniskasten bleibt kräftig, wenn eines seiner Elemente in einer gewählten Phase *und* einem gewählten Modul liegt; Modulköpfe und Phasenbalken zählen über ihren Namen. Alles andere blasst wie bisher ab (weisse Fläche 70 %), bleibt sichtbar und klickbar. Ein aktiver Filter (Phasen, Module oder Szenario) färbt das Steuerungs-Icon in Akzent. Das Panel scrollt, wenn es höher als der Viewport wird. Nicht gespeichert, wie Rolle und Szenario. Geprüft mit Konzept + IT-System, ohne Konsolenfehler. `?v=` auf 2026-09-09j.

## 2026-09-09 (8) — Überblick: Szenario-Filter in der Steuerung

**Auftrag:** «Haben wir den Filter auf der Übersicht links schon eingebaut? Wir müssten für den Filter auch noch Szenarien ergänzen.» — Der Überblick hatte keinen Filter, nur «Rolle einfärben» und «nur minimal gefordert»; der Graph hat die Szenario-Auswahl bereits in der Leiste.

**Umsetzung:** In der Steuerung des Überblicks steht neu als erster Block nach dem Modus ein Szenario-Select (`zustand.szenario`, nicht gespeichert). Gewählt blasst `malen()` alles ab, was nicht zu den Modulen des Szenarios gehört — Modulköpfe über ihren Namen, Ergebniskästen über ihr Feld `module` (ein Feld zählt, wenn eines seiner Elemente passt), Phasenbalken bleiben als Orientierung. Das Abblenden nutzt denselben Weg wie «nur minimal gefordert» (weisse Fläche, 70 %). Geprüft mit «Organisationsanpassung», ohne Konsolenfehler. Dabei fiel auf, dass Projektgrundlagen mit abblasste: Die Szenarioseiten der Quelle führen es nicht in ihrer Modulliste, nach Kap. 3.2.1 ist es aber in jedem Projekt zwingend. `HT.graph.szenarioModule()` ergänzt jedes Szenario jetzt um die vier zwingenden Module — das wirkt im Überblick und in der Szenario-Auswahl des Graphen gleichermassen. Der Überblick nutzt dieselbe Funktion. `?v=` auf 2026-09-09i.

## 2026-09-09 (7) — Markenzeichen: Meilenstein-Raute statt rotem H

**Auftrag:** «Ja, bau die Raute ein.» — Ein einzelnes H auf Rot lag zu nah an der Kernmarke des Modehauses Hermès. Das neue Zeichen kommt aus der Methode selbst: die Raute des Meilensteins (Quality Gate), wie sie der Graph als Knotenform nutzt.

**Umsetzung:** Kopfzeile (`.marke__logo`) zeigt ein Inline-SVG — Raute in Akzentrot mit ausgesparter Innenraute, ohne Kasten dahinter; das Favicon in `index.html` ist dieselbe Raute als Daten-URI. Kein Buchstabe, kein Fremdmotiv. `?v=` auf 2026-09-09g.

## 2026-09-09 (6) — Strukturlinien dünn und hellgrau

**Auftrag:** «Die dicken schwarzen Linien sind etwas unschön, können wir die dünn und hellgrau machen?» Dazu die Frage nach einem Logo anstelle des roten H, das keine Markenrechte verletzt (Vorschläge im Chat, noch nicht umgesetzt).

**Umsetzung:** Das Token `--linie-stark` (Kopfzeile unten, Markenzelle rechts, Abschnitts- und Tabellenlinien, Kapitelüberschriften der Feldseite, Fussbereich) war `#201e1d` und stand überall als `2px solid`. Neu `#cfcbcb` und an allen elf Stellen `1px`. Die Kantenlegende im Graph (`--gkante-stark`) bleibt — sie ist ein Muster, keine Seitenlinie. Geprüft: Methode und Lexikon. `?v=` auf 2026-09-09f.

## 2026-09-09 (5) — Überblick ohne Steckbrief, volle Textbreite, Expand-Icon; Graph mit Fokus-Filter

**Auftrag:** Steckbrief bei Modulen und Phasen entfernen (bei Ergebnissen schon weg); der Text rechts brach auch bei breiter Inhaltsseite um; «Im vollen Graph öffnen» durch ein Expand-Icon ersetzen, das im Graph auf das Element filtert; und im Graph selbst fehlte ein Filter, mit dem man «schnell und simpel die für mich interessanten Elemente» sieht (Phasen, Rollen …).

**Überblick:** Steckbrief samt `faktenVon()` gestrichen — Ergebnistyp und «minimal gefordert» stehen im Kopf, alles andere im Beziehungsbild. Die `max-width: 60ch/64ch` an Kopf, Prosa, Handbuchabsätzen und Beziehungslisten der Inhaltsseite sind weg; der Text folgt jetzt der Breite, die man mit der Trennlinie einstellt. Der Textlink unter dem Bild ist durch ein Expand-Icon rechts in der Kopfzeile «Beziehungen» ersetzt (`refs.graphLink`, Ziel beim Zeichnen gesetzt): Ergebnisse, Aufgaben, Rollen → `#/graph?fokus=id`, Module und Phasen → `#/graph?id=id` (setzen den Umfang wie bisher).

**Graph, Fokus-Filter:** Neuer Zustand `fokusId` (URL `fokus=`, nicht gespeichert). Das Modell (`teilgraph`) filtert Aufgaben, Ergebnisse und Rollen auf `HT.graph.fokusMenge(id)` — dieselbe Nachbarschaft wie im Beziehungsbild des Überblicks: Rolle → ihre Aufgaben → deren Ergebnisse (plus direkt verantwortete Ergebnisse); Aufgabe → Rollen und Ergebnisse; Ergebnis → erzeugende Aufgaben → deren Rollen. Beim Setzen wird die Phasen-/Modulauswahl geleert (sonst fehlte z. B. bei Situationsanalyse die zweite erzeugende Aufgabe aus dem Modul Organisation), die Vorgehensweise folgt dem Element; Phasen und Module lassen sich danach dazuschalten, der Fokus bleibt. Im Fokus wird nichts abgeblendet (Hervorhebung aus) — alles Gezeigte ist relevant. UI: Filter-Icon in den Werkzeugen mit Popover (Erklärung, aktiver Fokus mit «Aufheben», alle Rollen als Chips, Suchfeld für jedes andere Element — die Trefferliste ist mit der Suche geteilt, `trefferZeichnen(feld, liste, beiWahl)`), ein Fokus-Chip in der Leiste mit ×, «Zurücksetzen» hebt auch den Fokus auf, im Detailfeld ist «Nur dieses Element» der primäre Knopf und «Nur Modul …» rückt daneben.

**Geprüft im Browser:** Überblick Modul Projektgrundlagen (kein Steckbrief, Text volle Breite), Situationsanalyse → Expand-Icon → Graph mit 2 Aufgaben und 3 Rollen; Filter-Popover, Rolle Projektleiter (44 Aufgaben, 73 Ergebnisse über alle Phasen), Fokus per × aufgehoben — ohne Konsolenfehler. `?v=` auf 2026-09-09e.

## 2026-09-09 (4) — Überblick: Phasen bekommen dasselbe Beziehungsbild; Aufgaben gruppiert wie im Graph

**Auftrag:** «Ja, mach das gleiche Bild auch für Phasen.»

**Umsetzung:** `graphBildModul()` ist zu `graphBildMenge(e, gehoertDazu, gruppen, gruppeFeld)` verallgemeinert; Modul und Phase rufen es mit ihrem Zugehörigkeitsfeld auf (`module` bzw. `phasen`). Phasen zeigten vorher gar keine Beziehungen (keine Graphknoten). Dabei fiel auf, dass `reihenfolge` die Dateiposition ist und `data/aufgaben.json` alphabetisch liegt — die «Reihenfolge der Methode» gab es so nicht. Die Aufgaben stehen jetzt wie im grossen Graph gruppiert: im Modulbild nach Phasen (Reihenfolge der Vorgehensweise, `HT.daten.phasenSortiert`), im Phasenbild nach Modulen (Reihenfolge der Methode), innerhalb der Gruppe alphabetisch. Rollen und Ergebnisse weiterhin nach Schwerpunkt ihrer Aufgaben. Eine Phase wie Konzept bringt 33 Aufgaben und alle Rollen — das Bild ist dicht, die Hervorhebung beim Zeigen trägt es.

**Geprüft im Browser:** Phase «Konzept» (Projektsteuerung zuerst, dann Projektführung …), Modul «IT-Betrieb», Ergebnisbild unverändert, ohne Konsolenfehler. `?v=` auf 2026-09-09d.

## 2026-09-09 (3) — Überblick: Module bekommen dasselbe Beziehungsbild wie Ergebnisse

**Auftrag:** «Wenn ich auf ein Modul klicke, sehe ich rechts unten in der Graphsicht etwas anderes als bei den Ergebnissen. Können wir nicht einfach das gleiche darstellen (alle Elemente und deren Beziehungen)?»

**Umsetzung:** Module zeigten im unteren Bereich zwei Listen («umfasst die Aufgaben», «erzeugt die Ergebnisse»), weil Module keine Graphknoten sind. Neu zeichnet `graphBildModul()` dasselbe Bild wie bei Ergebnissen, nur in drei Spalten wie im grossen Graph: links die Rollen, in der Mitte alle Aufgaben des Moduls in der Reihenfolge der Methode, rechts die Ergebnisse (die des Moduls plus alles, was seine Aufgaben erzeugen). Kanten genau die des Graphmodells: verantwortlich/beteiligt als S-Kurve Rolle → Aufgabe, erzeugt als S-Kurve mit Pfeil Aufgabe → Ergebnis, Rolle verantwortet Ergebnis gepunktet. Rollen und Ergebnisse stehen nach dem Schwerpunkt (mittlere Zeile) ihrer Aufgaben, damit die Kurven flach bleiben; alle Spalten beginnen oben. Das Zeichnen (Kanten, verlinkte Knoten, Hervorhebung beim Zeigen, «Im vollen Graph öffnen») ist in `bildRendern()` ausgelagert, das Ergebnisbild nutzt es mit der rechten Schiene für «erzeugt», das Modulbild ohne. Das Modulbild ist breiter als die Inhaltsseite und scrollt seitwärts (`.ub-gb--breit`, kein `max-width`), statt mit der Schrift zu schrumpfen — die Trennlinie verbreitert die Seite. Die Listen bleiben als Rückfall ohne Graphmodell.

**Geprüft im Browser:** Modul «Organisation» — drei Spalten mit allen Kanten, verbreiterte Inhaltsseite zeigt das ganze Bild, ohne Konsolenfehler. `?v=` auf 2026-09-09c.

## 2026-09-09 (2) — Überblick: nur noch Icons auf der Bühne

**Auftrag:** «Die Legende auf der linken Seite unten, können wir die als kleines Icon ergänzen, damit man sie ein- und ausblenden kann? Und das "Erkunden und Abfragen" oben würde ich entfernen. Die Boxen rechts mit "breit" und "Steuerung" auch. Die Steuerungselemente sollten wir als kleines Icon in der Übersicht haben.»

**Bühne:** Die Modus-Tabs oben links und die Gruppe «Breit / Steuerung» oben rechts sind weg. Oben rechts bleibt ein Schieberegler-Icon, das die Steuerung öffnet; unten links kommt ein Info-Icon, das die Legende «Zeichen der Abbildung» als kleine Karte über dem Icon ein- und ausblendet (Zustand gespeichert, Standard: zu). Beide Icons sind dieselben wie in der Leiste des Graphen (`HT.ui.symbol`, Pfade aus `js/graph.js` übernommen). Der Zoom bleibt unten rechts. Die Legendenzeile unter der Abbildung entfällt, die Bühne gewinnt ihre Höhe; oben braucht sie keinen Abstand mehr (16 statt 56 px), weil dort nur das Icon rechts steht, wo die Grafik leer ist.

**Steuerung:** Der Modus (Erkunden / Abfragen) steht jetzt als Segment als erster Block im Panel, mit einem Satz Erklärung; «Inhaltsseite einklappen» (vorher «Breit») ist ein Häkchen unter «Darstellung» — in beiden Modi. Gestapelt unter 700 px ist diese Zeile ausgeblendet, wie vorher der Knopf. Der Fokus beim Öffnen liegt auf dem aktiven Modus-Knopf. Im Druck erscheint die Legende wieder als Zeile.

**Geprüft im Browser:** Icons an Ort, Legende auf/zu, Panel in beiden Modi, Wechsel nach Abfragen (Aufgabenzeile erscheint, Panel schliesst) und zurück — ohne Konsolenfehler. `?v=` auf 2026-09-09b.

## 2026-09-09 — Nur noch Originaldokumentation: Prüfungshinweis und Abgrenzung entfernt

**Auftrag:** Frage, ob die Abschnitte «Prüfungshinweis» und «Abgrenzung» aus der HERMES-Dokumentation stammen — sie stammten von uns (kuratierte Zugaben der ersten Session, in SCHEMA.md so definiert). Entscheid des Sponsors: komplett entfernen und vorerst nur Inhalte aus der Originaldokumentation nutzen.

**Entfernt:** die Felder `abgrenzung` und `pruefungshinweis` aus allen sieben Elementdateien in `data/` (zeilenweise, Formatierung unverändert, Ergebnis gegen ein Round-Trip ohne die Felder geprüft); ihre Darstellung in Lexikonkarte (Stufe Kernpunkte und Handbuch), Überblick, Lernkarten-Rückseite und Graph-Detailfeld; im Quiz die Erklärung generierter Fragen fällt auf die Definition bzw. den reinen Sachverhalt zurück; das Suchfeld indexiert sie nicht mehr; SCHEMA.md, README und die Über-Seite nachgeführt (Stufe Kernpunkte = «Definition und Querverweise»); zwei verwaiste CSS-Regeln (`.detail__block--hinweis`, `.ub-abschnitt--hinweis`) gestrichen. `DATEN_VERSION` und `?v=` auf 2026-09-09a.

**Nicht angefasst, weiterhin eigene Zusammenfassungen:** die Kurzfassungen (`kurz`), der `details`-Rückfalltext, die Kernaussagen der Methode-Kapitel und die kuratierten Quizfragen. Die Über-Seite nennt sie weiterhin als eigene, am Wortlaut geprüfte Texte.

**Geprüft im Browser:** Lexikon (Kernpunkte), Überblick mit Ergebniskasten, Lernkarten-Rückseite, Quiz mit generierter Frage — ohne Konsolenfehler.

## 2026-09-08 (5) — Ein Erscheinungsbild für die ganze Anwendung; Bedienung des Überblicks auf der Bühne

**Auftrag:** «Put the percentage zoom in and out icons into the overview itself and delete that navigation on the left. On the top nav in Übersicht, the items should be centered. Also, align the remaining page to this look and feel.»

**Überblick:** Die Werkzeugleiste über der Abbildung ist weg. Ihre Knöpfe liegen als drei schwebende Gruppen auf der weissen Bühne — Modus (Erkunden/Abfragen) oben links, Breit und Steuerung oben rechts, Zoom (−, Prozent, +, Passend) unten rechts wie auf einer Karte. Gruppen stehen auf dem Grundton mit Haarlinie, flach; die Steuerung bleibt die einzige erhobene Fläche und hängt jetzt unter der rechten Gruppe. Die Bühne bekommt oben und unten 56 px Platz, damit die Gruppen die Ränder der Abbildung in der Ausgangslage nicht verdecken (`js/ueberblick.js` `schweberBauen()`, `.ub-buehne-huelle` trägt Gruppen und Steuerung, die Bühne darin scrollt — läge das Schwebende in der Bühne, scrollte es mit). Unter 700 px rückt die Steuerung unter den Modus; «Breit» gibt es gestapelt nicht, es gäbe keine Spalte einzuklappen.

**Kopfzeile global:** Markenzelle links mit starker Linie, Hauptnavigation mittig (`.nav-top { flex: 1; justify-content: center }`), starke Linie unten — auf allen Routen, nicht nur im Überblick. Die `body[data-route="ueberblick"]`-Überschreibungen der Kopfzeile sind gestrichen.

**Tokens:** `css/style.css` trägt jetzt die Modernist-Palette als globale Tokens unter den alten Namen (`--akzent` = `#ec3013`, `--bg` = `#f3f2f2`, `--rand` = `#d7d3d3`, `--radius` = 0, `--schatten` = none, Archivo als `--schrift`), dazu `--ub-*` als Aliasse, damit `css/ueberblick.css` unverändert weiterläuft. Dark Mode ist in allen Stylesheets entfernt (Entscheid aus dem Design-Handoff: nur hell; die Originalabbildung ist Druckgrafik). Kategorie-Marken (`--kat-*`) sind neutral grau; die Knoten- und Kantenfarben des Graphen (`--gk-*`, `--gkante-*`) bleiben als validierte Datenkodierung unverändert. `index.html`: `color-scheme: light`, Favicon rot.

**Übrige Ansichten (zwei parallele Agenten, nur CSS, kein JS berührt):** `css/style.css` ab «Layout» und `css/feld.css` — Methode (Phasenmodell als Blöcke zwischen Linien statt blauer Karten, Kapitel als Zeilen), Lexikon (Einträge als Abschnitte zwischen Haarlinien, Stufen als Texttabs, Filter als Textknopfzeile mit Haarstrichen), Lernkarten (Karte mit 1-px-Rahmen, Balken 4 px), Quiz (Optionen mit Rahmen, einziger gefüllter Knopf «Quiz starten», Rückmeldung flach mit Tönung), Über, Feld (Typmarken weiss auf Tinte, «minimal gefordert» auf Akzent). `css/graph.css` — Leiste mit flachen Grossbuchstaben-Tabs, Haarstriche als Trenner, Leinwand weiss ohne Raster, Popover mit Rand und Schatten, Detailfeld mit Linien und Mikro-Beschriftungen. `--maxbreite` von 62 auf 66 rem, damit die acht Kategorien samt Zähler in eine Zeile passen (vorher hing «Grundbegriffe» allein darunter). Untere Navigation ohne Grossbuchstaben — bei 380 px wurden «Überblick» und «Methode» sonst abgeschnitten.

**Geprüft (lokal, ohne Konsolenfehler):** Überblick (Steuerung, Abfragen, Breit, 380-px-iframe), Graph, Methode-Hub und Kapitel Phasen, Lexikon (Kurz/Kernpunkte/Handbuch), Lernkarten, Quiz (Start, Frage, Rückmeldung), Über, Feld Konzept × IT-System; 375-px-iframes der Hauptrouten ohne Seitwärtsscroll. Versionsmarke `?v=2026-09-08o`.

**Nachgefasst — zugeklappter Graph liess sich nicht mehr aufklappen** («when I minimize the graph view on the right, I cannot find the button to maximize it again»): Zugeklappt bekam der Ziehstreifen `display:none` und fiel damit aus der Rasterplatzierung; die Kopfzeile «Beziehungen» rutschte in die 0-px-Zeile des Griffs (gemessen `607px 0 0 0` statt `607px 0 35px 0`) und ihr Knopf lag unsichtbar unter dem Rand. Jetzt `visibility:hidden` — der Griff bleibt Rasterelement, die Kopfzeile steht unten und klappt wieder auf. Geprüft in beide Richtungen.

**Beziehungsbild als Kette Rolle → Aufgabe → Ergebnis, gezeichnet wie der grosse Graph.** Frage des Sponsors: «Is it an Aufgabe that leads to an Ergebnis and the Role is connected to the Aufgabe?» — im Graphmodell ja: Rolle –verantwortlich/beteiligt→ Aufgabe –erzeugt→ Ergebnis, dazu «Rolle verantwortet das Ergebnis» als eigene Kante. Das bisherige Bild hängte die Rollen direkt ans Ergebnis (aus `verantwortlich`/`beteiligt` des Ergebnisses) und zeigte damit etwas anderes als der Graph. Jetzt zeichnet `graphBild()` genau die Kanten des Modells: zwei Spalten wie im Graph — links die Rollen, rechts die Aufgaben, S-Kurven dazwischen (durchgezogen verantwortlich, gestrichelt beteiligt) —, darunter in der Aufgabenspalte das Ergebnis, zu dem «erzeugt» über eine rechte Schiene mit Pfeil führt; gepunktet die direkte Verantwortung fürs Ergebnis. Rollen mittig zur Aufgabenspalte, damit die Kurven flach bleiben. Ein erster Versuch mit drei Stufen untereinander und einer linken Sammelschiene bündelte alle Rolle→Aufgabe-Kanten zu einem Strang — unlesbar, verworfen.

**Knoten aus einer Quelle:** `js/graph-zeichnen.js` exportiert jetzt `schriftLesen`, `knotenBreite` und `knotenElement`; das Beziehungsbild baut damit dieselben Knoten (Form, Glyph, Farbe, Typzeichen) und nutzt dieselben Kantenklassen (`.gkante--…`, `.gpfeil`) aus `css/graph.css`. Die eigenen Knotenregeln in `css/ueberblick.css` sind weg. Das SVG bekommt seine natürliche Breite in Pixeln (`viewBox` + `style.width`) und `max-width:100%`: bei 420 px Spalte wird ein Bild mit 530 px auf zwei Drittel verkleinert, beim Verbreitern der Spalte wächst es bis 1:1. Ein Ergebnis mit `beteiligt`-Rollen, die an keiner erzeugenden Aufgabe hängen, zeigt diese nicht mehr — das Modell kennt die Kante nicht, und der grosse Graph auch nicht.

**Rollen ohne Kasten** (in beiden Graphen): `.gk--rolle .gk__form` ist transparent ohne Kontur — Glyph und Name genügen, und Rollen heben sich damit deutlicher von Aufgaben (Parallelogramm) und Ergebnissen (Dokument) ab. Die Form bleibt als Trefffläche; Hover unterstreicht den Namen, Auswahl und Fokus markieren den Glyph.

**Sonst:** Titel der Inhaltsseite mit `hyphens:auto` («Projektmanagement-plan» statt «Projektmanagementpla|n» bei 420 px). Geprüft: Projektmanagementplan (5 Rollen × 9 Aufgaben), Studie (7 Rollen, 2 Aufgaben, Projektleiter verantwortet direkt), grosser Graph mit kastenlosen Rollen; keine Konsolenfehler. Versionsmarke `?v=2026-09-08p`.

**Nachgefasst:** Erklärtext über dem Beziehungsbild entfernt («not needed»). Hervorhebung beim Zeigen wie im grossen Graph («we had highlighted the relationships on mouse over — can we restore that?»): Zeigen oder Fokus auf einen Knoten lässt ihn samt Nachbarn und Kanten stehen und dimmt den Rest (`hervorheben()` in `graphBild()`, Regeln `.ub-gb.ist-hervorhebung` spiegeln die von `.graph-svg`). Im grossen Graph war die Hervorhebung nie weg — geprüft. Versionsmarke `?v=2026-09-08q`.

**Veröffentlicht:** Commit `f64b53c` auf `main` gepusht; GitHub Pages nach rund einer Minute aktualisiert (verifiziert: `index.html` mit Marke `?v=2026-09-08q`, neue `css/ueberblick.css` live).

**Offen / nicht gemacht:** Quiz-Endbilanz (`.statistik`, `.abschluss`) ist gestylt, aber nicht durchgespielt. Bei Fensterbreiten zwischen 700 und ~1000 px umbricht die Kategoriezeile weiterhin mit einem führenden Haarstrich — kosmetisch. README nachgeführt (Design gilt für die ganze Anwendung, Bedienelemente auf der Bühne).

## 2026-09-08 (4) — Inhaltsseite des Überblicks nach dem Aufbau der Quellseite

**Auftrag:** «Die Details zu den Ergebnisse sollten exakt auflisten, was auf der HERMES Seite steht. Beschreibung, Inhalt und Link auf die Dokumentenvorlage. Die Beziehungen sollten wir darstellen auf Basis unserer Graphdaten und nicht wie dort als Tabelle. Den Steckbrief am Anfang finde ich aber gut.»

**Der Vorlagenverweis fehlte im Import.** Die Quellseiten haben einen Abschnitt «Dokumentenvorlage» mit einem Download (`<a class="download-item">`, Titel, Dateiname, Grösse). Der Importer hat ihn stillschweigend verschluckt: `inline_text()` überspringt verschachtelte Blockelemente, und der Titel steckt in einem `<div>` innerhalb des `<a>` — übrig blieb ein leerer Listenpunkt und damit ein Abschnitt ohne Blöcke. Neu erzeugt `handbuch-import.py` dafür einen Block `{ t: "download", titel, datei, groesse, url }`; `HT.ui.bloecke` rendert ihn. 71 Ergebnisse haben eine Vorlage — genau die 71, bei denen der Abschnitt existiert.

**Erneuter Import ohne PDF:** `rhb.txt` war nicht mehr da, und ohne `--pdf-text` hätte ein Lauf alle Kapitelnummern und Seitenzahlen verloren. Darum nimmt `toc_lesen` jetzt ersatzweise das zuletzt gesicherte `data/handbuch/inhaltsverzeichnis.json` (417 Einträge). Der volle Lauf über 220 Seiten änderte danach **nur** `elemente-ergebnis.json` und nur um die 71 Download-Blöcke — alle anderen Dateien byteweise gleich. Das ist zugleich die Gegenprobe, dass sich hermes.admin.ch seit dem letzten Import nicht verändert hat.

**Die Inhaltsseite folgt jetzt der Quellseite:** Kopf mit der vollständigen «Beschreibung» (alle Absätze, nicht nur der erste), Steckbrief, dann die Abschnitte der Quelle in ihrer Reihenfolge — «Inhalt» als echte verschachtelte Liste über alle drei Ebenen, «Dokumentenvorlage» als Verweis mit Dateiname und Grösse —, danach «Beziehungen», dann die kuratierten Zugaben Prüfungshinweis und Abgrenzung. Der kuratierte `details`-Text erscheint nur noch als Rückfall, wenn kein Handbuchtext geladen werden kann; alles darin steht sonst an seiner richtigen Stelle (Ergebnistyp im Steckbrief, erzeugende Aufgaben in den Beziehungen, Inhaltsliste im Abschnitt «Inhalt»).

**Beziehungen aus dem Graphmodell statt als Tabelle:** Für Ergebnisse liefert `HT.graph.nachbarn()` die erzeugenden Aufgaben («entsteht in»), je Zeile verlinkt und mit Modul und Verantwortung als Beizeile — derselbe Inhalt wie die fünfspaltige Quelltabelle, aber in 420 px lesbar. Die Relation «verantwortet» wird ausgelassen, sie wiederholte nur den Steckbrief. **Module sind keine Graphknoten** (der Graph kennt nur Rolle → Aufgabe → Ergebnis), ihre Quellseite hat aber dieselbe Tabellenform — beim Modul IT-System 23 Zeilen mit Seitwärtsscroll in der schmalen Spalte. Sie kommen deshalb aus den Daten: zwei Listen «umfasst die Aufgaben» und «erzeugt die Ergebnisse».

**Doppelter Absatz bei den Phasen:** Phasenseiten haben keine Zwischentitel, ihr ganzer Text liegt in einem Abschnitt ohne Titel. Der Lead hätte den ersten Absatz gezeigt und der Abschnitt darunter denselben nochmals. `leadQuelle()` merkt sich deshalb die Blockobjekte, die in den Lead gewandert sind, und filtert sie unten per Identität heraus — nicht per Textvergleich, denn bei Initialisierung und Umsetzung weicht `definition` vom Quellabsatz ab.

**Nachladen ohne Flackern:** Die Inhaltsseite reagiert auf Zeigen, der Handbuchtext kommt aber aus einem Versprechen. `handbuchHolen()` fragt je Eintrag einmal an und zeichnet nur nach, wenn der Eintrag noch derselbe ist; die Kategoriedatei holt `HT.daten` ohnehin nur einmal. Das Nachzeichnen setzt den Scrollstand nicht zurück (`zustand.gezeichnet`).

**Der Vorlagenverweis gilt für die ganze Anwendung.** Zuerst standen seine Regeln in `css/ueberblick.css` und griffen auf `--ub-*` zu — im Lexikon, wo `HT.ui.bloecke` denselben Block rendert, waren diese Variablen nicht definiert und die Ikone unsichtbar (transparenter Grund, weisse Schrift). Die Grundregeln stehen jetzt in `css/style.css` mit den globalen Token, der Überblick überschreibt nur Farbe und Radius. Geprüft in beiden Themen: Lexikon blau mit Radius, Überblick rot ohne.

**Geprüft:** Systemkonzept (Beschreibung zweiabsätzig, Inhalt dreistufig, Vorlage `systemkonzept.dotx · 62.88 KB`, zwei erzeugende Aufgaben), Zustand «System integriert» (weder Inhalt noch Vorlage — hat die Quelle auch nicht), Modul IT-System (zwei Listen statt Tabelle), Phase Konzept (kein doppelter Absatz), Lexikon-Stufe «Handbuch» (Vorlage erscheint dort ebenfalls). 380 px im sichtbaren iframe: Abschnittsfolge korrekt, Vorlagenkarte 344 px, kein Seitwärtsscroll. Keine Konsolenfehler.

**Nachfassen — Steckbrief raus, Graphbild rein:** «Lass uns den Text für Ergebnisse identisch halten zur Quelle und den Steckbrief entfernen. Im unteren Teil auf der rechten Seite, könnten wir aber die Graph-Sicht ergänzen, mit dem Ergebnis im Zentrum und den direkten Verbindungen drumherum.» Der Abschnitt «Beziehungen» ist bei Ergebnissen jetzt ein gezeichneter Graph statt einer Liste: das Ergebnis in der Mitte (Akzentfläche), darüber die Aufgaben, in denen es entsteht, mit ihrem Modul, darunter die Rollen — durchgezogene Kante für «verantwortet», gestrichelte für «beteiligt». Jeder Knoten ist ein Link ins Lexikon, darunter führt ein Verweis in den vollen Graphen.

**Warum senkrecht und nicht radial:** Gemessen hat ein Ergebnis 0 bis 14 direkte Nachbarn (Median 4; Spitzenreiter «Liste Projektentscheide Steuerung» mit 11 Aufgaben, «Projektmanagementplan» mit 9). Ein Kreis um die Mitte wäre bei 420 px Spaltenbreite ab etwa sechs Nachbarn unlesbar. Die Knoten stehen deshalb als volle Zeilen über- und untereinander, die Kanten fächern links aus der Mitte heraus — bei 13 Knoten (Projektmanagementplan) trägt das noch ohne eine einzige Kürzung. Das SVG hat eine feste viewBox von 360 Einheiten und `width:100%`, skaliert also mit der ziehbaren Trennlinie mit; bei 380 px Fensterbreite ist es 344 px breit, ohne Seitwärtsscroll.

**«Beteiligt» ist im Graphmodell keine Kante.** `graph-modell.js` legt für Ergebnisse nur die Verantwortung an (Kommentar dort: «es werden keine Beziehungen ergänzt»). Die beteiligten Rollen stehen aber als Querverweis im Eintrag und in der Beziehungstabelle der Quelle — und mit dem Steckbrief fiele die einzige Stelle weg, an der sie zu sehen sind. Das Bild nimmt sie deshalb aus `e.beteiligt` und zeichnet sie gestrichelt. Das Modell selbst bleibt unangetastet, damit der grosse Graph sich nicht ungefragt verdichtet.

**Kategoriezeichen — es gab sie schon, nur nicht im neuen Bild.** Auf die Frage «können wir die nicht wiederverwenden bzw. einmal definieren für die ganze Seite» war die Antwort: einmal definiert sind sie längst — `HT.ui.KAT_PFADE` in `js/ui.js` (24er-Raster, Kontur: Rolle Person, Aufgabe Zahnrad, Ergebnis Dokument, Meilenstein Raute, Phase Fahne, Modul Baustein-Stapel, Szenario Weg, Grundbegriff Idee). Genutzt von Graph, Lexikon, Methode, Lernkarten, Quiz, Feld und der Legende des Überblicks; nur mein Graphbild zeichnete blosse Kästen. Doppelt lag allerdings die **Einbettung ins SVG**: `graph-zeichnen.js` hatte dafür eine eigene `ikone()` mit Skalierung und Zentrierung. Die steht jetzt als `HT.ui.katGruppe(kategorie, cx, cy, kante, klasse)` neben `katSymbol` — der Graph ruft sie auf, das Graphbild ebenfalls; `rund2()` in `graph-zeichnen.js` wurde damit überflüssig und ist raus. Dabei fiel auf, dass `NS` nur lokal in `symbol()` deklariert war; jetzt steht die Konstante im Modulkopf.

**Steckbrief:** bei Ergebnissen entfernt, bei Modulen und Phasen behalten — die sind keine Graphknoten und verlören sonst ihre Fakten ersatzlos. Ergebnistyp und «minimal gefordert» stehen weiterhin als Kicker und Marke im Kopf, das Modul an jedem Aufgabenknoten. Einzige Angabe, die auf Ergebnisseiten nun fehlt: die **Phasen** — die Abbildung zeigt sie über die Zeile, in der der Kasten steht.

**Inhaltsseite waagrecht geteilt:** «Können wir die rechte Seite in der Mitte teilen, so dass oben der Text ist und unten der Graph. Der Benutzer kann es ein- und ausklappen. Und wenn der rechte Teil grösser gemacht wird, sollte die Textgrösse bei der Beschreibung oben gleich bleiben.» Die Inhaltsseite ist ab 700 px ein Raster aus vier Zeilen — Text, Ziehstreifen, Kopfzeile, Graph — beide Bereiche scrollen für sich. Die Kopfzeile «Beziehungen» ist ein Knopf mit `aria-expanded`, der den unteren Bereich zuklappt; der Ziehstreifen ist das waagrechte Gegenstück zu `.ub-trenner` und lässt sich genauso bedienen (ziehen, Pfeiltasten ±24 px, Doppelklick auf 260 px zurück). Höhe und Klappzustand liegen jetzt in `HT.store` neben Fehlerbilanz und bester Serie — ein zugeklappter Graph soll zugeklappt bleiben. Ohne Beziehungen (Phasen) verschwindet der ganze untere Bereich samt Kopfzeile (`data-graph="leer"`); unter 700 px entfällt nur der Ziehstreifen, geklappt wird weiterhin.

**Schriftgrösse bleibt:** Das Graphbild hatte `width:100%` und wuchs mit der Spalte — die Schrift im Bild also mit. Jetzt steht `width:360px; max-width:100%`: schmaler wird verkleinert, breiter nicht. Gemessen beim Verbreitern der Spalte von 420 auf 760 px: Beschreibung bleibt bei 16 px, Bildschrift bei 12 px, das SVG wächst nur von 356 auf seine natürlichen 360 px. Das war ohnehin nötig, weil eine mitwachsende Zeichnung in einem Bereich fester Höhe ständig die Scrollhöhe verändert hätte.

**Eine Falle beim CSS:** Die Rasterregeln standen zuerst im `@media (min-width: 700px)`-Block weiter oben in `css/ueberblick.css` — also **vor** `.ub-inhalt { display: flex }`. Gleiche Spezifität, spätere Regel gewinnt: das Raster kam nie an, gemessen 470/1/35/190 px statt 392/9/35/260. Der Block steht jetzt unten bei den übrigen `.ub-inhalt`-Regeln, mit Kommentar warum.

**Nachtrag — «Ich sehe den Graph im rechten Teil nicht mehr»:** Zwei Ursachen, beide meine.
Erstens hatte ich beim Testen des Klappknopfs `graphOffen: false` in den **echten Browser des Sponsors** geschrieben — die Chrome-Automatisierung fährt sein Profil, nicht ein eigenes. Zweitens, und das war der eigentliche Fehler: Ohne Auswahl und bei Einträgen ohne Beziehungen blendete `graphBereichSetzen(false)` den ganzen unteren Bereich **samt Kopfzeile** aus (`data-graph="leer"`). Wer die Seite öffnete und noch nichts angeklickt hatte, sah also weder Graph noch Leiste — die geteilte Seite sah je nach Auswahl völlig anders aus. Der untere Bereich bleibt jetzt immer stehen und trägt in diesen Fällen einen Hinweis («Ein Ergebnis, ein Modul oder eine Phase wählen …» bzw. «Für «Konzept» führt das Handbuch keine Beziehungen …»). Der Zustand `leer` ist damit weg, aus JS und CSS.

Nebenbefund bei der Suche: Es laufen zwei lokale Server auf demselben Verzeichnis (8848 aus dieser Sitzung, 8765 aus einer früheren). Beide schicken `no-store`, beide liefern denselben Stand — aber es sind **verschiedene Origins**, also getrennte `localStorage`. Was auf dem einen Port geklickt wurde, gilt auf dem anderen nicht.

**Geprüft:** Aufklappen und Zuklappen (Text 392 → 695 px), Ziehen (260 → 380 px, gespeichert), Klappzustand überlebt das Neuladen, Phase ohne Beziehungen (unterer Bereich ganz weg), Modul (zwei Listen statt Bild), 380 px im sichtbaren iframe (Ziehstreifen aus, Kopfzeile da, kein Seitwärtsscroll). Keine Konsolenfehler.

**Offen:** Die Lexikonstufe «Handbuch» zeigt die Beziehungen weiter als Quelltabelle — dort ist das stimmig, die Stufe verspricht den vollständigen Handbuchtext, und in voller Seitenbreite ist die Tabelle lesbar und verlinkt.

## 2026-09-08 (3) — Inhaltslisten der Ergebnisse vervollständigt, Legende zur Abbildung

**Auftrag:** «Wenn ich auf eines der Ergebnisse klicke, zB das Systemkonzept, bekomme ich eine etwas andere Beschreibung als in der Quelle.» Der Befund stimmte, und die Ursache war schmaler als befürchtet.

**Was geprüft wurde:** Alle 110 Ergebnisse Feld für Feld gegen den Import `data/handbuch/elemente-ergebnis.json` (der seinerseits gegen die Live-Seite `ergebnisse/systemkonzept.html` gegengelesen wurde — der Import ist wortgetreu).
- *Definition* — bei 108 Einträgen wörtlich der Abschnitt «Beschreibung» bzw. dessen erster Absatz; der Rest steht in `details`. Einzige Ausnahme: **Projektmanagementplan**, dort ist die Definition aus dem zweiten Quellabsatz zusammengesetzt und gekürzt («Der Projektmanagementplan dient …» → «Er dient …»). Sachlich richtig, der vollständige Text steht in `details` — bewusst belassen, weil der erste Quellabsatz («Die erstmalige Ausarbeitung … wird durch den Entscheid Weiteres Vorgehen geprägt») keine Definition ist.
- *Erzeugende Aufgaben, Verantwortlich, Beteiligt, Module* — deckungsgleich mit der Beziehungstabelle, bei allen 108 Einträgen mit Tabelle (bis auf das Fussnotenzeichen `*` an Rollennamen, das bewusst nicht übernommen wird).
- *«HERMES stellt … eine Dokumentvorlage bereit»* — steht bei genau den 71 Ergebnissen, die den Abschnitt «Dokumentenvorlage» haben. Keine Abweichung.

**Der Fehler:** Beim erstmaligen Kuratieren wurde die **dritte Gliederungsebene** der Inhaltslisten fallengelassen — 39 Unterpunkte in 8 Ergebnissen. Beim Systemkonzept endete der Punkt darum mit «Lösungskonzept mit: Systemvarianten für jede Systemvariante:» und die drei Unterpunkte (Beschreibung, Anforderungsabdeckung, Machbarkeitsbeurteilung) fehlten. Betroffen: Ausschreibungsunterlagen (14 Punkte), Situationsanalyse (6), Projektschlussbeurteilung (5), Studie (5), Systemkonzept (3), Durchführungsauftrag (3), Projektmanagementplan (2), Betriebshandbuch (1).

**Behoben mit `tools/ergebnis-inhalt.py`:** schreibt den Abschnitt «Inhalt gemäss Dokumentvorlage» aus dem Import neu, mit allen Ebenen (1. Ebene trennt mit «: », tiefere klammern ein). Gegenprobe: 42 der 50 Blöcke kommen zeichengleich wieder heraus — die Formatregel ist also die des Bestands, und die 8 Änderungen sind genau die fehlenden Unterpunkte. Das Skript ist idempotent.

**Legende zur Abbildung:** Die bisherige Legende stand nur auf der leeren Inhaltsseite rechts und verschwand beim ersten Klick. Neu steht unter der Grafik dauerhaft eine Legende der Zeichen, aus denen die Originalgrafik besteht: blaues Kästchen = Ergebnis (Dokument oder Checkliste), weisses Kästchen mit runden Ecken = Ergebnis als Zustand, schwarz umrandetes Kästchen = Modulkopf, Band am linken Rand = Phase, Raute auf der gestrichelten Linie = Meilenstein am Phasenübergang, rote gestrichelte Linie = agile Iteration. Die Musterzeichen sind Inline-SVG mit den Farbwerten aus `FARBEN` — derselben Konstante, an der die Trefferschicht die Kästen erkennt, damit Legende und Erkennung nicht auseinanderlaufen.

**Nebenbefund:** Der Kommentar zu `FARBEN.ergebnisRand` sagte «Dokumentform (weiss gefüllt, welliger Fuss)». Nachgemessen sind es 20 Pfade `#FFFFFF/#DCEBFA` mit runden Ecken, und ihre Beschriftungen sind ausnahmslos die Zustände (Organisation umgesetzt, System integriert, Betrieb aktiviert …). Kommentar korrigiert.

**Nachfassen — der eigentliche Grund für «einen anderen Text»:** Der Sponsor verglich weiter mit hermes.admin.ch und behielt recht. Die Inhaltsliste war nur die halbe Ursache. Die Überblick-Seite zeigte als Lead `e.kurz` — und `kurz` steht in keiner Datendatei, sondern wird in `js/data.js` als **erster Satz** der Definition berechnet (`kurzfassung()`). Beim Systemkonzept blieb davon «Das Systemkonzept vertieft die in der Studie beschriebene und gewählte Lösungsvariante.» übrig; die beiden Folgesätze der Quelle waren auf dieser Seite nirgends zu lesen. In der Lexikonkarte fällt das nicht auf, weil Stufe «Kernpunkte» die vollständige Definition nachliefert — die Überblick-Seite hat keine Stufen. Der Lead ist jetzt `e.definition || e.kurz`, also der Absatz «Beschreibung» der Quelle wörtlich. **Das Systemkonzept war kein Einzelfall:** in der laufenden Anwendung gemessen hat die Abbildung 98 Trefferflächen für 82 verschiedene Einträge (64 Ergebnisse, 12 Module, 6 Phasen), und bei **59 davon** blieb bisher nur der erste Satz stehen — 53 der 64 Ergebnisse und alle 6 Phasen. Die Module nicht, deren Definitionen sind einsätzig. Grösste Verluste: Organisationskonzept (378 Zeichen), Studie (344), Detailspezifikation (343), Lösungsanforderungen (337), Projekterfahrungen (317), Integrationskonzept (312). Weil es am Renderpfad lag und nicht an den Daten, behebt die eine Zeile alle Fälle zugleich. Der zweite Quellabsatz steht wie bisher unter «Aus der Dokumentation». Längster Fall geprüft: Studie (544 Zeichen) füllt elf Zeilen, der Steckbrief bleibt sichtbar. Die übrigen Stellen mit `kurz` bleiben, wie sie sind: Lexikonkarte Stufe «Kurz» (Stufe «Kernpunkte» liefert die vollständige Definition nach), Graph-Tooltip, Listen der Feldseiten und der Methode — dort ist die Kurzfassung ein Anreisser mit Link auf den vollen Eintrag, kein Endpunkt.

**Geprüft:** Überblick bei 1552 px und im sichtbaren iframe bei 380 px (Legende bricht dort auf fünf Zeilen um, bleibt vor der Bildunterschrift), Legende bleibt sichtbar, wenn rechts ein Eintrag gehalten wird, Systemkonzept zeigt die drei Unterpunkte. `DATEN_VERSION` auf `2026-09-08a` und `?v=` auf `2026-09-08e` erhöht, weil `data/ergebnisse.json` geändert ist.

## 2026-09-08 (2) — Hauptnavigation auch im Graph sichtbar

**Auftrag:** «Ich sehe keinen Überblick auf der Navigationsleiste.» Zu Recht: Startseite ist der Graph, und der blendete die Kopfzeile der Anwendung aus (`body[data-route="graph"] .topbar { display: none }`). Die Hauptnavigation steckte dort in einem Popover hinter dem kleinen Markenknopf — auf der Startseite war also gar keine Navigationsleiste zu sehen. Der Design-Handoff nennt genau das als Schwäche des Graphen («no clear entry point»). Nach Rückfrage entschied der Sponsor: Kopfzeile auch im Graph zeigen.

**Umgesetzt:** Die Kopfzeile steht jetzt auf allen Routen. Im Graph entfallen dafür der Markenknopf (`.gmarke`), das Navigations-Popover (`POPS.nav`, `navInhalt()`, `.gnav__*`) und die Linksverankerung `gpop--links`, die es nur für dieses eine Menü gab — die Marke steht dreissig Pixel darüber in der Kopfzeile, ein zweites «H» in der Graph-Leiste wäre Doppelung. Die Leiste beginnt nun mit der Ansicht.

**Höhe ohne Zauberzahl:** `.graph-seite` rechnete mit `calc(100vh - 52px - 64px)`. Gemessen ist die Kopfzeile 57.7 px hoch (die Navigationszeile ist höher als die Markenzelle), was 4 px Seitenscroll ergab. Ab 700 px füllt die Seite den Schirm jetzt über eine Flexkette (`body` → `main` → `.view` → `.graph-seite`), ganz ohne Konstante; geprüft: Kopfzeile 57.7 + Leinwand 685.3 = 743 = Viewport, kein Body-Scroll. Unter 700 px bleibt der normale Fluss mit Fussnavigation, dort ist die Kopfzeile die Markenzeile allein (`--kopf: 53px`, gemessen bestätigt).

**Geprüft:** Graph mit sichtbarer Navigation und Detailspalte (öffnet bündig unter der Kopfzeile bis zur Unterkante), Legenden-Popover, Wechsel Graph → Überblick → Lexikon → Methode → Graph (Body-Layout stellt sich je Route korrekt um, andere Routen scrollen weiter normal), 390 px im sichtbaren iframe. Keine Konsolenfehler.

## 2026-09-08 — Überblick nach dem Modernist-Entwurf neu gebaut

**Auftrag:** «In the Design folder, there is some guidance from Claude Design to implement» — der Handoff `design/design_handoff_hermes_ueberblick/` (README, drei `.dc.html`-Prototypen, Modernist-Tokensheet) beschreibt die Ansicht «Überblick» als Werkbank aus zwei Bereichen. Der Prototyp ist ein Komponentenformat mit `<x-dc>`/`class Component`; der Handoff verlangt ausdrücklich, das **nicht** zu portieren, sondern das Ergebnis im bestehenden Vanilla-JS-Gerüst nachzubauen. Genau das ist geschehen: `js/ueberblick.js` und `css/ueberblick.css` sind neu geschrieben, kein Framework, kein Build-Schritt, weiter ohne `innerHTML`.

**Die Ansicht:** links die unveränderte Originalabbildung mit Trefferschicht, rechts eine Inhaltsseite mit fester Abschnittsfolge (Kopf mit Kategorie-Ikone/Kicker/Marker, Steckbrief als Definitionsliste mit Ikonen, Prüfungshinweis im Akzent-Hauch, Abgrenzung, «Aus der Dokumentation», Verweise), dazwischen eine ziehbare Trennlinie (`role="separator"`, Doppelklick setzt auf 420 px, Pfeiltasten ±24 px). Werkzeugleiste mit Modus-Tabs, Zoom (×1.2, 0.4–2.5), «Passend», «Breit» und der Steuerung als einziger erhobener Fläche der Seite.

**Zwei Modi.** *Erkunden*: Zeigen füllt die Inhaltsseite, Klick hält den Eintrag fest, Rollenauswahl färbt (verantwortlich gefüllt, beteiligt umrandet, Rest blasst ab), Schalter «nur minimal gefordert». *Abfragen* (neu): jeder der 80 Ergebniskästen bekommt einen Deckel in seiner eigenen Füllfarbe — nur die Beschriftung verschwindet, Modulrahmen und Phasenbalken bleiben als Orientierung stehen. Gesucht wird der Ort in der Abbildung; Runde aus 12 Aufgaben, Fehlerbilanz und beste Serie in `localStorage` (`hermes-trainer:ueberblick-drill`), Begriffe mit Fehlern bekommen bis zu drei Zusatzlose je Runde.

**Design.** Modernist: Archivo, Radius 0, Struktur aus Linien statt Kästen, Akzent `#ec3013`, kein Dark Mode. Alle Regeln hängen an `body[data-route="ueberblick"]` — auch die Umgestaltung der Kopfzeile —, damit die übrigen Ansichten unangetastet bleiben; geprüft: Lexikon und Feld rendern unverändert. Ab 700 px füllt die Werkbank den Schirm (`100vh`, nur die zwei Bereiche scrollen, Fusszeile ausgeblendet), darunter wird gestapelt, damit die Seite auf dem Telefon samt Fussnavigation benutzbar bleibt.

**Drei bewusste Abweichungen vom Handoff**, jeweils weil er sonst eine Lücke liesse: (1) Das `<title>` eines verdeckten Kastens hiess im Prototyp weiter wie der Begriff — der native Tooltip hätte im Abfragemodus die Lösung verraten; verdeckte Kästen heissen jetzt «Verdeckter Ergebniskasten». (2) Am Rundenende liegt «Neue Runde» zusätzlich in der Aufgabenzeile, nicht nur in der Steuerung — sonst endet die Runde ohne sichtbare Fortsetzung. (3) Escape schliesst die Steuerung und gibt den Fokus an den Auslöser zurück.

**Entscheidungen.** Schrift Archivo global über Google Fonts in `index.html` (Rückfrage an den Sponsor; damit ist die Site nicht mehr abhängigkeitsfrei — README und der Kopf von `css/style.css` sind nachgeführt). Die Ergebnis-Detailseite unter `#/ueberblick?id=…` ist entfallen: der Eintrag steht jetzt rechts in der Inhaltsseite und vollständig im Lexikon, alte Links leiten dorthin um; `js/feld.js` verlinkt Ergebnisse direkt ins Lexikon.

**Geprüft im Browser** (lokaler Server mit `Cache-Control: no-store`): 98 von 99 Kästen mit dem Lexikon verbunden — der einzige Rest ist wie dokumentiert die Sammelfläche «Phasenunabhängig»; Hover/Klick/Tastatur (Enter auf fokussiertem Kasten), Rolleneinfärbung (Auftraggeber: 3 verantwortet · 13 beteiligt), «nur minimal» blasst 31 Kästen ab, Steuerung öffnet/schliesst per Klick, Aussenklick und Escape, Trennlinie ziehen/Doppelklick/Pfeiltasten, «Breit» klappt ein und passt den Zoom nach, eine ganze Abfragerunde bis «Runde beendet» inklusive Schwachstellenliste und Persistenz, Route verlassen und zurück, schmale Darstellung bei 390 px im sichtbaren iframe. Keine Konsolenfehler.

**Veröffentlicht:** Commit `69ee441` auf `main` gepusht; GitHub Pages nach rund 15 s aktualisiert (verifiziert: neue `js/ueberblick.js` und `css/ueberblick.css` werden ausgeliefert, Archivo lädt, 98 Kästen verbunden). Das Handoff-Bündel bleibt auf Wunsch des Sponsors ausserhalb des Repos (`.gitignore`) — es steckt vollständig im Ergebnis.

**Offen:** Der Handoff nennt den Graph als nächstes Stück Arbeit (zu viele Knoten auf einmal, kein klarer Einstieg, schwer lesbares Swimlane-Layout); die übrigen Routen tragen weiterhin das alte blaue Kartendesign.

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
