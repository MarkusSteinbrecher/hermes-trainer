/* meinHERMES — Ansicht «Graph».
   Der Graph zeigt drei Elemente in drei Spalten: Rolle → Aufgabe → Ergebnis.
   Phasen und Module sind keine Knoten, sondern die Auswahl: die Ansicht
   («Nach Phasen» oder «Nach Modulen») legt die Bahnen des Swimlane-Layouts
   fest, das jeweils andere Kriterium bleibt als zusätzlicher Filter. Steuerung: eine
   einzige Leiste über der Fläche (Ansicht, Auswahl, Werkzeuge) unter der
   Kopfzeile der Anwendung; auf der Fläche links die Icon-Leiste für
   Elemente und Verbindungen, rechts die Werkzeuge (Filter, Suche,
   Darstellung, Legende, Zoom), alles Weitere als Popover. Ein Klick auf einen
   Knoten fokussiert ihn: nur er und seine verbundenen Elemente bleiben
   stehen, in die Fläche eingepasst, rechts die Lexikonkarte mit allen
   Querverweisen. Ein zweiter Klick hebt den Fokus wieder auf. */
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
      fokusId: null,            // nur dieses Element mit seiner Nachbarschaft
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
    if (zustand.fokusId) { teile.push('fokus=' + encodeURIComponent(zustand.fokusId)); }
    if (zustand.auswahlId && zustand.auswahlId !== zustand.fokusId) { teile.push('id=' + encodeURIComponent(zustand.auswahlId)); }
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
      isolierteAusblenden: zustand.isolierteAusblenden,
      fokus: zustand.fokusId
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

  /* Ruhezustand ohne Maus: nichts gedimmt, das gewählte Element nur umrandet.
     Dimmen gibt es beim Überfahren; das Ausblenden macht der Fokus. */
  function auswahlZeigen() {
    if (!zeichner) { return; }
    zeichner.hervorheben(null, false);
    zeichner.markieren(zustand.auswahlId);
  }

  function auswaehlen(id) {
    zustand.auswahlId = id || null;
    detailZeigen(zustand.auswahlId);
    if (zeichner) { auswahlZeigen(); }
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

  /* Im Fokus soll die ganze Nachbarschaft sichtbar sein, nicht nur der Teil
     in einem Modul oder einer Phase: die Auswahl wird geleert, die
     Vorgehensweise passt sich dem Element an. Phasen und Module lassen sich
     danach wieder dazuschalten — der Fokus bleibt. */
  var umfangVorFokus = null;

  function fokusUmfang(k) {
    var e = k.kategorie === 'rolle' ? null : HT.graph.einstieg(k.id);
    if (!zustand.fokusId) { umfangVorFokus = zustand.umfang; }
    zustand.umfang = { vorgehen: e ? e.umfang.vorgehen : zustand.umfang.vorgehen, phasen: [], module: [] };
  }

  /** Fokus: nur dieses Element mit seiner Nachbarschaft, eingepasst in die
      Fläche. Ein Klick auf einen Knoten setzt ihn; das fokussierte Element
      nochmals gewählt hebt ihn auf und stellt die Auswahl von vorher wieder
      her. Der Umfang wird bei Bedarf so gesetzt, dass das Element sichtbar
      ist — wie beim Anzeigen aus der Suche. */
  function fokusSetzen(id) {
    if (!id || zustand.fokusId === id) {
      zustand.fokusId = null;
      /* Der zweite Klick hebt den Fokus auf, zeigt aber weiterhin das
         Element: war das Detailfeld geschlossen, geht es damit auf — ein
         Klick auf einen Knoten öffnet es immer. */
      if (id) { zustand.auswahlId = id; }
      if (umfangVorFokus) { zustand.umfang = umfangVorFokus; umfangVorFokus = null; }
      popSchliessen();
      geaendert();
      return;
    }
    var k = HT.graph.knoten(id);
    if (!k) { return; }
    fokusUmfang(k);
    if (!zustand.kategorien[k.kategorie]) { zustand.kategorien[k.kategorie] = true; }
    zustand.fokusId = id;
    zustand.auswahlId = id;
    popSchliessen();
    geaendert();
  }

  function alleZuruecksetzen() {
    zustand.umfang.phasen = [];
    zustand.umfang.module = [];
    zustand.fokusId = null;
    umfangVorFokus = null;
    popSchliessen();
    geaendert();
  }

  /* --- Popover -------------------------------------------------------------- */

  var popFokusNoetig = false;

  function popOeffnen(key) {
    zustand.pop = zustand.pop === key ? null : key;
    popFokusNoetig = !!zustand.pop;
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
    alle:        { titel: 'Alle Filter',    inhalt: function () { return alleFilterInhalt(); },  knopf: 'knopfAlle', breit: true },
    suche:       { titel: 'Element suchen', inhalt: function () { return sucheInhalt(); },       knopf: 'knopfSuche' },
    darstellung: { titel: 'Darstellung',    inhalt: function () { return darstellungInhalt(); }, knopf: 'knopfDarstellung' },
    legende:     { titel: 'Legende',        inhalt: function () { return legendeInhalt(); },     knopf: 'knopfLegende' }
  };

  function popAusloeser() {
    return Object.keys(POPS).map(function (k) { return refs[POPS[k].knopf]; });
  }

  function popZeichnen() {
    /* Beim Neuaufbau nach einem Klick bleiben Scrollstand und Fokus, wo sie
       waren — sonst springt eine lange Liste bei jedem Häkchen nach oben. */
    var scroll = refs.pop.scrollTop;
    var aktiv = document.activeElement;
    var fokusKey = aktiv && refs.pop.contains(aktiv) ? aktiv.getAttribute('data-fokus') : null;
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
    /* «Alle Filter» nutzt die ganze Breite der Fläche — Spalten statt Liste. */
    refs.pop.classList.toggle('gpop--breit', !!meta.breit);

    refs.pop.appendChild(h('div', { class: 'gpop__kopf' }, [
      h('strong', { class: 'gpop__titel', text: titel }),
      h('button', { type: 'button', class: 'graph-schliessen', 'aria-label': titel + ' schliessen', text: '✕', on: { click: popSchliessen } })
    ]));
    refs.pop.appendChild(meta.inhalt());
    refs.pop.scrollTop = scroll;
    var wieder = fokusKey ? refs.pop.querySelector('[data-fokus="' + fokusKey.replace(/"/g, '') + '"]') : null;
    if (wieder) {
      wieder.focus({ preventScroll: true });
    } else if (popFokusNoetig) {
      var erstes = refs.pop.querySelector('.gpop__inhalt input, .gpop__inhalt button, .gpop__inhalt a');
      if (erstes) { erstes.focus(); }
    }
    popFokusNoetig = false;
  }

  function popInhalt(kinder) {
    return h('div', { class: 'gpop__inhalt' }, kinder);
  }

  function sucheInhalt() {
    return popInhalt([refs.sucheFeld, refs.sucheListe]);
  }

  /* Alle Filter auf einer Seite, untereinander: Ansicht, Vorgehensweise,
     Phasen, Szenarien, Module, Elemente, Verbindungen, Darstellung. Phasen
     und Module sind Häkchenlisten; «alle» heisst im Modell eine leere Liste,
     darum zeigt die Liste dann jedes Häkchen gesetzt, und wer eines
     wegnimmt, behält die übrigen. Sind wieder alle gesetzt, wird die Liste
     leer. */
  function alleFilterInhalt() {
    var istPhasen = zustand.ansicht === 'phasen';
    var phasen = HT.graph.phasenDerVorgehensweise(zustand.umfang.vorgehen);
    var module = HT.daten.eintraegeDerKategorie('modul').map(function (m) { return m.begriff; });
    var zahlen = refs.zahlen || {};

    function abschnitt(titel, rechts, inhalt, klasse) {
      return h('section', { class: 'gaf' + (klasse ? ' ' + klasse : '') }, [
        h('div', { class: 'gaf__kopf' }, [h('h3', { class: 'gaf__titel', text: titel }), rechts]),
        inhalt
      ]);
    }

    function alleKnopf(feld, label) {
      var alle = !zustand.umfang[feld].length;
      return h('button', {
        type: 'button', class: 'gaf__alle', 'aria-pressed': alle ? 'true' : 'false',
        text: alle ? label + ': alle' : 'Alle ' + label,
        disabled: alle ? 'disabled' : null,
        on: { click: function () { zustand.umfang[feld] = []; geaendert(); popZeichnen(); } }
      });
    }

    function haken(feld, name, alle, zahl, klasse) {
      var liste = zustand.umfang[feld];
      var an = !liste.length || liste.indexOf(name) !== -1;
      var kasten = h('input', { type: 'checkbox', class: 'gs-schalter__eingabe', 'data-fokus': feld + ':' + name });
      kasten.checked = an;
      kasten.addEventListener('change', function () {
        var l = zustand.umfang[feld];
        if (!l.length) {
          zustand.umfang[feld] = alle.filter(function (n) { return n !== name; });
        } else {
          var i = l.indexOf(name);
          if (i === -1) { l.push(name); } else { l.splice(i, 1); }
          if (alle.every(function (n) { return l.indexOf(n) !== -1; })) { zustand.umfang[feld] = []; }
        }
        geaendert();
        popZeichnen();
      });
      return h('label', { class: 'gs-schalter' + (klasse ? ' ' + klasse : '') }, [
        kasten,
        h('span', { class: 'gs-schalter__label', text: name }),
        zahl === null || zahl === undefined ? null : h('span', { class: 'gs-schalter__extra', text: String(zahl) })
      ]);
    }

    function kategorieHaken(m) {
      var kasten = h('input', { type: 'checkbox', class: 'gs-schalter__eingabe', 'data-fokus': 'kat:' + m.key });
      kasten.checked = !!zustand.kategorien[m.key];
      kasten.addEventListener('change', function () { zustand.kategorien[m.key] = kasten.checked; geaendert(); popZeichnen(); });
      return h('label', { class: 'gs-schalter' }, [
        kasten,
        h('span', { class: 'gswatch gswatch--' + m.key, 'aria-hidden': 'true' }, HT.ui.katSymbol(m.key, 13)),
        h('span', { class: 'gs-schalter__label', text: m.label }),
        zahlen[m.key] === undefined ? null : h('span', { class: 'gs-schalter__extra', text: String(zahlen[m.key]) })
      ]);
    }

    function relationHaken(r) {
      var kasten = h('input', { type: 'checkbox', class: 'gs-schalter__eingabe', 'data-fokus': 'rel:' + r.key });
      kasten.checked = !!zustand.relationen[r.key];
      kasten.addEventListener('change', function () { zustand.relationen[r.key] = kasten.checked; geaendert(); popZeichnen(); });
      return h('label', { class: 'gs-schalter' }, [
        kasten,
        h('span', { class: 'glinie glinie--' + r.stil, 'aria-hidden': 'true' }),
        h('span', { class: 'gs-schalter__label', text: r.label })
      ]);
    }

    function darstellungHaken(label, key, neuEinpassen) {
      var kasten = h('input', { type: 'checkbox', class: 'gs-schalter__eingabe', 'data-fokus': 'dar:' + key });
      kasten.checked = !!zustand[key];
      kasten.addEventListener('change', function () { zustand[key] = kasten.checked; geaendert(neuEinpassen); popZeichnen(); });
      return h('label', { class: 'gs-schalter' }, [kasten, h('span', { class: 'gs-schalter__label', text: label })]);
    }

    var aktuell = zustand.umfang.module;
    var szenarien = HT.daten.eintraegeDerKategorie('szenario').map(function (sz) {
      var gleich = sz.module.length === aktuell.length && sz.module.every(function (m) { return aktuell.indexOf(m) !== -1; });
      return h('button', {
        type: 'button', class: 'gaf__szenario', 'aria-pressed': gleich ? 'true' : 'false', 'data-fokus': 'sz:' + sz.id,
        on: { click: function () {
          zustand.umfang.module = gleich ? [] : sz.module.slice();
          geaendert();
          popZeichnen();
        } }
      }, [
        h('span', { class: 'gaf__szenario-haken', 'aria-hidden': 'true', text: gleich ? '●' : '○' }),
        h('span', { class: 'gaf__szenario-titel', text: sz.begriff }),
        h('span', { class: 'gs-schalter__extra', title: sz.module.length + ' Module', text: String(sz.module.length) })
      ]);
    });

    var ansichtOptionen = ANSICHTEN.map(function (a) { return { key: a.key, label: a.label }; });

    /* Sechs Spalten über die ganze Breite: kein Scrollen, alles auf einen
       Blick. Ansicht und Vorgehensweise teilen sich die erste Spalte,
       Elemente und Verbindungen die fünfte; die zwölf Module stehen in zwei
       Reihen. */
    var kinder = [
      h('div', { class: 'gaf-raster' }, [
        h('div', { class: 'gaf-spalte' }, [
          abschnitt('Ansicht', null, segment(ansichtOptionen, zustand.ansicht, function (key) { ansichtSetzen(key); popOeffnen('alle'); }, 'Ansicht', true)),
          abschnitt('Vorgehensweise', null, segment(VORGEHENSWEISEN, zustand.umfang.vorgehen, function (key) { vorgehenSetzen(key); popZeichnen(); }, 'Vorgehensweise', true))
        ]),
        abschnitt('Phasen', alleKnopf('phasen', 'Phasen'),
          h('div', { class: 'gs-liste', role: 'group', 'aria-label': 'Phasen' }, phasen.map(function (name) {
            return haken('phasen', name, phasen, HT.graph.beitrag('phase', name, zustand.umfang));
          }))),
        abschnitt('Szenarien', null, h('div', { class: 'gs-liste', role: 'group', 'aria-label': 'Szenarien' }, szenarien)),
        abschnitt('Module', alleKnopf('module', 'Module'),
          h('div', { class: 'gs-liste gs-liste--zwei', role: 'group', 'aria-label': 'Module' }, module.map(function (name) {
            return haken('module', name, module, HT.graph.beitrag('modul', name, zustand.umfang));
          })), 'gaf--module'),
        h('div', { class: 'gaf-spalte' }, [
          abschnitt('Elemente', null, h('div', { class: 'gs-liste', role: 'group', 'aria-label': 'Elemente' }, HT.graph.KATEGORIEN.map(kategorieHaken))),
          abschnitt('Verbindungen', null, h('div', { class: 'gs-liste', role: 'group', 'aria-label': 'Verbindungen' }, HT.graph.RELATIONEN.map(relationHaken)))
        ]),
        abschnitt('Darstellung', null, h('div', { class: 'gs-liste', role: 'group', 'aria-label': 'Darstellung' }, [
          darstellungHaken('Phasenmodell im Knoten (Phasen des Elements dunkelgrau)', 'phasenstreifen', false),
          darstellungHaken('Ergebnisse ohne erzeugende Aufgabe ausblenden', 'isolierteAusblenden'),
          darstellungHaken('Nur minimal geforderte Dokumente', 'nurMinimal'),
          darstellungHaken('Nur Entscheidungsaufgaben', 'nurEntscheide')
        ]))
      ]),
      h('div', { class: 'gaf__fuss' }, [
        h('p', { class: 'gpop__hinweis gaf__fuss-hinweis', text: 'Jedes Häkchen wirkt sofort auf den Graphen; Leiste und Adresse zeigen dieselbe Auswahl.' }),
        h('button', {
          type: 'button', class: 'btn btn--klein', text: 'Auswahl zurücksetzen',
          disabled: HT.graph.umfangAktiv(zustand.umfang) || zustand.fokusId ? null : 'disabled',
          on: { click: function () { zustand.umfang.phasen = []; zustand.umfang.module = []; zustand.fokusId = null; geaendert(); popZeichnen(); } }
        }),
        h('button', { type: 'button', class: 'btn btn--klein btn--primaer', text: 'Fertig', on: { click: popSchliessen } })
      ])
    ];
    return popInhalt(kinder);
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

  function schalter(label, aktiv, beiWechsel) {
    var kasten = h('input', { type: 'checkbox', class: 'gs-schalter__eingabe' });
    kasten.checked = !!aktiv;
    kasten.addEventListener('change', function () { beiWechsel(kasten.checked); });
    return h('label', { class: 'gs-schalter' }, [kasten, h('span', { class: 'gs-schalter__label', text: label })]);
  }

  function darstellungInhalt() {
    return popInhalt([
      h('div', { class: 'gs-liste' }, [
        schalter('Phasenmodell im Knoten (Phasen des Elements dunkelgrau)', zustand.phasenstreifen, function (v) { zustand.phasenstreifen = v; geaendert(false); popZeichnen(); }),
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
      h('p', { class: 'glegende__hinweis', text: 'Meilensteine sind Ergebnisse, stehen als Quality Gate aber im Sechseck mit Raute. Das kleine Phasenmodell am Knoten zeigt die Phasen des Elements dunkelgrau: links Initialisierung, in der Mitte oben Konzept, Realisierung und Einführung, darunter Umsetzung (agil), rechts Abschluss. Jede Verbindung entspricht einem Querverweis in der offiziellen Dokumentation — es werden keine Beziehungen ergänzt.' })
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

    refs.fokusChip = h('button', {
      type: 'button', class: 'gfokus', title: 'Fokus aufheben',
      on: { click: function () { fokusSetzen(null); } }
    });
    refs.fokusChip.hidden = true;

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
        on: { click: function () { if (zeichner) { zeichner.einpassen(einpassOptionen()); } } } },
        HT.ui.symbol(['M9.6 4.6H4.6v5', 'M14.4 4.6h5v5', 'M9.6 19.4h-5v-5', 'M14.4 19.4h5v-5'], 17))
    ]);

    /* «Alle Filter»: ein Werkzeug in der rechten Icon-Leiste, öffnet den
       breiten Popover mit Phasen, Szenarien, Modulen, Elementen und
       Verbindungen. */
    refs.knopfAlle = werkzeugKnopf('graph-werkzeug--filter', 'Alle Filter: Phasen, Szenarien, Module, Elemente',
      ['M3.5 5h17', 'M6.5 12h11', 'M10 19h4'],
      function () { popOeffnen('alle'); });
    refs.vorgehenSegment = h('span', { class: 'gauswahl__vorgehen' });
    /* Suchfeld in der Leiste: findet Elemente, Module und Phasen. Ein
       Element setzt den Fokus, ein Modul oder eine Phase den Umfang — in
       beiden Fällen bleibt nur, was dazugehört oder damit verbunden ist. */
    refs.leisteSuche = HT.ui.suchpille({
      platzhalter: 'Element, Modul oder Phase suchen …',
      label: 'Element, Modul oder Phase suchen',
      treffer: function (text) {
        return HT.ui.suchtreffer(text, ['modul', 'phase'], function (t) {
          return HT.graph.suchen(t, 40).map(function (k) { return k.eintrag; });
        });
      },
      beiWahl: suchtrefferAnwenden
    });
    /* Gewählte Module und Phasen als Chips, jeder mit × zum Entfernen. */
    refs.umfangChips = h('div', { class: 'gumfang', role: 'group', 'aria-label': 'Gewählte Module und Phasen' });
    refs.knopfReset = h('button', {
      type: 'button', class: 'gauswahl__reset', text: 'Zurücksetzen',
      on: { click: alleZuruecksetzen }
    });

    /* Drei Zonen, damit die Suche in der Mitte der Leiste steht: links die
       Ansicht (und die Vorgehensweise), in der Mitte die Suche, rechts die
       Chips. Die Filter liegen als Werkzeug in der rechten Icon-Leiste. */
    refs.werkzeugleiste = h('div', { class: 'graph-leiste' }, [
      h('div', { class: 'graph-leiste__links' }, [refs.ansichtSegment, refs.vorgehenSegment]),
      h('div', { class: 'graph-leiste__mitte' }, [refs.leisteSuche]),
      h('div', { class: 'graph-leiste__rechts' }, [refs.umfangChips, refs.fokusChip, refs.knopfReset, refs.status])
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

    HT.ui.leeren(refs.umfangChips);
    [['phasen', 'phase', 'Phase'], ['module', 'modul', 'Modul']].forEach(function (f) {
      zustand.umfang[f[0]].forEach(function (name) {
        refs.umfangChips.appendChild(h('button', {
          type: 'button', class: 'gfokus gfokus--umfang', title: f[2] + ' ' + name + ' entfernen',
          'aria-label': f[2] + ' ' + name + ' entfernen',
          on: { click: function () { listeSchalten(f[0], name); } }
        }, [
          h('span', { class: 'gswatch gswatch--' + f[1], 'aria-hidden': 'true' }, HT.ui.katSymbol(f[1], 13)),
          h('span', { text: name }),
          h('span', { class: 'gfokus__x', 'aria-hidden': 'true', text: '×' })
        ]));
      });
    });
    refs.umfangChips.hidden = !refs.umfangChips.childNodes.length;

    var fokus = zustand.fokusId ? HT.daten.eintragMitId(zustand.fokusId) : null;
    HT.ui.leeren(refs.fokusChip);
    refs.fokusChip.hidden = !fokus;
    if (fokus) {
      refs.fokusChip.appendChild(h('span', { class: 'gswatch gswatch--' + fokus.kategorie, 'aria-hidden': 'true' }, HT.ui.katSymbol(fokus.kategorie, 13)));
      refs.fokusChip.appendChild(h('span', { text: fokus.begriff }));
      refs.fokusChip.appendChild(h('span', { class: 'gfokus__x', 'aria-hidden': 'true', text: '×' }));
      refs.fokusChip.setAttribute('aria-label', 'Fokus auf ' + fokus.begriff + ' aufheben');
    }
    refs.fokusHinweis.hidden = !fokus;
    if (fokus) {
      var meta = HT.graph.KAT[fokus.kategorie];
      refs.fokusText.textContent = 'Nur «' + fokus.begriff + '» (' + meta.singular + ') und die direkt verbundenen Elemente.';
    }

    refs.knopfReset.hidden = !HT.graph.umfangAktiv(zustand.umfang) && !fokus;
    refs.knopfAlle.classList.toggle('ist-aktiv', HT.graph.umfangAktiv(zustand.umfang));
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

  /* Rechte Icon-Leiste: die Werkzeuge, die früher in der Leiste standen —
     Alle Filter, Suche, Darstellung, Legende und darunter der Zoom.
     Die Knöpfe entstehen in leisteBauen(), damit die Popover-Tabelle POPS
     sie über refs findet. */
  function railRechtsBauen() {
    refs.railRechts = h('div', { class: 'grail grail--rechts' }, [
      h('div', { class: 'grail__gruppe', role: 'group', 'aria-label': 'Werkzeuge' }, [
        refs.knopfAlle, refs.knopfSuche, refs.knopfDarstellung, refs.knopfLegende
      ]),
      h('div', { class: 'grail__trenner', 'aria-hidden': 'true' }),
      refs.zoom
    ]);
    return refs.railRechts;
  }

  function railAktualisieren(zahlen) {
    refs.zahlen = zahlen;
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
    trefferZeichnen(refs.sucheFeld, refs.sucheListe, zeigen);
  }

  /* Trefferliste zu einem Suchfeld; beiWahl(id) bekommt den Klick. */
  function trefferZeichnen(feld, liste, beiWahl) {
    var text = feld.value.trim();
    HT.ui.leeren(liste);
    if (text.length < 2) { liste.hidden = true; return; }
    var treffer = HT.graph.suchen(text, 8);
    if (!treffer.length) {
      liste.appendChild(h('li', { class: 'gs-treffer__leer', text: 'Keine Treffer' }));
      liste.hidden = false;
      return;
    }
    treffer.forEach(function (k) {
      liste.appendChild(h('li', {}, h('button', {
        type: 'button', class: 'gs-treffer__knopf', on: { click: function () {
          feld.value = '';
          liste.hidden = true;
          popSchliessen();
          beiWahl(k.id);
        } }
      }, [
        h('span', { class: 'gswatch gswatch--' + k.kategorie, 'aria-hidden': 'true' }, HT.ui.katSymbol(k.kategorie, 13)),
        h('span', { class: 'gs-treffer__text', text: k.begriff })
      ])));
    });
    refs.sucheListe.hidden = false;
  }

  /* Ein Modul oder eine Phase wird zum Umfang (allein), ein Element zum Fokus. */
  function suchtrefferAnwenden(e) {
    if (e.kategorie === 'modul') {
      zustand.fokusId = null; umfangVorFokus = null;
      zustand.umfang.module = [e.begriff];
      zustand.umfang.phasen = [];
      geaendert();
    } else if (e.kategorie === 'phase') {
      zustand.fokusId = null; umfangVorFokus = null;
      if (HT.graph.phasenDerVorgehensweise(zustand.umfang.vorgehen).indexOf(e.begriff) === -1) {
        zustand.umfang.vorgehen = zustand.umfang.vorgehen === 'agil' ? 'klassisch' : 'agil';
      }
      zustand.umfang.phasen = [e.begriff];
      zustand.umfang.module = [];
      geaendert();
    } else {
      fokusSetzen(e.id);
    }
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
    refs.fokusText = h('span', { class: 'gfokus-hinweis__text' });
    refs.fokusHinweis = h('div', { class: 'gfokus-hinweis', role: 'status' }, [
      refs.fokusText,
      h('button', { type: 'button', class: 'btn btn--klein btn--primaer', text: 'Fokus aufheben', title: 'Fokus aufheben (Esc)', on: { click: function () { fokusSetzen(null); } } })
    ]);
    refs.fokusHinweis.hidden = true;

    /* Die Leiste entsteht hier (die rechte Icon-Leiste braucht ihre Knöpfe),
       liegt aber als eigene Zeile über Bühne und Detailfeld. */
    leisteBauen();
    refs.buehne = h('div', { class: 'graph-buehne' }, [
      h('div', { class: 'graph-flaeche-huelle' }, [refs.flaeche, railBauen(), railRechtsBauen(), refs.leer, refs.fokusHinweis, refs.pop, refs.tooltip])
    ]);

    zeichner = HT.graphZeichnen.erstellen(refs.flaeche, {
      freihalten: function () { return [refs.rail, refs.railRechts, refs.fokusHinweis]; },
      beiKlick: function (id) { fokusSetzen(id); },
      beiDoppelklick: einschraenken,
      beiLeerklick: function () { tooltipVerbergen(); popSchliessen(); },
      beiHover: function (id) {
        if (!zeichner) { return; }
        /* Über dem fokussierten Element nichts dimmen: alles Sichtbare
           gehört zu ihm, ein Grauschleier sähe nach «alles noch da» aus. */
        if (id && id === zustand.fokusId) { zeichner.hervorheben(null, false); tooltipZeigen(id); return; }
        if (id) {
          zeichner.hervorheben(id, false);
          if (zustand.auswahlId) { zeichner.markieren(zustand.auswahlId); }
          tooltipZeigen(id);
        } else {
          auswahlZeigen();
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
    refs.tooltip.appendChild(h('p', { class: 'graph-tooltip__tipp', text: meta.singular + ' · Klick: nur dieses Element mit seinen direkten Verbindungen' + (k.eintrag.module && k.eintrag.module.length ? ' · Doppelklick: auf Modul einschränken' : '') }));
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
    zeichner.zeigen(layout, { einpassen: einpassen !== false, phasenstreifen: zustand.phasenstreifen, maxZoom: einpassOptionen().maxZoom });
    leerZustandZeigen(layout.knoten.length === 0);

    if (zustand.auswahlId && !layout.knoten.some(function (n) { return n.id === zustand.auswahlId; })) {
      /* Ausgewähltes Element liegt nicht mehr im Umfang — Auswahl behalten,
         aber im Detailfeld darauf hinweisen. */
      zeichner.hervorheben(null, false);
    } else if (zustand.auswahlId) {
      auswahlZeigen();
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
    var imFokus = zustand.fokusId === id;
    aktionen.push(h('button', {
      type: 'button', class: 'btn btn--klein btn--primaer',
      'aria-pressed': imFokus ? 'true' : 'false',
      on: { click: function () { fokusSetzen(id); } }
    }, [h('span', { 'aria-hidden': 'true', text: '◎ ' }), imFokus ? 'Fokus aufheben' : 'Nur dieses Element']));
    if (e.module && e.module.length && !imFokus) {
      aktionen.push(h('button', {
        type: 'button', class: 'btn btn--klein',
        on: { click: function () { einschraenken(id); } }
      }, 'Nur Modul ' + e.module[0]));
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

  /* Im Fokus sind es wenige Knoten — sie dürfen die Fläche füllen. */
  function einpassOptionen() {
    return zustand.fokusId ? { maxZoom: 1.6, minZoom: 0.35 } : {};
  }

  /* Nach dem Öffnen oder Schliessen des Detailfelds (Übergang .2s) neu einpassen. */
  function neuEinpassen() {
    if (!zeichner) { return; }
    global.setTimeout(function () { zeichner.einpassen(einpassOptionen()); }, 260);
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
    if (params.fokus) {
      var kf = HT.graph.knoten(params.fokus);
      if (kf) {
        zustand.fokusId = params.fokus;
        zustand.auswahlId = params.fokus;
        zustand.kategorien[kf.kategorie] = true;
        if (!etwas) { fokusUmfang(kf); }
      }
    }
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

    var buehne = buehneBauen();
    refs.seite = h('div', { class: 'graph-seite' }, [refs.werkzeugleiste, buehne, detailBauen()]);
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
        /* Der Pfad des Ereignisses, nicht die Elternkette: ein Knopf im
           Popover, der beim Klick den Popover neu aufbaut, hängt hier schon
           nicht mehr im Dokument — seine Elternkette endet im Leeren, und
           der Popover ginge zu. */
        var pfad = typeof ev.composedPath === 'function' ? ev.composedPath() : [];
        if (!pfad.length) {
          for (var el = ev.target; el && el !== document; el = el.parentNode) { pfad.push(el); }
        }
        for (var i = 0; i < pfad.length; i++) {
          if (pfad[i] === refs.pop || ausloeser.indexOf(pfad[i]) !== -1) { return; }
        }
        popSchliessen();
      });
      document.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Escape' || !document.body.contains(refs.seite)) { return; }
        if (zustand.pop) { popSchliessen(); } else if (zustand.fokusId) { fokusSetzen(null); }
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
