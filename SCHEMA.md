# Datenschema — HERMES-Trainer

Verbindlicher Kontrakt zwischen Inhalt und Frontend. Alle Inhalte liegen als JSON in `data/`, eine Datei je Kategorie, Top-Level ist ein Array von Einträgen. Sprache: Deutsch, Schweizer Rechtschreibung (ss statt ß), HERMES-2022-Terminologie exakt — keine Synonyme, keine Umschreibungen.

## Dateien und Kategorien

| Datei | `kategorie` | Inhalt |
|---|---|---|
| `data/phasen.json` | `phase` | Alle sechs definierten Phasen (fünf klassisch: Initialisierung, Konzept, Realisierung, Einführung, Abschluss; agil: Initialisierung, Umsetzung, Abschluss) inkl. Meilensteine je Phase |
| `data/szenarien.json` | `szenario` | Standardszenarien (inkl. agile Varianten) |
| `data/module.json` | `modul` | Alle Module |
| `data/grundbegriffe.json` | `grundbegriff` | Methodenverständnis: Governance, Tailoring, Ergebnisorientierung, Meilenstein, Entscheidungspunkt, minimale Vorgaben, Anwendungsgebiet, Programm, Vorhaben, Projektsteuerung/-führung/-ausführung usw. |
| `data/aufgaben.json` | `aufgabe` | Alle Aufgaben |
| `data/ergebnisse.json` | `ergebnis` | Alle Ergebnisse |
| `data/rollen.json` | `rolle` | Alle Rollen |
| `data/quizfragen.json` | — | Kuratierte Prüfungsfragen (eigenes Schema, siehe unten) |
| `data/kernaussagen.json` | — | Je Handbuchkapitel Kernaussagen, Zusammenfassung, Prüfungsfallen, Belege (Schema unten) |
| `data/handbuch/*.json` | — | Importierte Handbuchtexte (generiert von `tools/handbuch-import.py`, nicht von Hand pflegen) |

## Pflichtfelder je Eintrag

```json
{
  "id": "aufgabe-ausschreibung-erarbeiten",
  "kategorie": "aufgabe",
  "begriff": "Ausschreibung erarbeiten",
  "definition": "Kurzdefinition in 1–3 Sätzen, möglichst nah am Original-Wortlaut der HERMES-Dokumentation.",
  "quelle": {
    "url": "https://www.hermes.admin.ch/de/projektmanagement/aufgaben/ausschreibung-erarbeiten.html",
    "bezeichnung": "HERMES online · Aufgabe «Ausschreibung erarbeiten»"
  }
}
```

- `id`: `{kategorie}-{slug}`, eindeutig über **alle** Dateien, nur Kleinbuchstaben/Ziffern/Bindestriche.
- `begriff`: exakter HERMES-Wortlaut (Prüfungsrelevanz!).
- `quelle.url`: Detailseite des Elements auf hermes.admin.ch (URL-Muster unten); **jede URL muss per Abruf verifiziert sein** (HTTP 200 und die Seite beschreibt tatsächlich dieses Element). Nur wenn keine Detailseite existiert, auf die passende Übersichtsseite verlinken. Über diese URL findet der Import auch den Handbuchtext des Eintrags (`data/handbuch/elemente-<kategorie>.json`, Schlüssel = `id`).
- `definition`: Der **erste Satz** ist die Kurzfassung der Stufe «Kurz» und muss für sich stehen (Fallback: Feld `kurz`).

## Optionale Felder (je nach Kategorie sinnvoll)

```json
{
  "details": "Prüfungsrelevante Zusatzpunkte als reiner Text; Absätze mit \n\n. Keine Markdown-Syntax.",
  "phasen": ["Konzept"],
  "module": ["Beschaffung"],
  "verantwortlich": "Projektleiter",
  "beteiligt": ["Anwendervertreter"],
  "ergebnisse": ["Ausschreibung"],
  "ebene": "Führung",
  "meilensteine": [{ "name": "Freigabe Umsetzung", "beschreibung": "…" }],
  "abgrenzung": "Wovon ist der Begriff abzugrenzen? Exakte Unterscheidung bei Verwechslungsgefahr.",
  "pruefungshinweis": "Typische Stolperfalle oder exakter Ausdruck, auf den die Prüfung zielt.",
  "kurz": "Nur wenn der erste Satz der Definition nicht als Kurzfassung taugt.",
  "typ": "Ergebnisse: Dokument | Checkliste | Zustand | Meilenstein (aus Tabellen 16/17, gesetzt von tools/ergebnis-typen.py)",
  "minimalGefordert": true
}
```

