---
adr: 0001
title: Export/Import vor Login und Server-Abgleich
date: 2026-09-15
status: Accepted
scope: project
tags: [speicherung, localstorage, export, login, datenschutz, supabase]
---

# ADR 0001 — Export/Import vor Login und Server-Abgleich

## Context

meinHERMES ist eine statische Seite (GitHub Pages, Vanilla-JS, Hash-Routing, keine Laufzeitbibliotheken). Alles, was die Seite sich merkt, liegt im `localStorage` des Browsers. Alle Zugriffe laufen über die Kapsel `HT.store` in `js/store.js` (Präfix `hermes-trainer:`); kein Modul spricht `localStorage` direkt an.

Schlüssel, Stand 2026-09-15:

| Schlüssel | Modul | Art |
|---|---|---|
| `trainer` | `js/zuordnen.js` | Lernstand: beste Runde je Übung, leere Arten, Vorgehensweise |
| `markierungen` | `js/markieren.js` (übernimmt einmalig das alte `notizen`) | Lernstand |
| `lernkarten` | `js/lernkarten.js` | Lernstand |
| `quiz-statistik` | `js/quiz.js` | Lernstand |
| `quiz-konfig` | `js/quiz.js` | Einstellung |
| `graph`, `handbuch`, `ueberblick-drill` | `js/graph.js`, `js/handbuch.js`, `js/ueberblick.js` | Ansichtszustand |

Der Sponsor möchte Fortschritt und Markierungen über Geräte hinweg behalten, allenfalls mit einem Login. Die Über-Seite (`js/ueber.js`, «Gespeicherte Daten») verspricht heute: keine Konten, keine Daten an einen Server, kein Tracking.

## Decision

Als Erstes kommt ein Export und Import aller Lernstände als JSON-Datei, ohne Server und ohne Konto. Ein Login mit Server-Abgleich folgt erst, wenn der Export nicht reicht. Dann ist Supabase mit Anmeldung per E-Mail-Code die bevorzugte Wahl (siehe Alternativen). Beide Schritte hängen an `HT.store`, damit die Regeln fürs Zusammenführen nur einmal entstehen.

## Alternatives considered

Die Angaben zu den Anbietern stammen aus der Beratung am 2026-09-15 und sind nicht gegen deren Dokumentation geprüft. Vor dem Login-Schritt nachprüfen.

1. **Supabase (Auth + Postgres mit Row Level Security)**, bevorzugt für später.
   - Mit `fetch` ansprechbar, ohne Bibliothek.
   - Eine Tabelle `(user_id, schluessel, wert jsonb, geaendert)` mit Policy `user_id = auth.uid()`; der öffentliche Schlüssel darf dann in der statischen Seite stehen.
   - Anmeldung per 6-stelligem **E-Mail-Code**, nicht per Link: die Tokens eines Magic Links kämen hinter `#` in die Adresse und kollidieren mit dem Hash-Routing.
   - Stolpersteine: Kostenlose Projekte pausieren nach etwa einer Woche ohne Nutzung, dagegen hilft ein regelmässiger Ping oder der Pro-Plan (ca. 25 $/Monat). Der eingebaute Mailversand ist nur zum Testen gedacht, für echte Nutzende braucht es einen eigenen SMTP-Dienst (etwa Resend, Postmark). Eine EU-Region wählen.
2. **Firebase (Auth + Firestore).** Pausiert nicht und kann Daten in Zürich (`europe-west6`) halten. Dafür ist das SDK schwer, REST umständlich, und man bindet sich an Google. Die bessere Wahl, falls Datenhaltung in der Schweiz verlangt wird.
3. **Cloudflare Workers + D1/KV.** Der Sponsor nutzt Cloudflare schon (HQ-Dashboard hinter Cloudflare Access). Kostenlos und ohne Pausieren, aber der Login müsste selbst gebaut werden (Mailversand, Tokens, Sitzungen), mit voller Sicherheitsverantwortung. Abgeraten. Cloudflare Access sperrt nur Seiten für bekannte Adressen und ist keine öffentliche Kontoverwaltung.
4. **Sync-Code ohne Konto** (zufälliger Schlüssel, Daten im Worker-KV). Kein Login nötig, aber wer den Code kennt, hat die Daten, und es braucht trotzdem einen Server.
5. **GitHub-OAuth + Gist.** Setzt ein GitHub-Konto voraus, das Prüfungskandidatinnen und -kandidaten meist nicht haben, und braucht einen Server für das Client-Secret.

