# meinHERMES

**Lernhilfe für die HERMES-2022-Prüfung — kostenlos im Browser, ohne Anmeldung.**

→ **[meinHERMES öffnen](https://markussteinbrecher.github.io/hermes-trainer/)**

meinHERMES hilft, die Methode HERMES 2022 der Schweizer Bundesverwaltung zu verstehen und die Begriffe für die Prüfung sicher zu beherrschen: Wer tut was, und was entsteht dabei? Jeder Begriff ist mit der offiziellen Dokumentation auf hermes.admin.ch verknüpft — inklusive Kapitel und Seite im Referenzhandbuch.

Die Anwendung ist eine **Beta-Version**. Rückmeldungen und Fehlerberichte sind willkommen: [Issue eröffnen](https://github.com/MarkusSteinbrecher/hermes-trainer/issues).

## Was drin ist

- **Graph** — Rollen, Aufgaben und Ergebnisse und ihre Verbindungen, nach Phasen oder Modulen geordnet. Ein Klick auf ein Element zeigt nur noch, was direkt damit zusammenhängt. Die Suche findet jedes Element, jedes Modul und jede Phase.
- **Überblick** — das Gesamtbild der Methode (Abbildung 1 des Referenzhandbuchs) als Originalgrafik. Zeigen auf einen Kasten erklärt ihn; im Abfragemodus sind die Kästen verdeckt, und Sie suchen den richtigen Ort.
- **Trainer** — Ergebnisse per Drag-and-drop in die leeren Kästen des Gesamtbilds legen, je Phase, je Modul oder das ganze Bild; «Prüfen» zeigt, was stimmt.
- **Methode** — die Kapitel des Referenzhandbuchs in drei Stufen: Kernaussagen und Prüfungsfallen, Zusammenfassung, vollständiger Text.
- **Lexikon** — alle Phasen, Szenarien, Module, Aufgaben, Ergebnisse, Rollen und Grundbegriffe, durchsuchbar, mit Link auf die offizielle Seite.
- **Lernkarten** — Begriff und Definition mit Selbsteinschätzung; was nicht sitzt, kommt wieder.
- **Quiz** — Prüfungsfragen mit Belegzitat aus dem Referenzhandbuch.
- **Notizen** — Textstellen markieren und kommentieren, eigene Notizen je Kapitel und Begriff; als Datei sichern und wieder einlesen.

Lernstand und Notizen bleiben in Ihrem Browser. Es gibt kein Konto und keine Übertragung an einen Server.

## Unterstützen

meinHERMES ist ein privates Projekt und bleibt kostenlos. Wer es unterstützen möchte: [Ko-fi](https://ko-fi.com/rrradio).

## Quellen und Rechtliches

Alle Inhalte stammen aus der offiziellen HERMES-Methode: [hermes.admin.ch](https://www.hermes.admin.ch/de/projektmanagement.html) und dem [Referenzhandbuch Projektmanagement, Ausgabe 2022](https://www.hermes.admin.ch/de/downloads.html). HERMES ist ein offener Standard der Bundesverwaltung (eCH-0054); die Urheberrechte an der Dokumentation liegen bei der Schweizerischen Eidgenossenschaft. meinHERMES ist inoffiziell; massgebend ist die offizielle Dokumentation.

## Für Entwickler

Statische Website ohne Build-Schritt (HTML, CSS, Vanilla-JS), Inhalte als JSON in `data/`. Lokal starten mit `python3 -m http.server 8080` im Projektverzeichnis. Datenschema: [SCHEMA.md](SCHEMA.md), Aufbau und Werkzeuge: [design/technik.md](design/technik.md).
