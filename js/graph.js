/* HERMES-Trainer — Ansicht «Graph».
   Der Graph zeigt drei Elemente in drei Spalten: Rolle → Aufgabe → Ergebnis.
   Phasen und Module sind keine Knoten, sondern die Auswahl: die Ansicht
   («Nach Phasen» oder «Nach Modulen») legt die Bahnen des Swimlane-Layouts
   fest, das jeweils andere Kriterium bleibt als zusätzlicher Filter. Steuerung: eine
   einzige Leiste über der Fläche (Ansicht, Auswahl, Werkzeuge) unter der
   Kopfzeile der Anwendung; Icon-Leiste für Elemente und Verbindungen auf
   der Fläche, alles Weitere als Popover. Ein Klick auf einen
   Knoten wählt ihn aus, hebt seine Verbindungen hervor und zeigt rechts die
   Lexikonkarte mit allen Querverweisen. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;

  /* Die Ansicht steht als Icon in der Leiste — dieselben Zeichen wie Phase
     und Modul im Lexikon; der Name steckt in aria-label und Titel. */
  var ANSICHTEN = [
    { key: 'phasen', label: 'Nach Phasen', ikone: 'phase', titel: 'Nach Phasen — Aufgaben nach Phasen gruppiert' },
    { key: 'module', label: 'Nach Modulen', ikone: 'modul', titel: 'Nach Modulen — Aufgaben nach Modulen gruppiert' }
  ];
  var VORGEHENSWEISEN = [
    { key: 'klassisch', label: 'Klassisch' },
    { key: 'agil', label: 'Agil' }
  ];

  var refs = {};
  var zeichner = null;
  var initialisiert = false;
  var zustand = standardZustand();

  function standardZustand() {
    var kategorien = {};
    HT.graph.KATEGORIEN.forEach(function (k) { kategorien[k.key] = true; });
    return {
      ansicht: 'phasen',
      umfang: { vorgehen: 'klassisch', phasen: ['Initialisierung'], module: [] },
      kategorien: kategorien,
      relationen: { verantwortlich: true, beteiligt: true, erzeugt: true, ergebnisrolle: false },
      auswahlId: null,
      pop: null,
      statusText: '',
      phasenstreifen: true,
      isolierteAusblenden: false,
      nurMinimal: false,
      nurEntscheide: false
    };
  }

  /* --- Zustand sichern und laden ------------------------------------------- */

  function speichern() {
    HT.store.schreib('graph', {
      ansicht: zustand.ansicht,
      umfang: zustand.umfang,
      kategorien: zustand.kategorien,
      relationen: zustand.relationen,
      phasenstreifen: zustand.phasenstreifen,
      isolierteAusblenden: zustand.isolierteAusblenden,
      nurMinimal: zustand.nurMinimal,
      nurEntscheide: zustand.nurEntscheide
    });
  }

  function wiederherstellen() {
    var g = HT.store.lies('graph', null);
    if (!g || typeof g !== 'object') { return; }
    if (ANSICHTEN.some(function (a) { return a.key === g.ansicht; })) { zustand.ansicht = g.ansicht; }
    if (g.umfang && typeof g.umfang === 'object') {
      var u = zustand.umfang;
      if (HT.graph.VORGEHEN[g.umfang.vorgehen]) { u.vorgehen = g.umfang.vorgehen; }
      ['phasen', 'module'].forEach(function (feld) {
        if (Array.isArray(g.umfang[feld])) {
          u[feld] = g.umfang[feld].filter(function (x) { return typeof x === 'string'; });
        }
      });
    }
    if (g.kategorien) {
      Object.keys(zustand.kategorien).forEach(function (k) {
        if (typeof g.kategorien[k] === 'boolean') { zustand.kategorien[k] = g.kategorien[k]; }
      });
    }
    if (g.relationen) {
      Object.keys(zustand.relationen).forEach(function (k) {
        if (typeof g.relationen[k] === 'boolean') { zustand.relationen[k] = g.relationen[k]; }
      });
    }
    ['phasenstreifen', 'isolierteAusblenden', 'nurMinimal', 'nurEntscheide'].forEach(function (k) {
      if (typeof g[k] === 'boolean') { zustand[k] = g[k]; }
    });
  }

  function urlSetzen() {
    var teile = ['ansicht=' + zustand.ansicht];
    if (zustand.umfang.vorgehen === 'agil') { teile.push('vorgehen=agil'); }
    if (zustand.umfang.phasen.length) { teile.push('phase=' + encodeURIComponent(zustand.umfang.phasen.join(','))); }
    if (zustand.umfang.module.length) { teile.push('modul=' + encodeURIComponent(zustand.umfang.module.join(','))); }
    if (zustand.auswahlId) { teile.push('id=' + encodeURIComponent(zustand.auswahlId)); }
    var neu = '#/graph?' + teile.join('&');
    if (global.location.hash !== neu) {
      try { global.history.replaceState(null, '', neu); } catch (e) { /* egal */ }
    }
  }

  /* --- Umfang ändern -------------------------------------------------------- */

  function modellZustand() {
    return {
      umfang: zustand.umfang,
      kategorien: zustand.kategorien,
      relationen: zustand.relationen,
      gruppierung: zustand.ansicht === 'phasen' ? 'phase' : 'modul',
      nurMinimal: zustand.nurMinimal,
      nurEntscheide: zustand.nurEntscheide,
      isolierteAusblenden: zustand.isolierteAusblenden
    };
  }

  function listeSchalten(feld, wert) {
    var l = zustand.umfang[feld];
    var i = l.indexOf(wert);
    if (i === -1) { l.push(wert); } else { l.splice(i, 1); }
    geaendert();
  }

  function geaendert(neuEinpassen) {
    speichern();
    alles(neuEinpassen !== false);
  }

  function ansichtSetzen(key) {
    if (zustand.ansicht === key) { return; }
    zustand.ansicht = key;
    popSchliessen();
    geaendert();
  }

  function vorgehenSetzen(key) {
    if (zustand.umfang.vorgehen === key) { return; }
    zustand.umfang.vorgehen = key;
    /* Phasennamen der anderen Vorgehensweise wären ohne Wirkung. */
    var gueltig = HT.graph.phasenDerVorgehensweise(key);
    zustand.umfang.phasen = zustand.umfang.phasen.filter(function (p) { return gueltig.indexOf(p) !== -1; });
    geaendert();
  }

  function auswaehlen(id) {
    zustand.auswahlId = id || null;
    detailZeigen(zustand.auswahlId);
    if (zeichner) { zeichner.hervorheben(zustand.auswahlId, true); }
    urlSetzen();
  }

  /** Doppelklick: auf das Modul des Elements einschränken. */
  function einschraenken(id) {
    var k = HT.graph.knoten(id);
    if (!k || !k.eintrag.module || !k.eintrag.module.length) { return; }
    zustand.umfang.module = [k.eintrag.module[0]];
    zustand.ansicht = 'module';
    zustand.auswahlId = id;
    geaendert();
  }

  function alleZuruecksetzen() {
    zustand.umfang.phasen = [];
    zustand.umfang.module = [];
    popSchliessen();
    geaendert();
  }

  /* --- Popover -------------------------------------------------------------- */

  function popOeffnen(key) {
    zustand.pop = zustand.pop === key ? null : key;
    popZeichnen();
  }

  function popSchliessen() {
    if (!zustand.pop) { return; }
    zustand.pop = null;
    popZeichnen();
  }

  /* Alle Popover an einer Stelle: Titel, Inhalt und der Knopf, der sie
     öffnet. */
  var POPS = {
    suche:       { titel: 'Element suchen', inhalt: function () { return sucheInhalt(); },       knopf: 'knopfSuche' },
    quer:        { titel: function () { return zustand.ansicht === 'phasen' ? 'Auf Module einschränken' : 'Auf Phasen einschränken'; },
                   inhalt: function () { return querInhalt(); },        knopf: 'knopfQuer' },
    szenario:    { titel: 'Szenario',       inhalt: function () { return szenarioInhalt(); },    knopf: 'knopfSzenario' },
    darstellung: { titel: 'Darstellung',    inhalt: function () { return darstellungInhalt(); }, knopf: 'knopfDarstellung' },
    legende:     { titel: 'Legende',        inhalt: function () { return legendeInhalt(); },     knopf: 'knopfLegende' }
  };

  function popAusloeser() {
    return Object.keys(POPS).map(function (k) { return refs[POPS[k].knopf]; });
  }

  function popZeichnen() {
    HT.ui.leeren(refs.pop);
    refs.pop.hidden = !zustand.pop;
    popAusloeser().forEach(function (b) {
      if (b) { b.setAttribute('aria-expanded', 'false'); }
    });
    if (!zustand.pop) { return; }

    var meta = POPS[zustand.pop] || POPS.legende;
    var knopf = refs[meta.knopf];
    var titel = typeof meta.titel === 'function' ? meta.titel() : meta.titel;
    if (knopf) { knopf.setAttribute('aria-expanded', 'true'); }

    refs.pop.appendChild(h('div', { class: 'gpop__kopf' }, [
      h('strong', { class: 'gpop__titel', text: titel }),
      h('button', { type: 'button', class: 'graph-schliessen', 'aria-label': titel + ' schliessen', text: '✕', on: { click: popSchliessen } })
    ]));
    refs.pop.appendChild(meta.inhalt());
    var erstes = refs.pop.querySelector('.gpop__inhalt input, .gpop__inhalt button, .gpop__inhalt a');
    if (erstes) { erstes.focus(); }
  }

  function popInhalt(kinder) {
    return h('div', { class: 'gpop__inhalt' }, kinder);
  }

  function sucheInhalt() {
    return popInhalt([refs.sucheFeld, refs.sucheListe]);
  }

  function chip(label, zahl, aktiv, beiKlick, klasse) {
    return h('button', {
      type: 'button', class: 'chip chip--auswahl' + (klasse ? ' ' + klasse : ''),
      'aria-pressed': aktiv ? 'true' : 'false',
      on: { click: beiKlick }
    }, [
      h('span', { text: label }),
      zahl === null || zahl === undefined ? null : h('span', { class: 'chip__zahl', text: String(zahl) })
    ]);
  }

  function querInhalt() {
    var istPhasen = zustand.ansicht === 'phasen';
    var liste = istPhasen
      ? HT.daten.eintraegeDerKategorie('modul').map(function (m) { return m.begriff; })
      : HT.graph.phasenDerVorgehensweise(zustand.umfang.vorgehen);
    var feld = istPhasen ? 'module' : 'phasen';
    var art = istPhasen ? 'modul' : 'phase';
    return popInhalt([
      h('p', { class: 'gpop__hinweis', text: istPhasen
        ? 'Zusätzlich zur Phasenauswahl: nur Aufgaben und Ergebnisse dieser Module zeigen.'
        : 'Zusätzlich zur Modulauswahl: nur Aufgaben und Ergebnisse dieser Phasen zeigen.' }),
      h('div', { class: 'chips chips--klein' }, liste.map(function (name) {
        return chip(name, HT.graph.beitrag(art, name, zustand.umfang), zustand.umfang[feld].indexOf(name) !== -1,
          function () { listeSchalten(feld, name); popZeichnen(); });
      }))
    ]);
  }

  function szenarioInhalt() {
    var aktuell = zustand.umfang.module;
    return popInhalt([
      h('p', { class: 'gpop__hinweis', text: 'Wählt die Module des Szenarios aus. Danach lässt sich die Auswahl von Hand ergänzen.' }),
      h('div', { class: 'gs-liste' }, HT.daten.eintraegeDerKategorie('szenario').map(function (s) {
        var gleich = s.module.length === aktuell.length && s.module.every(function (m) { return aktuell.indexOf(m) !== -1; });
        return h('button', {
          type: 'button', class: 'gs-beispiel', 'aria-pressed': gleich ? 'true' : 'false',
          on: { click: function () {
            zustand.umfang.module = s.module.slice();
            zustand.ansicht = 'module';
            popSchliessen();
            geaendert();
          } }
        }, [
          h('span', { class: 'gs-beispiel__titel', text: s.begriff }),
          h('span', { class: 'gs-beispiel__hinweis', text: s.module.length + ' Module' })
        ]);
      }))
    ]);
  }

  function schalter(label, aktiv, beiWechsel) {
    var kasten = h('input', { type: 'checkbox', class: 'gs-schalter__eingabe' });
    kasten.checked = !!aktiv;
    kasten.addEventListener('change', function () { beiWechsel(kasten.checked); });
    return h('label', { class: 'gs-schalter' }, [kasten, h('span', { class: 'gs-schalter__label', text: label })]);
  }

  function darstellungInhalt() {
    return popInhalt([
      h('div', { class: 'gs-liste' }, [
        schalter('Phasenstreifen im Knoten (I K R E U A)', zustand.phasenstreifen, function (v) { zustand.phasenstreifen = v; geaendert(false); popZeichnen(); }),
        schalter('Ergebnisse ohne erzeugende Aufgabe ausblenden', zustand.isolierteAusblenden, function (v) { zustand.isolierteAusblenden = v; geaendert(); popZeichnen(); }),
        schalter('Nur minimal geforderte Dokumente', zustand.nurMinimal, function (v) { zustand.nurMinimal = v; geaendert(); popZeichnen(); }),
        schalter('Nur Entscheidungsaufgaben', zustand.nurEntscheide, function (v) { zustand.nurEntscheide = v; geaendert(); popZeichnen(); })
      ])
    ]);
  }

  function legendeInhalt() {
    return popInhalt([
      h('p', { class: 'glegende__status', text: zustand.statusText || '' }),
      h('p', { class: 'gpop__hinweis', text: 'Der Graph zeigt immer dieselben drei Elemente: wer (Rolle) tut was (Aufgabe) und was dabei entsteht (Ergebnis). Phasen und Module wählen nur aus.' }),
      h('div', { class: 'glegende__gruppe' }, HT.graph.KATEGORIEN.map(function (m) {
        return h('span', { class: 'glegende__eintrag' }, [
          h('span', { class: 'gswatch gswatch--' + m.key, 'aria-hidden': 'true' }, HT.ui.katSymbol(m.key, 13)),
          h('span', { text: m.singular })
        ]);
      })),
      h('div', { class: 'glegende__gruppe' }, HT.graph.RELATIONEN.map(function (r) {
        return h('span', { class: 'glegende__eintrag' }, [
          h('span', { class: 'glinie glinie--' + r.stil, 'aria-hidden': 'true' }),
          h('span', { text: r.label })
        ]);
      })),
      h('div', { class: 'glegende__gruppe glegende__gruppe--typen' }, Object.keys(HT.graphZeichnen.TYP_SYMBOL).map(function (t) {
        return h('span', { class: 'glegende__eintrag' }, [
          h('span', { class: 'glegende__symbol', 'aria-hidden': 'true', text: HT.graphZeichnen.TYP_SYMBOL[t] }),
          h('span', { text: t })
        ]);
      })),
      h('p', { class: 'glegende__hinweis', text: 'Meilensteine sind Ergebnisse, stehen als Quality Gate aber im Sechseck mit Raute. Die sechs Kästchen am Knoten sind die Phasen I K R E U A. Jede Verbindung entspricht einem Querverweis in der offiziellen Dokumentation — es werden keine Beziehungen ergänzt.' })
    ]);
  }

  /* --- Werkzeug- und Auswahlleiste ------------------------------------------ */

  function segment(optionen, aktuell, beiWahl, label, klein) {
    return h('div', { class: 'segment' + (klein ? ' segment--klein' : ''), role: 'group', 'aria-label': label }, optionen.map(function (o) {
      return h('button', {
        type: 'button',
        class: 'segment__knopf' + (o.ikone ? ' segment__knopf--ikone' : ''),
        'aria-pressed': o.key === aktuell ? 'true' : 'false',
        'aria-label': o.ikone ? o.label : null,
        title: o.titel || null,
        dataset: { wert: o.key },
        text: o.ikone ? null : o.label,
        on: { click: function () { beiWahl(o.key); } }
      }, o.ikone ? HT.ui.katSymbol(o.ikone, 19) : null);
    }));
  }

  function werkzeugKnopf(klasse, beschriftung, symbolPfade, beiKlick) {
    return h('button', {
      type: 'button', class: 'graph-werkzeug ' + klasse, title: beschriftung, 'aria-label': beschriftung,
      'aria-expanded': 'false', 'aria-haspopup': 'dialog',
      on: { click: beiKlick }
    }, HT.ui.symbol(symbolPfade, 18));
  }

  /* Eine Leiste für den Graphen: links Ansicht und Auswahl, rechts die
     Werkzeuge. Alles, was nicht in eine Zeile passt — Suche, Darstellung,
     Legende, Umfang — liegt in Popovern. Die Hauptnavigation steht darüber
     in der Kopfzeile der Anwendung. */
  function leisteBauen() {
    refs.ansichtSegment = segment(ANSICHTEN, zustand.ansicht, ansichtSetzen, 'Ansicht');
    refs.ansichtSegment.classList.add('segment--ansicht');

    refs.sucheFeld = h('input', {
      type: 'search', class: 'suche__feld suche__feld--klein', placeholder: 'Element suchen …',
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Element suchen'
    });
    refs.sucheListe = h('ul', { class: 'gs-treffer', role: 'listbox', 'aria-label': 'Suchtreffer' });
    refs.sucheListe.hidden = true;
    var sucheTimer = null;
    refs.sucheFeld.addEventListener('input', function () {
      if (sucheTimer) { clearTimeout(sucheTimer); }
      sucheTimer = setTimeout(sucheAktualisieren, 120);
    });
    refs.sucheFeld.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        var erster = refs.sucheListe.querySelector('button');
        if (erster) { erster.click(); }
      } else if (ev.key === 'Escape') {
        refs.sucheFeld.value = '';
        sucheAktualisieren();
      }
    });

    /* Der Statustext («10 Rollen, 13 Aufgaben …») steht nicht mehr in der
       Leiste — sichtbar ist er in der Legende, hier bleibt er für
       Screenreader als Live-Bereich. */
    refs.status = h('p', { class: 'graph-status nur-sr', role: 'status', 'aria-live': 'polite' });

    refs.knopfSuche = werkzeugKnopf('graph-werkzeug--suche', 'Element suchen',
      ['M10.6 3.6a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z', 'M15.6 15.6 20.4 20.4'],
      function () { popOeffnen('suche'); });
    refs.knopfDarstellung = werkzeugKnopf('graph-werkzeug--darstellung', 'Darstellung',
      ['M4 7h10M18 7h2M4 17h4M12 17h8', 'M16 4.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z', 'M10 14.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z'],
      function () { popOeffnen('darstellung'); });
    refs.knopfLegende = werkzeugKnopf('graph-werkzeug--legende', 'Legende',
      ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 11v5.5', 'M12 7.6h.01'],
      function () { popOeffnen('legende'); });

    refs.zoom = h('div', { class: 'graph-zoom', role: 'group', 'aria-label': 'Zoom' }, [
      h('button', { type: 'button', class: 'graph-zoom__knopf graph-zoom__knopf--stufe', 'aria-label': 'Verkleinern', title: 'Verkleinern', text: '−', on: { click: function () { if (zeichner) { zeichner.zoomen(0.8); } } } }),
      h('button', { type: 'button', class: 'graph-zoom__knopf graph-zoom__knopf--stufe', 'aria-label': 'Vergrössern', title: 'Vergrössern', text: '+', on: { click: function () { if (zeichner) { zeichner.zoomen(1.25); } } } }),
      h('button', { type: 'button', class: 'graph-zoom__knopf graph-zoom__knopf--ikone', 'aria-label': 'Einpassen', title: 'Einpassen',
        on: { click: function () { if (zeichner) { zeichner.einpassen(); } } } },
        HT.ui.symbol(['M9.6 4.6H4.6v5', 'M14.4 4.6h5v5', 'M9.6 19.4h-5v-5', 'M14.4 19.4h5v-5'], 17))
    ]);

    /* Auswahl (früher eine eigene Leiste) */
    refs.vorgehenSegment = h('span', { class: 'gauswahl__vorgehen' });
    refs.knopfSzenario = h('button', {
      type: 'button', class: 'btn btn--klein gauswahl__szenario', 'aria-expanded': 'false', 'aria-haspopup': 'dialog',
      on: { click: function () { popOeffnen('szenario'); } }
    }, [h('span', { text: 'Szenario' }), h('span', { 'aria-hidden': 'true', text: ' ▾' })]);
    refs.chips = h('div', { class: 'chips chips--auswahl', role: 'group', 'aria-label': 'Auswahl' });
    refs.knopfQuer = h('button', {
      type: 'button', class: 'btn btn--klein gauswahl__quer', 'aria-expanded': 'false', 'aria-haspopup': 'dialog',
      on: { click: function () { popOeffnen('quer'); } }
    });
    refs.knopfReset = h('button', {
      type: 'button', class: 'gauswahl__reset', text: 'Zurücksetzen',
      on: { click: alleZuruecksetzen }
    });

    refs.werkzeugleiste = h('div', { class: 'graph-leiste' }, [
      refs.ansichtSegment,
      refs.vorgehenSegment,
      refs.knopfSzenario,
      refs.chips,
      refs.knopfQuer,
      refs.knopfReset,
      h('div', { class: 'graph-werkzeuge' }, [
        refs.knopfSuche, refs.knopfDarstellung, refs.knopfLegende, refs.zoom
      ]),
      refs.status
    ]);

    return [refs.werkzeugleiste];
  }

  function leisteAktualisieren() {
    var knoepfe = refs.ansichtSegment.querySelectorAll('.segment__knopf');
    for (var i = 0; i < knoepfe.length; i++) {
      knoepfe[i].setAttribute('aria-pressed', knoepfe[i].dataset.wert === zustand.ansicht ? 'true' : 'false');
    }

    var istPhasen = zustand.ansicht === 'phasen';

    HT.ui.leeren(refs.vorgehenSegment);
    refs.vorgehenSegment.hidden = !istPhasen;
    if (istPhasen) {
      refs.vorgehenSegment.appendChild(segment(VORGEHENSWEISEN, zustand.umfang.vorgehen, vorgehenSetzen, 'Vorgehensweise', true));
    }
    refs.knopfSzenario.hidden = istPhasen;

    HT.ui.leeren(refs.chips);
    /* Phasen laufen in der Reihenfolge der Vorgehensweise — als Chevron-Band,
       das die Abfolge zeigt. Module sind keine Folge und bleiben Chips. */
    refs.chips.classList.toggle('chips--phasen', istPhasen);
    var liste = istPhasen
      ? HT.graph.phasenDerVorgehensweise(zustand.umfang.vorgehen)
      : HT.daten.eintraegeDerKategorie('modul').map(function (m) { return m.begriff; });
    var feld = istPhasen ? 'phasen' : 'module';
    var art = istPhasen ? 'phase' : 'modul';
    liste.forEach(function (name) {
      refs.chips.appendChild(chip(name, HT.graph.beitrag(art, name, zustand.umfang),
        zustand.umfang[feld].indexOf(name) !== -1, function () { listeSchalten(feld, name); },
        istPhasen ? 'chip--phase' : null));
    });

    var querAnzahl = istPhasen ? zustand.umfang.module.length : zustand.umfang.phasen.length;
    HT.ui.leeren(refs.knopfQuer);
    refs.knopfQuer.appendChild(h('span', { text: (istPhasen ? 'Module' : 'Phasen') + ': ' + (querAnzahl ? querAnzahl + ' gewählt' : 'alle') }));
    refs.knopfQuer.appendChild(h('span', { 'aria-hidden': 'true', text: ' ▾' }));
    refs.knopfQuer.classList.toggle('ist-aktiv', querAnzahl > 0);

    refs.knopfReset.hidden = !HT.graph.umfangAktiv(zustand.umfang);
  }

  /* --- Icon-Leiste ---------------------------------------------------------- */

  function railBauen() {
    refs.railTypen = h('div', { class: 'grail__gruppe', role: 'group', 'aria-label': 'Elemente ein- und ausblenden' });
    refs.railRel = h('div', { class: 'grail__gruppe', role: 'group', 'aria-label': 'Verbindungen ein- und ausblenden' });
    refs.rail = h('div', { class: 'grail' }, [
      refs.railTypen,
      h('div', { class: 'grail__trenner', 'aria-hidden': 'true' }),
      refs.railRel
    ]);
    return refs.rail;
  }

  function railAktualisieren(zahlen) {
    HT.ui.leeren(refs.railTypen);
    HT.graph.KATEGORIEN.forEach(function (m) {
      var an = !!zustand.kategorien[m.key];
      var knopf = h('button', {
        type: 'button', class: 'grail__knopf grail__knopf--' + m.key,
        'aria-pressed': an ? 'true' : 'false',
        title: m.label + ' · ' + zahlen[m.key] + ' — ' + (an ? 'ausblenden' : 'einblenden'),
        'aria-label': m.label + ' ' + (an ? 'ausblenden' : 'einblenden'),
        on: { click: function () {
          zustand.kategorien[m.key] = !zustand.kategorien[m.key];
          geaendert();
        } }
      }, [
        h('span', { class: 'gswatch gswatch--' + m.key, 'aria-hidden': 'true' }, HT.ui.katSymbol(m.key, 13)),
        h('span', { class: 'grail__zahl', text: String(zahlen[m.key]) })
      ]);
      refs.railTypen.appendChild(knopf);
    });

    HT.ui.leeren(refs.railRel);
    HT.graph.RELATIONEN.forEach(function (r) {
      var an = !!zustand.relationen[r.key];
      refs.railRel.appendChild(h('button', {
        type: 'button', class: 'grail__knopf grail__knopf--linie',
        'aria-pressed': an ? 'true' : 'false',
        title: r.label + ' — ' + (an ? 'ausblenden' : 'einblenden'),
        'aria-label': r.label + ' ' + (an ? 'ausblenden' : 'einblenden'),
        on: { click: function () {
          zustand.relationen[r.key] = !zustand.relationen[r.key];
          geaendert();
        } }
      }, h('span', { class: 'glinie glinie--' + r.stil, 'aria-hidden': 'true' })));
    });
  }

  /* --- Suche ---------------------------------------------------------------- */

  function sucheAktualisieren() {
    var text = refs.sucheFeld.value.trim();
    HT.ui.leeren(refs.sucheListe);
    if (text.length < 2) { refs.sucheListe.hidden = true; return; }
    var treffer = HT.graph.suchen(text, 8);
    if (!treffer.length) {
      refs.sucheListe.appendChild(h('li', { class: 'gs-treffer__leer', text: 'Keine Treffer' }));
      refs.sucheListe.hidden = false;
      return;
    }
    treffer.forEach(function (k) {
      refs.sucheListe.appendChild(h('li', {}, h('button', {
        type: 'button', class: 'gs-treffer__knopf', on: { click: function () {
          refs.sucheFeld.value = '';
          refs.sucheListe.hidden = true;
          popSchliessen();
          zeigen(k.id);
        } }
      }, [
        h('span', { class: 'gswatch gswatch--' + k.kategorie, 'aria-hidden': 'true' }, HT.ui.katSymbol(k.kategorie, 13)),
        h('span', { class: 'gs-treffer__text', text: k.begriff })
      ])));
    });
    refs.sucheListe.hidden = false;
  }

  /** Element auswählen und, falls es ausserhalb des Umfangs liegt, den Umfang erweitern. */
  function zeigen(id) {
    var k = HT.graph.knoten(id);
    if (!k) { return; }
    var drin = k.kategorie === 'rolle' || HT.graph.imUmfang(k.eintrag, zustand.umfang);
    if (!drin) {
      var e = HT.graph.einstieg(id);
      if (e) {
        zustand.umfang = e.umfang;
        zustand.ansicht = e.ansicht;
      }
    }
    if (!zustand.kategorien[k.kategorie]) { zustand.kategorien[k.kategorie] = true; }
    zustand.auswahlId = id;
    popSchliessen();
    geaendert();
  }

  /* --- Bühne ---------------------------------------------------------------- */

  function buehneBauen() {
    refs.flaeche = h('div', { class: 'graph-flaeche' });
    refs.tooltip = h('div', { class: 'graph-tooltip', role: 'tooltip' });
    refs.tooltip.hidden = true;
    refs.pop = h('div', { class: 'gpop', role: 'dialog', 'aria-label': 'Einstellungen' });
    refs.pop.hidden = true;
    refs.leer = h('div', { class: 'graph-leer' });
    refs.leer.hidden = true;

    refs.buehne = h('div', { class: 'graph-buehne' }, leisteBauen().concat([
      h('div', { class: 'graph-flaeche-huelle' }, [refs.flaeche, railBauen(), refs.leer, refs.pop, refs.tooltip])
    ]));

    zeichner = HT.graphZeichnen.erstellen(refs.flaeche, {
      beiKlick: function (id) { popSchliessen(); auswaehlen(id); },
      beiDoppelklick: einschraenken,
      beiLeerklick: function () { tooltipVerbergen(); popSchliessen(); },
      beiHover: function (id) {
        if (!zeichner) { return; }
        if (id) {
          zeichner.hervorheben(id, false);
          if (zustand.auswahlId) { zeichner.markieren(zustand.auswahlId); }
          tooltipZeigen(id);
        } else {
          zeichner.hervorheben(zustand.auswahlId, true);
          tooltipVerbergen();
        }
      }
    });

    return refs.buehne;
  }

  function tooltipZeigen(id) {
    var k = HT.graph.knoten(id);
    if (!k || !zeichner) { return; }
    var pos = zeichner.knotenPosition(id);
    if (!pos) { return; }
    var meta = HT.graph.KAT[k.kategorie];
    HT.ui.leeren(refs.tooltip);
    refs.tooltip.appendChild(h('div', { class: 'graph-tooltip__kopf' }, [HT.ui.badge(k.kategorie), h('b', { text: k.begriff })]));
    refs.tooltip.appendChild(h('p', { class: 'graph-tooltip__text', text: HT.ui.kuerzen(k.eintrag.kurz || k.eintrag.definition, 160) }));
    refs.tooltip.appendChild(h('p', { class: 'graph-tooltip__tipp', text: meta.singular + ' · Klick: Details' + (k.eintrag.module && k.eintrag.module.length ? ' · Doppelklick: auf Modul einschränken' : '') }));
    refs.tooltip.hidden = false;

    var b = refs.buehne.getBoundingClientRect();
    var tw = refs.tooltip.offsetWidth, th = refs.tooltip.offsetHeight;
    var x = pos.x - b.left;
    var y = pos.y - b.top + pos.h + 8;
    if (x + tw > b.width - 8) { x = Math.max(8, b.width - tw - 8); }
    if (y + th > b.height - 8) { y = pos.y - b.top - th - 8; }
    if (y < 8) { y = 8; }
    refs.tooltip.style.left = Math.round(x) + 'px';
    refs.tooltip.style.top = Math.round(y) + 'px';
  }

  function tooltipVerbergen() { refs.tooltip.hidden = true; }

  /* Nichts zu zeichnen: sagen, woran es liegt und wie man weiterkommt. */
  function leerZustandZeigen(leer) {
    refs.leer.hidden = !leer;
    if (!leer) { return; }
    HT.ui.leeren(refs.leer);
    var alleAus = HT.graph.KATEGORIEN.every(function (m) { return !zustand.kategorien[m.key]; });
    refs.leer.appendChild(HT.ui.leerZustand(
      alleAus ? 'Alle Elemente ausgeblendet' : 'Nichts in dieser Auswahl',
      alleAus
        ? 'Rollen, Aufgaben und Ergebnisse sind über die Icon-Leiste ausgeblendet. Ein Klick auf ein Zeichen blendet sie wieder ein.'
        : 'Für diese Phasen und Module sind keine Aufgaben oder Ergebnisse erfasst. Weniger einschränken oder die Auswahl zurücksetzen.'
    ));
    if (!alleAus && HT.graph.umfangAktiv(zustand.umfang)) {
      refs.leer.appendChild(h('button', { type: 'button', class: 'btn btn--klein btn--primaer', text: 'Auswahl zurücksetzen', on: { click: alleZuruecksetzen } }));
    }
  }

  function umfangText() {
    var u = zustand.umfang;
    var teile = [];
    teile.push(u.module.length
      ? (u.module.length === 1 ? 'Modul ' + u.module[0] : u.module.length + ' Module')
      : 'alle Module');
    teile.push((u.vorgehen === 'agil' ? 'agil' : 'klassisch') + ', ' + (u.phasen.length
      ? (u.phasen.length === 1 ? 'Phase ' + u.phasen[0] : u.phasen.length + ' Phasen')
      : 'alle Phasen'));
    return teile.join(' · ');
  }

  function graphZeichnen(einpassen) {
    tooltipVerbergen();
    var tg = HT.graph.teilgraph(modellZustand());
    railAktualisieren(tg.zahlen);

    var teile = [umfangText()];
    var mengen = HT.graph.KATEGORIEN
      .filter(function (m) { return zustand.kategorien[m.key]; })
      .map(function (m) { return tg.gezeigt[m.key] + ' ' + (tg.gezeigt[m.key] === 1 ? m.singular : m.label); });
    teile.push(mengen.length ? mengen.join(', ') : 'keine Elemente eingeblendet');
    teile.push(tg.kanten.length + (tg.kanten.length === 1 ? ' Verbindung' : ' Verbindungen'));
    zustand.statusText = teile.join(' · ');
    refs.status.textContent = zustand.statusText;

    var layout = HT.graphZeichnen.layoutSpalten(tg, { phasenstreifen: zustand.phasenstreifen });
    zeichner.zeigen(layout, { einpassen: einpassen !== false, phasenstreifen: zustand.phasenstreifen });
    leerZustandZeigen(layout.knoten.length === 0);

    if (zustand.auswahlId && !layout.knoten.some(function (n) { return n.id === zustand.auswahlId; })) {
      /* Ausgewähltes Element liegt nicht mehr im Umfang — Auswahl behalten,
         aber im Detailfeld darauf hinweisen. */
      zeichner.hervorheben(null, false);
    } else if (zustand.auswahlId) {
      zeichner.hervorheben(zustand.auswahlId, true);
    }
  }

  /* --- Detailfeld ----------------------------------------------------------- */

  function detailBauen() {
    refs.detailInhalt = h('div', { class: 'graph-detail__inhalt' });
    refs.detail = h('aside', { class: 'graph-detail', 'aria-label': 'Details zum gewählten Element' }, [
      h('div', { class: 'graph-detail__kopf' }, [
        h('span', { class: 'graph-detail__titel', text: 'Details' }),
        h('button', { type: 'button', class: 'graph-schliessen', 'aria-label': 'Details schliessen', text: '✕', on: { click: function () { auswaehlen(null); } } })
      ]),
      refs.detailInhalt
    ]);

    refs.detail.addEventListener('click', function (ev) {
      var a = ev.target;
      while (a && a !== refs.detail && a.tagName !== 'A') { a = a.parentNode; }
      if (!a || a === refs.detail) { return; }
      var m = /^#\/graph\?id=([^&]+)/.exec(a.getAttribute('href') || '');
      if (!m) { return; }
      ev.preventDefault();
      zeigen(decodeURIComponent(m[1]));
    });
    return refs.detail;
  }

  function graphZiel(ziel) {
    return '#/graph?id=' + encodeURIComponent(ziel.id);
  }

  function verbindungenBlock(id) {
    var liste = HT.graph.nachbarn(id);
    if (!liste.length) {
      return h('section', { class: 'gv' }, [
        h('h3', { class: 'gv__titel', text: 'Verbindungen' }),
        h('p', { class: 'trefferzahl', text: 'Für dieses Element sind in den Daten keine Querverweise erfasst.' })
      ]);
    }
    /* Nach Kategorie und Beziehung gruppieren, stärkste Beziehung zuerst. */
    var gruppen = {};
    var reihenfolge = [];
    liste.forEach(function (n) {
      n.relationen.slice().sort(function (a, b) { return HT.graph.REL[a.rel].rang - HT.graph.REL[b.rel].rang; }).slice(0, 1).forEach(function (r) {
        var key = n.knoten.kategorie + '|' + r.rel + '|' + r.richtung;
        if (!gruppen[key]) {
          gruppen[key] = { kategorie: n.knoten.kategorie, rel: r.rel, label: r.label, knoten: [] };
          reihenfolge.push(key);
        }
        gruppen[key].knoten.push(n.knoten);
      });
    });
    reihenfolge.sort(function (a, b) {
      var ga = gruppen[a], gb = gruppen[b];
      var d = HT.graph.KAT[ga.kategorie].rang - HT.graph.KAT[gb.kategorie].rang;
      return d !== 0 ? d : HT.graph.REL[ga.rel].rang - HT.graph.REL[gb.rel].rang;
    });

    var kinder = [h('h3', { class: 'gv__titel', text: 'Verbindungen · ' + liste.length })];
    reihenfolge.forEach(function (key) {
      var g = gruppen[key];
      var meta = HT.graph.KAT[g.kategorie];
      var sichtbar = zustand.relationen[g.rel];
      g.knoten.sort(function (a, b) { return a.begriff.localeCompare(b.begriff, 'de'); });
      kinder.push(h('div', { class: 'gv__rel' + (sichtbar ? '' : ' ist-ausgeblendet') }, [
        h('span', { class: 'gv__rel-label' }, [
          h('span', { class: 'gswatch gswatch--' + g.kategorie, 'aria-hidden': 'true' }, HT.ui.katSymbol(g.kategorie, 13)),
          h('span', { class: 'glinie glinie--' + HT.graph.REL[g.rel].stil, 'aria-hidden': 'true' }),
          h('span', { text: g.label + ' · ' + g.knoten.length + (sichtbar ? '' : ' (im Graph ausgeblendet)') })
        ]),
        h('ul', { class: 'gv__liste' }, g.knoten.map(function (n) {
          return h('li', {}, h('a', { class: 'gv__link', href: graphZiel(n), title: n.begriff + ' im Graph zeigen' }, n.begriff));
        }))
      ]));
    });
    return h('section', { class: 'gv' }, kinder);
  }

  function detailZeigen(id) {
    var e = id ? HT.daten.eintragMitId(id) : null;
    HT.ui.leeren(refs.detailInhalt);
    var warOffen = refs.seite.classList.contains('detail-offen');
    refs.detail.classList.toggle('ist-offen', !!e);
    refs.seite.classList.toggle('detail-offen', !!e);
    if (warOffen !== !!e && istBreit()) { neuEinpassen(); }
    if (!e) {
      refs.detailInhalt.appendChild(HT.ui.leerZustand(
        'Kein Element gewählt',
        'Auf einen Knoten tippen: die ganze Beschreibung, die Fakten und alle Verbindungen erscheinen hier. Doppelklick schränkt auf das Modul des Elements ein.'
      ));
      return;
    }

    var k = HT.graph.knoten(id);
    var imUmfang = k && (k.kategorie === 'rolle' || HT.graph.imUmfang(k.eintrag, zustand.umfang));
    if (!imUmfang) {
      refs.detailInhalt.appendChild(h('p', { class: 'graph-detail__hinweis' }, [
        'Dieses Element liegt ausserhalb der aktuellen Auswahl. ',
        h('button', { type: 'button', class: 'gauswahl__reset', text: 'Auswahl anpassen', on: { click: function () { zeigen(id); } } })
      ]));
    }

    var aktionen = [];
    if (e.module && e.module.length) {
      aktionen.push(h('button', {
        type: 'button', class: 'btn btn--klein btn--primaer',
        on: { click: function () { einschraenken(id); } }
      }, [h('span', { 'aria-hidden': 'true', text: '◎ ' }), 'Nur Modul ' + e.module[0]]));
    }
    aktionen.push(h('a', { class: 'btn btn--klein', href: '#/lexikon?id=' + encodeURIComponent(id), text: 'Im Lexikon' }));
    refs.detailInhalt.appendChild(h('div', { class: 'graph-detail__aktionen' }, aktionen));

    /* Stufe 2: der Klick soll die ganze Beschreibung zeigen, nicht nur den
       ersten Satz. Über die Stufenknöpfe lässt sie sich wieder einklappen. */
    refs.detailInhalt.appendChild(HT.karte.bauen(e, { stufe: 2, linkZiel: graphZiel, titelEbene: 'h2' }));
    refs.detailInhalt.appendChild(verbindungenBlock(id));
    refs.detailInhalt.scrollTop = 0;
  }

  /* --- Layout --------------------------------------------------------------- */

  function istBreit() {
    return global.matchMedia && global.matchMedia('(min-width: 1100px)').matches;
  }

  function neuEinpassen() {
    if (!zeichner) { return; }
    global.setTimeout(function () { zeichner.einpassen(); }, 230);
  }

  function alles(einpassen) {
    leisteAktualisieren();
    graphZeichnen(einpassen);
    detailZeigen(zustand.auswahlId);
    urlSetzen();
  }

  /* --- Parameter aus der Adresse -------------------------------------------- */

  function parameterAnwenden(params) {
    if (!params) { return; }
    var etwas = false;

    /* Nennt die Adresse einen Umfang, gilt genau dieser — sonst mischt sich der
       zuletzt gespeicherte Umfang in einen geteilten Link. */
    if (params.modul || params.phase || params.szenario || params.vorgehen) {
      zustand.umfang = HT.graph.leererUmfang();
    }

    if (params.ansicht && ANSICHTEN.some(function (a) { return a.key === params.ansicht; })) {
      zustand.ansicht = params.ansicht;
      etwas = true;
    }
    /* Alte Links: ?modus=phasen, ?kat=aufgabe */
    if (params.modus === 'phasen') { zustand.ansicht = 'phasen'; etwas = true; }
    if (params.kat && HT.graph.KAT[params.kat]) {
      zustand.kategorien[params.kat] = true;
      etwas = true;
    }
    if (params.vorgehen && HT.graph.VORGEHEN[params.vorgehen]) {
      zustand.umfang.vorgehen = params.vorgehen;
      etwas = true;
    }
    if (params.szenario) {
      var mods = HT.graph.szenarioModule(params.szenario);
      if (mods) { zustand.umfang.module = mods; zustand.ansicht = 'module'; etwas = true; }
    }
    ['phase', 'modul'].forEach(function (art) {
      var werte = params[art];
      if (!werte) { return; }
      var feld = art === 'phase' ? 'phasen' : 'module';
      zustand.umfang[feld] = String(werte).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      etwas = true;
    });
    if (params.id) {
      var k = HT.graph.knoten(params.id);
      if (k) {
        zustand.auswahlId = params.id;
        if (!etwas && k.kategorie !== 'rolle' && !HT.graph.imUmfang(k.eintrag, zustand.umfang)) {
          var ein = HT.graph.einstieg(params.id);
          if (ein) { zustand.umfang = ein.umfang; zustand.ansicht = ein.ansicht; }
        }
        zustand.kategorien[k.kategorie] = true;
      } else {
        /* Phase, Modul, Szenario: setzen den Umfang statt der Auswahl. */
        var ein2 = HT.graph.einstieg(params.id);
        if (ein2) {
          zustand.umfang = ein2.umfang;
          zustand.ansicht = ein2.ansicht;
        }
      }
    }
  }

  /* --- Aufbau --------------------------------------------------------------- */

  function render(behaelter, params) {
    HT.graph.bauen();
    if (!initialisiert) {
      wiederherstellen();
      initialisiert = true;
    }
    parameterAnwenden(params);
    zustand.pop = null;

    var warnung = HT.app.datenWarnung();

    refs.seite = h('div', { class: 'graph-seite' }, [buehneBauen(), detailBauen()]);
    if (warnung) { behaelter.appendChild(warnung); }
    behaelter.appendChild(refs.seite);

    /* Erst zeichnen, wenn die Fläche ihre Grösse hat — in einem Hintergrundtab
       läuft requestAnimationFrame nicht, darum zusätzlich ein Timeout. */
    var aufgebaut = false;
    function ersterAufbau() {
      if (aufgebaut || !document.body.contains(refs.seite)) { return; }
      aufgebaut = true;
      alles(true);
    }
    global.requestAnimationFrame(ersterAufbau);
    global.setTimeout(ersterAufbau, 150);

    /* Popover schliesst bei Klick daneben und mit Escape. */
    if (!refs.globalGebunden) {
      refs.globalGebunden = true;
      document.addEventListener('click', function (ev) {
        if (!zustand.pop || !document.body.contains(refs.seite)) { return; }
        var ausloeser = popAusloeser();
        var el = ev.target;
        while (el && el !== document) {
          if (el === refs.pop || ausloeser.indexOf(el) !== -1) { return; }
          el = el.parentNode;
        }
        popSchliessen();
      });
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && zustand.pop && document.body.contains(refs.seite)) { popSchliessen(); }
      });
      /* Im Hintergrund aufgebaut: beim Sichtbarwerden neu einpassen. */
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState !== 'visible') { return; }
        if (!zeichner || !document.body.contains(refs.seite)) { return; }
        global.setTimeout(function () { zeichner.einpassen(); }, 60);
      });
      var resizeTimer = null;
      global.addEventListener('resize', function () {
        if (!document.body.contains(refs.seite)) { return; }
        if (resizeTimer) { clearTimeout(resizeTimer); }
        resizeTimer = setTimeout(function () { if (zeichner) { zeichner.einpassen(); } }, 150);
      });
    }
  }

  HT.views.graph = { titel: 'Graph', render: render, breit: true };
}(window));
