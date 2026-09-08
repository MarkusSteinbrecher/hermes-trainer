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

  /* Fällt der Verweis im Handbuchkapitel aus, wird diese Datei genommen. */
  var ABBILDUNG = 'assets/abb/f297763a-101-gesamtbild-der-hermes-module-und-'
    + 'der-wesentlichen-ergebnisse-entlang-der-phasen.svg';

  var BILDUNTERSCHRIFT = 'Abbildung 1: Gesamtbild der HERMES-Module und der '
    + 'wesentlichen Ergebnisse entlang der Phasen';

  var QUELLE_ABB = 'https://www.hermes.admin.ch/de/projektmanagement/methodenueberblick.html';
  var QUELLE_ALLGEMEIN = 'https://www.hermes.admin.ch/de/projektmanagement.html';

  /* Farben, an denen die Grafik ihre Bestandteile unterscheidet. Sie stammen
     aus dem Office-Export und werden wörtlich verglichen — keine Themenfarben. */
  var FARBEN = {
    ergebnis: '#DCEBFA',        // Ergebniskasten (eckig): Dokument oder Checkliste
    ergebnisRand: '#DCEBFA',    // Zustandskasten (weiss gefüllt, runde Ecken)
    modulRand: '#000000',       // Modulrahmen
    phase: ['#B7D5F1', '#D9D9D9', '#EBC9C7'],  // Phasenbalken am linken Rand
    /* Nur für die Legende — an diesen Farben wird nichts erkannt. */
    uebergang: '#DF1D7F',       // gestrichelte Linie am Phasenübergang
    iteration: '#FF0000'        // Pfeile und Linien der agilen Iteration
  };

  /* Farben der Trefferschicht. */
  var AKZENT = '#ec3013';
  var TINTE = '#201e1d';

  /* Kästen, die in der Grafik anders oder verkürzt beschriftet sind als im
     Lexikon. Zwei Kästen stehen für je zwei Elemente — die Grafik fasst
     Projektsteuerung und Projektführung zu einer Spalte zusammen. */
  var ABWEICHENDE_BESCHRIFTUNG = [
    { label: 'Geschäftsmod.-beschreibung', ziele: ['Geschäftsmodellbeschreibung'], kat: 'ergebnis' },
    { label: 'Produkt entwickelt/angepasst', ziele: ['Produkt entwickelt oder angepasst'], kat: 'ergebnis' },
    { label: 'System entwickelt/parametrisiert', ziele: ['System entwickelt oder parametrisiert'], kat: 'ergebnis' },
    { label: 'Projektentscheide', ziele: ['Liste Projektentscheide Steuerung', 'Liste Projektentscheide Führung'], kat: 'ergebnis' },
    { label: 'Testen', ziele: ['Tests'], kat: 'modul' },
    { label: 'Projektsteuerung Projektführung', ziele: ['Projektsteuerung', 'Projektführung'], kat: 'modul' }
  ];

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
    nurMinimal: false,        // alles ausblassen, was nicht minimal gefordert ist
    zoom: 1,
    aktiv: null,              // Eintrag, den die Inhaltsseite zeigt
    gezeichnet: null,         // id des zuletzt gezeichneten Eintrags
    gehalten: false,          // durch Klick festgehalten
    nurAbb: false,            // «Breit»: Inhaltsseite eingeklappt
    panel: false,             // Steuerung offen
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
  var abbQuelle = null;       // einmal geholter SVG-Text, für spätere Aufrufe
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
      graphOffen: zustand.graphOffen
    });
  }

  function wiederherstellen() {
    var g = HT.store.lies(SPEICHER, null);
    if (!g || typeof g !== 'object') { return; }
    if (g.fehler && typeof g.fehler === 'object') { zustand.fehler = g.fehler; }
    if (typeof g.besteSerie === 'number' && g.besteSerie >= 0) { zustand.besteSerie = g.besteSerie; }
    if (typeof g.graphHoehe === 'number' && g.graphHoehe >= GRAPH_MIN) { zustand.graphHoehe = g.graphHoehe; }
    if (typeof g.graphOffen === 'boolean') { zustand.graphOffen = g.graphOffen; }
  }

  /* --- Beschriftung -> Eintrag -------------------------------------------- */

  /* Die Grafik bricht Wörter um («Projekt-» / «initialisierungs-» / «auftrag»);
     für den Abgleich fallen deshalb alle Trennzeichen weg. */
  function schluessel(text) {
    return HT.daten.normalisieren(text).replace(/[^0-9a-zäöüß]/g, '');
  }

  var abweichend = null;

  function abweichendeZiele(key) {
    if (!abweichend) {
      abweichend = {};
      ABWEICHENDE_BESCHRIFTUNG.forEach(function (a) { abweichend[schluessel(a.label)] = a; });
    }
    var treffer = abweichend[key];
    if (!treffer) { return null; }
    var eintraege = treffer.ziele.map(function (name) {
      return HT.daten.eintragMitBegriff(name, treffer.kat);
    }).filter(function (e) { return !!e; });
    return eintraege.length ? eintraege : null;
  }

  function eintraegeZuBeschriftung(text, kategorie) {
    var key = schluessel(text);
    if (!key) { return null; }
    var abw = abweichendeZiele(key);
    if (abw) { return abw; }

    var treffer = null;
    HT.daten.eintraegeDerKategorie(kategorie).forEach(function (e) {
      if (!treffer && schluessel(e.begriff) === key) { treffer = e; }
    });
    return treffer ? [treffer] : null;
  }

  /* --- SVG lesen ----------------------------------------------------------- */

  /* Die Grafik ist ein Office-Export: alles liegt flach in einer Gruppe, jedes
     Element trägt sein eigenes «transform». Statt zu rendern und zu messen
     (getBBox braucht ein sichtbares Dokument) werden die Matrizen direkt
     gelesen — translate(x y) und matrix(a b c d e f) genügen. */
  function matrixVon(el) {
    var s = el.getAttribute('transform') || '';
    var m = /^matrix\(([^)]*)\)/.exec(s);
    if (m) {
      var p = m[1].trim().split(/[\s,]+/).map(Number);
      if (p.length >= 6) { return p; }
    }
    m = /^translate\(\s*([-\d.eE+]+)[\s,]+([-\d.eE+]+)/.exec(s);
    if (m) { return [1, 0, 0, 1, Number(m[1]), Number(m[2])]; }
    return [1, 0, 0, 1, 0, 0];
  }

  function punkt(p, x, y) {
    return [p[0] * x + p[2] * y + p[4], p[1] * x + p[3] * y + p[5]];
  }

  function rahmenAusPunkten(pkte) {
    var xs = pkte.map(function (q) { return q[0]; });
    var ys = pkte.map(function (q) { return q[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function rahmenVonRect(el) {
    var p = matrixVon(el);
    var x = Number(el.getAttribute('x') || 0);
    var y = Number(el.getAttribute('y') || 0);
    var w = Number(el.getAttribute('width') || 0);
    var hoehe = Number(el.getAttribute('height') || 0);
    return rahmenAusPunkten([
      punkt(p, x, y), punkt(p, x + w, y), punkt(p, x, y + hoehe), punkt(p, x + w, y + hoehe)
    ]);
  }

  /* Die Dokumentform ist ein Pfad aus M/L/C/Z — ausschliesslich
     Koordinatenpaare, deshalb genügt das Auslesen aller Zahlen. */
  function rahmenVonPfad(el) {
    var zahlen = (el.getAttribute('d') || '').match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g);
    if (!zahlen || zahlen.length < 4) { return null; }
    var pkte = [];
    for (var i = 0; i + 1 < zahlen.length; i += 2) {
      pkte.push([Number(zahlen[i]), Number(zahlen[i + 1])]);
    }
    return rahmenAusPunkten(pkte);
  }

  function farbe(el, attr) {
    return String(el.getAttribute(attr) || '').toUpperCase();
  }

  function liste(svg, tag) {
    var roh = svg.getElementsByTagName(tag);
    var raus = [];
    for (var i = 0; i < roh.length; i++) { raus.push(roh[i]); }
    return raus;
  }

  function texteLesen(svg) {
    return liste(svg, 'text').map(function (el) {
      var p = matrixVon(el);
      return {
        x: p[4], y: p[5],
        s: el.textContent || '',
        gedreht: Math.abs(p[1]) > 0.5 || Math.abs(p[2]) > 0.5
      };
    });
  }

  function kaestenLesen(svg) {
    var kaesten = [];

    liste(svg, 'rect').forEach(function (el) {
      var f = farbe(el, 'fill');
      var s = farbe(el, 'stroke');
      var art = null;
      if (f === FARBEN.ergebnis) { art = 'ergebnis'; }
      else if (s === FARBEN.modulRand && f === 'NONE') { art = 'modul'; }
      else if (FARBEN.phase.indexOf(f) !== -1) { art = 'phase'; }
      if (!art) { return; }
      var r = rahmenVonRect(el);
      if (r.w < 4 || r.h < 4) { return; }
      r.art = art;
      r.fuell = art === 'ergebnis' ? FARBEN.ergebnis : null;
      kaesten.push(r);
    });

    liste(svg, 'path').forEach(function (el) {
      if (farbe(el, 'fill') !== '#FFFFFF' || farbe(el, 'stroke') !== FARBEN.ergebnisRand) { return; }
      var r = rahmenVonPfad(el);
      if (!r || r.w < 4 || r.h < 4) { return; }
      r.art = 'ergebnis';
      r.fuell = '#FFFFFF';
      kaesten.push(r);
    });

    return kaesten;
  }

  /* Jedes Textfragment gehört zum kleinsten Kasten, der es umschliesst —
     sonst schluckt die Sammelfläche «Phasenunabhängig» alle Kästen darin.
     Die Phasenbalken tragen als Einzige gedrehte Beschriftungen. */
  function beschriftungVerteilen(kaesten, texte) {
    kaesten.forEach(function (k) { k.flaeche = k.w * k.h; k.texte = []; });

    texte.forEach(function (t) {
      var beste = null;
      for (var i = 0; i < kaesten.length; i++) {
        var k = kaesten[i];
        if ((k.art === 'phase') !== t.gedreht) { continue; }
        if (t.x < k.x - 3 || t.x > k.x + k.w + 3) { continue; }
        if (t.y < k.y - 3 || t.y > k.y + k.h + 6) { continue; }
        if (!beste || k.flaeche < beste.flaeche) { beste = k; }
      }
      if (beste) { beste.texte.push(t); }
    });

    kaesten.forEach(function (k) {
      k.texte.sort(function (a, b) {
        var d = Math.round(a.y * 10) - Math.round(b.y * 10);
        return d || (a.x - b.x);
      });
      k.beschriftung = k.texte.map(function (t) { return t.s; }).join('');
    });
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
        var blass = zustand.nurMinimal && e.kategorie === 'ergebnis' && !e.minimalGefordert;

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

  function istGleich(feld, eintrag) {
    return feld.eintraege.some(function (x) { return x.id === eintrag.id; });
  }

  function istGesucht(feld, gesucht) {
    return istGleich(feld, gesucht);
  }

  /* --- Diagramm einsetzen -------------------------------------------------- */

  var KATEGORIE_JE_ART = { ergebnis: 'ergebnis', modul: 'modul', phase: 'phase' };

  function diagrammVeredeln(svg) {
    var gruppe = svg.getElementsByTagName('g')[0] || svg;
    var kaesten = kaestenLesen(svg);
    beschriftungVerteilen(kaesten, texteLesen(svg));

    var maske = svgEl('g', { 'class': 'ub-deckel' });
    var ebene = svgEl('g', { 'class': 'ub-felder' });
    var felder = [];
    var ohneTreffer = [];

    kaesten.forEach(function (k) {
      if (!k.beschriftung) { return; }
      var eintraege = eintraegeZuBeschriftung(k.beschriftung, KATEGORIE_JE_ART[k.art]);
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

  function diagrammLesen(text) {
    var doc = new global.DOMParser().parseFromString(text, 'image/svg+xml');
    var wurzel = doc.documentElement;
    if (!wurzel || String(wurzel.nodeName).toLowerCase() !== 'svg') {
      throw new Error('Keine SVG-Datei');
    }
    return document.importNode(wurzel, true);
  }

  /* Der Pfad steht im Handbuchkapitel; so bleibt er richtig, wenn der Import
     die Abbildung neu ablegt. */
  function abbildungspfadSuchen() {
    return HT.daten.handbuchKapitel().then(function (kapitel) {
      var pfad = null;
      (kapitel || []).forEach(function (k) {
        if (k.id !== 'methodenueberblick') { return; }
        (k.teile || []).forEach(function (t) {
          (t.abschnitte || []).forEach(function (a) {
            (a.bloecke || []).forEach(function (b) {
              if (!pfad && b.t === 'abb' && b.datei) { pfad = b.datei; }
            });
          });
        });
      });
      return pfad || ABBILDUNG;
    }).catch(function () { return ABBILDUNG; });
  }

  function abbildungHolen() {
    if (abbQuelle) { return global.Promise.resolve(abbQuelle); }
    return abbildungspfadSuchen().then(function (pfad) {
      return global.fetch(pfad).then(function (antwort) {
        if (!antwort.ok) { throw new Error('HTTP ' + antwort.status); }
        return antwort.text();
      });
    }).then(function (text) {
      abbQuelle = text;
      return text;
    });
  }

  function diagrammEinsetzen(svg) {
    var breite = Number(svg.getAttribute('width')) || 1059;
    var hoehe = Number(svg.getAttribute('height')) || 759;

    /* Manche Exporte tragen einen c2pa-Block als <metadata>; einzelne Parser
       zeigen dessen Inhalt als Text an. */
    liste(svg, 'metadata').forEach(function (m) {
      if (m.parentNode) { m.parentNode.removeChild(m); }
    });

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

  /* --- Werkzeugleiste ------------------------------------------------------ */

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
    return h('span', { class: 'ub-werkzeug__strich', 'aria-hidden': 'true' });
  }

  function werkzeugAktualisieren() {
    if (!refs.tabErkunden) { return; }
    var erkunden = zustand.modus === 'erkunden';
    refs.tabErkunden.setAttribute('aria-pressed', erkunden ? 'true' : 'false');
    refs.tabAbfragen.setAttribute('aria-pressed', erkunden ? 'false' : 'true');
    refs.knopfBreit.setAttribute('aria-pressed', zustand.nurAbb ? 'true' : 'false');
    refs.knopfPanel.setAttribute('aria-expanded', zustand.panel ? 'true' : 'false');
    refs.werkbank.dataset.breit = zustand.nurAbb ? 'true' : 'false';
    refs.werkbank.dataset.modus = zustand.modus;
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

  function werkzeugBauen() {
    refs.tabErkunden = werkzeugKnopf('Erkunden', 'ub-tab', function () { modusSetzen('erkunden'); });
    refs.tabAbfragen = werkzeugKnopf('Abfragen', 'ub-tab', function () { modusSetzen('abfragen'); });

    refs.zoomWert = h('span', {
      class: 'ub-zoom__wert', role: 'status',
      text: Math.round(zustand.zoom * 100) + ' %'
    });

    refs.knopfBreit = werkzeugKnopf('Breit', 'ub-werkzeug__knopf', function () {
      zustand.nurAbb = !zustand.nurAbb;
      werkzeugAktualisieren();
      zoomPassendSpaeter(40);
    }, { 'aria-pressed': 'false', title: 'Inhaltsseite einklappen' });

    refs.knopfPanel = werkzeugKnopf('Steuerung', 'ub-werkzeug__knopf', function () {
      panelSchalten();
    }, { 'aria-expanded': 'false', 'aria-haspopup': 'dialog' });

    return h('div', { class: 'ub-werkzeug' }, [
      h('div', { class: 'ub-modus', role: 'group', 'aria-label': 'Modus' }, [
        refs.tabErkunden, refs.tabAbfragen
      ]),
      werkzeugTrenner(),
      werkzeugKnopf('−', 'ub-zoom__knopf', function () { zoomSetzen(zustand.zoom / ZOOM_SCHRITT); },
        { 'aria-label': 'Verkleinern' }),
      refs.zoomWert,
      werkzeugKnopf('+', 'ub-zoom__knopf', function () { zoomSetzen(zustand.zoom * ZOOM_SCHRITT); },
        { 'aria-label': 'Vergrössern' }),
      werkzeugTrenner(),
      werkzeugKnopf('Passend', 'ub-werkzeug__knopf', zoomPassend,
        { title: 'Abbildung auf die Breite der Bühne bringen' }),
      werkzeugTrenner(),
      refs.knopfBreit,
      werkzeugTrenner(),
      refs.knopfPanel
    ]);
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

    refs.panelErstes = auswahl;

    return [
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
        ])
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
    refs.panelErstes = neu;

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
      h('div', { class: 'ub-panel__block' }, [
        h('div', { class: 'ub-panel__kopf' }, [
          h('span', { class: 'ub-panel__label', text: 'Schwachstellen' }),
          neu
        ]),
        koerper
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

  function faktenVon(e) {
    var raus = [];

    if (e.kategorie === 'ergebnis' && e.typ) {
      raus.push({
        label: 'Ergebnistyp',
        wert: e.typ + (e.minimalGefordert ? ' · minimal gefordert' : ''),
        kat: e.typ === 'Meilenstein' ? 'meilenstein' : 'ergebnis'
      });
    }
    if (e.verantwortlich) {
      raus.push({ label: 'Verantwortlich', wert: e.verantwortlich, kat: 'rolle' });
    }
    if (e.beteiligt && e.beteiligt.length) {
      raus.push({ label: 'Beteiligt', wert: e.beteiligt.join(', '), kat: 'rolle' });
    }
    if (e.kategorie !== 'modul' && e.module && e.module.length) {
      raus.push({ label: 'Module', wert: e.module.join(', '), kat: 'modul' });
    }
    if (e.kategorie !== 'phase' && e.phasen && e.phasen.length) {
      raus.push({ label: 'Phasen', wert: HT.daten.phasenSortiert(e.phasen).join(' · '), kat: 'phase' });
    }
    if (e.kategorie === 'phase' && e.meilensteine && e.meilensteine.length) {
      raus.push({
        label: 'Meilensteine',
        wert: e.meilensteine.map(function (m) { return m.name.replace(/^Meilenstein\s+/i, ''); }).join(' · '),
        kat: 'meilenstein'
      });
    }
    if (e.kategorie === 'modul' && e.szenarien && e.szenarien.length) {
      raus.push({ label: 'Szenarien', wert: e.szenarien.join(', '), kat: 'szenario' });
    }
    return raus;
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

  /* --- Graphbild: das Ergebnis im Zentrum ---------------------------------- */

  /* Masse im Koordinatensystem des SVG; die Zeichnung skaliert mit der
     Breite der Inhaltsseite (viewBox + width:100%). */
  var GB = {
    breite: 360,
    knotenX: 44, knotenB: 310,      // Nachbarknoten
    mitteX: 30, mitteB: 324,        // das Ergebnis
    zeile1: 26, zeile2: 36,         // Knotenhöhe mit einer bzw. zwei Zeilen
    luecke: 7, abstand: 12, rand: 5,
    biegung: 12,                    // x der Kontrollpunkte, dort fächern die Kanten
    glyph: 15,                      // Kantenlänge des Kategorie-Icons
    textX: 32                       // Textanfang, rechts neben dem Icon
  };

  /* Wie viele Zeichen in eine Zeile passen — SVG kann nicht kürzen. */
  function passt(text, groesse) {
    return HT.ui.kuerzen(text, groesse === 'klein' ? 50 : 41);
  }

  function gbKnoten(x, y, breite, hoehe, klasse, kat, z1, z2, ziel, titel) {
    var g = svgEl('a', { 'class': 'ub-gb__knoten ' + klasse, href: ziel });
    g.appendChild(svgEl('rect', { x: x, y: y, width: breite, height: hoehe }));
    var t = svgEl('title', {});
    t.textContent = titel || z1;
    g.appendChild(t);
    /* Dieselben Kategoriezeichen wie im Graph, im Lexikon und in der Legende
       (HT.ui.KAT_PFADE) — hier in die Zeichnung skaliert. */
    g.appendChild(HT.ui.katGruppe(kat, x + 17, y + hoehe / 2, GB.glyph, 'ub-gb__ikone'));
    var t1 = svgEl('text', { x: x + GB.textX, y: y + (z2 ? 15 : hoehe / 2 + 4), 'class': 'ub-gb__t1' });
    t1.textContent = passt(z1);
    g.appendChild(t1);
    if (z2) {
      var t2 = svgEl('text', { x: x + GB.textX, y: y + 27, 'class': 'ub-gb__t2' });
      t2.textContent = passt(z2, 'klein');
      g.appendChild(t2);
    }
    return g;
  }

  /* Das Ergebnis in der Mitte, darüber die Aufgaben, in denen es entsteht,
     darunter die Rollen. «Beteiligt» ist im Graphmodell keine Kante (es kennt
     für Ergebnisse nur die Verantwortung), steht aber als Querverweis in den
     Daten und auf der Quellseite — hier wird es gestrichelt gezeichnet. */
  function graphBild(e, linkZiel) {
    var knoten = HT.graph && HT.graph.knoten(e.id);
    if (!knoten) { return null; }

    var aufgaben = [];
    var rollen = [];
    var verantw = {};
    HT.graph.nachbarn(e.id).forEach(function (n) {
      var x = n.knoten.eintrag;
      if (x.kategorie === 'aufgabe') { aufgaben.push({ e: x, rel: 'erzeugt' }); }
      else if (x.kategorie === 'rolle') { verantw[x.begriff] = true; rollen.push({ e: x, rel: 'verantwortet' }); }
    });
    (e.beteiligt || []).forEach(function (name) {
      if (verantw[name]) { return; }
      var x = HT.daten.eintragMitBegriff(name, 'rolle');
      if (x) { rollen.push({ e: x, rel: 'beteiligt' }); }
    });
    if (!aufgaben.length && !rollen.length) { return null; }

    function sortieren(a, b) { return a.e.begriff.localeCompare(b.e.begriff, 'de'); }
    aufgaben.sort(sortieren);
    rollen.sort(function (a, b) {
      if (a.rel !== b.rel) { return a.rel === 'verantwortet' ? -1 : 1; }
      return sortieren(a, b);
    });

    /* Höhen von oben nach unten festlegen. */
    var y = GB.rand;
    aufgaben.forEach(function (a) {
      a.hoehe = a.e.module && a.e.module.length ? GB.zeile2 : GB.zeile1;
      a.y = y;
      y += a.hoehe + GB.luecke;
    });
    y += GB.abstand - GB.luecke;
    var mitteY = y;
    var mitteH = e.typ ? GB.zeile2 : GB.zeile1;
    y += mitteH + GB.abstand;
    rollen.forEach(function (r) {
      r.hoehe = GB.zeile2;
      r.y = y;
      y += r.hoehe + GB.luecke;
    });
    var hoehe = y - GB.luecke + GB.rand;

    var svg = svgEl('svg', {
      'class': 'ub-gb', viewBox: '0 0 ' + GB.breite + ' ' + hoehe,
      role: 'img', 'aria-label': 'Beziehungen von ' + e.begriff
    });

    /* Kanten zuerst, damit die Knoten darüber liegen. */
    var mitteAnker = mitteY + mitteH / 2;
    var kanten = svgEl('g', { 'class': 'ub-gb__kanten' });
    aufgaben.concat(rollen).forEach(function (n) {
      var ny = n.y + n.hoehe / 2;
      kanten.appendChild(svgEl('path', {
        'class': 'ub-gb__kante' + (n.rel === 'beteiligt' ? ' ist-lose' : ''),
        d: 'M' + GB.mitteX + ' ' + mitteAnker
         + 'C' + GB.biegung + ' ' + mitteAnker + ',' + GB.biegung + ' ' + ny + ',' + GB.knotenX + ' ' + ny
      }));
    });
    svg.appendChild(kanten);

    aufgaben.forEach(function (a) {
      svg.appendChild(gbKnoten(GB.knotenX, a.y, GB.knotenB, a.hoehe, 'ist-aufgabe', 'aufgabe',
        a.e.begriff, (a.e.module || []).join(', '), linkZiel(a.e), a.e.begriff + ' — entsteht darin'));
    });
    svg.appendChild(gbKnoten(GB.mitteX, mitteY, GB.mitteB, mitteH, 'ist-mitte', ikoneFuer(e),
      e.begriff, e.typ || '', linkZiel(e), e.begriff));
    rollen.forEach(function (r) {
      svg.appendChild(gbKnoten(GB.knotenX, r.y, GB.knotenB, r.hoehe, 'ist-rolle', 'rolle',
        r.e.begriff, r.rel, linkZiel(r.e), r.e.begriff + ' — ' + r.rel));
    });

    return [
      h('p', { class: 'ub-gb__lese', text:
        (aufgaben.length ? 'Oben die Aufgaben, in denen das Ergebnis entsteht. ' : '')
        + 'Unten die Rollen; gestrichelt heisst beteiligt.' }),
      svg,
      h('p', { class: 'ub-gb__mehr' }, h('a', {
        class: 'ub-verweis',
        href: '#/graph?id=' + encodeURIComponent(e.id),
        text: 'Im vollen Graph öffnen'
      }))
    ];
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

  /* Module sind keine Knoten des Graphen — er zeigt nur Rolle → Aufgabe →
     Ergebnis. Ihre Beziehungen stehen aber in denselben Daten: alles, was das
     Modul führt. Die Quellseite gibt das als breite Tabelle aus, hier stehen
     zwei Listen. */
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

  /* Ergebnisse bekommen das Bild, Module die Listen — sie sind keine Knoten. */
  function beziehungenVon(e, linkZiel) {
    if (e.kategorie === 'modul') { return modulBeziehungen(e, linkZiel); }
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
    HT.ui.leeren(refs.inhalt);
    HT.ui.leeren(refs.graph);

    var e = zustand.aktiv;
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
    var lead = leadQuelle(text);
    var marker = markerVon(e);

    refs.inhalt.appendChild(h('article', { class: 'ub-kopf' }, [
      h('div', { class: 'ub-kopf__zeile' }, [
        ikone(ikoneFuer(e), 24, 'ub-ikone--kopf'),
        h('span', { class: 'ub-kopf__kicker', text: kickerVon(e) }),
        marker ? h('span', { class: 'ub-marker', text: marker }) : null
      ]),
      h('h2', { class: 'ub-kopf__titel', text: e.begriff }),
      h('div', { class: 'ub-kopf__lead' }, leadBauen(e, lead))
    ]));

    /* Ergebnisse zeigen ihre Fakten unten im Graphbild — Ergebnistyp und
       «minimal gefordert» stehen bereits als Kicker und Marke im Kopf.
       Module und Phasen sind keine Knoten und behalten den Steckbrief. */
    var fakten = e.kategorie === 'ergebnis' ? [] : faktenVon(e);
    if (fakten.length) {
      refs.inhalt.appendChild(abschnitt('Steckbrief', [
        h('dl', { class: 'ub-fakten' }, fakten.map(function (f) {
          return h('div', { class: 'ub-fakt' }, [
            ikone(f.kat, 16, 'ub-ikone--fakt'),
            h('dt', { text: f.label }),
            h('dd', { text: f.wert })
          ]);
        }))
      ]));
    }

    /* Die übrigen Abschnitte der Quellseite in ihrer Reihenfolge — «Inhalt»
       und «Dokumentenvorlage» also genau so, wie sie auf hermes.admin.ch
       stehen. Die Beziehungen stehen nicht hier, sondern im unteren Bereich. */
    var beziehungen = beziehungenVon(e, lexikonZiel);
    (text && text.abschnitte ? text.abschnitte : []).forEach(function (a) {
      if (a === lead.abschnitt) { return; }                     // steht im Lead
      var titel = (a.titel || '').trim();
      if (AUS_GRAPH.indexOf(titel) !== -1 && beziehungen) { return; }
      var bs = (a.bloecke || []).filter(function (b) { return lead.bloecke.indexOf(b) === -1; });
      if (!bs.length) { return; }
      refs.inhalt.appendChild(abschnitt(titel || 'Aus dem Handbuch',
        [HT.ui.bloecke(bs, { verlinken: false, ebene: 4 })], 'ub-abschnitt--regel'));
    });

    if (beziehungen) {
      beziehungen.forEach(function (k) { refs.graph.appendChild(k); });
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

    if (e.pruefungshinweis) {
      refs.inhalt.appendChild(h('section', { class: 'ub-abschnitt ub-abschnitt--hinweis' }, [
        h('h3', { class: 'ub-mikro ub-mikro--akzent', text: 'Prüfungshinweis' }),
        h('p', { class: 'ub-prosa', text: e.pruefungshinweis })
      ]));
    }

    if (e.abgrenzung) {
      refs.inhalt.appendChild(abschnitt('Abgrenzung', [
        h('p', { class: 'ub-prosa', text: e.abgrenzung })
      ]));
    }

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

  function abbLegendeBauen() {
    return h('div', { class: 'ub-abblegende' }, [
      h('span', { class: 'ub-abblegende__titel', text: 'Zeichen der Abbildung' }),
      h('ul', { class: 'ub-abblegende__liste' }, ABB_LEGENDE.map(function (l) {
        return h('li', {}, [zeichen(l.form), h('span', { text: l.text })]);
      }))
    ]);
  }

  /* --- Aufbau -------------------------------------------------------------- */

  function abbildungSeiteBauen() {
    refs.prompt = h('div', { class: 'ub-prompt', hidden: true });
    refs.panelHuelle = h('div', { class: 'ub-panel-huelle' });
    refs.buehne = h('div', { class: 'ub-buehne' }, [
      h('p', { class: 'ub-buehne__laden', text: 'Abbildung wird geladen' })
    ]);

    var warnung = HT.app.datenWarnung();

    return h('section', { class: 'ub-seite' }, [
      werkzeugBauen(),
      refs.panelHuelle,
      warnung || null,
      refs.prompt,
      refs.buehne,
      abbLegendeBauen(),
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

    refs.graph = h('div', {
      class: 'ub-graph',
      id: 'ub-graphbereich',
      'aria-label': 'Beziehungen des gewählten Elements'
    });

    return [griff, h('div', { class: 'ub-graphkopf' }, refs.graphKnopf), refs.graph];
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

    abbildungHolen().then(function (text) {
      if (!document.body.contains(refs.buehne)) { return; }
      diagrammEinsetzen(diagrammLesen(text));
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