Querverweise auf andere Elemente (z. B. `ergebnisse`, `verantwortlich`) als **exakte Begriffs-Strings**, nicht als IDs.

## URL-Muster hermes.admin.ch

`https://www.hermes.admin.ch/de/projektmanagement/{phasen|szenarien|module|ergebnisse|aufgaben|rollen}/{slug}.html`

Umlaute im Slug: ä→ae, ö→oe, ü→ue. Übersichtsseiten: `…/de/projektmanagement/{kategorie}.html`. Referenzhandbuch (PDF): über `https://www.hermes.admin.ch/de/downloads.html`.

## Quizfragen (`data/quizfragen.json`)

```json
{
  "id": "q-001",
  "frage": "Welche Rolle trägt die Gesamtverantwortung für das Projekt?",
  "antworten": ["Projektleiter", "Auftraggeber", "Projektausschuss", "Anwendervertreter"],
  "richtig": 1,
  "erklaerung": "Der Auftraggeber steuert das Projekt und trägt die Gesamtverantwortung.",
  "quelle": { "url": "…", "bezeichnung": "…" },
  "kategorie": "rolle",
  "beleg": { "zitat": "Wörtlicher Satz aus dem Referenzhandbuch, der die richtige Antwort belegt.", "kapitel": "6.2.1 Standardrollen", "seite": 166 }
}
```

- Genau eine richtige Antwort, `richtig` ist der 0-basierte Index; genau vier Antworten.
- Fragen zielen auf Begriffsverständnis und exakte Ausdrücke (Verwechslungskandidaten als Distraktoren). Nur fragen, was das Handbuch explizit sagt — keine eigenen Zählungen oder Schlussfolgerungen.
- `beleg` ist Pflicht: wörtliches Zitat (Silbentrennung aufgelöst), Kapitelnummer mit Titel und Seitenzahl des Referenzhandbuchs (Ausgabe 2022, 3. Auflage). Tabelleninhalte dürfen als «Tabelle N: …» paraphrasiert werden. `tools/quiz-pruefen.py --pdf-text rhb.txt` prüft Form und Zitate.

## Kernaussagen (`data/kernaussagen.json`)

Objekt mit einem Schlüssel je Kapitel bzw. Hinweis-Thema (`methodenueberblick`, `phasen`, `szenarien`, `module`, `ergebnisse`, `aufgaben`, `rollen`, `hinweise`, `governance`, `reporting`, `nachhaltigkeit`, `pm-entwicklungsmanagement`, `finanzen`, `planung`, `realisierungseinheiten`, `andere-methoden`, `integration`):

```json
{
  "phasen": {
    "kernaussagen": ["5–8 Sätze, die ein Prüfling zwingend wissen muss"],
    "zusammenfassung": ["2–4 Absätze als Strings"],
    "pruefungsfallen": ["2–4 Verwechslungen: «X ist nicht Y, sondern …»"],
    "belege": [{ "kapitel": "1.2.2 Einheitliche Projektstruktur", "seite": 18, "zitat": "…" }]
  }
}
```

## Handbuchtexte (`data/handbuch/`, generiert)

`kapitel.json`: Array der Kapitel `{ id, titel, nummer, seite, url, teile: [{ titel, url, nummer, seite, abschnitte: [{ titel, ebene, nummer?, seite?, bloecke }] }] }`.
`elemente-<kategorie>.json`: Objekt `id → { titel, url, nummer, seite, abschnitte }`.
Blöcke: `{ t: "p", text }`, `{ t: "ul"|"ol", items: [{ text, items? }] }`, `{ t: "tabelle", titel, zeilen: [[{ text, kopf? }]] }`, `{ t: "abb", src, datei?, text }`, `{ t: "download", titel, datei, groesse, url }` (Dokumentvorlage `.dotx`), `{ t: "h", n, text }`. Begriffe in Listen und Zellen werden im Frontend über den exakten Wortlaut auf Lexikoneinträge verlinkt.

## Graph (abgeleitet, keine eigene Datei)

`js/graph-modell.js` baut zur Laufzeit einen Graphen aus den Einträgen. Knoten sind **nur** Aufgaben, Ergebnisse und Rollen — sie beschreiben zusammen den Ablauf: wer tut was, und was entsteht dabei. Phasen, Module und Szenarien sind keine Knoten, sondern der **Umfang**: sie wählen aus, welche Aufgaben und Ergebnisse gezeigt werden (Grundbegriffe kommen im Graphen nicht vor). Jede Kante ist auf ein Feld eines Eintrags zurückführbar; es werden keine Beziehungen ergänzt:

