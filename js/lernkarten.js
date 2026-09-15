/* meinHERMES — Teil «Lernkarten» des Trainers (#/trainer?teil=lernkarten).
   Karten für Aufgaben und Ergebnisse: vorne der Begriff oder die Definition,
   hinten die Beziehungen — verantwortliche Rolle, die Ergebnisse der Aufgabe
   bzw. die Aufgaben, aus denen das Ergebnis entsteht, das Modul — und die
   Definition. Karte drehen, selbst einschätzen; «Nochmals» kehrt im Stapel
   zurück. Fortschritt liegt im localStorage und ist zurücksetzbar. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.trainerTeile = HT.trainerTeile || {};

  var h = HT.ui.h;
  var KATEGORIEN = ['aufgabe', 'ergebnis'];
  var VERSION = 2;         // 1 (ohne Angabe): Begriff ↔ Definition für alle Kategorien — «Gewusst» galt nur der Definition

  /* Was die Vorderseite abfragt; die Rückseite zeigt nur Zeilen mit Werten. */
  var GESUCHT = {
    aufgabe: ['Verantwortlich', 'Ergebnisse', 'Modul'],
    ergebnis: ['Verantwortlich', 'Aufgaben', 'Modul']
  };

  var zustand = {
    initialisiert: false,
    richtung: 'bd',        // 'bd' = vorne Begriff, 'db' = vorne Definition
    filter: [],            // leer = Aufgaben und Ergebnisse
    fortschritt: {},       // id -> 'gewusst' | 'nochmals'
    stapel: [],            // offene Karten-IDs der laufenden Runde
    gedreht: false
  };

  var refs = {};
  var entstehtAus = null;  // Ergebnis-Begriff -> [Aufgaben-Begriffe]

  /* --- Persistenz --------------------------------------------------------- */

  function speichern() {
    HT.store.schreib('lernkarten', {
      version: VERSION,
      richtung: zustand.richtung,
      filter: zustand.filter,
      fortschritt: zustand.fortschritt
    });
  }

  function wiederherstellen() {
    var g = HT.store.lies('lernkarten', null);
    if (g && typeof g === 'object') {
      zustand.richtung = (g.richtung === 'db') ? 'db' : 'bd';
      zustand.filter = Array.isArray(g.filter)
        ? g.filter.filter(function (k) { return KATEGORIEN.indexOf(k) !== -1; })
        : [];
      zustand.fortschritt = (g.version === VERSION && g.fortschritt && typeof g.fortschritt === 'object')
        ? g.fortschritt
        : {};
    }
  }

  /* --- Beziehungen -------------------------------------------------------- */

  function rollenVon(e) {
    return e.verantwortlich
      ? e.verantwortlich.split(',').map(function (r) { return r.trim(); }).filter(function (r) { return !!r; })
      : [];
  }

  function aufgabenZu(ergebnis) {
    if (!entstehtAus) {
      entstehtAus = {};
      HT.daten.eintraegeDerKategorie('aufgabe').forEach(function (a) {
        a.ergebnisse.forEach(function (name) {
          (entstehtAus[name] = entstehtAus[name] || []).push(a.begriff);
        });
      });
    }
    return entstehtAus[ergebnis.begriff] || [];
  }

  /** Zeilen der Lösung: [{ label, kategorie, werte }], nur solche mit Werten. */
  function bezuege(e) {
    var zeilen = [{ label: 'Verantwortlich', kategorie: 'rolle', werte: rollenVon(e) }];
    if (e.kategorie === 'aufgabe') {
      zeilen.push({ label: e.ergebnisse.length === 1 ? 'Ergebnis' : 'Ergebnisse', kategorie: 'ergebnis', werte: e.ergebnisse });
    } else {
      zeilen.push({ label: 'Entsteht aus', kategorie: 'aufgabe', werte: aufgabenZu(e) });
    }
    zeilen.push({ label: e.module.length === 1 ? 'Modul' : 'Module', kategorie: 'modul', werte: e.module });
    return zeilen.filter(function (z) { return z.werte.length > 0; });
  }

  /* --- Stapel ------------------------------------------------------------- */

  /* Ohne Definition oder ohne Beziehungen keine Karte — das trifft die
     Sammeleinträge «Checklisten» und «Meilensteine». */
  function kartenDerKategorie(kat) {
    return HT.daten.eintraegeDerKategorie(kat).filter(function (e) {
      return !!e.definition && bezuege(e).length > 0;
    });
  }

  function auswahl() {
    var kats = zustand.filter.length ? zustand.filter : KATEGORIEN;
    return kats.reduce(function (alle, k) { return alle.concat(kartenDerKategorie(k)); }, []);
  }

  function stapelAufbauen(auchGewusste) {
    var karten = auswahl();
    var ids = karten
      .filter(function (e) { return auchGewusste || zustand.fortschritt[e.id] !== 'gewusst'; })
      .map(function (e) { return e.id; });
    zustand.stapel = HT.ui.mischen(ids);
    zustand.gedreht = false;
  }

  function zaehlen() {
    var karten = auswahl();
    var gewusst = 0;
    karten.forEach(function (e) {
      if (zustand.fortschritt[e.id] === 'gewusst') { gewusst++; }
    });
    return { gesamt: karten.length, gewusst: gewusst, offen: zustand.stapel.length };
  }

  /* --- Kartenaufbau ------------------------------------------------------- */

  function seiteVorne(e) {
    var istBegriff = zustand.richtung === 'bd';
    var gesucht = (istBegriff ? [] : ['Begriff']).concat(GESUCHT[e.kategorie]);
    return h('div', {
      class: 'flip__seite flip__seite--vorne',
      role: 'button',
      tabindex: '0',
      'aria-hidden': 'false',
      'aria-label': 'Karte umdrehen und Lösung anzeigen'
    }, [
      h('div', { class: 'flip__rolle' }, [
        h('span', { text: istBegriff ? 'Begriff' : 'Definition' }),
        ' · ',
        HT.ui.badge(e.kategorie)
      ]),
      h('div', {
        class: 'flip__inhalt' + (istBegriff ? '' : ' flip__inhalt--klein'),
        /* Beim Abfragen der Definition darf der gesuchte Begriff nicht darin stehen. */
        text: istBegriff ? e.begriff : HT.ui.ohneBegriff(e.definition, e.begriff)
      }),
      h('div', { class: 'flip__gesucht', text: 'Gesucht: ' + gesucht.join(' · ') }),
      h('div', { class: 'flip__tipp', text: 'Tippen oder Leertaste — Karte umdrehen' })
    ]);
  }

  function seiteHinten(e) {
    var kinder = [
      h('div', { class: 'flip__rolle' }, [
        h('span', { text: 'Lösung' }),
        ' · ',
        HT.ui.badge(e.kategorie)
      ]),
      h('div', { class: 'flip__inhalt', text: e.begriff }),
      h('dl', { class: 'lk-bezuege' }, bezuege(e).map(function (z) {
        return h('div', { class: 'lk-bezug' }, [
          h('dt', { text: z.label }),
          h('dd', {}, [
            h('ul', { class: 'lk-werte' }, z.werte.map(function (w) {
              return h('li', {}, [HT.ui.katSymbol(z.kategorie, 14), h('span', { text: w })]);
            }))
          ])
        ]);
      })),
      h('div', { class: 'flip__inhalt flip__inhalt--klein', text: e.definition })
    ];

    var quelle = HT.ui.quellenLink(e.quelle);
    if (quelle) {
      kinder.push(h('div', { class: 'flip__hinweis' }, quelle));
    }

    return h('div', {
      class: 'flip__seite flip__seite--hinten',
      'aria-hidden': 'true'
    }, kinder);
  }

  function kartenBereichAufbauen() {
    var bereich = h('div', {});
    var st = zaehlen();

    if (!st.gesamt) {
      bereich.appendChild(HT.ui.leerZustand(
        'Keine Karten im gewählten Umfang',
        HT.daten.alleEintraege().length
          ? 'Für die gewählten Kategorien gibt es keine Karten. Filter anpassen.'
          : 'Die Datendateien in data/ sind derzeit leer. Sobald Einträge erfasst sind, entstehen daraus Lernkarten.'
      ));
      return bereich;
    }

    if (!zustand.stapel.length) {
      bereich.appendChild(h('div', { class: 'box abschluss' }, [
        h('p', { class: 'abschluss__zahl', text: st.gewusst + ' / ' + st.gesamt }),
        h('p', { text: 'Stapel durchgearbeitet — alle Karten als «Gewusst» eingestuft.' }),
        h('div', { class: 'btn-reihe', style: 'justify-content:center' }, [
          h('button', {
            type: 'button', class: 'btn btn--primaer', text: 'Stapel neu mischen',
            on: { click: function () { stapelAufbauen(true); neuZeichnen(true); } }
          }),
          h('button', {
            type: 'button', class: 'btn', text: 'Fortschritt zurücksetzen',
            on: { click: zuruecksetzen }
          })
        ])
      ]));
      return bereich;
    }

    var e = HT.daten.eintragMitId(zustand.stapel[0]);
    if (!e) {                              // Datenlage hat sich geändert
      zustand.stapel.shift();
      return kartenBereichAufbauen();
    }

    var vorne = seiteVorne(e);
    var hinten = seiteHinten(e);
    var flip = h('div', { class: 'flip' }, [vorne, hinten]);

    var gewusstBtn = h('button', {
      type: 'button', class: 'btn btn--gut', text: 'Gewusst', disabled: true
    });
    var nochmalsBtn = h('button', {
      type: 'button', class: 'btn btn--schlecht', text: 'Nochmals', disabled: true
    });

    function drehen() {
      if (zustand.gedreht) { return; }
      zustand.gedreht = true;
      flip.classList.add('ist-gedreht');
      vorne.setAttribute('aria-hidden', 'true');
      vorne.setAttribute('tabindex', '-1');
      hinten.setAttribute('aria-hidden', 'false');
      gewusstBtn.disabled = false;
      nochmalsBtn.disabled = false;
      gewusstBtn.focus();
    }

    vorne.addEventListener('click', drehen);
    vorne.addEventListener('keydown', function (ev) {
      if (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'Spacebar') {
        ev.preventDefault();
        drehen();
      }
    });

    gewusstBtn.addEventListener('click', function () { bewerten('gewusst'); });
    nochmalsBtn.addEventListener('click', function () { bewerten('nochmals'); });

    bereich.appendChild(h('div', { class: 'flip-wrap' }, flip));
    bereich.appendChild(h('div', { class: 'lk-aktionen' }, [nochmalsBtn, gewusstBtn]));
    bereich.appendChild(h('p', {
      class: 'trefferzahl',
      text: 'Noch ' + zustand.stapel.length + ' ' + (zustand.stapel.length === 1 ? 'Karte' : 'Karten') + ' im Stapel'
    }));

    return bereich;
  }

  function bewerten(wert) {
    var id = zustand.stapel[0];
    if (!id) { return; }
    zustand.fortschritt[id] = wert;
    zustand.stapel.shift();
    if (wert === 'nochmals') { zustand.stapel.push(id); }
    zustand.gedreht = false;
    speichern();
    neuZeichnen(true);
  }

  function zuruecksetzen() {
    var etwasVorhanden = Object.keys(zustand.fortschritt).length > 0;
    if (etwasVorhanden && !global.confirm('Lernfortschritt wirklich zurücksetzen? Alle Einschätzungen gehen verloren.')) {
      return;
    }
    zustand.fortschritt = {};
    stapelAufbauen(true);
    speichern();
    neuZeichnen(true);
  }

  /* --- Fortschrittsanzeige ------------------------------------------------ */

  function fortschrittAufbauen() {
    var st = zaehlen();
    var anteil = HT.ui.prozent(st.gewusst, st.gesamt);
    var fuellung = h('div', { class: 'fortschritt__fuellung' });
    fuellung.style.width = anteil + '%';

    return h('div', { class: 'fortschritt' }, [
      h('div', { class: 'fortschritt__zeile' }, [
        h('span', { text: 'Gewusst ' + st.gewusst + ' / ' + st.gesamt }),
        h('span', { text: anteil + ' %' })
      ]),
      h('div', {
        class: 'fortschritt__balken',
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': String(anteil),
        'aria-label': 'Anteil gewusster Karten'
      }, fuellung)
    ]);
  }

  function neuZeichnen(fokusKarte) {
    if (!refs.spiel) { return; }
    HT.ui.leeren(refs.fortschritt).appendChild(fortschrittAufbauen());
    HT.ui.leeren(refs.spiel).appendChild(kartenBereichAufbauen());
    if (fokusKarte) {
      var vorne = refs.spiel.querySelector('.flip__seite--vorne');
      if (vorne) { vorne.focus(); }
    }
  }

  /* --- Steuerleiste ------------------------------------------------------- */

  function richtungsKnopf() {
    var btn = h('button', { type: 'button', class: 'btn btn--klein' });

    function beschriften() {
      var text = zustand.richtung === 'bd' ? 'Vorne: Begriff' : 'Vorne: Definition';
      btn.textContent = text;
      btn.setAttribute('aria-label', 'Vorderseite umschalten, aktuell ' + text);
      btn.setAttribute('title', 'Vorderseite umschalten: Begriff oder Definition');
    }

    btn.addEventListener('click', function () {
      zustand.richtung = zustand.richtung === 'bd' ? 'db' : 'bd';
      zustand.gedreht = false;
      beschriften();
      speichern();
      neuZeichnen(true);
    });

    beschriften();
    return btn;
  }

  function chipsAufbauen() {
    var liste = h('ul', { class: 'chips chips--streifen', 'aria-label': 'Kategorien filtern' });
    var knoepfe = [];

    function markieren() {
      knoepfe.forEach(function (b) {
        var kat = b.dataset.kat;
        var aktiv = kat === '' ? zustand.filter.length === 0 : zustand.filter.indexOf(kat) !== -1;
        b.setAttribute('aria-pressed', aktiv ? 'true' : 'false');
      });
    }

    function chip(key, label, anzahl) {
      var btn = h('button', {
        type: 'button', class: 'chip', 'aria-pressed': 'false', dataset: { kat: key }
      }, [
        key ? HT.ui.katSymbol(key, 15) : null,
        h('span', { text: label }),
        anzahl === null ? null : h('span', { class: 'chip__zahl', text: String(anzahl) })
      ]);
      btn.addEventListener('click', function () {
        if (key === '') {
          zustand.filter = [];
        } else {
          var i = zustand.filter.indexOf(key);
          if (i === -1) { zustand.filter.push(key); } else { zustand.filter.splice(i, 1); }
        }
        markieren();
        stapelAufbauen(false);
        speichern();
        neuZeichnen(false);
      });
      knoepfe.push(btn);
      liste.appendChild(h('li', {}, btn));
    }

    chip('', 'Alle', null);
    KATEGORIEN.forEach(function (key) {
      var anzahl = kartenDerKategorie(key).length;
      if (!anzahl) { return; }
      chip(key, HT.daten.kategorieMeta(key).label, anzahl);
    });

    markieren();
    return liste;
  }

  /* --- Render ------------------------------------------------------------- */

  function render(behaelter, params, leiste) {
    if (!zustand.initialisiert) {
      wiederherstellen();
      zustand.initialisiert = true;
    }
    if (params && params.kat && KATEGORIEN.indexOf(params.kat) !== -1) {
      zustand.filter = [params.kat];
    }
    stapelAufbauen(false);

    /* Was die Lernkarten sind, steht vorn in der Karte hinter dem Info-Icon der Leiste. */
    if (leiste) {
      leiste(null, function () {
        return [
          h('h3', { class: 'gpop__abschnitt', text: 'Lernkarten' }),
          h('p', { text: 'Aufgaben und Ergebnisse: Wer ist verantwortlich, was entsteht woraus, in welchem Modul? '
            + 'Karte umdrehen, selbst einschätzen. Was «Nochmals» erhält, kehrt im Stapel zurück.' })
        ];
      });
    }

    behaelter.appendChild(h('div', { class: 'lk-leiste' }, [
      richtungsKnopf(),
      h('button', {
        type: 'button', class: 'btn btn--klein', text: 'Zurücksetzen',
        'aria-label': 'Lernfortschritt zurücksetzen',
        on: { click: zuruecksetzen }
      })
    ]));

    behaelter.appendChild(chipsAufbauen());

    refs.fortschritt = h('div', {});
    refs.spiel = h('div', {});
    behaelter.appendChild(refs.fortschritt);
    behaelter.appendChild(refs.spiel);

    if (!HT.store.verfuegbar) {
      behaelter.appendChild(h('p', {
        class: 'trefferzahl',
        text: 'Hinweis: Dieser Browser erlaubt keine lokale Speicherung — der Fortschritt gilt nur für diese Sitzung.'
      }));
    }

    neuZeichnen(false);
  }

  HT.trainerTeile.lernkarten = {
    id: 'lernkarten',
    label: 'Lernkarten',
    pfade: ['M8 3h10a2 2 0 0 1 2 2v9', 'M5 7h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z'],
    render: render
  };
}(window));
