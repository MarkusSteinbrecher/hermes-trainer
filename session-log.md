# Session-Log — HERMES-Trainer

Neueste Einträge zuerst.

## 2026-08-27 — Projektaufbau: Site komplett, QA bestanden

**Von null auf fertige Site in einer Session**, koordiniert über Opus-Agenten: Skeleton + Datenschema (SCHEMA.md als Kontrakt), dann parallel drei Inhaltsagenten (Phasen/Szenarien/Module/Grundbegriffe · Aufgaben · Ergebnisse/Rollen) und ein Frontend-Agent; anschliessend Quiz-Agent (60 kuratierte Prüfungsfragen) und unabhängiger QA-Agent.

**Inhalte:** 259 Methodenelemente (6 Phasen, 5 Szenarien, 12 Module, 39 Grundbegriffe, 71 Aufgaben, 110 Ergebnisse, 16 Rollen) + 60 Quizfragen. Jede Quellen-URL auf hermes.admin.ch per Abruf verifiziert (233/233 HTTP 200, Titelabgleich); 1821 Querverweise konsistent. Fachliche Befunde: HERMES 2022 hat 6 definierte Phasen (5 klassisch/3 agil, nicht 4); keine agilen Szenario-Varianten; «Anwendungsgebiet»/«Partizipation»/«hybrid» existieren nicht; 17 Checklisten vs. 16 Meilensteine (kein Meilenstein Projektabbruch).

**Frontend:** statisch, ohne Build/Abhängigkeiten, Hash-Routing; Lexikon (Suche mit Umlauttoleranz, Kategorie-Filter, Quellenlink je Eintrag), Lernkarten (localStorage), Quiz (kuratiert + generiert mit Begriffsmaskierung), Übersicht (beide Vorgehensweisen). QA: 0 XSS (kein innerHTML), 0 Konsolenfehler, kein Horizontalscroll bei 320/375/768 px, GH-Pages-tauglich (relative Pfade, .nojekyll).

**QA-Runde:** Blocker behoben (Übersicht zeigte 4-Phasen-Modell — genau die Prüfungsfalle), Quiz-Antwort-Leaks geschlossen (Wortbestandteil-Maskierung, uneindeutige Fragen verworfen), Antwortlängen-Giveaways ausbalanciert. Bekannte Restpunkte: Zitattreue bei 2 Grundbegriff-Definitionen (Montage/Kürzung, sachlich korrekt), 2 selbst geprägte Grundbegriff-Labels, Präfix-Hinweis bei Komposita im generierten Quiz (bewusst belassen).

**Veröffentlicht:** Repo `MarkusSteinbrecher/hermes-trainer` (public) erstellt, GH Pages ab `main` aktiviert — live unter https://markussteinbrecher.github.io/hermes-trainer/ (verifiziert: Assets und Daten laden, Lexikon rendert 259 Einträge).
