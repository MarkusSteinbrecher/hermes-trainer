/* meinHERMES — Teil «Lernkarten» des Trainers (#/trainer?teil=lernkarten).
   Karten für Aufgaben und Ergebnisse. Worum es geht, ist der Zusammenhang
   von Phase, Modul, Aufgabe, Ergebnis und Rolle: vorn steht der Begriff
   (oder die Definition) und darunter je Bezug ein Dropdown — Phase, Modul,
   verantwortliche Rolle und das Gegenstück (die Ergebnisse einer Aufgabe
   bzw. die Aufgaben, aus denen ein Ergebnis entsteht). Jede Wahl wird
   sofort geprüft; ist die letzte beantwortet, dreht sich die Karte zur
   Lösung. Ohne Wahl geht es auch: Karte drehen und selbst einschätzen.
   «Nochmals» kehrt im Stapel zurück. Fortschritt liegt im localStorage und
   ist zurücksetzbar. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.trainerTeile = HT.trainerTeile || {};

  var h = HT.ui.h;
  var KATEGORIEN = ['aufgabe', 'ergebnis'];
  /* 1 (ohne Angabe): Begriff ↔ Definition für alle Kategorien — «Gewusst» galt nur der Definition
     2: Bezüge auf der Rückseite (Rolle, Ergebnisse/Aufgaben, Modul)
     3: Bezüge als Dropdown auf der Vorderseite, dazu die Phase */
  var VERSION = 3;

  /* Wie lange die Rückmeldung der letzten Wahl stehen bleibt, bevor sich
     die Karte von selbst dreht (ms). */
  var DREH_VERZUG = 550;

  var zustand = {
    initialisiert: false,
    richtung: 'bd',        // 'bd' = vorne Begriff, 'db' = vorne Definition
    filter: [],            // leer = Aufgaben und Ergebnisse
    fortschritt: {},       // id -> 'gewusst' | 'nochmals'
    stapel: [],            // offene Karten-IDs der laufenden Runde
    gedreht: false,
    antworten: {}          // Bezug-Schlüssel -> { wert, richtig } der laufenden Karte
  };

  var refs = {};
  var entstehtAus = null;  // Ergebnis-Begriff -> [Aufgaben-Begriffe]
  var pool = null;         // Kategorie -> Werteliste der Dropdowns

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

  /**
   * Die Bezüge einer Karte in der Reihenfolge der Methode: Phase, Modul,
   * verantwortliche Rolle, dann das Gegenstück. Nur Zeilen mit Werten —
   * das lässt die Sammeleinträge «Checklisten» und «Meilensteine» aussen vor.
   * [{ key, label, kategorie, werte }]
   */
  function bezuege(e) {
    var zeilen = [
      { key: 'phase', label: e.phasen.length === 1 ? 'Phase' : 'Phasen', kategorie: 'phase', werte: HT.daten.phasenSortiert(e.phasen) },
      { key: 'modul', label: e.module.length === 1 ? 'Modul' : 'Module', kategorie: 'modul', werte: e.module },
      { key: 'rolle', label: 'Verantwortlich', kategorie: 'rolle', werte: rollenVon(e) }
    ];
    if (e.kategorie === 'aufgabe') {
      zeilen.push({ key: 'ergebnis', label: e.ergebnisse.length === 1 ? 'Ergebnis' : 'Ergebnisse', kategorie: 'ergebnis', werte: e.ergebnisse });
    } else {
      zeilen.push({ key: 'aufgabe', label: 'Entsteht aus', kategorie: 'aufgabe', werte: aufgabenZu(e) });
    }
    return zeilen.filter(function (z) { return z.werte.length > 0; });
  }

  /** Was die Vorderseite abfragt: bei «Definition vorn» zuerst der Begriff selbst. */
  function fragen(e) {
    var vorweg = zustand.richtung === 'db'
      ? [{ key: 'begriff', label: 'Begriff', kategorie: e.kategorie, werte: [e.begriff] }]
      : [];
    return vorweg.concat(bezuege(e));
  }

  /**
   * Die Auswahl eines Dropdowns: alle Werte, die auf irgendeiner Karte
   * richtig sein können — nicht alle Einträge der Kategorie. So ist jede
   * Option eine mögliche Antwort (bei den Rollen etwa nur die neun, die
   * überhaupt verantwortlich zeichnen).
   */
  function poolVon(kategorie) {
    if (!pool) {
      pool = {};
      var gesehen = {};
      var merken = function (kat, werte) {
        if (!pool[kat]) { pool[kat] = []; gesehen[kat] = {}; }
        werte.forEach(function (w) {
          if (gesehen[kat][w]) { return; }
          gesehen[kat][w] = true;
          pool[kat].push(w);
        });
      };
      KATEGORIEN.forEach(function (kat) {
        kartenDerKategorie(kat).forEach(function (e) {
          merken(kat, [e.begriff]);
          bezuege(e).forEach(function (z) { merken(z.kategorie, z.werte); });
        });
      });
      Object.keys(pool).forEach(function (kat) {
        pool[kat] = kat === 'phase'
          ? HT.daten.phasenSortiert(pool[kat])
          : pool[kat].sort(function (a, b) { return a.localeCompare(b, 'de'); });
      });
    }
    return pool[kategorie] || [];
  }

  /* --- Stapel ------------------------------------------------------------- */

  /* Ohne Definition oder ohne Bezüge keine Karte. */
  function kartenDerKategorie(kat) {
    return HT.daten.eintraegeDerKategorie(kat).filter(function (e) {
      return !!e.definition && bezuege(e).length > 0;
    });
  }

  function auswahl() {
    var kats = zustand.filter.length ? zustand.filter : KATEGORIEN;
    return kats.reduce(function (alle, k) { return alle.concat(kartenDerKategorie(k)); }, []);
  }

  function neueKarte() {
    zustand.gedreht = false;
    zustand.antworten = {};
  }

  function stapelAufbauen(auchGewusste) {
    var karten = auswahl();
    var ids = karten
      .filter(function (e) { return auchGewusste || zustand.fortschritt[e.id] !== 'gewusst'; })
      .map(function (e) { return e.id; });
    zustand.stapel = HT.ui.mischen(ids);
    neueKarte();
  }

  function zaehlen() {
    var karten = auswahl();
    var gewusst = 0;
    karten.forEach(function (e) {
      if (zustand.fortschritt[e.id] === 'gewusst') { gewusst++; }
    });
    return { gesamt: karten.length, gewusst: gewusst, offen: zustand.stapel.length };
  }

  /** Stand der laufenden Karte über alle Dropdowns. */
  function auswertung(e) {
    var alle = fragen(e);
    var beantwortet = 0;
    var richtig = 0;
    alle.forEach(function (z) {
      var a = zustand.antworten[z.key];
      if (!a) { return; }
      beantwortet++;
      if (a.richtig) { richtig++; }
    });
    return {
      gesamt: alle.length,
      beantwortet: beantwortet,
      richtig: richtig,
      fertig: beantwortet === alle.length
    };
  }

  /* --- Kartenaufbau ------------------------------------------------------- */

  function zeichenFuer(richtig) {
    return h('span', {
      class: 'lk-zeichen lk-zeichen--' + (richtig ? 'gut' : 'schlecht'),
      role: 'img',
      'aria-label': richtig ? 'richtig' : 'falsch',
      text: richtig ? '✓' : '✗'
    });
  }

  /** Eine Abfragezeile der Vorderseite: Bezeichnung, Dropdown, Zeichen. */
  function frageZeile(z, beiAntwort) {
    var zeichen = h('span', { class: 'lk-frage__zeichen', 'aria-hidden': 'true' });
    var wahl = h('select', { class: 'lk-frage__wahl' }, [
      h('option', { value: '', text: '– wählen –' })
    ].concat(poolVon(z.kategorie).map(function (w) {
      return h('option', { value: w, text: w });
    })));

    var zeile = h('label', { class: 'lk-frage', dataset: { stand: 'offen' } }, [
      h('span', { class: 'lk-frage__label' }, [
        HT.ui.katSymbol(z.kategorie, 14),
        h('span', { text: z.label })
      ]),
      wahl,
      zeichen
    ]);

    wahl.addEventListener('change', function () {
      var wert = wahl.value;
      if (!wert || zustand.antworten[z.key]) { return; }
      var richtig = z.werte.indexOf(wert) !== -1;
      zustand.antworten[z.key] = { wert: wert, richtig: richtig };
      wahl.disabled = true;
      zeile.dataset.stand = richtig ? 'richtig' : 'falsch';
      zeichen.textContent = richtig ? '✓' : '✗';
      beiAntwort();
    });

    return { el: zeile, wahl: wahl };
  }

  function seiteVorne(e, beiAntwort) {
    var istBegriff = zustand.richtung === 'bd';
    var waehler = [];

    var kopf = h('div', { class: 'flip__rolle' }, [
      h('span', { text: istBegriff ? 'Begriff' : 'Definition' }),
      ' · ',
      HT.ui.badge(e.kategorie)
    ]);

    var inhalt = h('div', {
      class: 'flip__inhalt' + (istBegriff ? '' : ' flip__inhalt--klein'),
      /* Beim Abfragen der Definition darf der gesuchte Begriff nicht darin stehen. */
      text: istBegriff ? e.begriff : HT.ui.ohneBegriff(e.definition, e.begriff)
    });

    var liste = h('div', { class: 'lk-fragen' }, fragen(e).map(function (z) {
      var zeile = frageZeile(z, beiAntwort);
      waehler.push(zeile.wahl);
      return zeile.el;
    }));

    var seite = h('div', {
      class: 'flip__seite flip__seite--vorne',
      tabindex: '-1',
      'aria-hidden': 'false'
    }, [kopf, inhalt, h('p', { class: 'lk-auftrag', text: 'Zuordnen — jede Wahl wird sofort geprüft:' }), liste]);

    return { el: seite, waehler: waehler };
  }

  /** Eine Bezugszeile der Lösung: alle richtigen Werte, dazu die eigene Wahl. */
  function loesungZeile(z) {
    var a = zustand.antworten[z.key];
    var werte = z.werte.map(function (w) {
      return h('li', { class: (a && a.richtig && a.wert === w) ? 'ist-gewaehlt' : null }, [
        HT.ui.katSymbol(z.kategorie, 14),
        h('span', { text: w })
      ]);
    });
    if (a && !a.richtig) {
      werte.push(h('li', { class: 'ist-falsch' }, [
        HT.ui.katSymbol(z.kategorie, 14),
        h('span', { text: a.wert })
      ]));
    }
    return h('div', { class: 'lk-bezug' }, [
      h('dt', {}, [a ? zeichenFuer(a.richtig) : null, h('span', { text: z.label })]),
      h('dd', {}, [h('ul', { class: 'lk-werte' }, werte)])
    ]);
  }

  /** Inhalt der Rückseite; er entsteht erst beim Drehen, mit den Zeichen der eigenen Wahl. */
  function hintenFuellen(el, e) {
    var st = auswertung(e);
    var begriffAntwort = zustand.antworten.begriff;

    /* Wer die Karte vor der letzten Wahl dreht, soll die offenen Zuordnungen
       nicht als Fehler gezählt sehen. */
    var bilanz = !st.beantwortet
      ? h('span', { text: 'ohne Zuordnung' })
      : h('span', {
        class: st.richtig === st.beantwortet ? 'tag-gut' : 'tag-schlecht',
        text: st.fertig
          ? st.richtig + ' von ' + st.gesamt + ' richtig'
          : st.richtig + ' von ' + st.beantwortet + ' richtig, ' + (st.gesamt - st.beantwortet) + ' offen'
      });

    el.appendChild(h('div', { class: 'flip__rolle' }, [
      h('span', { text: 'Lösung' }),
      ' · ',
      bilanz,
      ' · ',
      HT.ui.badge(e.kategorie)
    ]));

    el.appendChild(h('div', { class: 'flip__inhalt' }, [
      begriffAntwort ? zeichenFuer(begriffAntwort.richtig) : null,
      h('span', { text: e.begriff })
    ]));
    if (begriffAntwort && !begriffAntwort.richtig) {
      el.appendChild(h('p', { class: 'lk-gewaehlt', text: 'Gewählt: ' + begriffAntwort.wert }));
    }

    el.appendChild(h('dl', { class: 'lk-bezuege' }, bezuege(e).map(loesungZeile)));
    el.appendChild(h('div', { class: 'flip__inhalt flip__inhalt--klein', text: e.definition }));

    var quelle = HT.ui.quellenLink(e.quelle);
    if (quelle) {
      el.appendChild(h('div', { class: 'flip__hinweis' }, quelle));
    }
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

    var stand = h('p', { class: 'lk-stand', role: 'status' });
    var vorne = seiteVorne(e, function () { antwortGezaehlt(); });
    var hinten = h('div', { class: 'flip__seite flip__seite--hinten', 'aria-hidden': 'true' });
    var flip = h('div', { class: 'flip' }, [vorne.el, hinten]);

    var drehKnopf = h('button', {
      type: 'button', class: 'btn lk-drehen', text: 'Lösung zeigen'
    });
    var gewusstBtn = h('button', {
      type: 'button', class: 'btn btn--gut', text: 'Gewusst', disabled: true
    });
    var nochmalsBtn = h('button', {
      type: 'button', class: 'btn btn--schlecht', text: 'Nochmals', disabled: true
    });

    function standSetzen() {
      var s = auswertung(e);
      if (!s.beantwortet) {
        stand.textContent = s.gesamt + ' ' + (s.gesamt === 1 ? 'Zuordnung' : 'Zuordnungen') + ' offen';
      } else if (!s.fertig) {
        stand.textContent = s.beantwortet + ' von ' + s.gesamt + ' zugeordnet, ' + s.richtig + ' richtig';
      } else {
        stand.textContent = s.richtig === s.gesamt
          ? 'Alle ' + s.gesamt + ' Zuordnungen richtig'
          : s.richtig + ' von ' + s.gesamt + ' richtig';
      }
    }

    function drehen() {
      if (zustand.gedreht) { return; }
      zustand.gedreht = true;
      hintenFuellen(hinten, e);
      flip.classList.add('ist-gedreht');
      vorne.el.setAttribute('aria-hidden', 'true');
      hinten.setAttribute('aria-hidden', 'false');
      /* Hinter der Rückseite darf nichts mehr zu bedienen sein; wie viel
         richtig war, sagt jetzt der Kopf der Lösung. */
      vorne.waehler.forEach(function (w) { w.disabled = true; });
      stand.hidden = true;
      drehKnopf.hidden = true;
      gewusstBtn.disabled = false;
      nochmalsBtn.disabled = false;
      var s = auswertung(e);
      (s.beantwortet && s.richtig < s.gesamt ? nochmalsBtn : gewusstBtn).focus();
    }

    /* Fortschritt (js/fortschritt.js): Hat die Karte Phase und Modul richtig
       zugeordnet und steht das Element in diesem Feld wirklich, zählt das
       Feld eine richtige Antwort. Falsche Wahlen melden nichts — eine Karte
       sagt nicht, in welchem Feld es gehakt hat. */
    function fortschrittMelden() {
      if (!HT.fortschritt) { return; }
      var p = zustand.antworten.phase, m = zustand.antworten.modul;
      if (!p || !p.richtig || !m || !m.richtig) { return; }
      if (HT.daten.phasenImModul(e, m.wert).indexOf(p.wert) === -1) { return; }
      HT.fortschritt.melden([{ phase: p.wert, modul: m.wert, id: e.id, richtig: true }]);
    }

    /* Ist die letzte Zuordnung getroffen, dreht sich die Karte von selbst —
       kurz danach, damit das Zeichen der letzten Wahl noch zu sehen ist. */
    function antwortGezaehlt() {
      standSetzen();
      if (!auswertung(e).fertig || zustand.gedreht) { return; }
      fortschrittMelden();
      global.setTimeout(function () {
        if (zustand.stapel[0] === e.id) { drehen(); }
      }, DREH_VERZUG);
    }

    drehKnopf.addEventListener('click', drehen);
    gewusstBtn.addEventListener('click', function () { bewerten('gewusst'); });
    nochmalsBtn.addEventListener('click', function () { bewerten('nochmals'); });

    standSetzen();
    bereich.appendChild(h('div', { class: 'flip-wrap' }, flip));
    bereich.appendChild(stand);
    bereich.appendChild(drehKnopf);
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
    neueKarte();
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
      /* Die Karte selbst, nicht das erste Dropdown: ein versehentlicher
         Tastendruck soll keine Zuordnung setzen. */
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
      neueKarte();
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
          h('p', { text: 'Aufgaben und Ergebnisse und ihr Zusammenhang: In welcher Phase, in welchem Modul, wer ist '
            + 'verantwortlich, was entsteht woraus? Je Bezug ein Dropdown auf der Vorderseite — jede Wahl wird sofort '
            + 'geprüft, nach der letzten dreht sich die Karte zur Lösung.' }),
          h('p', { text: 'Ohne Wahl geht es auch: Karte drehen und selbst einschätzen. Was «Nochmals» erhält, kehrt im '
            + 'Stapel zurück. Zur Auswahl stehen nur Werte, die auf irgendeiner Karte richtig sind.' })
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
