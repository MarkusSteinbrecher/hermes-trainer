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
    ergebnis: '#DCEBFA',        // Ergebniskasten (eckig)
    ergebnisRand: '#DCEBFA',    // Dokumentform (weiss gefüllt, welliger Fuss)
    modulRand: '#000000',       // Modulrahmen
    phase: ['#B7D5F1', '#D9D9D9', '#EBC9C7']   // Phasenbalken am linken Rand
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

  var RUNDEN_LAENGE = 12;
  var SPEICHER = 'ueberblick-drill';

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
    gehalten: false,          // durch Klick festgehalten
    nurAbb: false,            // «Breit»: Inhaltsseite eingeklappt
    panel: false,             // Steuerung offen
    inhaltBreite: INHALT_STANDARD,
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

  /* Gespeichert wird nur, was über eine Runde hinaus zählt: die Fehlerbilanz
     und die beste Serie. Punkte und laufende Serie gehören zur Runde. */
  function speichern() {
    HT.store.schreib(SPEICHER, { fehler: zustand.fehler, besteSerie: zustand.besteSerie });
  }

  function wiederherstellen() {
    var g = HT.store.lies(SPEICHER, null);
    if (!g || typeof g !== 'object') { return; }
    if (g.fehler && typeof g.fehler === 'object') { zustand.fehler = g.fehler; }
    if (typeof g.besteSerie === 'number' && g.besteSerie >= 0) { zustand.besteSerie = g.besteSerie; }
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

  function inhaltZeichnen() {
    if (!refs.inhalt) { return; }
    HT.ui.leeren(refs.inhalt);

    var e = zustand.aktiv;
    if (!e) {
      refs.inhalt.appendChild(leerseite());
      refs.inhalt.scrollTop = 0;
      return;
    }

    var marker = markerVon(e);

    refs.inhalt.appendChild(h('article', { class: 'ub-kopf' }, [
      h('div', { class: 'ub-kopf__zeile' }, [
        ikone(ikoneFuer(e), 24, 'ub-ikone--kopf'),
        h('span', { class: 'ub-kopf__kicker', text: kickerVon(e) }),
        marker ? h('span', { class: 'ub-marker', text: marker }) : null
      ]),
      h('h2', { class: 'ub-kopf__titel', text: e.begriff }),
      h('p', { class: 'ub-kopf__lead', text: e.kurz || e.definition || '' })
    ]));

    var fakten = faktenVon(e);
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

    if (e.details) {
      refs.inhalt.appendChild(abschnitt('Aus der Dokumentation', [
        h('p', { class: 'ub-doku', text: e.details })
      ], 'ub-abschnitt--regel'));
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

    refs.inhalt.scrollTop = 0;
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
      h('p', { class: 'ub-bildunterschrift' }, [
        BILDUNTERSCHRIFT + ' — Originalgrafik, ',
        h('a', { href: QUELLE_ABB, target: '_blank', rel: 'noopener', text: 'hermes.admin.ch ↗' })
      ])
    ]);
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

    refs.inhalt = h('aside', { class: 'ub-inhalt', 'aria-label': 'Inhaltsseite zum gewählten Element' });

    refs.werkbank = h('div', { class: 'ub-werkbank' }, [
      h('h1', { class: 'nur-sr', text: 'Methodenüberblick' }),
      abbildungSeiteBauen(),
      trennerBauen(),
      refs.inhalt
    ]);

    behaelter.appendChild(refs.werkbank);

    werkzeugAktualisieren();
    inhaltBreiteSetzen(zustand.inhaltBreite);
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