| Beziehung | Quelle (Feld) | Richtung |
|---|---|---|
| `verantwortlich` | `aufgabe.verantwortlich` (mehrere Rollen kommagetrennt) | Rolle → Aufgabe |
| `beteiligt` | `aufgabe.beteiligt` (ohne die bereits verantwortliche Rolle) | Rolle → Aufgabe |
| `erzeugt` | `aufgabe.ergebnisse` | Aufgabe → Ergebnis |
| `ergebnisrolle` | `ergebnis.verantwortlich` | Rolle → Ergebnis |

Der Umfang (`{ vorgehen, phasen[], module[] }`) filtert über `aufgabe.phasen`/`ergebnis.phasen` und `aufgabe.module`/`ergebnis.module`; `vorgehen` schränkt zusätzlich auf die Phasen der klassischen (Initialisierung, Konzept, Realisierung, Einführung, Abschluss) oder der agilen Vorgehensweise (Initialisierung, Umsetzung, Abschluss) ein. Leere Auswahl heisst «alle». Rollen tragen selbst weder Phasen noch Module — sie erscheinen, wenn sie über eine eingeblendete Beziehung an einer Aufgabe oder einem Ergebnis im Umfang hängen. `szenario.module` dient als Vorwahl der Modulauswahl. Aufgaben und Ergebnisse ohne Phasenangabe — die Sammeleinträge «Checklisten» und «Meilensteine» — lassen sich nicht im Ablauf verorten und erscheinen nur im Lexikon.

Die Ansicht («Nach Phasen» oder «Nach Modulen») legt die Bahnen des Swimlane-Layouts fest: eine Aufgabe steht in der ersten Bahn, zu der sie laut ihren Feldern gehört; ein Ergebnis in der Bahn der Aufgabe, die es erzeugt (ohne erzeugende Aufgabe in seiner eigenen ersten Phase bzw. seinem ersten Modul). Rollen bekommen keine Bahn — sie tragen in HERMES weder Phase noch Modul und stehen als durchgehende Spalte daneben. Die Daten tragen das: 68 von 71 Aufgaben hängen an genau einem Modul, 55 von 71 an genau einer klassischen Phase.

Querverweise werden über den exakten Begriff aufgelöst (`eintragMitBegriff`); nicht auflösbare Werte erzeugen keine Kante. Abgeleitete Kennzeichen: Entscheidungsaufgabe (`begriff` beginnt mit «Entscheid »), Ergebnistyp und «minimal gefordert» aus den Feldern `typ`/`minimalGefordert`.

## Feld: eine Phase in einem Modul (abgeleitet, keine eigene Datei)

`js/feld.js` schneidet die Einträge auf ein Feld der Abbildung 1 zu — eine Phase (Zeile) in einem Modul (Spalte). Die Adresse nennt beide: `#/feld?phase=<Phase>&modul=<Modul>[,<Modul>…]`; mehrere Module sind zulässig, weil die Abbildung Projektsteuerung und Projektführung zu einer Spalte zusammenfasst. Namen werden über `eintragMitBegriff` aufgelöst; ein unbekannter Name macht das Feld ungültig.

| Inhalt | Regel |
|---|---|
| Ergebnisse | `ergebnis.phasen` enthält die Phase **und** `ergebnis.module` eines der Module. Reihenfolge: Meilenstein, Dokument, Zustand, Checkliste, darin alphabetisch |
| Aufgaben | `aufgabe.phasen` enthält die Phase **und** `aufgabe.module` eines der Module |
| «Entsteht aus» | Aufgaben **dieses Felds**, deren `ergebnisse` das Ergebnis nennen — nicht alle erzeugenden Aufgaben |
| Meilensteintext | `phase.meilensteine[].beschreibung`, wenn der Name übereinstimmt; sonst die Kurzfassung des Ergebnisses |
| Rollen | aus `verantwortlich` (kommagetrennt) und `beteiligt` der Aufgaben und Ergebnisse des Felds; «beteiligt an» lässt weg, was die Rolle im selben Feld ohnehin verantwortet |
| Nachbarfelder | dieselbe Rechnung für die übrigen Phasen bzw. Module; leere Felder erscheinen nicht (das eigene bleibt als Anker stehen) |

Das Kennzeichen «minimal gefordert» wird wie auf der Lexikonkarte nur bei `typ: "Dokument"` angezeigt (Tabelle 16); die 18 Checklisten tragen das Feld ebenfalls, sind aber über ihren Typ schon erkennbar. Vergleiche laufen über `HT.daten.normalisieren`, nicht über Zeichenkettengleichheit.
