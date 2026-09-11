/* meinHERMES — Graph-Sicht (Komponente für den Überblick).
   Der Graph zeigt drei Elemente in drei Spalten: Rolle → Aufgabe → Ergebnis.
   Phasen und Module sind keine Knoten, sondern die Auswahl: die Ansicht
   («Nach Phasen» oder «Nach Modulen») legt die Bahnen des Swimlane-Layouts
   fest, das jeweils andere Kriterium bleibt als zusätzlicher Filter.

   Die Sicht hat keine eigene Seite mehr: der Überblick bettet sie über
   HT.graphSicht.einbetten() als zweite Sicht seiner Bühne ein und zeigt das
   gewählte Element auf seiner Inhaltsseite. Die Komponente bringt mit: die
   Fläche, links die Icon-Leiste für Elemente und Verbindungen, rechts die
   Werkzeuge (Alle Filter, Suche, Darstellung, Legende, Zoom), das «×» zum
   Aufheben des Fokus und die Popover. Der Umfang (Vorgehensweise, Phasen,
   Module) ist zugleich der Filter der Abbildung — der Gastgeber liest ihn
   über die zurückgegebene Steuerung. Ein Klick auf einen Knoten fokussiert
   ihn: nur er und seine verbundenen Elemente bleiben stehen, eingepasst;
   ein zweiter Klick hebt den Fokus wieder auf.

   Die alte Route #/graph leitet in den Überblick weiter. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;

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
  /* Der Gastgeber: Rückrufe und der Ort für die Popover. */
  var wirt = {};
  /* Während die Sicht verborgen ist, wird nicht gezeichnet; beim
     Sichtbarwerden wird nachgeholt. */
  var zeichnungFaellig = false;
  var gemeldeteAuswahl = null;

  function standardZustand() {
    var kategorien = {};
    HT.graph.KATEGORIEN.forEach(function (k) { kategorien[k.key] = true; });
    return {
      ansicht: 'phasen',
      umfang: { vorgehen: 'klassisch', phasen: [], module: [] },
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

  /* Die Teile der Adresse, die den Graphen beschreiben; der Gastgeber setzt
     sie in seine Route ein. */
  function urlTeile() {
    var teile = ['ansicht=' + zustand.ansicht];
    if (zustand.umfang.vorgehen === 'agil') { teile.push('vorgehen=agil'); }
    if (zustand.umfang.phasen.length) { teile.push('phase=' + encodeURIComponent(zustand.umfang.phasen.join(','))); }
    if (zustand.umfang.module.length) { teile.push('modul=' + encodeURIComponent(zustand.umfang.module.join(','))); }
    if (zustand.fokusId) { teile.push('fokus=' + encodeURIComponent(zustand.fokusId)); }
    if (zustand.auswahlId && zustand.auswahlId !== zustand.fokusId) { teile.push('id=' + encodeURIComponent(zustand.auswahlId)); }
    return teile;
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
    geaendert();
  }

  function vorgehenSetzen(key) {
    if (zustand.umfang.vorgehen === key) { return; }
    zustand.umfang.vorgehen = key;
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

  /** Auswahl ohne Fokus: der Gastgeber hält ein Element fest (Abbildung),
      der Graph umrandet es. */
  function auswaehlen(id) {
    zustand.auswahlId = id || null;
    if (zeichner) { auswahlZeigen(); }
    melden();
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
      her — das Element bleibt gewählt, die Inhaltsseite zeigt es weiter. */
  function fokusSetzen(id) {
    if (!id || zustand.fokusId === id) {
      zustand.fokusId = null;
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

  /* Knöpfe, die einen Popover öffnen — auch die, die der Gastgeber über
     filterKnopf() erhalten hat. Ein Klick auf sie schliesst den Popover nicht. */
  function popAusloeser() {
    return Object.keys(POPS).map(function (k) { return refs[POPS[k].knopf]; }).concat(refs.filterKnoepfe || []);
  }

  function popZeichnen() {
    if (!refs.pop) { return; }
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
    var titel = typeof meta.titel === 'function' ? meta.titel() : meta.titel;
    var knoepfe = zustand.pop === 'alle' ? [refs.knopfAlle].concat(refs.filterKnoepfe || []) : [refs[meta.knopf]];
    knoepfe.forEach(function (b) { if (b) { b.setAttribute('aria-expanded', 'true'); } });
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

  /* Alle Filter auf einer Seite: Ansicht, Vorgehensweise, Phasen, Szenarien,
     Module, Elemente, Verbindungen, Darstellung. Phasen und Module sind
     Häkchenlisten; «alle» heisst im Modell eine leere Liste, darum zeigt die
     Liste dann jedes Häkchen gesetzt, und wer eines wegnimmt, behält die
     übrigen. Sind wieder alle gesetzt, wird die Liste leer. Der Umfang gilt
     zugleich für die Abbildung des Überblicks. */
  function alleFilterInhalt() {
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
        h('p', { class: 'gpop__hinweis gaf__fuss-hinweis', text: 'Phasen, Szenarien und Module gelten für Abbildung und Graph; Elemente, Verbindungen und Darstellung nur für den Graphen. Jedes Häkchen wirkt sofort.' }),
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

  /* --- Werkzeuge ------------------------------------------------------------ */

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

  var IKONE_FILTER = ['M3.5 5h17', 'M6.5 12h11', 'M10 19h4'];

  /* Die Knöpfe der rechten Icon-Leiste, das Suchfeld des Such-Popovers, der
     Zoom und das «×» für den Fokus. */
  function werkzeugeBauen() {
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

    /* Der Statustext («10 Rollen, 13 Aufgaben …») ist in der Legende
       sichtbar; hier bleibt er für Screenreader als Live-Bereich. */
    refs.status = h('p', { class: 'graph-status nur-sr', role: 'status', 'aria-live': 'polite' });

    /* «×» auf der Fläche, links neben der rechten Icon-Leiste: hebt den
       Fokus auf. */
    refs.fokusX = h('button', {
      type: 'button', class: 'gfokus-x', title: 'Auswahl aufheben (Esc)', 'aria-label': 'Auswahl aufheben',
      on: { click: function () { fokusSetzen(null); } }
    }, [h('span', { 'aria-hidden': 'true', text: '×' })]);
    refs.fokusX.hidden = true;

    refs.knopfAlle = werkzeugKnopf('graph-werkzeug--filter', 'Alle Filter: Phasen, Szenarien, Module, Elemente',
      IKONE_FILTER, function () { popOeffnen('alle'); });
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
  }

  /* Ein weiterer Knopf für «Alle Filter» — der Gastgeber stellt ihn in seine
     eigene Leiste (Abbildung), er zeigt denselben Zustand wie der in der
     Icon-Leiste. */
  function filterKnopf() {
    var knopf = werkzeugKnopf('graph-werkzeug--filter', 'Alle Filter: Phasen, Szenarien, Module',
      IKONE_FILTER, function () { popOeffnen('alle'); });
    refs.filterKnoepfe = (refs.filterKnoepfe || []).concat([knopf]);
    knopf.classList.toggle('ist-aktiv', HT.graph.umfangAktiv(zustand.umfang));
    return knopf;
  }

  function werkzeugeAktualisieren() {
    var fokus = zustand.fokusId ? HT.daten.eintragMitId(zustand.fokusId) : null;
    refs.fokusX.hidden = !fokus;
    if (fokus) { refs.fokusX.title = 'Auswahl «' + fokus.begriff + '» aufheben (Esc)'; }
    refs.fokusHinweis.hidden = !fokus;
    if (fokus) {
      var meta = HT.graph.KAT[fokus.kategorie];
      refs.fokusText.textContent = 'Nur «' + fokus.begriff + '» (' + meta.singular + ') und die direkt verbundenen Elemente.';
    }
    var aktiv = HT.graph.umfangAktiv(zustand.umfang);
    [refs.knopfAlle].concat(refs.filterKnoepfe || []).forEach(function (b) {
      if (b) { b.classList.toggle('ist-aktiv', aktiv); }
    });
  }

  /* --- Icon-Leisten --------------------------------------------------------- */

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

  /* Rechte Icon-Leiste: Alle Filter, Suche, Darstellung, Legende und
     darunter der Zoom. */
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
    var feld = refs.sucheFeld, liste = refs.sucheListe;
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
          zeigen(k.id);
        } }
      }, [
        h('span', { class: 'gswatch gswatch--' + k.kategorie, 'aria-hidden': 'true' }, HT.ui.katSymbol(k.kategorie, 13)),
        h('span', { class: 'gs-treffer__text', text: k.begriff })
      ])));
    });
    liste.hidden = false;
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
    } else if (e.kategorie === 'szenario') {
      zustand.fokusId = null; umfangVorFokus = null;
      zustand.umfang.module = (HT.graph.szenarioModule(e.begriff) || []).slice();
      zustand.umfang.phasen = [];
      zustand.ansicht = 'module';
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

    werkzeugeBauen();
    var kinder = [refs.flaeche, railBauen(), railRechtsBauen(), refs.fokusX, refs.leer, refs.fokusHinweis, refs.tooltip, refs.status];
    /* Der Popover liegt beim Gastgeber, damit «Alle Filter» auch über der
       Abbildung erscheint, wenn der Graph verborgen ist. */
    if (wirt.popEltern) { wirt.popEltern.appendChild(refs.pop); } else { kinder.push(refs.pop); }
    refs.buehne = h('div', { class: 'graph-buehne' }, [
      h('div', { class: 'graph-flaeche-huelle' }, kinder)
    ]);

    zeichner = HT.graphZeichnen.erstellen(refs.flaeche, {
      freihalten: function () {
        return [refs.rail, refs.railRechts, refs.fokusX, refs.fokusHinweis].concat(wirt.freihalten ? wirt.freihalten() : []);
      },
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

  function tooltipVerbergen() { if (refs.tooltip) { refs.tooltip.hidden = true; } }

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

  function sichtbar() {
    return !wirt.sichtbar || wirt.sichtbar();
  }

  function graphZeichnen(einpassen) {
    tooltipVerbergen();
    if (!sichtbar()) { zeichnungFaellig = true; return; }
    zeichnungFaellig = false;
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
      zeichner.hervorheben(null, false);
    } else if (zustand.auswahlId) {
      auswahlZeigen();
    }
  }

  /* Im Fokus sind es wenige Knoten — sie dürfen die Fläche füllen. */
  function einpassOptionen() {
    return zustand.fokusId ? { maxZoom: 1.6, minZoom: 0.35 } : {};
  }

  /* Dem Gastgeber sagen, was sich geändert hat: die Auswahl (nur bei
     Wechsel) und den Zustand insgesamt (Umfang für die Abbildung, Adresse). */
  function melden() {
    if (gemeldeteAuswahl !== zustand.auswahlId) {
      gemeldeteAuswahl = zustand.auswahlId;
      if (wirt.beiAuswahl) { wirt.beiAuswahl(zustand.auswahlId ? HT.daten.eintragMitId(zustand.auswahlId) : null); }
    }
    if (wirt.beiZustand) { wirt.beiZustand(); }
  }

  function alles(einpassen) {
    werkzeugeAktualisieren();
    graphZeichnen(einpassen);
    melden();
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

  /* --- Einbetten ------------------------------------------------------------ */

  function globalBinden() {
    if (refs.globalGebunden) { return; }
    refs.globalGebunden = true;
    /* Popover schliesst bei Klick daneben und mit Escape. */
    document.addEventListener('click', function (ev) {
      if (!zustand.pop || !refs.buehne || !document.body.contains(refs.buehne)) { return; }
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
      if (ev.key !== 'Escape' || !refs.buehne || !document.body.contains(refs.buehne)) { return; }
      if (zustand.pop) { popSchliessen(); } else if (zustand.fokusId && sichtbar()) { fokusSetzen(null); }
    });
    /* Im Hintergrund aufgebaut: beim Sichtbarwerden neu einpassen. */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') { return; }
      if (!zeichner || !refs.buehne || !document.body.contains(refs.buehne) || !sichtbar()) { return; }
      global.setTimeout(function () { zeichner.einpassen(einpassOptionen()); }, 60);
    });
    var resizeTimer = null;
    global.addEventListener('resize', function () {
      if (!refs.buehne || !document.body.contains(refs.buehne) || !sichtbar()) { return; }
      if (resizeTimer) { clearTimeout(resizeTimer); }
      resizeTimer = setTimeout(function () { if (zeichner) { zeichner.einpassen(einpassOptionen()); } }, 150);
    });
  }

  /** Die Graph-Sicht in einen Behälter setzen.
      optionen: { params, popEltern, sichtbar(), freihalten(), beiAuswahl(eintrag), beiZustand() }
      Liefert die Steuerung, über die der Gastgeber Umfang, Auswahl und
      Sichtbarkeit anspricht. */
  function einbetten(behaelter, optionen) {
    HT.graph.bauen();
    wirt = optionen || {};
    if (!initialisiert) {
      wiederherstellen();
      initialisiert = true;
    }
    refs = { globalGebunden: refs.globalGebunden, filterKnoepfe: [] };
    zeichner = null;
    zustand.pop = null;
    gemeldeteAuswahl = null;
    parameterAnwenden(wirt.params);

    behaelter.appendChild(buehneBauen());
    globalBinden();

    /* Erst zeichnen, wenn die Fläche ihre Grösse hat — in einem Hintergrundtab
       läuft requestAnimationFrame nicht, darum zusätzlich ein Timeout. */
    var aufgebaut = false;
    function ersterAufbau() {
      if (aufgebaut || !document.body.contains(refs.buehne)) { return; }
      aufgebaut = true;
      alles(true);
    }
    global.requestAnimationFrame(ersterAufbau);
    global.setTimeout(ersterAufbau, 150);

    return {
      buehne: refs.buehne,
      umfang: function () { return zustand.umfang; },
      umfangAktiv: function () { return HT.graph.umfangAktiv(zustand.umfang); },
      auswahlId: function () { return zustand.auswahlId; },
      fokusId: function () { return zustand.fokusId; },
      urlTeile: urlTeile,
      filterKnopf: filterKnopf,
      filterOeffnen: function () { popOeffnen('alle'); },
      popSchliessen: popSchliessen,
      auswaehlen: auswaehlen,
      fokus: fokusSetzen,
      zeigen: zeigen,
      suchtreffer: suchtrefferAnwenden,
      listeSchalten: listeSchalten,
      zuruecksetzen: alleZuruecksetzen,
      /* Nach dem Einblenden: Nachholen, was verborgen nicht gezeichnet wurde,
         sonst neu einpassen — die Fläche hatte verborgen keine Grösse. */
      sichtbarGeworden: function () {
        global.requestAnimationFrame(function () {
          if (!zeichner || !document.body.contains(refs.buehne)) { return; }
          if (zeichnungFaellig) { alles(true); } else { zeichner.einpassen(einpassOptionen()); }
        });
      },
      verborgen: function () { popSchliessen(); tooltipVerbergen(); }
    };
  }

  HT.graphSicht = { einbetten: einbetten, ANSICHTEN: ANSICHTEN };

  /* Alte Adresse #/graph?…: in den Überblick, Graph-Sicht, mit denselben
     Parametern. */
  HT.views.graph = {
    titel: 'Graph',
    nav: 'ueberblick',
    render: function (behaelter, params) {
      var teile = ['sicht=graph'];
      Object.keys(params || {}).forEach(function (k) {
        if (k !== 'sicht') { teile.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k])); }
      });
      global.location.replace('#/ueberblick?' + teile.join('&'));
    }
  };
}(window));
