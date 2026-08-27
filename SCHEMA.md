# Datenschema — HERMES-Trainer

Verbindlicher Kontrakt zwischen Inhalt und Frontend. Alle Inhalte liegen als JSON in `data/`, eine Datei je Kategorie, Top-Level ist ein Array von Einträgen. Sprache: Deutsch, Schweizer Rechtschreibung (ss statt ß), HERMES-2022-Terminologie exakt — keine Synonyme, keine Umschreibungen.

## Dateien und Kategorien

| Datei | `kategorie` | Inhalt |
|---|---|---|
| `data/phasen.json` | `phase` | Die vier Phasen inkl. Meilensteine und Entscheidungspunkte je Phase |
| `data/szenarien.json` | `szenario` | Standardszenarien (inkl. agile Varianten) |
| `data/module.json` | `modul` | Alle Module |
| `data/grundbegriffe.json` | `grundbegriff` | Methodenverständnis: Governance, Tailoring, Ergebnisorientierung, Meilenstein, Entscheidungspunkt, minimale Vorgaben, Anwendungsgebiet, Programm, Vorhaben, Projektsteuerung/-führung/-ausführung usw. |
| `data/aufgaben.json` | `aufgabe` | Alle Aufgaben |
| `data/ergebnisse.json` | `ergebnis` | Alle Ergebnisse |
| `data/rollen.json` | `rolle` | Alle Rollen |
| `data/quizfragen.json` | — | Kuratierte Prüfungsfragen (eigenes Schema, siehe unten) |

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
- `quelle.url`: Detailseite des Elements auf hermes.admin.ch (URL-Muster unten); **jede URL muss per Abruf verifiziert sein** (HTTP 200 und die Seite beschreibt tatsächlich dieses Element). Nur wenn keine Detailseite existiert, auf die passende Übersichtsseite verlinken.

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
  "pruefungshinweis": "Typische Stolperfalle oder exakter Ausdruck, auf den die Prüfung zielt."
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
  "kategorie": "rolle"
}
```

- Genau eine richtige Antwort, `richtig` ist der 0-basierte Index.
- Fragen zielen auf Begriffsverständnis und exakte Ausdrücke (Verwechslungskandidaten als Distraktoren).