## Consequences

**Leichter:** Gerätewechsel und Sicherung gehen ohne Server, ohne Kosten und ohne Betrieb. Das Datenschutzversprechen der Über-Seite bleibt gültig.

**Schwerer:** Es gibt keinen automatischen Abgleich; man trägt die Datei selbst auf das andere Gerät. Die Regeln zum Zusammenführen müssen je Schlüssel festgelegt werden. Genau diese Regeln braucht später auch der Server-Abgleich, deshalb gehören sie in `HT.store` und nicht in die Oberfläche.

### Umfang Export/Import (nächste Sitzung)

- **Ort:** Über-Seite, Abschnitt «Gespeicherte Daten», neben «Alle lokal gespeicherten Daten löschen».
- **`HT.store.alle()`:** listet alle Schlüssel mit Präfix auf, statt einer festen Liste; neue Schlüssel sind so automatisch dabei. Die Löschfunktion nutzt dieselbe Liste. **Fehler heute:** sie löscht nur `handbuch`, `graph`, `lernkarten`, `quiz-konfig` und `quiz-statistik`; `trainer`, `markierungen` und `ueberblick-drill` bleiben stehen.
- **Export:** eine Datei `meinHERMES-JJJJ-MM-TT.json` mit `{ app: "meinHERMES", format: 1, exportiert: <ISO-Zeit>, daten: { <schluessel>: <wert> } }`, heruntergeladen über Blob-URL und `<a download>`. Ansichtszustand darf mit, beim Import zählt er nicht.
- **Import:** `<input type="file">` und `FileReader`.
  - Prüfen: gültiges JSON, passende `app` und `format`, nur Schlüssel mit bekannter Form.
  - Vorschau: «n Einträge, exportiert am …».
  - Danach `location.reload()`, weil die Module ihren Zustand beim Start lesen.
- **Zuerst «Ersetzen»**, «Zusammenführen» nur, wenn es schlank bleibt:
  - `trainer.beste`: je Übung die bessere Runde (gleiche Kastenzahl beachten);
  - `markierungen`: je Eintrag der neueste (`geaendert`);
  - `lernkarten`: je Karte der neueste Stand;
  - `quiz-statistik`: Regel beim Bau festlegen, doppelter Import darf nicht doppelt zählen;
  - Ansichtszustand bleibt lokal.
- **Texte:** Die Über-Seite erklärt Export und Import; die Datei bleibt beim Nutzer.
- **Testen:** Export im Sponsor-Chrome, Import in einem Privatfenster. Den Speicher des Sponsors vorher sichern und nachher wiederherstellen, weil Browsertests dort Zustand hinterlassen.

### Später: Login mit Abgleich

- `localStorage` bleibt die Grundlage: die Seite funktioniert ohne Konto und offline. Nach dem Login lädt eine Schicht in `HT.store` Änderungen verzögert hoch und führt beim ersten Login mit den Regeln oben zusammen.
- Nur Lernstände werden abgeglichen, kein Ansichtszustand.
- Über-Seite und Datenschutzerklärung neu schreiben, E-Mail-Adressen sind Personendaten; dazu «Konto löschen».

## References

- `js/store.js`, `js/ueber.js`, `js/zuordnen.js`, `js/markieren.js`, `js/lernkarten.js`, `js/quiz.js`
- Wiki: `~/Code/hq/wiki/projects/hermes-trainer/README.md`; Cloudflare Access im HQ-Dashboard-Plan: `~/Code/hq/wiki/projects/hq/dashboard-plan.md`
- Sitzung 2026-09-15 (lokales `session-log.md`)
