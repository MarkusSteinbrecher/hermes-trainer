/* HERMES-Trainer — Ansichten «Übersicht» und «Über». */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;

  var STANDARD_PHASEN = ['Initialisierung', 'Konzept', 'Realisierung', 'Einführung'];

  /* --- Phasenmodell ------------------------------------------------------- */

  function phasenKasten(name, nummer, definition, id) {
    var kinder = [
      h('span', { class: 'pm-phase__nr', text: 'Phase ' + nummer }),
      h('span', { class: 'pm-phase__name', text: name }),
      definition ? h('span', { class: 'pm-phase__def', text: HT.ui.kuerzen(definition, 72) }) : null
    ];
    if (id) {
      return h('a', {
        class: 'pm-phase',
        href: '#/lexikon?id=' + encodeURIComponent(id),
        title: name + ' im Lexikon anzeigen'
      }, kinder);
    }
    return h('div', { class: 'pm-phase' }, kinder);
  }

  var MS_MAX = 3;                  // mehr Meilensteine überfrachten die Grafik

  /* In der Grafik genügt der Name; die Raute zeigt bereits an, dass es ein
     Meilenstein ist. Der vollständige Wortlaut steht im Lexikon. */
  function meilensteinKurz(name) {
    return String(name || '').replace(/^Meilenstein\s+/i, '');
  }

  function verbinder(meilensteine, mitPfeil) {
    var kinder = [];
    var liste = meilensteine || [];
    liste.slice(0, MS_MAX).forEach(function (m) {
      kinder.push(h('span', { class: 'pm-meilenstein', title: m.name }, [
        h('span', { class: 'pm-raute', 'aria-hidden': 'true', text: '◆' }),
        h('span', { text: meilensteinKurz(m.name) })
      ]));
    });
    if (liste.length > MS_MAX) {
      kinder.push(h('span', {
        class: 'pm-meilenstein',
        text: '+ ' + (liste.length - MS_MAX) + ' weitere'
      }));
    }
    if (mitPfeil) {
      kinder.push(h('span', { class: 'pm-pfeil pm-pfeil--schmal', 'aria-hidden': 'true', text: '↓' }));
      kinder.push(h('span', { class: 'pm-pfeil pm-pfeil--breit', 'aria-hidden': 'true', text: '→' }));
    }
    if (!kinder.length) { return null; }
    return h('div', { class: 'pm-verbinder' }, kinder);
  }

  /* Die Grafik zeigt stets die vier Kernphasen; erfasste Daten werden
     eingesetzt, fehlende Phasen bleiben als leerer Kasten stehen. */
  function phasenmodell() {
    var erfasst = HT.daten.kernPhasen();
    var behaelter = h('div', { class: 'phasenmodell' });

    STANDARD_PHASEN.forEach(function (name, i) {
      var treffer = null;
      for (var j = 0; j < erfasst.length; j++) {
        if (HT.daten.normalisieren(erfasst[j].begriff) === HT.daten.normalisieren(name)) {
          treffer = erfasst[j];
          break;
        }
      }
      behaelter.appendChild(phasenKasten(
        treffer ? treffer.begriff : name,
        i + 1,
        treffer ? treffer.definition : '',
        treffer ? treffer.id : null
      ));
      var v = verbinder(treffer ? treffer.meilensteine : [], i < STANDARD_PHASEN.length - 1);
      if (v) { behaelter.appendChild(v); }
    });

    return behaelter;
  }

  /* --- Listen ------------------------------------------------------------- */

  function miniListe(kategorieKey) {
    var eintraege = HT.daten.alphabetisch(HT.daten.eintraegeDerKategorie(kategorieKey));
    if (!eintraege.length) { return null; }
    return h('ul', { class: 'mini-liste' }, eintraege.map(function (e) {
      return h('li', {}, h('a', {
        href: '#/lexikon?id=' + encodeURIComponent(e.id),
        title: e.definition ? HT.ui.kuerzen(e.definition, 120) : e.begriff
      }, e.begriff));
    }));
  }

  function abschnitt(titel, kategorieKey, leerText) {
    var liste = miniListe(kategorieKey);
    var anzahl = HT.daten.eintraegeDerKategorie(kategorieKey).length;
    return h('section', { class: 'abschnitt' }, [
      h('div', { class: 'abschnitt__kopf' }, [
        h('h2', { text: titel }),
        anzahl ? h('span', { class: 'abschnitt__zahl', text: anzahl + (anzahl === 1 ? ' Eintrag' : ' Einträge') }) : null
      ]),
      liste || h('p', { class: 'trefferzahl', text: leerText })
    ]);
  }

  function renderUebersicht(behaelter) {
    behaelter.appendChild(h('div', { class: 'kopf' }, [
      h('h1', { text: 'Übersicht' }),
      h('p', { text: 'Das Phasenmodell von HERMES 2022 mit den Meilensteinen sowie Module und Rollen auf einen Blick.' })
    ]));

    var warnung = HT.app.datenWarnung();
    if (warnung) { behaelter.appendChild(warnung); }

    var weitere = HT.daten.weiterePhasen();

    behaelter.appendChild(h('section', { class: 'abschnitt' }, [
      h('h2', { text: 'Phasenmodell' }),
      phasenmodell(),
      HT.daten.kernPhasen().length
        ? null
        : h('p', { class: 'trefferzahl', text: 'Die Phasendaten sind noch nicht erfasst; dargestellt ist das Grundgerüst der vier Phasen.' }),
      weitere.length
        ? h('div', {}, [
            h('p', { class: 'feldgruppe__titel', text: 'Weitere Phasen' }),
            h('ul', { class: 'mini-liste' }, weitere.map(function (p) {
              return h('li', {}, h('a', {
                href: '#/lexikon?id=' + encodeURIComponent(p.id),
                title: p.definition ? HT.ui.kuerzen(p.definition, 120) : p.begriff
              }, p.begriff));
            }))
          ])
        : null
    ]));

    behaelter.appendChild(abschnitt('Module', 'modul', 'Noch keine Module erfasst.'));
    behaelter.appendChild(abschnitt('Rollen', 'rolle', 'Noch keine Rollen erfasst.'));
    behaelter.appendChild(abschnitt('Szenarien', 'szenario', 'Noch keine Szenarien erfasst.'));

    behaelter.appendChild(h('div', { class: 'btn-reihe' }, [
      h('a', { class: 'btn', href: '#/lexikon', text: 'Zum Lexikon' }),
      h('a', { class: 'btn', href: '#/lernkarten', text: 'Lernkarten starten' })
    ]));
  }

  /* --- Über --------------------------------------------------------------- */

  function renderUeber(behaelter) {
    var prosa = h('div', { class: 'prosa' }, [
      h('div', { class: 'kopf' }, [
        h('h1', { text: 'Über den HERMES-Trainer' })
      ]),

      h('p', { text: 'Der HERMES-Trainer ist eine private, inoffizielle Lernhilfe zur Vorbereitung auf die HERMES-2022-Prüfung. '
        + 'Er ersetzt die offizielle Dokumentation nicht, sondern erschliesst sie: Jeder Eintrag im Lexikon, jede Lernkarte und jede Quizfrage '
        + 'verweist über den Link «HERMES online» auf die zugehörige Seite der offiziellen Methodenbeschreibung.' }),

      h('h2', { text: 'Quelle der Inhalte' }),
      h('p', { text: 'HERMES ist die Projektmanagementmethode der Schweizerischen Bundesverwaltung und ein offener Standard. '
        + 'Massgebend ist ausschliesslich die offizielle Darstellung:' }),
      h('ul', {}, [
        h('li', {}, h('a', {
          href: 'https://www.hermes.admin.ch/de/projektmanagement.html',
          target: '_blank', rel: 'noopener'
        }, 'Projektmanagement — Übersicht (hermes.admin.ch) ↗')),
        h('li', {}, h('a', {
          href: 'https://www.hermes.admin.ch/de/projektmanagement/phasen.html',
          target: '_blank', rel: 'noopener'
        }, 'Phasen ↗')),
        h('li', {}, h('a', {
          href: 'https://www.hermes.admin.ch/de/projektmanagement/szenarien.html',
          target: '_blank', rel: 'noopener'
        }, 'Szenarien ↗')),
        h('li', {}, h('a', {
          href: 'https://www.hermes.admin.ch/de/projektmanagement/module.html',
          target: '_blank', rel: 'noopener'
        }, 'Module ↗')),
        h('li', {}, h('a', {
          href: 'https://www.hermes.admin.ch/de/projektmanagement/aufgaben.html',
          target: '_blank', rel: 'noopener'
        }, 'Aufgaben ↗')),
        h('li', {}, h('a', {
          href: 'https://www.hermes.admin.ch/de/projektmanagement/ergebnisse.html',
          target: '_blank', rel: 'noopener'
        }, 'Ergebnisse ↗')),
        h('li', {}, h('a', {
          href: 'https://www.hermes.admin.ch/de/projektmanagement/rollen.html',
          target: '_blank', rel: 'noopener'
        }, 'Rollen ↗')),
        h('li', {}, h('a', {
          href: 'https://www.hermes.admin.ch/de/downloads.html',
          target: '_blank', rel: 'noopener'
        }, 'Downloads — Referenzhandbuch und weitere Unterlagen als PDF ↗'))
      ]),

      h('h2', { text: 'Gespeicherte Daten' }),
      h('div', { class: 'hinweisbox' }, [
        h('p', { text: 'Lernfortschritt, Filtereinstellungen und Quiz-Statistik liegen ausschliesslich lokal im Speicher dieses Browsers '
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
        h('li', { text: 'Im Lexikon lässt sich der Volltext aller Einträge durchsuchen; die Filterchips grenzen auf einzelne Kategorien ein.' }),
        h('li', { text: 'Bei den Lernkarten lässt sich die Abfragerichtung umschalten: Begriff → Definition oder Definition → Begriff.' }),
        h('li', { text: 'Im Quiz stehen kuratierte Prüfungsfragen und automatisch aus dem Lexikon erzeugte Fragen zur Wahl.' }),
        h('li', { text: 'Generierte Fragen entstehen maschinell aus den erfassten Daten. Bei Zweifeln gilt der verlinkte Originaltext.' })
      ]),

      h('h2', { text: 'Gewährleistung' }),
      h('p', { text: 'Diese Lernhilfe steht in keiner Verbindung zur Schweizerischen Bundesverwaltung oder zum HERMES-Fachausschuss. '
        + 'Für Richtigkeit und Vollständigkeit der wiedergegebenen Inhalte wird keine Gewähr übernommen; prüfungsrelevant ist die offizielle Dokumentation.' })
    ]);

    behaelter.appendChild(prosa);
  }

  HT.views.uebersicht = { titel: 'Übersicht', render: renderUebersicht };
  HT.views.ueber = { titel: 'Über', render: renderUeber };
}(window));
