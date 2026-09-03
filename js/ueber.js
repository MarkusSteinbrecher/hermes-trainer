/* HERMES-Trainer — Ansicht «Über». */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;

  function extern(url, text) {
    return h('a', { href: url, target: '_blank', rel: 'noopener' }, text + ' ↗');
  }

  function renderUeber(behaelter) {
    var prosa = h('div', { class: 'prosa' }, [
      h('div', { class: 'kopf' }, [
        h('h1', { text: 'Über den HERMES-Trainer' })
      ]),

      h('p', { text: 'Der HERMES-Trainer ist eine private, inoffizielle Lernhilfe zur Vorbereitung auf die HERMES-2022-Prüfung. '
        + 'Er erschliesst die offizielle Dokumentation in Stufen: zuerst das Wichtigste, dann Kernpunkte, dann der vollständige Text — '
        + 'und verweist bei jedem Eintrag, jeder Lernkarte und jeder Quizfrage auf die Belegstelle im Referenzhandbuch und auf HERMES online.' }),

      h('h2', { text: 'Aufbau' }),
      h('ul', {}, [
        h('li', {}, [h('b', { text: 'Methode: ' }), 'die Kapitel des Referenzhandbuchs (Methodenüberblick, Phasen, Szenarien, Module, Ergebnisse, Aufgaben, Rollen, Hinweise zur Anwendung) — je Kapitel Kernaussagen und Prüfungsfallen, eine Zusammenfassung und der vollständige Handbuchtext.']),
        h('li', {}, [h('b', { text: 'Lexikon: ' }), 'alle Methodenelemente mit drei Detailstufen: Kurz (erster Satz und Fakten), Kernpunkte (Definition, Abgrenzung, Prüfungshinweis, Querverweise) und Handbuch (vollständige Beschreibung mit Kapitel- und Seitenangabe).']),
        h('li', {}, [h('b', { text: 'Lernkarten: ' }), 'Begriff ↔ Definition mit Selbsteinschätzung; Fortschritt lokal im Browser.']),
        h('li', {}, [h('b', { text: 'Quiz: ' }), 'kuratierte Prüfungsfragen mit Belegzitat aus dem Handbuch sowie automatisch aus dem Lexikon erzeugte Fragen.'])
      ]),

      h('h2', { text: 'Quelle der Inhalte' }),
      h('p', {}, [
        'HERMES ist die Projektmanagementmethode der Schweizerischen Bundesverwaltung und ein offener Standard (eCH-0054). ',
        'Die Texte der Stufe «Handbuch» sind der offiziellen Dokumentation entnommen: ',
        extern('https://www.hermes.admin.ch/de/projektmanagement.html', 'HERMES online'),
        ' (gemäss Impressum die führende, für die Zertifizierung massgebliche Quelle) und dem ',
        extern('https://www.hermes.admin.ch/de/downloads.html', 'Referenzhandbuch Projektmanagement, Ausgabe 2022, 3. Auflage vom 9. März 2026'),
        ', aus dem die Kapitelnummern und Seitenzahlen stammen. Kurzfassungen, Kernpunkte, Prüfungshinweise, Kernaussagen und Quizfragen sind eigene, an diesem Wortlaut geprüfte Zusammenfassungen.'
      ]),
      h('p', { text: 'Die Urheberrechte an der HERMES-Dokumentation liegen bei der Schweizerischen Eidgenossenschaft (Bundeskanzlei, Digitale Transformation und IKT-Lenkung). '
        + 'Die Wiedergabe dient ausschliesslich dem Lernen; massgebend bleibt in jedem Fall die offizielle Dokumentation.' }),
      h('ul', {}, [
        h('li', {}, extern('https://www.hermes.admin.ch/de/projektmanagement/methodenueberblick.html', 'Methodenüberblick')),
        h('li', {}, extern('https://www.hermes.admin.ch/de/projektmanagement/phasen.html', 'Phasen')),
        h('li', {}, extern('https://www.hermes.admin.ch/de/projektmanagement/szenarien.html', 'Szenarien')),
        h('li', {}, extern('https://www.hermes.admin.ch/de/projektmanagement/module.html', 'Module')),
        h('li', {}, extern('https://www.hermes.admin.ch/de/projektmanagement/ergebnisse.html', 'Ergebnisse')),
        h('li', {}, extern('https://www.hermes.admin.ch/de/projektmanagement/aufgaben.html', 'Aufgaben')),
        h('li', {}, extern('https://www.hermes.admin.ch/de/projektmanagement/rollen.html', 'Rollen')),
        h('li', {}, extern('https://www.hermes.admin.ch/de/projektmanagement/hinweise-zur-anwendung.html', 'Hinweise zur Anwendung')),
        h('li', {}, extern('https://www.hermes.admin.ch/de/downloads.html', 'Downloads — Referenzhandbuch und weitere Unterlagen als PDF'))
      ]),

      h('h2', { text: 'Gespeicherte Daten' }),
      h('div', { class: 'hinweisbox' }, [
        h('p', { text: 'Lernfortschritt, Filtereinstellungen, Detailtiefe und Quiz-Statistik liegen ausschliesslich lokal im Speicher dieses Browsers '
          + '(localStorage). Es werden keine Daten an einen Server übermittelt, es gibt keine Konten, kein Tracking und keine Cookies von Dritten. '
          + 'Wer den Browserspeicher leert oder ein anderes Gerät verwendet, beginnt wieder bei null.' }),
        h('p', {
          class: 'trefferzahl',
          text: HT.store.verfuegbar
            ? 'Status: lokale Speicherung ist in diesem Browser verfügbar.'
            : 'Status: dieser Browser erlaubt keine lokale Speicherung — der Fortschritt gilt nur für die laufende Sitzung.'
        }),
        h('button', {
          type: 'button', class: 'btn btn--klein', text: 'Alle lokal gespeicherten Daten löschen',
          on: { click: function () {
            if (!global.confirm('Lernfortschritt, Filter und Quiz-Statistik wirklich löschen?')) { return; }
            HT.store.loesche('lexikon');
            HT.store.loesche('lernkarten');
            HT.store.loesche('quiz-konfig');
            HT.store.loesche('quiz-statistik');
            global.location.reload();
          } }
        })
      ]),

      h('h2', { text: 'Hinweise zur Nutzung' }),
      h('ul', {}, [
        h('li', { text: 'Im Lexikon lässt sich der Volltext aller Einträge durchsuchen; die Filterchips grenzen auf einzelne Kategorien ein, die Ansicht-Chips legen die Detailtiefe fest.' }),
        h('li', { text: 'Bei den Lernkarten lässt sich die Abfragerichtung umschalten: Begriff → Definition oder Definition → Begriff.' }),
        h('li', { text: 'Im Quiz stehen kuratierte Prüfungsfragen und automatisch aus dem Lexikon erzeugte Fragen zur Wahl. Zu jeder kuratierten Frage wird nach der Antwort das Belegzitat mit Kapitel und Seite des Referenzhandbuchs angezeigt.' }),
        h('li', { text: 'Generierte Fragen entstehen maschinell aus den erfassten Daten. Bei Zweifeln gilt der verlinkte Originaltext.' })
      ]),

      h('h2', { text: 'Gewährleistung' }),
      h('p', { text: 'Diese Lernhilfe steht in keiner Verbindung zur Schweizerischen Bundesverwaltung oder zum HERMES-Fachausschuss. '
        + 'Für Richtigkeit und Vollständigkeit der wiedergegebenen Inhalte wird keine Gewähr übernommen; prüfungsrelevant ist die offizielle Dokumentation.' })
    ]);

    behaelter.appendChild(prosa);
  }

  HT.views.ueber = { titel: 'Über', render: renderUeber };
}(window));
