/* meinHERMES — Ansicht «Über». */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;

  function extern(url, text) {
    return h('a', { href: url, target: '_blank', rel: 'noopener' }, text + ' ↗');
  }

  /* --- Gespeicherte Daten: Export, Import, Löschen ------------------------- */

  var MAX_IMPORT = 5 * 1024 * 1024;       // mehr fasst localStorage ohnehin nicht

  function zweistellig(n) { return (n < 10 ? '0' : '') + n; }

  function exportieren() {
    var d = new Date();
    var name = 'meinHERMES-' + d.getFullYear() + '-' + zweistellig(d.getMonth() + 1) + '-' + zweistellig(d.getDate()) + '.json';
    var text = JSON.stringify(HT.store.exportieren(), null, 2);
    var url = global.URL.createObjectURL(new global.Blob([text], { type: 'application/json' }));
    var a = h('a', { href: url, download: name, hidden: true });
    document.body.appendChild(a);
    a.click();
    a.remove();
    global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 1000);
  }

  function knopf(text, klasse, aktion, aus) {
    return h('button', {
      type: 'button', class: 'btn btn--klein' + (klasse ? ' ' + klasse : ''), text: text, disabled: !!aus,
      on: { click: aktion }
    });
  }

  function datenBereich(importiert) {
    var aus = !HT.store.verfuegbar;
    var vorschau = h('div', { class: 'import', hidden: true, 'aria-live': 'polite' });
    var auswahl = h('input', { type: 'file', accept: '.json,application/json', hidden: true });

    function schliessen() {
      HT.ui.leeren(vorschau);
      vorschau.hidden = true;
    }

    function zeigen(kinder) {
      HT.ui.leeren(vorschau);
      kinder.forEach(function (k) { if (k) { vorschau.appendChild(k); } });
      vorschau.hidden = false;
    }

    function meldung(text, fehler) {
      zeigen([
        h('p', { class: 'import__meldung' + (fehler ? ' import__meldung--fehler' : ''), text: text }),
        h('div', { class: 'btn-reihe' }, [knopf('Schliessen', '', schliessen)])
      ]);
    }

    function vorschauZeigen(pruefung) {
      if (!pruefung.ok) { meldung(pruefung.fehler, true); return; }
      var n = pruefung.uebergangen;
      zeigen([
        h('p', { class: 'import__meldung' }, [
          h('b', { text: 'Exportiert' + (pruefung.exportiert
            ? ' am ' + pruefung.exportiert.toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' })
            : '') }),
          ': ' + (pruefung.mengen.length ? pruefung.mengen.join(' · ') : 'nur Einstellungen') + '.'
        ]),
        n ? h('p', { class: 'trefferzahl', text: n === 1
          ? 'Einen Eintrag kennt diese Fassung der Seite nicht; er wird übergangen.'
          : n + ' Einträge kennt diese Fassung der Seite nicht; sie werden übergangen.' }) : null,
        h('p', { text: '«Ersetzen» überschreibt Lernstand, Markierungen und Einstellungen in diesem Browser mit dem Stand der Datei. '
          + 'Filter und offene Bereiche bleiben, wie sie sind.' }),
        h('div', { class: 'btn-reihe' }, [
          knopf('Ersetzen', 'btn--primaer', function () {
            if (!HT.store.importErsetzen(pruefung.daten)) {
              meldung('Der Import ist fehlgeschlagen, der bisherige Stand bleibt. Vermutlich ist der Speicher des Browsers voll.', true);
              return;
            }
            global.history.replaceState(null, '', global.location.hash.split('?')[0] + '?importiert=1');
            global.location.reload();
          }),
          knopf('Abbrechen', '', schliessen)
        ])
      ]);
    }

    auswahl.addEventListener('change', function () {
      var datei = auswahl.files && auswahl.files[0];
      auswahl.value = '';                   // dieselbe Datei nochmals wählbar
      if (!datei) { return; }
      if (datei.size > MAX_IMPORT) { meldung('Die Datei ist zu gross für einen Export von meinHERMES.', true); return; }
      var leser = new global.FileReader();
      leser.onload = function () { vorschauZeigen(HT.store.importPruefen(String(leser.result))); };
      leser.onerror = function () { meldung('Die Datei liess sich nicht lesen.', true); };
      leser.readAsText(datei);
    });

    if (importiert) { meldung('Import abgeschlossen: in diesem Browser gilt jetzt der Stand aus der Datei.'); }

    return h('div', { class: 'hinweisbox' }, [
      h('p', { text: 'Lernfortschritt, Markierungen, Filtereinstellungen und Quiz-Statistik liegen ausschliesslich lokal im Speicher dieses Browsers '
        + '(localStorage). Es werden keine Daten an einen Server übermittelt, es gibt keine Konten, kein Tracking und keine Cookies von Dritten. '
        + 'Wer den Browserspeicher leert, beginnt wieder bei null.' }),
      h('p', { text: 'Für ein anderes Gerät oder als Sicherung: «Exportieren» legt Lernstand, Markierungen und Einstellungen als Datei ab, '
        + '«Importieren» liest sie in einem anderen Browser wieder ein und ersetzt dort den bisherigen Stand. '
        + 'Die Datei entsteht auf dem eigenen Gerät und wird nirgends hin übermittelt.' }),
      h('p', {
        class: 'trefferzahl',
        text: HT.store.verfuegbar
          ? 'Status: lokale Speicherung ist in diesem Browser verfügbar.'
          : 'Status: dieser Browser erlaubt keine lokale Speicherung — der Fortschritt gilt nur für die laufende Sitzung.'
      }),
      h('div', { class: 'btn-reihe' }, [
        knopf('Exportieren', '', exportieren, aus),
        knopf('Importieren …', '', function () { auswahl.click(); }, aus),
        knopf('Alle lokal gespeicherten Daten löschen', '', function () {
          if (!global.confirm('Lernfortschritt, Markierungen, Filter und Quiz-Statistik wirklich löschen?')) { return; }
          HT.store.loescheAlle();
          global.location.reload();
        })
      ]),
      auswahl,
      vorschau
    ]);
  }

  function renderUeber(behaelter, params) {
    var importiert = !!(params && params.importiert);
    var daten = datenBereich(importiert);
    var prosa = h('div', { class: 'prosa' }, [
      h('div', { class: 'kopf' }, [
        h('h1', { text: 'Über meinHERMES' })
      ]),

      h('p', { text: 'meinHERMES ist eine private, inoffizielle Lernhilfe zur Vorbereitung auf die HERMES-2022-Prüfung. '
        + 'Die Seite zeigt die Methodenelemente als Graph mit ihren Zusammenhängen und zeigt das Referenzhandbuch in seiner Gliederung — '
        + 'und verweist bei jedem Eintrag, jeder Lernkarte und jeder Quizfrage auf die Belegstelle im Referenzhandbuch und auf HERMES online.' }),

      h('h2', { text: 'Aufbau' }),
      h('ul', {}, [
        h('li', {}, [h('b', { text: 'Graph: ' }), 'die Methodenelemente und ihre Zusammenhänge: als Struktur (Szenarien, Module, Aufgaben, Ergebnisse, Rollen in Spalten), im Fokus (ein Element mit allen Verbindungen) und entlang der Phasen. Jede Verbindung entspricht einem Querverweis der offiziellen Dokumentation; Kategorien, Beziehungen und Filter lassen sich ein- und ausblenden.']),
        h('li', {}, [h('b', { text: 'Trainer: ' }), 'drei Übungsformen unter einem Dach. Zuordnen: Rollen, Aufgaben und Ergebnisse der klassischen oder der agilen Vorgehensweise — je Phase, je Modul oder alles —, je Aufgabe eine Zeile mit der verantwortlichen Rolle links und den erzeugten Ergebnissen rechts, alles in leeren Kästen; die Elemente liegen daneben bereit und werden an ihren Platz gezogen, die Prüfung bewertet die Zuordnung (nicht die Reihenfolge) und zeigt richtig, falsch und offen. Lernkarten: zu jeder Aufgabe und jedem Ergebnis der Zusammenhang — Phase, Modul, verantwortliche Rolle und die erzeugten Ergebnisse bzw. die Aufgaben, aus denen es entsteht. Je Bezug eine Zeile auf der Vorderseite, und gesucht sind alle Werte, die dort richtig sind (die meisten Elemente stehen in mehreren Phasen, die meisten Aufgaben erzeugen mehrere Ergebnisse) — ausser der agilen Phase Umsetzung neben anderen Phasen, die zeigt erst die Lösung; gewählt wird in einem Kombinationsfeld, in langen Listen mit Suche. Jede Wahl wird sofort geprüft, die erste falsche beendet die Zeile; die Rückseite zeigt die Lösung samt eigener Wahl und die Definition. Dazu die Grundbegriffe: Ihre Karten zeigen die Definition und fragen nur den Begriff ab. Ohne Wahl geht es auch: Karte drehen und selbst einschätzen. Quiz: kuratierte Prüfungsfragen mit Belegzitat aus dem Handbuch sowie automatisch aus den Elementkarten erzeugte Fragen. Fortschritt: die Methode als Raster wie in der Übersicht — Phasen als Spalten, Module als Zeilen —, in jedem Feld der Stand seiner Rollen, Aufgaben und Ergebnisse; gezählt wird beim Prüfen im Zuordnen und bei den Lernkarten, nach dreimal richtig gilt ein Element als verstanden. Der Lernstand bleibt lokal im Browser.']),
        h('li', {}, [h('b', { text: 'Handbuch: ' }), 'das Referenzhandbuch Projektmanagement (PDF) 1:1 als Text, Kapitel für Kapitel in seiner Gliederung (Vorwort, Methodenüberblick, Methodenelemente, Phasen, Szenarien, Module, Ergebnisse, Aufgaben, Rollen, Hinweise zur Anwendung, Vokabular) mit den Kapitelnummern und Seitenzahlen des PDF; die Elemente stehen als Karten an ihrer Stelle im Text, jede mit Link auf HERMES online und auf die Seite im PDF. Nicht übernommen sind Inhalts-, Tabellen- und Abbildungsverzeichnis sowie der Index.']),
        h('li', {}, [h('b', { text: 'Markieren: ' }), 'Wörter und Sätze im Überblick und im Handbuch auswählen und gelb hervorheben; ein Klick auf die Markierung nimmt sie wieder weg. Alles bleibt in diesem Browser.'])
      ]),

      h('h2', { text: 'Quelle der Inhalte' }),
      h('p', {}, [
        'HERMES ist die Projektmanagementmethode der Schweizerischen Bundesverwaltung und ein offener Standard (eCH-0054). ',
        'Die Seite «Handbuch» gibt das ',
        extern('https://www.hermes.admin.ch/_Resources/Persistent/c/7/1/6/c7166cbb014fffc5a7ebb4697ba59ef63edb0de3/HERMES-Projektmanagement.pdf', 'Referenzhandbuch Projektmanagement, Ausgabe 2022, 3. Auflage vom 9. März 2026 (PDF)'),
        ' als Text wieder — mit seinen Kapitelnummern und Seitenzahlen; die Abbildungen stammen von ',
        extern('https://www.hermes.admin.ch/de/projektmanagement.html', 'HERMES online'),
        ' (gemäss Impressum die führende, für die Zertifizierung massgebliche Quelle), von dort kommen auch die Handbuchtexte der Karten im Überblick. Kurzfassungen und Quizfragen sind eigene, an diesem Wortlaut geprüfte Texte.'
      ]),
      h('p', { text: 'Die Urheberrechte an der HERMES-Dokumentation liegen bei der Schweizerischen Eidgenossenschaft (Bundeskanzlei, Digitale Transformation und IKT-Lenkung). '
        + 'Die Wiedergabe dient ausschliesslich dem Lernen; massgebend bleibt in jedem Fall die offizielle Dokumentation.' }),

      h('h2', { text: 'Unterstützen' }),
      h('p', {}, [
        'meinHERMES ist kostenlos und ohne Werbung. Wer die Seite nützlich findet, kann die Arbeit daran mit einem Kaffee unterstützen: ',
        extern('https://ko-fi.com/rrradio', 'Ko-fi'),
        '.'
      ]),
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
      daten,

      h('h2', { text: 'Hinweise zur Nutzung' }),
      h('ul', {}, [
        h('li', { text: 'Im Graph: Klick auf einen Knoten zeigt Details und hebt die Nachbarn hervor, Doppelklick stellt ihn in den Fokus; Ziehen verschiebt, Mausrad oder zwei Finger zoomen. Grosse Gruppen sind auf zwölf Einträge gekappt («+ n weitere anzeigen»).' }),
        h('li', { text: 'Die Suche in der Kopfzeile findet jedes Element; im Überblick steht rechts daneben der Filter für Abbildung und Graph. Die Leiste unter der Kopfzeile wählt im Handbuch das Kapitel und im Überblick, was Abbildung und Graph zeigen.' }),
        h('li', { text: 'Im Trainer wählt die Leiste unter der Kopfzeile die Übungsform. Bei den Lernkarten lässt sich die Vorderseite umschalten: Begriff oder Definition — bei «Definition» wird der Begriff selbst mit abgefragt.' }),
        h('li', { text: 'Im Quiz stehen kuratierte Prüfungsfragen und automatisch aus den Elementkarten erzeugte Fragen zur Wahl. Zu jeder kuratierten Frage wird nach der Antwort das Belegzitat mit Kapitel und Seite des Referenzhandbuchs angezeigt.' }),
        h('li', { text: 'Generierte Fragen entstehen maschinell aus den erfassten Daten. Bei Zweifeln gilt der verlinkte Originaltext.' })
      ]),

      h('h2', { text: 'Gewährleistung' }),
      h('p', { text: 'Diese Lernhilfe steht in keiner Verbindung zur Schweizerischen Bundesverwaltung oder zum HERMES-Fachausschuss. '
        + 'Für Richtigkeit und Vollständigkeit der wiedergegebenen Inhalte wird keine Gewähr übernommen; prüfungsrelevant ist die offizielle Dokumentation.' })
    ]);

    behaelter.appendChild(prosa);
    if (importiert) {
      /* Meldung nur einmal: beim nächsten Neuladen ohne Parameter. */
      global.history.replaceState(null, '', global.location.hash.split('?')[0]);
      daten.scrollIntoView({ block: 'center' });
    }
  }

  HT.views.ueber = { titel: 'Über', render: renderUeber };
}(window));
