/* HERMES-Trainer — Ansicht «Lernkarten».
   Karte drehen, selbst einschätzen; «Nochmals» kehrt im Stapel zurück.
   Fortschritt liegt im localStorage und ist zurücksetzbar. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;

  var zustand = {
    initialisiert: false,
    richtung: 'bd',        // 'bd' = Begriff → Definition, 'db' = Definition → Begriff
    filter: [],            // leer = alle Kategorien
    fortschritt: {},       // id -> 'gewusst' | 'nochmals'
    stapel: [],            // offene Karten-IDs der laufenden Runde
    gedreht: false
  };

  var refs = {};

  /* --- Persistenz --------------------------------------------------------- */

  function speichern() {
    HT.store.schreib('lernkarten', {
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
        ? g.filter.filter(function (k) { return !!HT.daten.kategorieMeta(k); })
        : [];
      zustand.fortschritt = (g.fortschritt && typeof g.fortschritt === 'object') ? g.fortschritt : {};
    }
  }

  /* --- Stapel ------------------------------------------------------------- */

  function auswahl() {
    var alle = HT.daten.alleEintraege().filter(function (e) {
      return !!e.definition;           // ohne Definition ist keine Karte möglich
    });
    if (!zustand.filter.length) { return alle; }
    return alle.filter(function (e) { return zustand.filter.indexOf(e.kategorie) !== -1; });
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
    return h('div', {
      class: 'flip__seite flip__seite--vorne',
      role: 'button',
      tabindex: '0',
      'aria-hidden': 'false',
      'aria-label': 'Karte umdrehen und Lösung anzeigen'
    }, [
      h('div', { class: 'flip__rolle', text: istBegriff ? 'Begriff' : 'Definition' }),
      h('div', {
        class: 'flip__inhalt' + (istBegriff ? '' : ' flip__inhalt--klein'),
        /* Beim Abfragen der Definition darf der gesuchte Begriff nicht darin stehen. */
        text: istBegriff ? e.begriff : HT.ui.ohneBegriff(e.definition, e.begriff)
      }),
      h('div', { class: 'flip__tipp', text: 'Tippen oder Leertaste — Karte umdrehen' })
    ]);
  }

  function seiteHinten(e) {
    var istBegriff = zustand.richtung === 'bd';
    var kinder = [
      h('div', { class: 'flip__rolle' }, [
        h('span', { text: istBegriff ? 'Definition' : 'Begriff' }),
        ' · ',
        HT.ui.badge(e.kategorie)
      ]),
      h('div', {
        class: 'flip__inhalt' + (istBegriff ? ' flip__inhalt--klein' : ''),
        text: istBegriff ? e.definition : e.begriff
      })
    ];

    if (istBegriff) {
      kinder.push(h('div', { class: 'flip__begriff', text: e.begriff }));
    } else {
      kinder.push(h('div', { class: 'flip__inhalt flip__inhalt--klein', text: e.definition }));
    }

    if (e.pruefungshinweis) {
      kinder.push(h('div', { class: 'flip__hinweis' }, [
        h('strong', { text: 'Prüfungshinweis: ' }),
        h('span', { text: e.pruefungshinweis })
      ]));
    }

    var quelle = HT.ui.quellenLink(e.quelle);
    if (quelle) {
      kinder.push(h('div', { class: e.pruefungshinweis ? '' : 'flip__hinweis' }, quelle));
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
          ? 'Für die gewählten Kategorien gibt es keine Einträge mit Definition. Filter anpassen.'
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
      var text = zustand.richtung === 'bd' ? 'Begriff → Definition' : 'Definition → Begriff';
      btn.textContent = text;
      btn.setAttribute('aria-label', 'Abfragerichtung umschalten, aktuell ' + text);
      btn.setAttribute('title', 'Abfragerichtung umschalten');
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
    HT.daten.kategorien().forEach(function (kat) {
      var anzahl = HT.daten.eintraegeDerKategorie(kat.key).length;
      if (!anzahl) { return; }
      chip(kat.key, kat.label, anzahl);
    });

    markieren();
    return liste;
  }

  /* --- Render ------------------------------------------------------------- */

  function render(behaelter, params) {
    if (!zustand.initialisiert) {
      wiederherstellen();
      zustand.initialisiert = true;
    }
    if (params && params.kat && HT.daten.kategorieMeta(params.kat)) {
      zustand.filter = [params.kat];
    }
    stapelAufbauen(false);

    behaelter.appendChild(h('div', { class: 'kopf' }, [
      h('h1', { text: 'Lernkarten' }),
      h('p', { text: 'Karte umdrehen, selbst einschätzen. Was «Nochmals» erhält, kehrt im Stapel zurück.' })
    ]));

    var warnung = HT.app.datenWarnung();
    if (warnung) { behaelter.appendChild(warnung); }

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

  HT.views.lernkarten = {
    titel: 'Lernkarten',
    render: render
  };
}(window));
