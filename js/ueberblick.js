/* HERMES-Trainer — Ansicht «Überblick» (Methodenüberblick).

   Eine Werkbank aus zwei Bereichen: links Abbildung 1 des Referenzhandbuchs
   («Gesamtbild der HERMES-Module und der wesentlichen Ergebnisse entlang der
   Phasen») unverändert als Originalgrafik von hermes.admin.ch, darüber eine
   unsichtbare Trefferschicht; rechts eine Inhaltsseite, die zu jedem Kasten
   immer dieselben Abschnitte in derselben Reihenfolge zeigt. Dazwischen eine
   ziehbare Trennlinie.

   Zwei Modi:
   – Erkunden — Zeigen füllt die Inhaltsseite, Klick hält den Eintrag fest.
     Über die Steuerung lässt sich eine Rolle einfärben oder alles ausblassen,
     was nicht minimal gefordert ist.
   – Abfragen — die Ergebniskästen werden verdeckt; gesucht wird der Ort in
     der Abbildung. Modulrahmen und Phasenbalken bleiben sichtbar, sie sind
     die Orientierungspunkte. Fehler werden gezählt und kommen in späteren
     Runden häufiger dran.

   Die Grafik wird nicht nachgebaut: Kästen, Beschriftungen und Pfeile stammen
   aus der SVG-Datei. Zur Laufzeit werden nur die Kästen über Füllfarbe und
   Kontur erkannt, ihre Beschriftung aus den Textfragmenten zusammengesetzt
   und mit den Einträgen aus data/ verbunden. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* Abbildung, Farben und Kastenerkennung liegen in js/abbildung.js — der
     Trainer nutzt dieselbe Grafik und dieselbe Zuordnung zum Lexikon. */
  var BILDUNTERSCHRIFT = HT.abbildung.BILDUNTERSCHRIFT;
  var QUELLE_ABB = HT.abbildung.QUELLE;
  var QUELLE_ALLGEMEIN = 'https://www.hermes.admin.ch/de/projektmanagement.html';
  var FARBEN = HT.abbildung.FARBEN;


  /* Farben der Trefferschicht. */
  var AKZENT = '#ec3013';
  var TINTE = '#201e1d';

  var ZOOM_MIN = 0.4;
  var ZOOM_MAX = 2.5;
  var ZOOM_SCHRITT = 1.2;

  var INHALT_STANDARD = 420;   // Breite der Inhaltsseite in px
  var INHALT_MIN = 280;
  var ABB_MIN = 380;           // so viel bleibt der Abbildung mindestens

  var GRAPH_STANDARD = 260;    // Höhe des Graphbereichs unten in px
  var GRAPH_MIN = 120;
  var TEXT_MIN = 160;          // so viel bleibt dem Text darüber mindestens

  var RUNDEN_LAENGE = 12;
  var SPEICHER = 'ueberblick-drill';

  /* Die Zeichen, aus denen die Originalgrafik besteht — Legende unter der
     Abbildung. Sie greift auf FARBEN zu, damit Legende und Kastenerkennung
     nicht auseinanderlaufen. Die Kästen selbst sind anklickbar, die Linien
     und Rauten nicht. */
  var ABB_LEGENDE = [
    { form: 'ergebnis', text: 'Ergebnis — Dokument oder Checkliste' },
    { form: 'zustand', text: 'Ergebnis — Zustand' },
    { form: 'modul', text: 'Modul — Kopf einer Spalte' },
    { form: 'phase', text: 'Phase — Band am linken Rand' },
    { form: 'meilenstein', text: 'Meilenstein — Phasenübergang als Quality Gate' },
    { form: 'iteration', text: 'Iteration — agile Vorgehensweise' }
  ];

  var LEGENDE = [
    { kat: 'rolle', text: 'Rolle — wer verantwortet und mitwirkt' },
    { kat: 'aufgabe', text: 'Aufgabe — was getan wird' },
    { kat: 'ergebnis', text: 'Ergebnis — was dabei entsteht' },
    { kat: 'meilenstein', text: 'Meilenstein — Ergebnis als Quality Gate' },
    { kat: 'modul', text: 'Modul — Bündel von Aufgaben und Ergebnissen' },
    { kat: 'phase', text: 'Phase — Abschnitt im Projektverlauf' }
  ];

  var zustand = {
    modus: 'erkunden',        // 'erkunden' | 'abfragen'
    rolle: '',                // eingefärbte Rolle (Begriff) oder ''
    szenario: '',             // Szenario (Begriff) oder '': alles ausserhalb seiner Module blasst ab
    phasen: [],               // gewählte Phasen (leer = alle); der Rest blasst ab
    module: [],               // gewählte Module (leer = alle); der Rest blasst ab
    nurMinimal: false,        // alles ausblassen, was nicht minimal gefordert ist
    zoom: 1,
    aktiv: null,              // Eintrag, den die Inhaltsseite zeigt
    gezeichnet: null,         // id des zuletzt gezeichneten Eintrags
    gehalten: false,          // durch Klick festgehalten
    nurAbb: false,            // Inhaltsseite eingeklappt («Breit»)
    panel: false,             // Steuerung offen
    legende: false,           // Zeichen der Abbildung eingeblendet
    inhaltBreite: INHALT_STANDARD,
    graphHoehe: GRAPH_STANDARD,
    graphOffen: true,         // unterer Bereich der Inhaltsseite aufgeklappt
    runde: null,              // { aufgaben, i, phase, falschesFeld }
    punkte: 0,
    versuche: 0,
    serie: 0,
    besteSerie: 0,
    fehler: {},               // Begriff -> Anzahl Fehlversuche
    initialisiert: false
  };

  var refs = {};
  var passTimer = null;
  var groesseAngemeldet = false;

  /* --- Zustand sichern ----------------------------------------------------- */

  /* Gespeichert wird, was über eine Runde hinaus zählt: die Fehlerbilanz, die
     beste Serie und der Zuschnitt des unteren Bereichs — ein zugeklappter
     Graph soll zugeklappt bleiben. Punkte und laufende Serie gehören zur
     Runde, die Spaltenbreite stellt sich bei jedem Aufruf neu ein. */
  function speichern() {
    HT.store.schreib(SPEICHER, {
      fehler: zustand.fehler,
      besteSerie: zustand.besteSerie,
      graphHoehe: zustand.graphHoehe,
      graphOffen: zustand.graphOffen,
      legende: zustand.legende
    });
  }

  function wiederherstellen() {
    var g = HT.store.lies(SPEICHER, null);
    if (!g || typeof g !== 'object') { return; }
    if (g.fehler && typeof g.fehler === 'object') { zustand.fehler = g.fehler; }
    if (typeof g.besteSerie === 'number' && g.besteSerie >= 0) { zustand.besteSerie = g.besteSerie; }
    if (typeof g.graphHoehe === 'number' && g.graphHoehe >= GRAPH_MIN) { zustand.graphHoehe = g.graphHoehe; }
    if (typeof g.graphOffen === 'boolean') { zustand.graphOffen = g.graphOffen; }
    if (typeof g.legende === 'boolean') { zustand.legende = g.legende; }
  }

  /* --- Trefferschicht ------------------------------------------------------ */

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] !== null) {
        el.setAttribute(k, String(attrs[k]));
      }
    }
    return el;
  }

  function namenVon(eintraege) {
    return eintraege.map(function (x) { return x.begriff; }).join(' / ');
  }

  function feldBauen(k, eintraege) {
    var gruppe = svgEl('g', { tabindex: '0', role: 'button', 'class': 'ub-feld' });
    var flaeche = svgEl('rect', {
      x: k.x - 1, y: k.y - 1, width: k.w + 2, height: k.h + 2,
      fill: '#ffffff', 'fill-opacity': '0', stroke: 'none'
    });
    var titel = svgEl('title', {});
    titel.appendChild(document.createTextNode(namenVon(eintraege)));

    gruppe.appendChild(flaeche);
    gruppe.appendChild(titel);

    var feld = {
      gruppe: gruppe, flaeche: flaeche, titel: titel, deckel: null,
      eintraege: eintraege, rahmen: k, art: k.art,
      name: namenVon(eintraege), schwebt: false, aufgedeckt: false
    };

    gruppe.addEventListener('mouseenter', function () {
      feld.schwebt = true;
      if (zustand.modus === 'erkunden' && !zustand.gehalten) { aktivSetzen(eintraege[0]); }
      malen();
    });
    gruppe.addEventListener('mouseleave', function () { feld.schwebt = false; malen(); });
    gruppe.addEventListener('focus', function () {
      feld.schwebt = true;
      if (zustand.modus === 'erkunden' && !zustand.gehalten) { aktivSetzen(eintraege[0]); }
      malen();
    });
    gruppe.addEventListener('blur', function () { feld.schwebt = false; malen(); });
    gruppe.addEventListener('click', function () { feldGeklickt(feld); });
    gruppe.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
        ev.preventDefault();
        feldGeklickt(feld);
      }
    });

    return feld;
  }

  function feldGeklickt(feld) {
    if (zustand.modus === 'abfragen') { antworten(feld); return; }
    var gleich = zustand.aktiv && zustand.aktiv.id === feld.eintraege[0].id;
    zustand.gehalten = !(gleich && zustand.gehalten);
    aktivSetzen(feld.eintraege[0]);
    malen();
    if (zustand.gehalten) { inhaltInSichtBringen(); }
  }

  /* Auf schmalen Schirmen steht die Inhaltsseite unter der Abbildung; ohne
     diesen Sprung sieht ein Tippen auf einen Kasten nach nichts aus. */
  function inhaltInSichtBringen() {
    if (!refs.inhalt || !global.matchMedia) { return; }
    if (!global.matchMedia('(max-width: 699.98px)').matches) { return; }
    try {
      refs.inhalt.scrollIntoView({ block: 'start' });
    } catch (e) {
      refs.inhalt.scrollIntoView();
    }
  }

  function aktivSetzen(eintrag) {
    if (zustand.aktiv === eintrag) { return; }
    zustand.aktiv = eintrag;
    inhaltZeichnen();
  }

  /* --- Einfärben ----------------------------------------------------------- */

  function rollenBezug(e) {
    if (!zustand.rolle || e.kategorie !== 'ergebnis') { return ''; }
    var norm = HT.daten.normalisieren(zustand.rolle);
    if (HT.daten.normalisieren(e.verantwortlich || '') === norm) { return 'verantwortlich'; }
    var beteiligt = e.beteiligt || [];
    for (var i = 0; i < beteiligt.length; i++) {
      if (HT.daten.normalisieren(beteiligt[i]) === norm) { return 'beteiligt'; }
    }
    return 'ohne';
  }

  /* Gezeichnet wird ausschliesslich auf der Trefferschicht; die Originalgrafik
     bleibt unangetastet. */
  function malen() {
    var runde = zustand.runde;
    var gesucht = runde ? runde.aufgaben[runde.i] : null;

    (refs.felder || []).forEach(function (f) {
      var e = f.eintraege[0];
      var fill = '#ffffff', op = 0, stroke = 'none', sw = 0;
      var verdeckt = false;

      if (zustand.modus === 'abfragen') {
        verdeckt = f.art === 'ergebnis' && !!runde && runde.phase !== 'ende' && !f.aufgedeckt;
        if (f.deckel) { f.deckel.style.display = verdeckt ? 'block' : 'none'; }

        if (runde && gesucht && istGesucht(f, gesucht) && runde.phase !== 'frage') {
          fill = AKZENT; op = 0.32; stroke = AKZENT; sw = 2;
        } else if (runde && f === runde.falschesFeld) {
          fill = TINTE; op = 0.1; stroke = TINTE; sw = 2;
        } else if (f.schwebt && f.art === 'ergebnis' && runde && runde.phase === 'frage') {
          fill = TINTE; op = 0.08;
        }
      } else {
        if (f.deckel) { f.deckel.style.display = 'none'; }
        var bezug = rollenBezug(e);
        var blass = (zustand.nurMinimal && e.kategorie === 'ergebnis' && !e.minimalGefordert)
          || (zustand.szenario && !imSzenario(f))
          || !imAuswahl(f);

        if (bezug === 'verantwortlich') { fill = AKZENT; op = 0.3; stroke = AKZENT; sw = 2; }
        else if (bezug === 'beteiligt') { op = 0; stroke = AKZENT; sw = 2; }
        else if (bezug === 'ohne' || blass) { fill = '#ffffff'; op = (bezug === 'ohne' && blass) ? 0.82 : 0.7; }

        if (zustand.gehalten && zustand.aktiv && istGleich(f, zustand.aktiv)) {
          fill = AKZENT; op = 0.18; stroke = AKZENT; sw = 2;
        }
        if (f.schwebt) { fill = AKZENT; op = 0.2; stroke = AKZENT; sw = 2; }
      }

      f.flaeche.setAttribute('fill', fill);
      f.flaeche.setAttribute('fill-opacity', String(op));
      f.flaeche.setAttribute('stroke', stroke);
      f.flaeche.setAttribute('stroke-width', String(sw));

      /* Verdeckte Kästen dürfen ihren Namen nicht im Tooltip verraten. */
      f.titel.textContent = verdeckt ? 'Verdeckter Ergebniskasten' : f.name;
    });
  }

  /* Szenario-Filter: ein Feld gehört dazu, wenn eines seiner Elemente in
     einem Modul des Szenarios liegt (Modulköpfe über ihren Namen). Phasen
     bleiben immer sichtbar — sie sind die Orientierung. */
  /* Modulliste aus dem Graphmodell — samt der zwingenden Module (Kap. 3.2.1). */
  function szenarioModule(name) {
    return (HT.graph && HT.graph.szenarioModule(name)) || [];
  }
  function imSzenario(feld) {
    if (feld.art === 'phase') { return true; }
    var module = szenarioModule(zustand.szenario);
    return feld.eintraege.some(function (e) {
      if (e.kategorie === 'modul') { return module.indexOf(e.begriff) !== -1; }
      return (e.module || []).some(function (m) { return module.indexOf(m) !== -1; });
    });
  }

  /* Phasen- und Modulauswahl: leer heisst alle. Ein Ergebniskasten passt,
     wenn eines seiner Elemente in einer gewählten Phase und einem gewählten
     Modul liegt; Modulköpfe zählen über ihren Namen, Phasenbalken über ihren. */
  function filterAktiv() {
    return !!(zustand.phasen.length || zustand.module.length || zustand.szenario);
  }
  function imAuswahl(feld) {
    var ph = zustand.phasen, mo = zustand.module;
    if (!ph.length && !mo.length) { return true; }
    return feld.eintraege.some(function (e) {
      if (e.kategorie === 'phase') { return !ph.length || ph.indexOf(e.begriff) !== -1; }
      if (e.kategorie === 'modul') { return !mo.length || mo.indexOf(e.begriff) !== -1; }
      var phOk = !ph.length || (e.phasen || []).some(function (p) { return ph.indexOf(p) !== -1; });
      var moOk = !mo.length || (e.module || []).some(function (m) { return mo.indexOf(m) !== -1; });
      return phOk && moOk;
    });
  }
  function filterGeaendert() {
    malen();
    werkzeugAktualisieren();
  }

  function istGleich(feld, eintrag) {
    return feld.eintraege.some(function (x) { return x.id === eintrag.id; });
  }

  function istGesucht(feld, gesucht) {
    return istGleich(feld, gesucht);
  }

  /* --- Diagramm einsetzen -------------------------------------------------- */

  function diagrammVeredeln(svg) {
    var gruppe = svg.getElementsByTagName('g')[0] || svg;
    var kaesten = HT.abbildung.kaesten(svg);

    var maske = svgEl('g', { 'class': 'ub-deckel' });
    var ebene = svgEl('g', { 'class': 'ub-felder' });
    var felder = [];
    var ohneTreffer = [];

    kaesten.forEach(function (k) {
      if (!k.beschriftung) { return; }
      var eintraege = k.eintraege;
      if (!eintraege) { ohneTreffer.push(k.beschriftung); return; }

      var feld = feldBauen(k, eintraege);
      if (k.art === 'ergebnis') {
        /* Der Deckel trägt die Originalfüllung des Kastens: im Abfragemodus
           bleibt der Kasten sichtbar, nur die Beschriftung verschwindet. */
        feld.deckel = svgEl('rect', {
          x: k.x + 1, y: k.y + 1,
          width: Math.max(0, k.w - 2), height: Math.max(0, k.h - 2),
          fill: k.fuell, stroke: 'none'
        });
        feld.deckel.style.display = 'none';
        maske.appendChild(feld.deckel);
      }
      felder.push(feld);
      ebene.appendChild(feld.gruppe);
    });

    gruppe.appendChild(maske);
    gruppe.appendChild(ebene);
    refs.felder = felder;

    if (ohneTreffer.length && global.console && global.console.info) {
      global.console.info('Überblick: Kästen ohne Lexikoneintrag —', ohneTreffer.join(' · '));
    }
  }

  function diagrammEinsetzen(svg) {
    var breite = Number(svg.getAttribute('width')) || 1059;
    var hoehe = Number(svg.getAttribute('height')) || 759;

    svg.setAttribute('viewBox', '0 0 ' + breite + ' ' + hoehe);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.removeAttribute('overflow');
    svg.setAttribute('class', 'ub-abb');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', BILDUNTERSCHRIFT);

    diagrammVeredeln(svg);

    refs.abb = svg;
    refs.abbBreite = breite;

    HT.ui.leeren(refs.buehne);
    refs.buehne.appendChild(svg);
    zoomPassend();
    malen();
    rundeNachladenRichten();
  }

  /* Die Felder entstehen erst mit der Abbildung. Wer vorher auf «Abfragen»
     schaltet oder die Ansicht mit laufender Runde verlässt und zurückkommt,
     trifft auf eine leere oder auf verschwundene Felder zeigende Runde. */
  function rundeNachladenRichten() {
    if (zustand.modus !== 'abfragen') { return; }
    var runde = zustand.runde;
    if (!runde || !runde.aufgaben.length) { rundeStarten(); return; }

    runde.falschesFeld = null;
    var gesucht = runde.aufgaben[runde.i];
    if (gesucht && runde.phase !== 'frage') {
      refs.felder.forEach(function (f) { if (istGleich(f, gesucht)) { f.aufgedeckt = true; } });
    }
    promptZeichnen();
    malen();
  }

  /* --- Zoom ---------------------------------------------------------------- */

  function zoomAnwenden() {
    if (refs.abb && refs.abbBreite) {
      refs.abb.style.width = Math.round(refs.abbBreite * zustand.zoom) + 'px';
    }
    if (refs.zoomWert) { refs.zoomWert.textContent = Math.round(zustand.zoom * 100) + ' %'; }
  }

  function zoomSetzen(wert) {
    zustand.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, wert));
    zoomAnwenden();
  }

  function zoomPassend() {
    if (!refs.buehne || !refs.abbBreite) { return; }
    var platz = refs.buehne.clientWidth - 32;
    if (platz <= 0) { return; }
    zoomSetzen(platz / refs.abbBreite);
  }

  function zoomPassendSpaeter(verzoegerung) {
    global.clearTimeout(passTimer);
    passTimer = global.setTimeout(zoomPassend, verzoegerung || 60);
  }

  /* Massstab der Bühne: derselbe Zoom wie die Knöpfe unten rechts. */
  function buehneSkalieren(faktor) {
    var alt = zustand.zoom;
    zoomSetzen(alt * faktor);
    return zustand.zoom / alt;
  }

  /* Massstab des Beziehungsbilds: die Breite wächst oder schrumpft um den
     Faktor, begrenzt auf das 0,4- bis 3-Fache der Zeichnungsbreite. Ab dem
     ersten Zoomen gilt die CSS-Grenze «höchstens Spaltenbreite» nicht mehr. */
  function gbSkalieren(faktor) {
    var svg = refs.graph && refs.graph.querySelector('svg.ub-gb');
    if (!svg) { return 1; }
    var alt = svg.getBoundingClientRect().width;
    if (!alt) { return 1; }
    var natur = parseFloat(svg.getAttribute('data-breite')) || alt;
    var neu = Math.max(natur * 0.4, Math.min(natur * 3, alt * faktor));
    svg.style.width = Math.round(neu) + 'px';
    svg.style.maxWidth = 'none';
    return neu / alt;
  }

  /* --- Breite der Inhaltsseite --------------------------------------------- */

  function inhaltBreiteSetzen(px) {
    var grenze = Math.max(INHALT_MIN, global.innerWidth - ABB_MIN);
    zustand.inhaltBreite = Math.max(INHALT_MIN, Math.min(px, grenze));
    if (refs.werkbank) {
      refs.werkbank.style.setProperty('--ub-inhalt', zustand.inhaltBreite + 'px');
    }
  }

  function ziehenStarten(ev) {
    if (ev.button !== undefined && ev.button !== 0) { return; }
    ev.preventDefault();

    var startX = ev.clientX;
    var startBreite = zustand.inhaltBreite;

    function bewegen(e) { inhaltBreiteSetzen(startBreite - (e.clientX - startX)); }
    function beenden() {
      global.removeEventListener('mousemove', bewegen);
      global.removeEventListener('mouseup', beenden);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      zoomPassendSpaeter(60);
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    global.addEventListener('mousemove', bewegen);
    global.addEventListener('mouseup', beenden);
  }

  function trennerTaste(ev) {
    if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      inhaltBreiteSetzen(zustand.inhaltBreite + 24);
      zoomPassendSpaeter(60);
    } else if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      inhaltBreiteSetzen(zustand.inhaltBreite - 24);
      zoomPassendSpaeter(60);
    }
  }

  /* --- Schwebende Bedienelemente auf der Bühne ----------------------------- */

  /* Auf der Bühne liegen nur noch Icons: oben rechts öffnet ein Schieberegler
     die Steuerung (Modus, Rolle, Darstellung, Inhaltsseite einklappen), unten
     links blendet ein Info-Zeichen die Legende der Abbildung ein und aus, unten
     rechts sitzt der Zoom wie auf einer Karte. Die Icons sind dieselben wie in
     der Leiste des Graphen. */

  var IKONE_STEUERUNG = ['M4 7h10M18 7h2M4 17h4M12 17h8', 'M16 4.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z', 'M10 14.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z'];
  var IKONE_LEGENDE = ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 11v5.5', 'M12 7.6h.01'];

  function ikonKnopf(beschriftung, pfade, aufruf, attrs) {
    var a = { type: 'button', 'class': 'ub-ikonknopf', title: beschriftung, 'aria-label': beschriftung };
    for (var k in (attrs || {})) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) { a[k] = attrs[k]; }
    }
    var el = h('button', a, HT.ui.symbol(pfade, 18));
    el.addEventListener('click', aufruf);
    return el;
  }

  function werkzeugKnopf(text, klasse, aufruf, attrs) {
    var a = { type: 'button', 'class': klasse, text: text };
    for (var k in (attrs || {})) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) { a[k] = attrs[k]; }
    }
    var el = h('button', a);
    el.addEventListener('click', aufruf);
    return el;
  }

  function werkzeugTrenner() {
    return h('span', { class: 'ub-schweber__strich', 'aria-hidden': 'true' });
  }

  function werkzeugAktualisieren() {
    if (!refs.knopfPanel) { return; }
    refs.knopfPanel.setAttribute('aria-expanded', zustand.panel ? 'true' : 'false');
    refs.knopfLegende.setAttribute('aria-expanded', zustand.legende ? 'true' : 'false');
    if (refs.abblegende) { refs.abblegende.hidden = !zustand.legende; }
    refs.werkbank.dataset.breit = zustand.nurAbb ? 'true' : 'false';
    refs.werkbank.dataset.modus = zustand.modus;
    refs.knopfPanel.classList.toggle('ist-aktiv', filterAktiv());
  }

  function legendeSchalten() {
    zustand.legende = !zustand.legende;
    werkzeugAktualisieren();
    speichern();
  }

  function breitSetzen(nurAbb) {
    if (zustand.nurAbb === nurAbb) { return; }
    zustand.nurAbb = nurAbb;
    werkzeugAktualisieren();
    zoomPassendSpaeter(40);
  }

  function modusSetzen(modus) {
    if (zustand.modus === modus) { return; }
    zustand.modus = modus;
    zustand.panel = false;
    panelZeichnen();

    if (modus === 'abfragen') {
      rundeStarten();
    } else {
      zustand.runde = null;
      zustand.aktiv = null;
      zustand.gehalten = false;
      (refs.felder || []).forEach(function (f) { f.aufgedeckt = false; });
      promptZeichnen();
      inhaltZeichnen();
      malen();
    }
    werkzeugAktualisieren();
  }

  function schweberBauen() {
    refs.zoomWert = h('span', {
      class: 'ub-zoom__wert', role: 'status',
      text: Math.round(zustand.zoom * 100) + ' %'
    });

    refs.knopfPanel = ikonKnopf('Steuerung', IKONE_STEUERUNG, function () { panelSchalten(); },
      { 'aria-expanded': 'false', 'aria-haspopup': 'dialog' });
    refs.knopfLegende = ikonKnopf('Zeichen der Abbildung', IKONE_LEGENDE, legendeSchalten,
      { 'aria-expanded': 'false', 'aria-controls': 'ub-abblegende' });

    return [
      h('div', { class: 'ub-schweber ub-schweber--steuerung' }, [refs.knopfPanel]),
      h('div', { class: 'ub-schweber ub-schweber--legende' }, [refs.knopfLegende]),
      h('div', { class: 'ub-schweber ub-schweber--zoom', role: 'group', 'aria-label': 'Zoom' }, [
        werkzeugKnopf('−', 'ub-zoom__knopf', function () { zoomSetzen(zustand.zoom / ZOOM_SCHRITT); },
          { 'aria-label': 'Verkleinern' }),
        refs.zoomWert,
        werkzeugKnopf('+', 'ub-zoom__knopf', function () { zoomSetzen(zustand.zoom * ZOOM_SCHRITT); },
          { 'aria-label': 'Vergrössern' }),
        werkzeugTrenner(),
        werkzeugKnopf('Passend', 'ub-schweber__knopf', zoomPassend,
          { title: 'Abbildung auf die Breite der Bühne bringen' })
      ]
    )];
  }

  /* --- Steuerung (Überlagerung) -------------------------------------------- */

  function panelSchalten() {
    zustand.panel = !zustand.panel;
    panelZeichnen();
    werkzeugAktualisieren();
    if (zustand.panel && refs.panelErstes) { refs.panelErstes.focus(); }
  }

  function panelSchliessen(zurueck) {
    if (!zustand.panel) { return; }
    zustand.panel = false;
    panelZeichnen();
    werkzeugAktualisieren();
    if (zurueck && refs.knopfPanel) { refs.knopfPanel.focus(); }
  }

  function rollenZahlen() {
    var verantwortet = 0, beteiligt = 0;
    (refs.felder || []).forEach(function (f) {
      var bezug = rollenBezug(f.eintraege[0]);
      if (bezug === 'verantwortlich') { verantwortet++; }
      if (bezug === 'beteiligt') { beteiligt++; }
    });
    return { verantwortet: verantwortet, beteiligt: beteiligt };
  }

  /* Der Modus steht als erster Block in der Steuerung — als Segment aus zwei
     Knöpfen, wie vorher als Tabs auf der Bühne. */
  function panelModus() {
    var erkunden = zustand.modus === 'erkunden';
    var tabErkunden = werkzeugKnopf('Erkunden', 'ub-tab', function () { modusSetzen('erkunden'); },
      { 'aria-pressed': erkunden ? 'true' : 'false' });
    var tabAbfragen = werkzeugKnopf('Abfragen', 'ub-tab', function () { modusSetzen('abfragen'); },
      { 'aria-pressed': erkunden ? 'false' : 'true' });
    refs.panelErstes = erkunden ? tabErkunden : tabAbfragen;
    return h('div', { class: 'ub-panel__block' }, [
      h('div', { class: 'ub-panel__label', text: 'Modus' }),
      h('div', { class: 'ub-segment', role: 'group', 'aria-label': 'Modus' }, [tabErkunden, tabAbfragen]),
      h('p', { class: 'ub-panel__hilfe ub-panel__hilfe--allein', text: erkunden
        ? 'Zeigen füllt die Inhaltsseite, Klick hält den Eintrag fest.'
        : 'Die Ergebniskästen sind verdeckt; gesucht wird ihr Ort in der Abbildung.' })
    ]);
  }

  /* Die Inhaltsseite einklappen («Breit») — gestapelt unter 700 px gibt es
     keine Spalte, die sich einklappen liesse; die Zeile ist dann ausgeblendet. */
  function panelBreit() {
    var haken = h('input', { type: 'checkbox', class: 'ub-haken' });
    haken.checked = zustand.nurAbb;
    haken.addEventListener('change', function () { breitSetzen(haken.checked); });
    return h('label', { class: 'ub-panel__haken ub-panel__nurbreit' }, [
      haken,
      h('span', {}, [
        'Inhaltsseite einklappen',
        h('span', { class: 'ub-panel__hilfe', text: 'Nur die Abbildung, über die ganze Breite.' })
      ])
    ]);
  }

  /* Filterblock: Phasen und Module als Chips zum An- und Abwählen — leer
     heisst alle. Dazu das Szenario und ein Zurücksetzen. */
  function chipReihe(label, namen, liste) {
    var chips = namen.map(function (name) {
      var c = h('button', {
        type: 'button', class: 'ub-chip', text: name,
        'aria-pressed': liste.indexOf(name) !== -1 ? 'true' : 'false'
      });
      c.addEventListener('click', function () {
        var i = liste.indexOf(name);
        if (i === -1) { liste.push(name); } else { liste.splice(i, 1); }
        c.setAttribute('aria-pressed', i === -1 ? 'true' : 'false');
        filterGeaendert();
      });
      return c;
    });
    return h('div', { class: 'ub-filter__gruppe' }, [
      h('div', { class: 'ub-filter__label', text: label }),
      h('div', { class: 'ub-chips', role: 'group', 'aria-label': label }, chips)
    ]);
  }

  function panelFilter() {
    var szenarioWahl = h('select', { class: 'ub-select', id: 'ub-szenario' },
      [h('option', { value: '', text: '— alle —' })].concat(
        HT.daten.eintraegeDerKategorie('szenario').map(function (s) {
          return h('option', { value: s.begriff, text: s.begriff });
        })
      ));
    szenarioWahl.value = zustand.szenario;
    szenarioWahl.addEventListener('change', function () {
      zustand.szenario = szenarioWahl.value;
      filterGeaendert();
    });

    var reset = h('button', { type: 'button', class: 'ub-textknopf', text: 'Zurücksetzen' });
    reset.hidden = !filterAktiv();
    reset.addEventListener('click', function () {
      zustand.phasen = [];
      zustand.module = [];
      zustand.szenario = '';
      filterGeaendert();
      panelZeichnen();
    });

    return h('div', { class: 'ub-panel__block' }, [
      h('div', { class: 'ub-panel__kopf' }, [
        h('span', { class: 'ub-panel__label', text: 'Filter' }),
        reset
      ]),
      h('p', { class: 'ub-panel__hilfe ub-panel__hilfe--allein', text:
        'Nicht Gewähltes bleibt sichtbar, blasst aber ab. Ohne Auswahl gilt alles.' }),
      chipReihe('Phasen', HT.daten.phasenSortiert(namen('phase')), zustand.phasen),
      chipReihe('Module', namen('modul'), zustand.module),
      h('div', { class: 'ub-filter__gruppe' }, [
        h('label', { class: 'ub-filter__label', for: 'ub-szenario', text: 'Szenario' }),
        szenarioWahl
      ])
    ]);
  }

  function panelErkunden() {
    var auswahl = h('select', { class: 'ub-select', id: 'ub-rolle' },
      [h('option', { value: '', text: '— keine —' })].concat(
        HT.daten.alphabetisch(HT.daten.eintraegeDerKategorie('rolle')).map(function (r) {
          return h('option', { value: r.begriff, text: r.begriff });
        })
      ));
    auswahl.value = zustand.rolle;

    var zahl = h('p', { class: 'ub-panel__zahl' });
    function zahlSchreiben() {
      var z = rollenZahlen();
      zahl.textContent = zustand.rolle
        ? (z.verantwortet + ' verantwortet · ' + z.beteiligt + ' beteiligt')
        : '';
    }
    zahlSchreiben();

    auswahl.addEventListener('change', function () {
      zustand.rolle = auswahl.value;
      malen();
      zahlSchreiben();
    });

    var haken = h('input', { type: 'checkbox', class: 'ub-haken' });
    haken.checked = zustand.nurMinimal;
    haken.addEventListener('change', function () {
      zustand.nurMinimal = haken.checked;
      malen();
    });

    return [
      panelModus(),
      panelFilter(),
      h('div', { class: 'ub-panel__block' }, [
        h('label', { class: 'ub-panel__label', for: 'ub-rolle', text: 'Rolle einfärben' }),
        auswahl,
        h('div', { class: 'ub-panel__legende' }, [
          h('span', {}, [h('span', { class: 'ub-swatch ub-swatch--voll', 'aria-hidden': 'true' }), 'verantwortlich']),
          h('span', {}, [h('span', { class: 'ub-swatch ub-swatch--rand', 'aria-hidden': 'true' }), 'beteiligt'])
        ]),
        zahl
      ]),
      h('div', { class: 'ub-panel__block' }, [
        h('div', { class: 'ub-panel__label', text: 'Darstellung' }),
        h('label', { class: 'ub-panel__haken' }, [
          haken,
          h('span', {}, [
            'Nur minimal geforderte Dokumente',
            h('span', { class: 'ub-panel__hilfe', text:
              'Blasst ab, was das Referenzhandbuch nicht als minimal gefordert führt.' })
          ])
        ]),
        panelBreit()
      ])
    ];
  }

  function panelAbfragen() {
    var schwach = Object.keys(zustand.fehler).map(function (k) {
      return { begriff: k, zahl: zustand.fehler[k] };
    }).sort(function (a, b) { return b.zahl - a.zahl; }).slice(0, 8);

    var neu = h('button', { type: 'button', class: 'ub-textknopf', text: 'Neue Runde' });
    neu.addEventListener('click', function () {
      panelSchliessen(false);
      rundeStarten();
    });

    var koerper = schwach.length
      ? h('ul', { class: 'ub-schwach' }, schwach.map(function (s) {
        return h('li', {}, [
          h('span', { class: 'ub-schwach__begriff', text: s.begriff }),
          h('span', { class: 'ub-schwach__zahl', text: s.zahl + '×' })
        ]);
      }))
      : h('p', { class: 'ub-panel__hilfe ub-panel__hilfe--allein', text:
        'Noch keine Fehler erfasst. Was hier landet, kommt in späteren Runden häufiger.' });

    return [
      panelModus(),
      h('div', { class: 'ub-panel__block' }, [
        h('div', { class: 'ub-panel__kopf' }, [
          h('span', { class: 'ub-panel__label', text: 'Schwachstellen' }),
          neu
        ]),
        koerper
      ]),
      h('div', { class: 'ub-panel__block ub-panel__block--nurbreit' }, [
        h('div', { class: 'ub-panel__label', text: 'Darstellung' }),
        panelBreit()
      ])
    ];
  }

  function panelZeichnen() {
    if (!refs.panelHuelle) { return; }
    HT.ui.leeren(refs.panelHuelle);
    refs.panelErstes = null;
    if (!zustand.panel) { return; }

    var faenger = h('div', { class: 'ub-panel__faenger' });
    faenger.addEventListener('mousedown', function () { panelSchliessen(true); });

    var panel = h('div', {
      class: 'ub-panel', role: 'dialog', 'aria-label': 'Steuerung'
    }, zustand.modus === 'erkunden' ? panelErkunden() : panelAbfragen());

    panel.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { ev.stopPropagation(); panelSchliessen(true); }
    });

    refs.panelHuelle.appendChild(faenger);
    refs.panelHuelle.appendChild(panel);
  }

  /* --- Abfragen ------------------------------------------------------------ */

  /* Jeder Begriff kommt einmal in den Topf, dazu bis zu drei weitere Lose je
     erfasstem Fehler. Nach dem Mischen bleibt der erste Treffer stehen —
     Schwachstellen rutschen so nach vorne, ohne die Runde zu füllen. */
  function kandidaten() {
    var topf = [];
    (refs.felder || []).forEach(function (f) {
      if (f.art !== 'ergebnis') { return; }
      var e = f.eintraege[0];
      topf.push(e);
      var fehl = zustand.fehler[e.begriff];
      if (fehl) {
        for (var i = 0; i < Math.min(3, fehl); i++) { topf.push(e); }
      }
    });

    var gesehen = {};
    return HT.ui.mischen(topf).filter(function (e) {
      if (gesehen[e.id]) { return false; }
      gesehen[e.id] = true;
      return true;
    });
  }

  function rundeStarten() {
    var aufgaben = kandidaten().slice(0, RUNDEN_LAENGE);
    (refs.felder || []).forEach(function (f) { f.aufgedeckt = false; });

    zustand.runde = { aufgaben: aufgaben, i: 0, phase: 'frage', falschesFeld: null };
    zustand.punkte = 0;
    zustand.versuche = 0;
    zustand.serie = 0;
    zustand.aktiv = null;
    zustand.gehalten = false;

    promptZeichnen();
    inhaltZeichnen();
    malen();
  }

  function antworten(feld) {
    var runde = zustand.runde;
    if (!runde || runde.phase !== 'frage') { return; }
    if (feld.art !== 'ergebnis') { return; }

    var gesucht = runde.aufgaben[runde.i];
    if (!gesucht) { return; }
    var richtig = istGleich(feld, gesucht);

    if (richtig) {
      zustand.serie += 1;
      zustand.besteSerie = Math.max(zustand.besteSerie, zustand.serie);
      zustand.punkte += 1;
    } else {
      zustand.serie = 0;
      zustand.fehler[gesucht.begriff] = (zustand.fehler[gesucht.begriff] || 0) + 1;
      feld.aufgedeckt = true;
    }
    zustand.versuche += 1;

    (refs.felder || []).forEach(function (f) {
      if (istGleich(f, gesucht)) { f.aufgedeckt = true; }
    });

    runde.phase = richtig ? 'richtig' : 'falsch';
    runde.falschesFeld = richtig ? null : feld;
    zustand.gehalten = true;
    zustand.aktiv = gesucht;

    speichern();
    promptZeichnen();
    inhaltZeichnen();
    malen();
    inhaltInSichtBringen();
  }

  function weiter() {
    var runde = zustand.runde;
    if (!runde) { return; }
    var naechste = runde.i + 1;

    if (naechste >= runde.aufgaben.length) {
      runde.phase = 'ende';
      runde.falschesFeld = null;
      promptZeichnen();
      malen();
      return;
    }

    (refs.felder || []).forEach(function (f) { f.aufgedeckt = false; });
    runde.i = naechste;
    runde.phase = 'frage';
    runde.falschesFeld = null;
    zustand.aktiv = null;
    zustand.gehalten = false;

    promptZeichnen();
    inhaltZeichnen();
    malen();
  }

  function ikone(kat, groesse, klasse) {
    var svg = HT.ui.katSymbol(kat, groesse);
    if (klasse) { svg.setAttribute('class', svg.getAttribute('class') + ' ' + klasse); }
    return svg;
  }

  function ikoneFuer(e) {
    if (e.kategorie === 'ergebnis' && e.typ === 'Meilenstein') { return 'meilenstein'; }
    return e.kategorie;
  }

  function promptZeichnen() {
    if (!refs.prompt) { return; }
    HT.ui.leeren(refs.prompt);

    var runde = zustand.runde;
    if (zustand.modus !== 'abfragen' || !runde) {
      refs.prompt.hidden = true;
      return;
    }
    refs.prompt.hidden = false;
    refs.prompt.dataset.phase = runde.phase;

    var gesucht = runde.aufgaben[runde.i];
    var kicker, titel, hinweis, status = '';

    if (runde.phase === 'ende') {
      kicker = 'Runde beendet';
      titel = zustand.punkte + ' von ' + runde.aufgaben.length + ' getroffen';
      hinweis = 'Die Schwachstellen links kommen in der nächsten Runde häufiger.';
    } else {
      kicker = 'Aufgabe ' + (runde.i + 1) + ' von ' + runde.aufgaben.length;
      titel = gesucht ? gesucht.begriff : '';
      if (runde.phase === 'frage') {
        hinweis = 'Wo steht dieses Ergebnis? Kasten in der Abbildung anklicken.';
      } else if (runde.phase === 'richtig') {
        status = 'Richtig';
        hinweis = 'Der Kasten ist markiert; rechts steht der ganze Eintrag.';
      } else {
        status = 'Daneben';
        hinweis = 'Der gesuchte Kasten ist rot markiert.';
      }
    }

    var zahl = function (wert, label) {
      return h('span', {}, [h('strong', { text: String(wert) }), ' ' + label]);
    };

    refs.prompt.appendChild(h('div', { class: 'ub-prompt__kopf' }, [
      h('span', { class: 'ub-prompt__kicker', text: kicker }),
      status ? h('span', { class: 'ub-prompt__status', role: 'status', text: status }) : null
    ]));

    refs.prompt.appendChild(h('div', { class: 'ub-prompt__zeile' }, [
      h('span', { class: 'ub-prompt__ziel' }, [
        runde.phase === 'ende' ? null : ikone(
          gesucht && gesucht.typ === 'Meilenstein' ? 'meilenstein' : 'ergebnis', 22, 'ub-ikone--prompt'),
        h('strong', { class: 'ub-prompt__titel', text: titel })
      ]),
      h('span', { class: 'ub-prompt__hinweis', text: hinweis }),
      h('span', { class: 'ub-prompt__zahlen' }, [
        zahl(zustand.punkte, 'richtig'),
        zahl(zustand.versuche ? HT.ui.prozent(zustand.punkte, zustand.versuche) + ' %' : '—', 'Quote'),
        zahl(zustand.serie, 'Serie'),
        h('span', { text: 'Beste ' + zustand.besteSerie })
      ])
    ]));

    if (runde.phase === 'richtig' || runde.phase === 'falsch') {
      var knopf = h('button', { type: 'button', class: 'ub-primaer', text: 'Weiter' });
      knopf.addEventListener('click', weiter);
      refs.prompt.appendChild(knopf);
      knopf.focus();
    } else if (runde.phase === 'ende') {
      /* Am Rundenende ist die nächste Handlung eine neue Runde; sie liegt sonst
         nur in der Steuerung. */
      var neu = h('button', { type: 'button', class: 'ub-primaer', text: 'Neue Runde' });
      neu.addEventListener('click', rundeStarten);
      refs.prompt.appendChild(neu);
      neu.focus();
    }
  }

  /* --- Inhaltsseite -------------------------------------------------------- */

  var TYP_KICKER = { Dokument: 'Dokument', Zustand: 'Zustand', Checkliste: 'Checkliste', Meilenstein: 'Meilenstein' };

  function kickerVon(e) {
    if (e.kategorie === 'modul') { return 'Modul'; }
    if (e.kategorie === 'phase') { return 'Phase'; }
    return TYP_KICKER[e.typ] || 'Ergebnis';
  }

  function markerVon(e) {
    if (e.kategorie === 'ergebnis' && e.minimalGefordert) { return 'Minimal gefordert'; }
    if (e.kategorie === 'modul' && HT.karte.ZWINGENDE_MODULE.indexOf(e.begriff) !== -1) {
      return 'Zwingend in jedem Projekt';
    }
    return '';
  }

  /* Siegel in der Akzentfarbe statt Wortmarke; der Wortlaut («Minimal
     gefordert», «Zwingend in jedem Projekt») steht im Tooltip und für den
     Screenreader. */
  function markerIkone(text) {
    var svg = svgEl('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(svgEl('circle', { cx: 12, cy: 12, r: 10 }));
    svg.appendChild(svgEl('path', { d: 'M7.6 12.4l2.9 2.9 5.9-6.2' }));
    return h('span', { class: 'ub-marker', role: 'img', title: text, 'aria-label': text }, svg);
  }

  var IKONE_DOWNLOAD = ['M12 4v11', 'M7.5 10.5 12 15l4.5-4.5', 'M4.5 19.5h15'];

  /* Der erste Vorlagenverweis (.dotx) aus dem Handbuchtext — auf der
     Quellseite ein eigener Abschnitt, hier ein Download-Icon im Kopf. */
  function vorlageVon(text) {
    var abschnitte = text && text.abschnitte ? text.abschnitte : [];
    for (var i = 0; i < abschnitte.length; i++) {
      var bs = abschnitte[i].bloecke || [];
      for (var j = 0; j < bs.length; j++) {
        if (bs[j].t === 'download' && bs[j].url) { return bs[j]; }
      }
    }
    return null;
  }

  function vorlageIkone(block) {
    var meta = [block.datei, block.groesse].filter(Boolean).join(' · ');
    var titel = 'Dokumentvorlage herunterladen' + (meta ? ' (' + meta + ')' : '');
    return h('a', {
      class: 'ub-kopf__vorlage',
      href: block.url,
      target: '_blank',
      rel: 'noopener',
      download: block.datei || true,
      title: titel,
      'aria-label': titel
    }, HT.ui.symbol(IKONE_DOWNLOAD, 20));
  }

  function abschnitt(titel, kinder, klasse) {
    return h('section', { class: 'ub-abschnitt' + (klasse ? ' ' + klasse : '') }, [
      h('h3', { class: 'ub-mikro', text: titel })
    ].concat(kinder));
  }

  /* --- Handbuchabschnitte --------------------------------------------------- */

  /* Die Inhaltsseite folgt dem Aufbau der Seite auf hermes.admin.ch:
     Beschreibung, Inhalt, Dokumentenvorlage. «Beziehungen» wird nicht als
     Tabelle übernommen, sondern aus dem Graphmodell gezeichnet — dieselben
     Daten, aber verlinkt und in der Breite der Inhaltsseite lesbar. */
  var AUS_GRAPH = ['Beziehungen', 'Aufgaben und Ergebnisse'];

  function hbAbschnitt(text, titel) {
    if (!text || !text.abschnitte) { return null; }
    for (var i = 0; i < text.abschnitte.length; i++) {
      if ((text.abschnitte[i].titel || '').trim().toLowerCase() === titel.toLowerCase()) {
        return text.abschnitte[i];
      }
    }
    return null;
  }

  function absaetze(a) {
    return a ? a.bloecke.filter(function (b) { return b.t === 'p'; }) : [];
  }

  /* Quelle des Leads: der Abschnitt «Beschreibung», sonst der erste Absatzblock
     des ersten Abschnitts (Phasenseiten tragen keine Zwischentitel). Die
     verwendeten Blöcke werden mitgegeben, damit sie unten nicht ein zweites
     Mal erscheinen. Der Lead zeigt alle Absätze, nicht nur den ersten Satz —
     diese Seite hat keine Stufen, an denen mehr nachkäme. */
  function leadQuelle(text) {
    var a = hbAbschnitt(text, 'Beschreibung');
    if (a) { return { abschnitt: a, bloecke: absaetze(a) }; }
    var erster = text && text.abschnitte && text.abschnitte[0];
    if (!erster) { return { abschnitt: null, bloecke: [] }; }
    var raus = [];
    for (var i = 0; i < erster.bloecke.length; i++) {
      if (erster.bloecke[i].t === 'p') { raus.push(erster.bloecke[i]); }
      else if (raus.length) { break; }
    }
    return { abschnitt: null, bloecke: raus };
  }

  function leadBauen(e, lead) {
    if (lead.bloecke.length) {
      return lead.bloecke.map(function (b) { return h('p', { text: b.text }); });
    }
    var ersatz = e.definition || e.kurz || '';
    return ersatz ? [h('p', { text: ersatz })] : [];
  }

  /* Eine Gruppe der Beziehungsliste: Überschrift und verlinkte Einträge,
     je Eintrag eine Beizeile aus Modul, Verantwortung oder Ergebnistyp. */
  function bezGruppe(label, eintraege, linkZiel) {
    if (!eintraege.length) { return null; }
    eintraege.sort(function (a, b) { return a.begriff.localeCompare(b.begriff, 'de'); });
    return h('div', { class: 'ub-bez' }, [
      h('span', { class: 'ub-bez__label', text: label }),
      h('ul', { class: 'ub-bez__liste' }, eintraege.map(function (x) {
        var zusatz = [];
        if (x.kategorie === 'ergebnis' && x.typ) { zusatz.push(x.typ); }
        if (x.kategorie === 'aufgabe' && x.module && x.module.length) { zusatz.push(x.module.join(', ')); }
        if (x.verantwortlich) { zusatz.push(x.verantwortlich); }
        return h('li', {}, [
          h('a', { class: 'ub-bez__ziel', href: linkZiel(x), text: x.begriff }),
          zusatz.length ? h('span', { class: 'ub-bez__zusatz', text: zusatz.join(' · ') }) : null
        ]);
      }))
    ]);
  }

  /* --- Beziehungsbild: Rolle → Aufgabe → Ergebnis -------------------------- */

  /* Dieselbe Darstellung wie im grossen Graph — Knoten und Kanten kommen aus
     js/graph-zeichnen.js und css/graph.css, nur die Anordnung ist enger:
     links die Rollen, rechts die Aufgaben, mit S-Kurven dazwischen wie im
     Graph (durchgezogen verantwortlich, gestrichelt beteiligt); darunter,
     in der Aufgabenspalte, das Ergebnis, zu dem «erzeugt» am rechten Rand
     mit Pfeil hinführt. Gepunktet, wenn eine Rolle das Ergebnis selbst
     verantwortet. Gezeigt wird genau, was das Graphmodell kennt — nicht mehr
     und nicht weniger als im grossen Graph. */
  var GB = {
    rand: 6,        // Luft oben, unten und links
    spalte: 40,     // Abstand zwischen Rollen- und Aufgabenspalte (Platz für die Kurven)
    zeile: 34,      // Zeilenabstand (Knoten 28 + 6)
    stufe: 18,      // Abstand zwischen Aufgaben und Ergebnis
    minBreite: 360
  };

  function gbKnotenFuer(k) {
    return { id: k.id, kategorie: k.kategorie, begriff: k.begriff, eintrag: k.eintrag, h: HT.graphZeichnen.KNOTEN_HOEHE };
  }

  function graphBild(e, linkZiel) {
    var Z = HT.graphZeichnen;
    if (!HT.graph || !HT.graph.knoten(e.id) || !Z || !Z.knotenElement) { return null; }
    Z.schriftLesen(refs.graph || document.body);

    var rollen = [], aufgaben = [], kanten = [], gesehen = {}, kanteGesehen = {};
    function merken(liste, k) {
      if (gesehen[k.id]) { return; }
      gesehen[k.id] = true;
      liste.push(gbKnotenFuer(k));
    }
    function kante(k) {
      if (kanteGesehen[k.id]) { return; }
      kanteGesehen[k.id] = true;
      kanten.push(k);
    }
    HT.graph.nachbarn(e.id).forEach(function (n) {
      n.relationen.forEach(function (r) {
        if (r.rel === 'erzeugt') { merken(aufgaben, n.knoten); kante(r.kante); }
        if (r.rel === 'ergebnisrolle') { merken(rollen, n.knoten); kante(r.kante); }
      });
    });
    aufgaben.forEach(function (a) {
      HT.graph.nachbarn(a.id).forEach(function (n) {
        n.relationen.forEach(function (r) {
          if (r.rel === 'verantwortlich' || r.rel === 'beteiligt') { merken(rollen, n.knoten); kante(r.kante); }
        });
      });
    });
    if (!aufgaben.length && !rollen.length) { return null; }

    function sortieren(a, b) { return a.begriff.localeCompare(b.begriff, 'de'); }
    rollen.sort(sortieren);
    aufgaben.sort(sortieren);
    var mitte = gbKnotenFuer(HT.graph.knoten(e.id));

    /* Anordnung: zwei Spalten wie im Graph, das Ergebnis unter den Aufgaben. */
    var alle = rollen.concat(aufgaben, [mitte]);
    var position = {};
    alle.forEach(function (k) { k.w = Z.knotenBreite(k, {}); position[k.id] = k; });
    var rollenBreite = rollen.reduce(function (m, k) { return Math.max(m, k.w); }, 0);
    var aufgabenX = rollen.length ? GB.rand + rollenBreite + GB.spalte : GB.rand;
    var aufgabenHoehe = aufgaben.length * GB.zeile - (GB.zeile - mitte.h);
    var rollenHoehe = rollen.length * GB.zeile - (GB.zeile - mitte.h);
    /* Rollen mittig zur Aufgabenspalte, damit die Kurven flach bleiben. */
    var y = GB.rand + Math.max(0, (aufgabenHoehe - rollenHoehe) / 2);
    rollen.forEach(function (k) { k.x = GB.rand; k.y = y; y += GB.zeile; });
    y = GB.rand + Math.max(0, (rollenHoehe - aufgabenHoehe) / 2);
    aufgaben.forEach(function (k) { k.x = aufgabenX; k.y = y; y += GB.zeile; });
    mitte.x = aufgabenX;
    mitte.y = GB.rand + Math.max(aufgabenHoehe, rollenHoehe) + GB.stufe;
    var hoehe = mitte.y + mitte.h + GB.rand;
    var rechts = alle.reduce(function (m, k) { return Math.max(m, k.x + k.w); }, 0);
    var schieneRechts = rechts + 14;
    var breite = Math.max(GB.minBreite, schieneRechts + 6);

    return bildRendern(e, alle, kanten, {
      breite: breite, hoehe: hoehe, schieneRechts: schieneRechts,
      label: 'Beziehungen von ' + e.begriff + ': Rolle, Aufgabe, Ergebnis'
    }, linkZiel);
  }

  /* Modul oder Phase: alles, was dazugehört, in drei Spalten wie im grossen
     Graph — links die Rollen, in der Mitte die Aufgaben in der Reihenfolge
     der Methode, rechts die Ergebnisse. Kanten wie dort: verantwortlich und
     beteiligt (Rolle → Aufgabe), erzeugt (Aufgabe → Ergebnis, mit Pfeil),
     Rolle verantwortet Ergebnis (gepunktet). Rollen und Ergebnisse stehen
     nach dem Schwerpunkt ihrer Aufgaben, damit die Kurven flach bleiben.
     gehoertDazu(eintrag) entscheidet über die Zugehörigkeit — beim Modul
     das Feld `module`, bei der Phase das Feld `phasen`. Die Aufgaben stehen
     wie im grossen Graph gruppiert: gruppen ist die Folge der Gruppennamen
     (Phasen der Vorgehensweise bzw. Module der Methode), gruppeFeld das
     Feld der Aufgabe, in dem sie stehen; innerhalb der Gruppe alphabetisch. */
  function graphBildMenge(e, gehoertDazu, gruppen, gruppeFeld, linkZiel) {
    var Z = HT.graphZeichnen;
    if (!HT.graph || !Z || !Z.knotenElement) { return null; }
    Z.schriftLesen(refs.graph || document.body);

    var rollen = [], aufgaben = [], ergebnisse = [], kanten = [], gesehen = {}, kanteGesehen = {};
    function merken(liste, k) {
      if (gesehen[k.id]) { return; }
      gesehen[k.id] = true;
      liste.push(gbKnotenFuer(k));
    }
    function kante(k) {
      if (kanteGesehen[k.id]) { return; }
      kanteGesehen[k.id] = true;
      kanten.push(k);
    }
    HT.daten.alleEintraege().forEach(function (x) {
      if (!gehoertDazu(x)) { return; }
      var k = HT.graph.knoten(x.id);
      if (!k) { return; }
      if (x.kategorie === 'aufgabe') { merken(aufgaben, k); }
      else if (x.kategorie === 'ergebnis') { merken(ergebnisse, k); }
    });
    aufgaben.forEach(function (a) {
      HT.graph.nachbarn(a.id).forEach(function (n) {
        n.relationen.forEach(function (r) {
          if (r.rel === 'verantwortlich' || r.rel === 'beteiligt') { merken(rollen, n.knoten); kante(r.kante); }
          if (r.rel === 'erzeugt') { merken(ergebnisse, n.knoten); kante(r.kante); }
        });
      });
    });
    ergebnisse.forEach(function (x) {
      HT.graph.nachbarn(x.id).forEach(function (n) {
        n.relationen.forEach(function (r) {
          if (r.rel === 'ergebnisrolle') { merken(rollen, n.knoten); kante(r.kante); }
        });
      });
    });
    if (!aufgaben.length && !ergebnisse.length) { return null; }

    function gruppe(k) {
      var werte = k.eintrag[gruppeFeld] || [];
      for (var i = 0; i < gruppen.length; i++) {
        if (werte.indexOf(gruppen[i]) !== -1) { return i; }
      }
      return gruppen.length;
    }
    aufgaben.sort(function (a, b) {
      return (gruppe(a) - gruppe(b)) || a.begriff.localeCompare(b.begriff, 'de');
    });
    var zeileVon = {};
    aufgaben.forEach(function (k, i) { zeileVon[k.id] = i; });

    /* Schwerpunkt: mittlere Zeile der verbundenen Aufgaben; ohne Aufgabe ans Ende. */
    function schwerpunkt(k) {
      var summe = 0, zahl = 0;
      kanten.forEach(function (x) {
        var anderer = x.von === k.id ? x.nach : (x.nach === k.id ? x.von : null);
        if (anderer !== null && zeileVon[anderer] !== undefined) { summe += zeileVon[anderer]; zahl++; }
      });
      return zahl ? summe / zahl : aufgaben.length;
    }
    function nachSchwerpunkt(a, b) {
      return (a.sp - b.sp) || a.begriff.localeCompare(b.begriff, 'de');
    }
    rollen.forEach(function (k) { k.sp = schwerpunkt(k); });
    ergebnisse.forEach(function (k) { k.sp = schwerpunkt(k); });
    rollen.sort(nachSchwerpunkt);
    ergebnisse.sort(nachSchwerpunkt);

    var alle = rollen.concat(aufgaben, ergebnisse);
    alle.forEach(function (k) { k.w = Z.knotenBreite(k, {}); });
    function spaltenBreite(liste) { return liste.reduce(function (m, k) { return Math.max(m, k.w); }, 0); }
    var hoeheVon = function (liste) { return liste.length ? liste.length * GB.zeile - (GB.zeile - Z.KNOTEN_HOEHE) : 0; };
    var hoechste = Math.max(hoeheVon(rollen), hoeheVon(aufgaben), hoeheVon(ergebnisse));
    var x = GB.rand;
    /* Alle Spalten beginnen oben — die Reihenfolge der Methode liest sich
       von oben nach unten, und der Bereich zeigt zuerst den Anfang. */
    [rollen, aufgaben, ergebnisse].forEach(function (liste) {
      if (!liste.length) { return; }
      var y = GB.rand;
      liste.forEach(function (k) { k.x = x; k.y = y; y += GB.zeile; });
      x += spaltenBreite(liste) + GB.spalte;
    });
    var breite = Math.max(GB.minBreite, x - GB.spalte + GB.rand);
    var hoehe = GB.rand + hoechste + GB.rand;

    return bildRendern(e, alle, kanten, {
      breite: breite, hoehe: hoehe, breit: true,
      label: 'Beziehungen in ' + (e.kategorie === 'phase' ? 'der Phase ' : 'dem Modul ') + e.begriff + ': Rollen, Aufgaben, Ergebnisse'
    }, linkZiel);
  }

  /* Zeichnet ein fertig angeordnetes Bild: Kanten zuerst, darüber die
     verlinkten Knoten, dazu die Hervorhebung beim Zeigen und der Verweis
     in den vollen Graph. masse: breite, hoehe, label; schieneRechts lässt
     «erzeugt» über eine rechte Schiene laufen (Ergebnis unter den Aufgaben),
     breit lässt das Bild seitwärts scrollen statt es zu verkleinern. */
  function bildRendern(e, alle, kanten, masse, linkZiel) {
    var Z = HT.graphZeichnen;
    var position = {};
    alle.forEach(function (k) { position[k.id] = k; });
    var breite = masse.breite, hoehe = masse.hoehe, schieneRechts = masse.schieneRechts;

    var svg = svgEl('svg', {
      'class': 'ub-gb' + (masse.breit ? ' ub-gb--breit' : ''), viewBox: '0 0 ' + breite + ' ' + hoehe,
      role: 'img', 'aria-label': masse.label
    });
    svg.style.width = breite + 'px';
    svg.setAttribute('data-breite', String(breite));
    var defs = svgEl('defs', {});
    var marker = svgEl('marker', { id: 'ub-gpfeil', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
    marker.appendChild(svgEl('path', { d: 'M0 0L10 5L0 10Z', 'class': 'gpfeil' }));
    defs.appendChild(marker);
    svg.appendChild(defs);

    /* Kanten zuerst, damit die Knoten darüber liegen. «erzeugt» läuft über
       die rechte Schiene zum Ergebnis, alles mit Rollen über die linke. */
    var ebeneKanten = svgEl('g', { 'class': 'ub-gb__kanten' });
    var nachbarschaft = {};   // id -> { knoten: {id:true}, kanten: {id:true} }
    var elemente = { knoten: {}, kanten: {} };
    function nachbar(id) {
      if (!nachbarschaft[id]) { nachbarschaft[id] = { knoten: {}, kanten: {} }; }
      return nachbarschaft[id];
    }
    kanten.forEach(function (k) {
      var von = position[k.von], nach = position[k.nach];
      if (!von || !nach) { return; }
      nachbar(k.von).kanten[k.id] = true; nachbar(k.von).knoten[k.nach] = true;
      nachbar(k.nach).kanten[k.id] = true; nachbar(k.nach).knoten[k.von] = true;
      var y1 = von.y + von.h / 2, y2 = nach.y + nach.h / 2;
      var stil = HT.graph.REL[k.rel] ? HT.graph.REL[k.rel].stil : 'struktur';
      var d, attrs = { 'class': 'gkante gkante--' + stil, 'data-id': k.id };
      if (k.rel === 'erzeugt' && schieneRechts) {
        d = 'M' + (von.x + von.w) + ' ' + y1
          + 'C' + schieneRechts + ' ' + y1 + ',' + schieneRechts + ' ' + y2 + ',' + (nach.x + nach.w) + ' ' + y2;
        attrs['marker-end'] = 'url(#ub-gpfeil)';
      } else {
        if (k.rel === 'erzeugt') { attrs['marker-end'] = 'url(#ub-gpfeil)'; }
        /* S-Kurve von der Rolle zur Aufgabe bzw. zum Ergebnis, wie im Graph. */
        var x1 = von.x + von.w, x2 = nach.x, mx = (x1 + x2) / 2;
        d = 'M' + x1 + ' ' + y1 + 'C' + mx + ' ' + y1 + ',' + mx + ' ' + y2 + ',' + x2 + ' ' + y2;
      }
      attrs.d = d;
      var pfad = svgEl('path', attrs);
      elemente.kanten[k.id] = pfad;
      ebeneKanten.appendChild(pfad);
    });
    svg.appendChild(ebeneKanten);

    /* Hervorhebung beim Zeigen und beim Fokus — wie im grossen Graph: der
       Knoten samt Nachbarn und Kanten bleibt, alles andere wird gedimmt. */
    function hervorheben(id) {
      svg.classList.toggle('ist-hervorhebung', !!id);
      Object.keys(elemente.knoten).forEach(function (x) { elemente.knoten[x].classList.remove('ist-aktiv'); });
      Object.keys(elemente.kanten).forEach(function (x) { elemente.kanten[x].classList.remove('ist-aktiv'); });
      if (!id || !elemente.knoten[id]) { return; }
      elemente.knoten[id].classList.add('ist-aktiv');
      var n = nachbarschaft[id];
      if (!n) { return; }
      Object.keys(n.knoten).forEach(function (x) { if (elemente.knoten[x]) { elemente.knoten[x].classList.add('ist-aktiv'); } });
      Object.keys(n.kanten).forEach(function (x) { if (elemente.kanten[x]) { elemente.kanten[x].classList.add('ist-aktiv'); } });
    }

    var ebeneKnoten = svgEl('g', { 'class': 'ub-gb__knoten' });
    alle.forEach(function (k) {
      var el = Z.knotenElement(k, {});
      el.removeAttribute('tabindex');
      el.removeAttribute('role');
      if (k.id === e.id) { el.classList.add('ist-gewaehlt'); }
      var a = svgEl('a', { 'class': 'ub-gb__link', href: linkZiel(k.eintrag), 'aria-label': el.getAttribute('aria-label') + ' — im Lexikon öffnen' });
      a.appendChild(el);
      elemente.knoten[k.id] = el;
      a.addEventListener('mouseenter', function () { hervorheben(k.id); });
      a.addEventListener('mouseleave', function () { hervorheben(null); });
      a.addEventListener('focus', function () { hervorheben(k.id); });
      a.addEventListener('blur', function () { hervorheben(null); });
      ebeneKnoten.appendChild(a);
    });
    svg.appendChild(ebeneKnoten);

    return [svg];
  }


  /* Eine Gruppe von Beziehungen als Liste — für Module, die im Graphmodell
     keine Knoten sind (es kennt nur Rolle → Aufgabe → Ergebnis). */
  function graphBeziehungen(e, linkZiel) {
    if (!HT.graph || !HT.graph.knoten(e.id)) { return null; }
    var gruppen = [];
    var nachLabel = {};
    HT.graph.nachbarn(e.id).forEach(function (n) {
      n.relationen.forEach(function (r) {
        /* «verantwortet» wiederholt nur den Steckbrief. */
        if (r.rel === 'ergebnisrolle') { return; }
        var g = nachLabel[r.label];
        if (!g) {
          g = { label: r.label, eintraege: [] };
          nachLabel[r.label] = g;
          gruppen.push(g);
        }
        g.eintraege.push(n.knoten.eintrag);
      });
    });
    var raus = gruppen.map(function (g) { return bezGruppe(g.label, g.eintraege, linkZiel); })
      .filter(function (x) { return !!x; });
    return raus.length ? raus : null;
  }

  /* Rückfall ohne Graphmodell: alles, was das Modul führt, als zwei Listen. */
  function modulBeziehungen(e, linkZiel) {
    var aufgaben = [];
    var ergebnisse = [];
    HT.daten.alleEintraege().forEach(function (x) {
      if (!x.module || x.module.indexOf(e.begriff) === -1) { return; }
      if (x.kategorie === 'aufgabe') { aufgaben.push(x); }
      else if (x.kategorie === 'ergebnis') { ergebnisse.push(x); }
    });
    var raus = [
      bezGruppe('umfasst die Aufgaben', aufgaben, linkZiel),
      bezGruppe('erzeugt die Ergebnisse', ergebnisse, linkZiel)
    ].filter(function (x) { return !!x; });
    return raus.length ? raus : null;
  }

  function namen(kategorie) {
    return HT.daten.eintraegeDerKategorie(kategorie).map(function (x) { return x.begriff; });
  }

  /* Modul: Aufgaben nach Phasen gruppiert (Reihenfolge der Vorgehensweise). */
  function graphBildModul(e, linkZiel) {
    return graphBildMenge(e,
      function (x) { return x.module && x.module.indexOf(e.begriff) !== -1; },
      HT.daten.phasenSortiert(namen('phase')), 'phasen', linkZiel);
  }

  /* Phase: Aufgaben nach Modulen gruppiert (Reihenfolge der Methode). */
  function graphBildPhase(e, linkZiel) {
    return graphBildMenge(e,
      function (x) { return x.phasen && x.phasen.indexOf(e.begriff) !== -1; },
      namen('modul'), 'module', linkZiel);
  }

  /* Ergebnisse, Module und Phasen bekommen das Bild; die Listen bleiben Rückfall. */
  function beziehungenVon(e, linkZiel) {
    if (e.kategorie === 'modul') { return graphBildModul(e, linkZiel) || modulBeziehungen(e, linkZiel); }
    if (e.kategorie === 'phase') { return graphBildPhase(e, linkZiel); }
    return graphBild(e, linkZiel) || graphBeziehungen(e, linkZiel);
  }

  function leerseite() {
    return h('div', { class: 'ub-leerseite' }, [
      h('h2', { class: 'ub-leerseite__titel', text: 'Noch nichts ausgewählt' }),
      h('p', { class: 'ub-leerseite__text', text:
        'Zeigen auf einen Ergebniskasten, einen Modulkopf oder einen Phasenbalken füllt '
        + 'diese Seite. Ein Klick hält den Eintrag fest, die Trennlinie links lässt sich ziehen.' }),
      h('h3', { class: 'ub-mikro ub-mikro--legende', text: 'Die Elemente der Methode' }),
      h('ul', { class: 'ub-legende' }, LEGENDE.map(function (l) {
        return h('li', {}, [ikone(l.kat, 20, 'ub-ikone--legende'), h('span', { text: l.text })]);
      }))
    ]);
  }

  /* Handbuchtexte je Eintrag, sobald geladen (null = keiner vorhanden). Die
     Kategoriedatei holt HT.daten einmalig; danach löst das Versprechen sofort
     auf und das Nachzeichnen ist nicht sichtbar. */
  var hbTexte = {};

  function handbuchHolen(e) {
    if (Object.prototype.hasOwnProperty.call(hbTexte, e.id)) { return; }
    hbTexte[e.id] = null;                       // nicht zweimal anfragen
    var id = e.id;
    HT.daten.handbuchElement(e).then(function (t) {
      hbTexte[id] = t || null;
      if (t && zustand.aktiv && zustand.aktiv.id === id) { inhaltZeichnen(); }
    }).catch(function () { /* Fallback bleibt «Aus der Dokumentation» */ });
  }

  function lexikonZiel(x) {
    return '#/lexikon?id=' + encodeURIComponent(x.id);
  }

  function inhaltZeichnen() {
    if (!refs.inhalt) { return; }
    var vorher = refs.inhalt.scrollTop;
    var gbAlt = refs.graph && refs.graph.querySelector('svg.ub-gb');
    var gbBreite = gbAlt && gbAlt.style.maxWidth === 'none' ? gbAlt.style.width : '';
    HT.ui.leeren(refs.inhalt);
    HT.ui.leeren(refs.graph);

    var e = zustand.aktiv;
    if (refs.graphLink) {
      refs.graphLink.hidden = !e;
      if (e) {
        /* Ergebnis: Fokus auf das Element; Modul und Phase setzen den Umfang. */
        var knoten = e.kategorie === 'ergebnis' || e.kategorie === 'aufgabe' || e.kategorie === 'rolle';
        refs.graphLink.href = '#/graph?' + (knoten ? 'fokus=' : 'id=') + encodeURIComponent(e.id);
        refs.graphLink.title = 'Im Graph öffnen: ' + e.begriff;
      }
    }
    if (e) {
      /* Ort für persönliche Notizen — derselbe wie die Lexikonkarte, damit
         eine Markierung hier auch dort erscheint. */
      refs.inhalt.dataset.nzOrt = '#/lexikon?id=' + encodeURIComponent(e.id);
      refs.inhalt.dataset.nzTitel = e.begriff;
    } else {
      delete refs.inhalt.dataset.nzOrt;
      delete refs.inhalt.dataset.nzTitel;
    }
    delete refs.inhalt.dataset.nzKomplett;
    if (!e) {
      refs.inhalt.appendChild(leerseite());
      refs.inhalt.scrollTop = 0;
      zustand.gezeichnet = null;
      refs.graph.appendChild(graphHinweis(
        'Ein Ergebnis, ein Modul oder eine Phase wählen — hier stehen dann die Beziehungen dazu.'));
      graphBereichSetzen();
      return;
    }

    handbuchHolen(e);
    var text = hbTexte[e.id] || null;
    /* Mit Handbuchtext ist die Seite vollständig (siehe js/notizen.js). */
    if (text) { refs.inhalt.dataset.nzKomplett = '1'; }
    var lead = leadQuelle(text);
    var marker = markerVon(e);
    var vorlage = vorlageVon(text);

    refs.inhalt.appendChild(h('article', { class: 'ub-kopf' }, [
      h('div', { class: 'ub-kopf__zeile' }, [
        ikone(ikoneFuer(e), 24, 'ub-ikone--kopf'),
        h('span', { class: 'ub-kopf__kicker', text: kickerVon(e) }),
        (marker || vorlage) ? h('span', { class: 'ub-kopf__zeichen' }, [
          marker ? markerIkone(marker) : null,
          vorlage ? vorlageIkone(vorlage) : null
        ]) : null
      ]),
      h('h2', { class: 'ub-kopf__titel', text: e.begriff }),
      h('div', { class: 'ub-kopf__lead' }, leadBauen(e, lead))
    ]));

    /* Kein Steckbrief: Ergebnistyp, «minimal gefordert» und die Dokument-
       vorlage stehen als Kicker und Zeichen im Kopf, alles andere zeigt das
       Beziehungsbild unten. */

    /* Die übrigen Abschnitte der Quellseite in ihrer Reihenfolge — «Inhalt»
       also genau so, wie er auf hermes.admin.ch steht. Der Vorlagenverweis
       hängt als Icon im Kopf; bleibt vom Abschnitt «Dokumentenvorlage» sonst
       nichts übrig, entfällt er. Die Beziehungen stehen im unteren Bereich. */
    var beziehungen = beziehungenVon(e, lexikonZiel);
    (text && text.abschnitte ? text.abschnitte : []).forEach(function (a) {
      if (a === lead.abschnitt) { return; }                     // steht im Lead
      var titel = (a.titel || '').trim();
      if (AUS_GRAPH.indexOf(titel) !== -1 && beziehungen) { return; }
      var bs = (a.bloecke || []).filter(function (b) {
        return lead.bloecke.indexOf(b) === -1 && b.t !== 'download';
      });
      if (!bs.length) { return; }
      refs.inhalt.appendChild(abschnitt(titel || 'Aus dem Handbuch',
        [HT.ui.bloecke(bs, { verlinken: false, ebene: 4 })], 'ub-abschnitt--regel'));
    });

    if (beziehungen) {
      beziehungen.forEach(function (k) { refs.graph.appendChild(k); });
      /* Das Nachzeichnen mit dem Handbuchtext darf den Zoom nicht verlieren. */
      var gb = zustand.gezeichnet === e.id && gbBreite && refs.graph.querySelector('svg.ub-gb');
      if (gb) { gb.style.width = gbBreite; gb.style.maxWidth = 'none'; }
    } else {
      refs.graph.appendChild(graphHinweis(
        'Für ' + HT.ui.zitat(e.begriff) + ' führt das Handbuch keine Beziehungen zu Aufgaben oder Rollen.'));
    }
    graphBereichSetzen();

    /* Ohne Handbuchtext bleibt die kuratierte Fassung die einzige Quelle. */
    if (!text && e.details) {
      refs.inhalt.appendChild(abschnitt('Aus der Dokumentation', [
        h('p', { class: 'ub-doku', text: e.details })
      ], 'ub-abschnitt--regel'));
    }

    if (HT.notizen) { refs.inhalt.appendChild(HT.notizen.panel('#/lexikon?id=' + encodeURIComponent(e.id), e.begriff)); }

    refs.inhalt.appendChild(h('section', { class: 'ub-verweise' }, [
      h('a', { class: 'ub-verweis', href: '#/lexikon?id=' + encodeURIComponent(e.id), text: 'Im Lexikon' }),
      h('a', {
        class: 'ub-verweis ub-verweis--akzent',
        href: (e.quelle && e.quelle.url) || QUELLE_ALLGEMEIN,
        target: '_blank', rel: 'noopener',
        text: 'Offizielle Seite ↗'
      })
    ]));

    /* Nur beim Wechsel nach oben springen — das Nachzeichnen mit dem
       Handbuchtext darf die Leseposition nicht verlieren. */
    if (zustand.gezeichnet !== e.id) {
      refs.inhalt.scrollTop = 0;
      zustand.gezeichnet = e.id;
    } else {
      refs.inhalt.scrollTop = vorher;
    }
  }

  /* --- Legende zur Abbildung ----------------------------------------------- */

  /* Ein Musterzeichen im Format der Grafik: 26 × 14, dieselben Farben. */
  function zeichen(form) {
    var svg = svgEl('svg', {
      width: 26, height: 14, viewBox: '0 0 26 14',
      'class': 'ub-zeichen', 'aria-hidden': 'true', focusable: 'false'
    });
    var teile = {
      ergebnis: [['rect', { x: 2.5, y: 1.5, width: 21, height: 11, fill: FARBEN.ergebnis }]],
      zustand: [['rect', { x: 3, y: 2, width: 20, height: 10, rx: 4, fill: '#FFFFFF', stroke: FARBEN.ergebnisRand }]],
      modul: [['rect', { x: 3, y: 2, width: 20, height: 10, fill: 'none', stroke: FARBEN.modulRand }]],
      phase: [
        ['rect', { x: 4, y: 0, width: 8, height: 14, fill: FARBEN.phase[1] }],
        ['rect', { x: 14, y: 0, width: 8, height: 14, fill: FARBEN.phase[0] }]
      ],
      meilenstein: [
        ['path', { d: 'M0 7 H26', stroke: FARBEN.uebergang, 'stroke-dasharray': '4 3' }],
        ['path', { d: 'M13 2.5 L17.5 7 L13 11.5 L8.5 7 Z', fill: '#575757' }]
      ],
      iteration: [
        ['path', { d: 'M2 7 H18', stroke: FARBEN.iteration, 'stroke-dasharray': '3 3' }],
        ['path', { d: 'M17 3 L24 7 L17 11 Z', fill: FARBEN.iteration }]
      ]
    }[form] || [];
    teile.forEach(function (t) { svg.appendChild(svgEl(t[0], t[1])); });
    return svg;
  }

  /* Die Legende ist eine kleine Karte über dem Info-Icon unten links; sie
     bleibt eingeblendet, bis das Icon sie wieder schliesst (gespeichert). */
  function abbLegendeBauen() {
    refs.abblegende = h('div', { class: 'ub-abblegende', id: 'ub-abblegende', hidden: true }, [
      h('span', { class: 'ub-abblegende__titel', text: 'Zeichen der Abbildung' }),
      h('ul', { class: 'ub-abblegende__liste' }, ABB_LEGENDE.map(function (l) {
        return h('li', {}, [zeichen(l.form), h('span', { text: l.text })]);
      }))
    ]);
    return refs.abblegende;
  }

  /* --- Aufbau -------------------------------------------------------------- */

  function abbildungSeiteBauen() {
    refs.prompt = h('div', { class: 'ub-prompt', hidden: true });
    refs.panelHuelle = h('div', { class: 'ub-panel-huelle' });
    refs.buehne = h('div', { class: 'ub-buehne' }, [
      h('p', { class: 'ub-buehne__laden', text: 'Abbildung wird geladen' })
    ]);
    HT.ui.radZoomAnbinden(refs.buehne, function () { return refs.abb || null; }, buehneSkalieren);

    var warnung = HT.app.datenWarnung();

    /* Die Hülle trägt die Icons, die Legende und die Steuerung, die Bühne
       darin scrollt — läge das Schwebende in der Bühne, scrollte es mit. */
    refs.buehneHuelle = h('div', { class: 'ub-buehne-huelle' },
      [refs.buehne].concat(schweberBauen(), [abbLegendeBauen(), refs.panelHuelle]));

    return h('section', { class: 'ub-seite' }, [
      warnung || null,
      refs.prompt,
      refs.buehneHuelle,
      h('p', { class: 'ub-bildunterschrift' }, [
        BILDUNTERSCHRIFT + ' — Originalgrafik, ',
        h('a', { href: QUELLE_ABB, target: '_blank', rel: 'noopener', text: 'hermes.admin.ch ↗' })
      ])
    ]);
  }

  /* --- Unterer Bereich der Inhaltsseite: Graph ----------------------------- */

  /* Die Inhaltsseite ist zweigeteilt: oben der Text, unten der Graph. Beide
     scrollen für sich, dazwischen liegt eine ziehbare Linie; die Kopfzeile
     des unteren Bereichs klappt ihn zu und wieder auf. */

  function graphHoeheSetzen(px) {
    var raum = refs.seite ? refs.seite.clientHeight : 0;
    var grenze = raum ? Math.max(GRAPH_MIN, raum - TEXT_MIN) : 640;
    zustand.graphHoehe = Math.round(Math.max(GRAPH_MIN, Math.min(px, grenze)));
    if (refs.seite) { refs.seite.style.setProperty('--ub-graph', zustand.graphHoehe + 'px'); }
  }

  /* Der untere Bereich bleibt immer sichtbar — auch ohne Auswahl und bei
     Einträgen ohne Beziehungen. Verschwände er, sähe die geteilte Seite je
     nach Auswahl anders aus und der Graph wirkte verschwunden. */
  function graphBereichSetzen() {
    if (!refs.seite) { return; }
    refs.seite.dataset.graph = zustand.graphOffen ? 'auf' : 'zu';
    if (refs.graphKnopf) {
      refs.graphKnopf.setAttribute('aria-expanded', String(zustand.graphOffen));
      refs.graphKnopf.title = zustand.graphOffen ? 'Graph zuklappen' : 'Graph aufklappen';
    }
  }

  function graphHinweis(text) {
    return h('p', { class: 'ub-graph__hinweis', text: text });
  }

  function graphUmschalten() {
    zustand.graphOffen = !zustand.graphOffen;
    graphBereichSetzen();
    speichern();
  }

  function graphZiehenStarten(ev) {
    if (ev.button !== undefined && ev.button !== 0) { return; }
    if (!zustand.graphOffen) { return; }
    ev.preventDefault();

    var startY = ev.clientY;
    var startHoehe = zustand.graphHoehe;

    function bewegen(e) { graphHoeheSetzen(startHoehe - (e.clientY - startY)); }
    function beenden() {
      global.removeEventListener('mousemove', bewegen);
      global.removeEventListener('mouseup', beenden);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      speichern();
    }

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    global.addEventListener('mousemove', bewegen);
    global.addEventListener('mouseup', beenden);
  }

  function graphGriffTaste(ev) {
    if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') { return; }
    ev.preventDefault();
    graphHoeheSetzen(zustand.graphHoehe + (ev.key === 'ArrowUp' ? 24 : -24));
    speichern();
  }

  function graphBereichBauen() {
    var griff = h('div', {
      class: 'ub-hgriff',
      role: 'separator',
      'aria-orientation': 'horizontal',
      'aria-label': 'Höhe des Graphbereichs',
      tabindex: '0',
      title: 'Ziehen ändert die Höhe · Doppelklick setzt zurück'
    }, [h('span', { class: 'ub-hgriff__strich', 'aria-hidden': 'true' })]);
    griff.addEventListener('mousedown', graphZiehenStarten);
    griff.addEventListener('keydown', graphGriffTaste);
    griff.addEventListener('dblclick', function () {
      graphHoeheSetzen(GRAPH_STANDARD);
      speichern();
    });

    refs.graphKnopf = h('button', {
      type: 'button',
      class: 'ub-graphkopf__knopf',
      'aria-controls': 'ub-graphbereich',
      'aria-expanded': 'true',
      on: { click: graphUmschalten }
    }, [
      h('span', { class: 'ub-graphkopf__pfeil', 'aria-hidden': 'true' }),
      h('span', { text: 'Beziehungen' })
    ]);

    /* Rechts in der Kopfzeile: ins Graph-Modul, im Fokus auf das Element
       (Modul und Phase setzen dort den Umfang). Der Link bekommt sein Ziel
       beim Zeichnen des Eintrags. */
    refs.graphLink = h('a', {
      class: 'ub-graphkopf__link', href: '#/graph',
      title: 'Im Graph öffnen', 'aria-label': 'Im Graph öffnen'
    }, HT.ui.symbol(['M14 4h6v6', 'M20 4l-7 7', 'M10 20H4v-6', 'M4 20l7-7'], 18));
    refs.graphLink.hidden = true;

    refs.graph = h('div', {
      class: 'ub-graph',
      id: 'ub-graphbereich',
      'aria-label': 'Beziehungen des gewählten Elements'
    });
    HT.ui.radZoomAnbinden(refs.graph, function () { return refs.graph.querySelector('svg.ub-gb'); }, gbSkalieren);

    return [griff, h('div', { class: 'ub-graphkopf' }, [refs.graphKnopf, refs.graphLink]), refs.graph];
  }

  function trennerBauen() {
    var trenner = h('div', {
      class: 'ub-trenner',
      role: 'separator',
      'aria-orientation': 'vertical',
      'aria-label': 'Breite der Inhaltsseite',
      tabindex: '0',
      title: 'Ziehen ändert die Breite · Doppelklick setzt zurück'
    }, [h('span', { class: 'ub-trenner__strich', 'aria-hidden': 'true' })]);

    trenner.addEventListener('mousedown', ziehenStarten);
    trenner.addEventListener('keydown', trennerTaste);
    trenner.addEventListener('dblclick', function () {
      inhaltBreiteSetzen(INHALT_STANDARD);
      zoomPassendSpaeter(40);
    });
    return trenner;
  }

  function groesseAnmelden() {
    if (groesseAngemeldet) { return; }
    groesseAngemeldet = true;
    global.addEventListener('resize', function () {
      if (!refs.buehne || !document.body.contains(refs.buehne)) { return; }
      inhaltBreiteSetzen(zustand.inhaltBreite);
      zoomPassendSpaeter(60);
    });
  }

  function werkbankRendern(behaelter) {
    refs.felder = [];

    refs.inhalt = h('div', { class: 'ub-inhalt__text' });
    refs.seite = h('aside', { class: 'ub-inhalt', 'aria-label': 'Inhaltsseite zum gewählten Element' },
      [refs.inhalt].concat(graphBereichBauen()));

    refs.werkbank = h('div', { class: 'ub-werkbank' }, [
      h('h1', { class: 'nur-sr', text: 'Methodenüberblick' }),
      abbildungSeiteBauen(),
      trennerBauen(),
      refs.seite
    ]);

    behaelter.appendChild(refs.werkbank);

    werkzeugAktualisieren();
    inhaltBreiteSetzen(zustand.inhaltBreite);
    graphHoeheSetzen(zustand.graphHoehe);
    inhaltZeichnen();
    panelZeichnen();
    promptZeichnen();
    groesseAnmelden();

    /* Escape schliesst die Steuerung auch dann, wenn der Fokus ausserhalb liegt. */
    refs.werkbank.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && zustand.panel) { panelSchliessen(true); }
    });

    HT.abbildung.holen().then(function (text) {
      if (!document.body.contains(refs.buehne)) { return; }
      diagrammEinsetzen(HT.abbildung.lesen(text));
    }).catch(function (fehler) {
      if (!refs.buehne) { return; }
      HT.ui.leeren(refs.buehne);
      refs.buehne.appendChild(HT.ui.leerZustand(
        'Das Diagramm konnte nicht geladen werden',
        'Die Originalabbildung liegt in assets/abb/. Wird die Seite direkt aus dem Dateisystem geöffnet '
          + '(file://), blockiert der Browser das Lesen — dann hilft ein lokaler Webserver. '
          + 'Technische Meldung: ' + (fehler && fehler.message ? fehler.message : String(fehler))
      ));
    });
  }

  function render(behaelter, params) {
    if (!zustand.initialisiert) {
      wiederherstellen();
      zustand.initialisiert = true;
    }
    refs = { felder: [] };

    /* Ältere Links auf ein Feld der Abbildung: die Feldseite ist eine eigene
       Route geworden. */
    if (params && params.phase && params.modul) {
      global.location.hash = '#/feld?phase=' + encodeURIComponent(params.phase)
        + '&modul=' + encodeURIComponent(params.modul);
      return;
    }

    /* Ergebnisse hatten hier einmal eine eigene Detailseite; sie stehen jetzt
       rechts in der Inhaltsseite und vollständig im Lexikon. */
    if (params && params.id) {
      var e = HT.daten.eintragMitId(params.id);
      if (e) {
        global.location.hash = '#/lexikon?id=' + encodeURIComponent(e.id);
        return;
      }
      behaelter.appendChild(HT.ui.leerZustand(
        'Diesen Eintrag gibt es nicht',
        'Der Link zeigt auf einen Eintrag, der nicht erfasst ist.',
        h('a', { class: 'btn btn--klein', href: '#/ueberblick', text: 'Zum Methodenüberblick' })
      ));
      return;
    }

    werkbankRendern(behaelter);
  }

  HT.views.ueberblick = {
    titel: 'Methodenüberblick',
    render: render
  };
}(window));
