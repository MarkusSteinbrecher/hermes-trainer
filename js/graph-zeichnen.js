/* HERMES-Trainer — Graph zeichnen.
   Reines SVG ohne Abhängigkeiten: Spaltenlayout (Rolle, Aufgabe, Ergebnis),
   Knotenformen je Kategorie, Kantenstile je Beziehung, Verschieben und Zoomen
   mit Maus, Rad und Touch, Hervorhebung eines Knotens samt Nachbarn. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var KNOTEN_HOEHE = 36;
  var GLYPH_R = 10;
  var GLYPH_KANTE = 14;   /* Kantenlänge des Kategorie-Icons im Knotenkreis */
  /* Der Phasenstreifen im Knoten bildet das Phasenmodell der Methode nach,
     wie es die HERMES-Übersicht zeigt: links Initialisierung, dann Konzept,
     Realisierung und Einführung oben und darunter Umsetzung (agil) über
     dieselbe Breite, rechts Abschluss. Alle Felder gleich hoch;
     Initialisierung und Abschluss stehen mittig zwischen den beiden Reihen.
     Masse in Knotenpixeln, Ursprung links oben des Streifens. */
  var ZELLE = 7, ZELLE_LUECKE = 1.5, STREIFEN_H = 20;
  var HALB = (STREIFEN_H - ZELLE_LUECKE) / 2;
  var MITTIG = (STREIFEN_H - HALB) / 2;
  var PHASEN_ZELLEN = [
    { name: 'Initialisierung', x: 0, y: MITTIG, w: ZELLE, h: HALB },
    { name: 'Konzept',         x: ZELLE + ZELLE_LUECKE, y: 0, w: ZELLE, h: HALB },
    { name: 'Realisierung',    x: 2 * (ZELLE + ZELLE_LUECKE), y: 0, w: ZELLE, h: HALB },
    { name: 'Einführung',      x: 3 * (ZELLE + ZELLE_LUECKE), y: 0, w: ZELLE, h: HALB },
    { name: 'Umsetzung',       x: ZELLE + ZELLE_LUECKE, y: HALB + ZELLE_LUECKE, w: 3 * ZELLE + 2 * ZELLE_LUECKE, h: HALB },
    { name: 'Abschluss',       x: 4 * (ZELLE + ZELLE_LUECKE), y: MITTIG, w: ZELLE, h: HALB }
  ];
  var STREIFEN_B = 5 * ZELLE + 4 * ZELLE_LUECKE;
  var TYP_SYMBOL = { Dokument: '▤', Checkliste: '☑', Zustand: '●', Meilenstein: '◆' };

  /* --- SVG-Helfer ---------------------------------------------------------- */

  function s(tag, attrs, kinder) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) { return; }
        if (k === 'text') { el.textContent = String(v); }
        else if (k === 'class') { el.setAttribute('class', String(v)); }
        else { el.setAttribute(k, String(v)); }
      });
    }
    if (kinder) {
      (Array.isArray(kinder) ? kinder : [kinder]).forEach(function (kind) {
        if (kind) { el.appendChild(kind); }
      });
    }
    return el;
  }

  function rund(n) { return Math.round(n * 10) / 10; }

  /* --- Textbreite messen -------------------------------------------------- */

  var messKontext = null;
  var messSchrift = { normal: '600 14px sans-serif', klein: '700 10px sans-serif' };

  function schriftLesen(container) {
    var probe = document.createElement('span');
    probe.className = 'graph-messprobe';
    probe.textContent = 'Probe';
    container.appendChild(probe);
    var stil = global.getComputedStyle(probe);
    var familie = stil.fontFamily || 'sans-serif';
    container.removeChild(probe);
    messSchrift.normal = '600 14px ' + familie;
    messSchrift.klein = '700 10px ' + familie;
  }

  function messen(text, art) {
    if (!messKontext) {
      var canvas = document.createElement('canvas');
      messKontext = canvas.getContext('2d');
    }
    messKontext.font = messSchrift[art || 'normal'];
    return messKontext.measureText(String(text || '')).width;
  }

  /* --- Knotenmasse --------------------------------------------------------- */

  function phasenListe(k) {
    return (k.eintrag && k.eintrag.phasen) ? k.eintrag.phasen : [];
  }

  /* Meilensteine sind Ergebnisse — aber die Quality Gates des Phasenmodells.
     Sie bekommen darum eine eigene Form (Sechseck) und ein eigenes Zeichen
     (Raute) statt Dokument, und tragen das Typ-Symbol nicht doppelt. */
  var MEILENSTEIN_SPITZE = 12;
  function istMeilenstein(k) {
    return k.kategorie === 'ergebnis' && k.eintrag && k.eintrag.typ === 'Meilenstein';
  }

  function knotenBreite(k, opt) {
    var w = 12 + GLYPH_R * 2 + 8 + messen(k.begriff, 'normal') + 14;
    if (istMeilenstein(k)) { w += MEILENSTEIN_SPITZE * 2 + 8; }   /* Platz für die beiden Spitzen */
    else if (k.kategorie === 'ergebnis' && k.eintrag && k.eintrag.typ) { w += 20; }
    if (opt.phasenstreifen && k.kategorie !== 'rolle' && phasenListe(k).length) { w += STREIFEN_B + 6; }
    return Math.ceil(w);
  }

  /* --- Knotenformen -------------------------------------------------------- */

  function formPfad(kategorie, w, h, meilenstein) {
    var c;
    if (meilenstein) {   // Sechseck (Quality Gate im Ablauf)
      c = MEILENSTEIN_SPITZE;
      return 'M' + c + ' 0H' + (w - c) + 'L' + w + ' ' + (h / 2) + 'L' + (w - c) + ' ' + h + 'H' + c + 'L0 ' + (h / 2) + 'Z';
    }
    switch (kategorie) {
      case 'aufgabe':    // Parallelogramm (Tätigkeit)
        c = 7;
        return 'M' + c + ' 0H' + w + 'L' + (w - c) + ' ' + h + 'H0Z';
      case 'ergebnis':   // Dokument mit Eselsohr
        c = 8;
        return 'M0 0H' + (w - c) + 'L' + w + ' ' + c + 'V' + h + 'H0Z';
      case 'rolle':      // Pille
        c = h / 2;
        return 'M' + c + ' 0H' + (w - c) + 'A' + c + ' ' + c + ' 0 0 1 ' + (w - c) + ' ' + h + 'H' + c + 'A' + c + ' ' + c + ' 0 0 1 ' + c + ' 0Z';
      default:           // Kasten (Rückfall)
        c = 5;
        return 'M' + c + ' 0H' + (w - c) + 'Q' + w + ' 0 ' + w + ' ' + c + 'V' + (h - c) + 'Q' + w + ' ' + h + ' ' + (w - c) + ' ' + h + 'H' + c + 'Q0 ' + h + ' 0 ' + (h - c) + 'V' + c + 'Q0 0 ' + c + ' 0Z';
    }
  }

  /* Kategorie-Icon (24er-Raster aus HT.ui) in den Knotenkreis skaliert. */
  function ikone(kategorie, cx, cy, kante) {
    return HT.ui.katGruppe(kategorie, cx, cy, kante, 'gk__ikone');
  }

  function knotenElement(k, opt) {
    var w = k.w, h = k.h;
    var meta = HT.graph.KAT[k.kategorie];
    var istMs = istMeilenstein(k);
    var klassen = ['gk', 'gk--' + k.kategorie];
    if (istMs) { klassen.push('gk--meilenstein'); }
    if (k.entscheid) { klassen.push('gk--entscheid'); }

    var label = (istMs ? 'Meilenstein ' : (meta ? meta.singular + ' ' : '')) + k.begriff;
    var g = s('g', {
      class: klassen.join(' '),
      transform: 'translate(' + rund(k.x) + ',' + rund(k.y) + ')',
      'data-id': k.id,
      tabindex: '0',
      role: 'button',
      'aria-label': label
    });

    g.appendChild(s('path', { class: 'gk__form', d: formPfad(k.kategorie, w, h, istMs) }));

    var gx = 12 + (istMs ? MEILENSTEIN_SPITZE - 4 : 0) + GLYPH_R;
    g.appendChild(s('circle', { class: 'gk__glyph', cx: gx, cy: h / 2, r: GLYPH_R }));
    g.appendChild(ikone(istMs ? 'meilenstein' : k.kategorie, gx, h / 2, GLYPH_KANTE));

    var tx = gx + GLYPH_R + 8;
    var labelText = k.begriff;
    g.appendChild(s('text', { class: 'gk__label', x: tx, y: h / 2, text: labelText }));
    tx += messen(labelText, 'normal');

    if (!istMs && k.kategorie === 'ergebnis' && k.eintrag && k.eintrag.typ) {
      tx += 8;
      g.appendChild(s('text', {
        class: 'gk__typ', x: tx, y: h / 2,
        text: TYP_SYMBOL[k.eintrag.typ] || ''
      }));
      var t = s('title', { text: 'Ergebnistyp: ' + k.eintrag.typ });
      g.appendChild(t);
      tx += 12;
    }

    if (opt.phasenstreifen && k.kategorie !== 'rolle') {
      var phasen = phasenListe(k);
      if (phasen.length) {
        var aktiv = {};
        phasen.forEach(function (p) { aktiv[p] = true; });
        var px = tx + 12;
        var streifen = s('g', { class: 'gk__phasen', 'aria-hidden': 'true' });
        var py = h / 2 - STREIFEN_H / 2;
        PHASEN_ZELLEN.forEach(function (z) {
          streifen.appendChild(s('rect', {
            class: 'gk__phase' + (aktiv[z.name] ? ' ist-aktiv' : ''),
            x: rund(px + z.x), y: rund(py + z.y), width: z.w, height: z.h
          }));
        });
        g.appendChild(streifen);
        g.appendChild(s('title', { text: label + ' · Phasen: ' + HT.daten.phasenSortiert(phasen).join(', ') }));
      }
    }

    return g;
  }

  /* --- Layout: Spalten und Bahnen ------------------------------------------ */

  /**
   * Swimlane-Layout: Rollen als durchgehende Spalte (sie tragen in HERMES
   * weder Phase noch Modul), daneben die Bahnbeschriftung und rechts davon
   * Aufgaben und Ergebnisse, jede in ihrer Bahn. Die Bahnen laufen von oben
   * nach unten in der Reihenfolge der Methode; Kanten bleiben S-Kurven.
   */
  function layoutSpalten(tg, opt) {
    opt = opt || {};
    var SPALTEN_ABSTAND = opt.spaltenAbstand || 104;
    var BAHN_ABSTAND = 28;        /* Beschriftung steht nah an ihrer Bahn */
    var ZEILE = KNOTEN_HOEHE + 8;
    var BAHN_LUFT = 12;           /* Luft oben und unten in der Bahn */
    var BAHN_RAND = 14;           /* Überstand des Bandes links und rechts */

    var spalten = tg.spalten.filter(function (sp) { return sp.knoten.length; }).map(function (sp) {
      var meta = HT.graph.KAT[sp.kategorie];
      return {
        kategorie: sp.kategorie,
        label: meta.label,
        gruppeVon: sp.gruppeVon || null,
        knoten: sp.knoten.map(function (k) {
          var n = { id: k.id, kategorie: k.kategorie, begriff: k.begriff, eintrag: k.eintrag, entscheid: k.entscheid, h: KNOTEN_HOEHE };
          n.w = knotenBreite(n, opt);
          return n;
        })
      };
    });
    spalten.forEach(function (sp) {
      sp.breite = sp.knoten.reduce(function (m, n) { return Math.max(m, n.w); }, 0);
    });

    var mitBahn = spalten.filter(function (sp) { return !!sp.gruppeVon; });
    var ohneBahn = spalten.filter(function (sp) { return !sp.gruppeVon; });

    /* Bahnen in der Reihenfolge der Methode, aber nur die belegten. */
    var bahnen = [];
    (tg.bahnen || []).concat(['']).forEach(function (name) {
      var belegt = mitBahn.some(function (sp) {
        return sp.knoten.some(function (n) { return (sp.gruppeVon[n.id] || '') === name; });
      });
      if (belegt) { bahnen.push({ name: name, zeilen: 0 }); }
    });

    var knoten = [];
    var positionen = {};
    var texte = [];
    var linien = [];
    var baender = [];

    if (!bahnen.length) {
      /* Weder Aufgaben noch Ergebnisse sichtbar: schlichte Spalten. */
      return einfacheSpalten(spalten, { knoten: knoten, positionen: positionen, texte: texte }, tg, SPALTEN_ABSTAND, ZEILE);
    }

    /* Bahnhöhen: die höhere der beiden Spalten bestimmt die Bahn. */
    var proBahn = {};
    bahnen.forEach(function (b) { proBahn[b.name] = {}; });
    mitBahn.forEach(function (sp) {
      bahnen.forEach(function (b) { proBahn[b.name][sp.kategorie] = []; });
      sp.knoten.forEach(function (n) {
        var g = sp.gruppeVon[n.id] || '';
        if (!proBahn[g]) { return; }
        proBahn[g][sp.kategorie].push(n);
      });
    });
    bahnen.forEach(function (b) {
      var max = 0;
      mitBahn.forEach(function (sp) { max = Math.max(max, proBahn[b.name][sp.kategorie].length); });
      b.zeilen = Math.max(1, max);
      b.hoehe = b.zeilen * ZEILE - 8 + 2 * BAHN_LUFT;
    });
    var bahnenHoehe = bahnen.reduce(function (m, b) { return m + b.hoehe; }, 0);

    /* Breite der Bahnspalte: längster Name, in Grenzen. */
    var beschriftung = 150;
    bahnen.forEach(function (b) {
      beschriftung = Math.max(beschriftung, Math.ceil(messen(b.name || 'Ohne Zuordnung', 'normal')) + 34);
    });
    beschriftung = Math.min(beschriftung, 250);

    /* Rollen laufen durch, ohne Bahn — Höhe der Spalte für die Ausrichtung. */
    var ohneHoehe = ohneBahn.reduce(function (m, sp) {
      return Math.max(m, sp.knoten.length * ZEILE - 8);
    }, 0);
    var gesamtHoehe = Math.max(bahnenHoehe, ohneHoehe);
    var obenBuendig = gesamtHoehe > 1400;
    var bahnenOben = obenBuendig ? 0 : (gesamtHoehe - bahnenHoehe) / 2;
    var ohneOben = obenBuendig ? 0 : (gesamtHoehe - ohneHoehe) / 2;

    /* Spalten von links: erst die bahnlosen (Rollen), dann die Beschriftung,
       dann die Spalten in Bahnen. */
    var x = 0;
    ohneBahn.forEach(function (sp) {
      sp.x = x;
      x += sp.breite + SPALTEN_ABSTAND;
    });
    var beschriftungX = x;
    x += beschriftung + BAHN_ABSTAND;
    mitBahn.forEach(function (sp, i) {
      sp.x = x;
      x += sp.breite + (i < mitBahn.length - 1 ? SPALTEN_ABSTAND : 0);
    });
    var bahnRechts = x;

    /* Spaltenköpfe */
    var alleSpalten = ohneBahn.concat(mitBahn);
    alleSpalten.forEach(function (sp, si) {
      sp.index = si;
      texte.push({ x: sp.x, y: -32, text: sp.label + ' · ' + sp.knoten.length, klasse: 'gtext gtext--spalte gtext--' + sp.kategorie, anker: 'start' });
    });
    texte.push({
      x: beschriftungX, y: -32,
      text: tg.achse === 'modul' ? 'Module' : 'Phasen',
      klasse: 'gtext gtext--spalte gtext--bahnkopf', anker: 'start'
    });

    /* Bänder, Beschriftung und Knoten je Bahn */
    var y = bahnenOben;
    bahnen.forEach(function (b, bi) {
      b.y = y;
      baender.push({
        x: beschriftungX - BAHN_RAND, y: y, w: bahnRechts - beschriftungX + 2 * BAHN_RAND, h: b.hoehe,
        gerade: bi % 2 === 0
      });
      if (bi > 0) { linien.push({ x1: beschriftungX - BAHN_RAND, y1: y, x2: bahnRechts + BAHN_RAND, y2: y }); }
      texte.push({ x: beschriftungX, y: y + BAHN_LUFT + 12, text: b.name || 'Ohne Zuordnung', klasse: 'gtext gtext--bahn', anker: 'start' });
      var anzahl = mitBahn.map(function (sp) {
        return proBahn[b.name][sp.kategorie].length + ' ' + (sp.kategorie === 'aufgabe' ? 'Aufgaben' : 'Ergebnisse');
      }).join(' · ');
      texte.push({ x: beschriftungX, y: y + BAHN_LUFT + 31, text: anzahl, klasse: 'gtext gtext--bahnzahl', anker: 'start' });

      mitBahn.forEach(function (sp) {
        /* Kürzere Spalte in der Bahn mittig: sonst klafft unter den Aufgaben
           eine Lücke, wenn die Bahn viel mehr Ergebnisse als Aufgaben hat. */
        var liste = proBahn[b.name][sp.kategorie];
        var ny = y + BAHN_LUFT + ((b.zeilen - liste.length) * ZEILE) / 2;
        liste.forEach(function (n) {
          n.x = sp.x;
          n.y = ny;
          n.spalte = sp.index;
          positionen[n.id] = n;
          knoten.push(n);
          ny += ZEILE;
        });
      });
      y += b.hoehe;
    });

    /* Rollen: durchgehend, ohne Bahn */
    ohneBahn.forEach(function (sp) {
      var ny = ohneOben;
      sp.knoten.forEach(function (n) {
        n.x = sp.x;
        n.y = ny;
        n.spalte = sp.index;
        positionen[n.id] = n;
        knoten.push(n);
        ny += ZEILE;
      });
    });

    return {
      art: 'spalten',
      knoten: knoten,
      kanten: kantenBauen(tg, positionen),
      texte: texte,
      linien: linien,
      baender: baender,
      zentrum: null
    };
  }

  /* Fallback ohne Bahnen (Aufgaben und Ergebnisse ausgeblendet). */
  function einfacheSpalten(spalten, sammler, tg, abstand, zeile) {
    var maxHoehe = spalten.reduce(function (m, sp) { return Math.max(m, sp.knoten.length * zeile - 8); }, 0);
    var x = 0;
    spalten.forEach(function (sp, si) {
      var y = (maxHoehe - (sp.knoten.length * zeile - 8)) / 2;
      sp.x = x;
      sp.index = si;
      sammler.texte.push({ x: x, y: -32, text: sp.label + ' · ' + sp.knoten.length, klasse: 'gtext gtext--spalte gtext--' + sp.kategorie, anker: 'start' });
      sp.knoten.forEach(function (n) {
        n.x = x; n.y = y; n.spalte = si;
        sammler.positionen[n.id] = n;
        sammler.knoten.push(n);
        y += zeile;
      });
      x += sp.breite + abstand;
    });
    return {
      art: 'spalten', knoten: sammler.knoten, kanten: kantenBauen(tg, sammler.positionen),
      texte: sammler.texte, linien: [], baender: [], zentrum: null
    };
  }

  function kantenBauen(tg, positionen) {
    var kanten = [];
    tg.kanten.forEach(function (kante) {
      var a = positionen[kante.von], b = positionen[kante.nach];
      if (!a || !b) { return; }
      var links = a.spalte <= b.spalte ? a : b;
      var rechts = links === a ? b : a;
      if (links.spalte === rechts.spalte) { return; }
      var x1 = links.x + links.w, y1 = links.y + links.h / 2;
      var x2 = rechts.x, y2 = rechts.y + rechts.h / 2;
      var mx = (x1 + x2) / 2;
      kanten.push({
        id: kante.id, von: kante.von, nach: kante.nach, rel: kante.rel,
        weit: rechts.spalte - links.spalte > 1,
        pfad: 'M' + rund(x1) + ' ' + rund(y1) + 'C' + rund(mx) + ' ' + rund(y1) + ' ' + rund(mx) + ' ' + rund(y2) + ' ' + rund(x2) + ' ' + rund(y2)
      });
    });
    return kanten;
  }


  /* --- Zeichner ------------------------------------------------------------ */

  function erstellen(container, rueckrufe) {
    rueckrufe = rueckrufe || {};
    schriftLesen(container);

    var svg = s('svg', { class: 'graph-svg', role: 'group', 'aria-label': 'Graph der Methodenelemente' });
    var defs = s('defs');
    defs.appendChild(s('marker', { id: 'gpfeil', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' },
      s('path', { d: 'M0 0L10 5L0 10Z', class: 'gpfeil' })));
    svg.appendChild(defs);
    var welt = s('g', { class: 'welt' });
    var ebeneBahnen = s('g', { class: 'ebene-bahnen' });
    var ebeneKanten = s('g', { class: 'ebene-kanten' });
    var ebeneTexte = s('g', { class: 'ebene-texte' });
    var ebeneKnoten = s('g', { class: 'ebene-knoten' });
    welt.appendChild(ebeneBahnen);
    welt.appendChild(ebeneKanten);
    welt.appendChild(ebeneTexte);
    welt.appendChild(ebeneKnoten);
    svg.appendChild(welt);
    container.appendChild(svg);

    var sicht = { k: 1, x: 0, y: 0 };
    var elemente = { knoten: {}, kanten: {} };
    var nachbarschaft = {};   // id -> { knoten: {id:true}, kanten: {id:true} }
    var aktuellesLayout = null;

    function anwenden() {
      welt.setAttribute('transform', 'translate(' + rund(sicht.x) + ',' + rund(sicht.y) + ') scale(' + (Math.round(sicht.k * 1000) / 1000) + ')');
    }

    function masse() {
      var r = svg.getBoundingClientRect();
      return { w: r.width || 800, h: r.height || 600, links: r.left, oben: r.top };
    }

    function einpassen(optionen) {
      optionen = optionen || {};
      var m = masse();
      var box;
      try { box = welt.getBBox(); } catch (e) { return; }
      if (!box || !box.width || !box.height) { return; }
      var rand = optionen.rand || 28;
      var kx = (m.w - 2 * rand) / box.width;
      var ky = (m.h - 2 * rand) / box.height;
      var k = Math.min(kx, ky, optionen.maxZoom || 1.15);
      /* Auf schmalen Flächen darf der Graph kleiner werden — Zoomen per Finger ist dort näher als Schieben. */
      k = Math.max(k, optionen.minZoom || (m.w < 700 ? 0.42 : 0.6));
      sicht.k = k;
      if (box.width * k + 2 * rand > m.w) {
        sicht.x = rand - box.x * k;
      } else {
        sicht.x = (m.w - box.width * k) / 2 - box.x * k;
      }
      if (box.height * k + 2 * rand > m.h) {
        sicht.y = rand - box.y * k;
      } else {
        sicht.y = (m.h - box.height * k) / 2 - box.y * k;
      }
      anwenden();
    }

    function zoomBei(cx, cy, faktor) {
      var m = masse();
      var px = cx - m.links, py = cy - m.oben;
      var neu = Math.min(3, Math.max(0.2, sicht.k * faktor));
      var f = neu / sicht.k;
      sicht.x = px - (px - sicht.x) * f;
      sicht.y = py - (py - sicht.y) * f;
      sicht.k = neu;
      anwenden();
    }

    function zoomen(faktor) {
      var m = masse();
      zoomBei(m.links + m.w / 2, m.oben + m.h / 2, faktor);
    }

    /* Zeiger: Verschieben mit einem Finger/Maus, Zoomen mit zwei Fingern. */
    var zeiger = {};
    var bewegt = false;
    var start = null;
    var pinch = null;

    function zeigerListe() { return Object.keys(zeiger).map(function (id) { return zeiger[id]; }); }

    svg.addEventListener('pointerdown', function (ev) {
      if (ev.button !== undefined && ev.button !== 0) { return; }
      zeiger[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
      var liste = zeigerListe();
      bewegt = false;
      if (liste.length === 1) {
        start = { x: ev.clientX, y: ev.clientY, sx: sicht.x, sy: sicht.y };
        pinch = null;
      } else if (liste.length === 2) {
        pinch = { d: Math.hypot(liste[0].x - liste[1].x, liste[0].y - liste[1].y) };
        start = null;
      }
    });

    svg.addEventListener('pointermove', function (ev) {
      if (!zeiger[ev.pointerId]) { return; }
      zeiger[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var liste = zeigerListe();
      if (liste.length === 1 && start) {
        var dx = ev.clientX - start.x, dy = ev.clientY - start.y;
        /* 8 px statt 4: ein Klick auf dem Trackpad wandert leicht ein paar
           Pixel — darunter zählte er als Zug und wurde verschluckt. */
        if (!bewegt && Math.hypot(dx, dy) > 8) { bewegt = true; svg.classList.add('ist-am-ziehen'); }
        if (bewegt) {
          sicht.x = start.sx + dx;
          sicht.y = start.sy + dy;
          anwenden();
        }
      } else if (liste.length === 2 && pinch) {
        var d = Math.hypot(liste[0].x - liste[1].x, liste[0].y - liste[1].y);
        if (d > 0 && pinch.d > 0) {
          zoomBei((liste[0].x + liste[1].x) / 2, (liste[0].y + liste[1].y) / 2, d / pinch.d);
          pinch.d = d;
          bewegt = true;
        }
      }
    });

    function zeigerEnde(ev) {
      delete zeiger[ev.pointerId];
      var liste = zeigerListe();
      if (!liste.length) {
        start = null; pinch = null;
        svg.classList.remove('ist-am-ziehen');
        /* «bewegt» bleibt bis zum click-Ereignis gesetzt, damit ein Zug keinen Klick auslöst. */
        global.setTimeout(function () { bewegt = false; }, 0);
      } else if (liste.length === 1) {
        start = { x: liste[0].x, y: liste[0].y, sx: sicht.x, sy: sicht.y };
        pinch = null;
      }
    }
    svg.addEventListener('pointerup', zeigerEnde);
    svg.addEventListener('pointercancel', zeigerEnde);

    svg.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var faktor = Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.0015));
      zoomBei(ev.clientX, ev.clientY, faktor);
    }, { passive: false });

    svg.addEventListener('dblclick', function (ev) {
      var g = knotenAusEreignis(ev);
      if (g) {
        ev.preventDefault();
        if (rueckrufe.beiDoppelklick) { rueckrufe.beiDoppelklick(g.getAttribute('data-id')); }
      }
    });

    svg.addEventListener('click', function (ev) {
      if (bewegt) { return; }
      var g = knotenAusEreignis(ev);
      if (g) {
        if (rueckrufe.beiKlick) { rueckrufe.beiKlick(g.getAttribute('data-id'), ev); }
      } else if (rueckrufe.beiLeerklick) {
        rueckrufe.beiLeerklick();
      }
    });

    svg.addEventListener('keydown', function (ev) {
      var g = knotenAusEreignis(ev);
      if (!g) { return; }
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        if (rueckrufe.beiKlick) { rueckrufe.beiKlick(g.getAttribute('data-id'), ev); }
      }
    });

    svg.addEventListener('pointerover', function (ev) {
      var g = knotenAusEreignis(ev);
      if (g && rueckrufe.beiHover) { rueckrufe.beiHover(g.getAttribute('data-id'), ev); }
    });
    svg.addEventListener('pointerout', function (ev) {
      var g = knotenAusEreignis(ev);
      if (g && rueckrufe.beiHover) {
        var ziel = ev.relatedTarget;
        while (ziel && ziel !== svg && !(ziel.classList && ziel.classList.contains('gk'))) { ziel = ziel.parentNode; }
        if (ziel !== g) { rueckrufe.beiHover(null, ev); }
      }
    });
    svg.addEventListener('focusin', function (ev) {
      var g = knotenAusEreignis(ev);
      if (g && rueckrufe.beiHover) { rueckrufe.beiHover(g.getAttribute('data-id'), ev); }
    });
    svg.addEventListener('focusout', function () {
      if (rueckrufe.beiHover) { rueckrufe.beiHover(null, null); }
    });

    function knotenAusEreignis(ev) {
      var el = ev.target;
      while (el && el !== svg) {
        if (el.classList && el.classList.contains('gk')) { return el; }
        el = el.parentNode;
      }
      return null;
    }

    /* --- Zeichnen --------------------------------------------------------- */

    function zeigen(layout, optionen) {
      optionen = optionen || {};
      aktuellesLayout = layout;
      HT.ui.leeren(ebeneBahnen);
      HT.ui.leeren(ebeneKanten);
      HT.ui.leeren(ebeneTexte);
      HT.ui.leeren(ebeneKnoten);
      elemente = { knoten: {}, kanten: {} };
      nachbarschaft = {};

      (layout.baender || []).forEach(function (b) {
        ebeneBahnen.appendChild(s('rect', {
          class: 'gbahn' + (b.gerade ? '' : ' gbahn--ungerade'),
          x: rund(b.x), y: rund(b.y), width: rund(b.w), height: rund(b.h)
        }));
      });

      layout.kanten.forEach(function (ka) {
        var stil = ka.stil || (HT.graph.REL[ka.rel] ? HT.graph.REL[ka.rel].stil : 'struktur');
        var el = s('path', {
          class: 'gkante gkante--' + stil + (ka.weit ? ' gkante--weit' : '') + (ka.quer ? ' gkante--quer' : ''),
          d: ka.pfad,
          'data-id': ka.id,
          'marker-end': (ka.rel === 'erzeugt' && !ka.quer) ? 'url(#gpfeil)' : null
        });
        ebeneKanten.appendChild(el);
        elemente.kanten[ka.id] = el;
        [ka.von, ka.nach].forEach(function (id) {
          if (!nachbarschaft[id]) { nachbarschaft[id] = { knoten: {}, kanten: {} }; }
          nachbarschaft[id].kanten[ka.id] = true;
        });
        nachbarschaft[ka.von].knoten[ka.nach] = true;
        nachbarschaft[ka.nach].knoten[ka.von] = true;
      });

      (layout.linien || []).forEach(function (l) {
        ebeneTexte.appendChild(s('line', { class: 'ggruppenlinie', x1: rund(l.x1), y1: rund(l.y1), x2: rund(l.x2), y2: rund(l.y2) }));
      });

      layout.texte.forEach(function (t) {
        ebeneTexte.appendChild(s('text', { class: t.klasse, x: rund(t.x), y: rund(t.y), 'text-anchor': t.anker || 'start', text: t.text }));
      });

      layout.knoten.forEach(function (k) {
        var el = knotenElement(k, optionen);
        ebeneKnoten.appendChild(el);
        elemente.knoten[k.id] = el;
      });

      if (optionen.einpassen !== false) {
        einpassen(optionen);
      } else {
        anwenden();
      }
    }

    /* Hervorhebung: ein Knoten samt Nachbarn und Kanten, alles andere gedimmt. */
    function hervorheben(id, festhalten) {
      svg.classList.remove('ist-hervorhebung');
      Object.keys(elemente.knoten).forEach(function (k) { elemente.knoten[k].classList.remove('ist-aktiv', 'ist-gewaehlt'); });
      Object.keys(elemente.kanten).forEach(function (k) { elemente.kanten[k].classList.remove('ist-aktiv'); });
      if (!id || !elemente.knoten[id]) { return; }
      svg.classList.add('ist-hervorhebung');
      elemente.knoten[id].classList.add('ist-aktiv');
      if (festhalten) { elemente.knoten[id].classList.add('ist-gewaehlt'); }
      var n = nachbarschaft[id];
      if (n) {
        Object.keys(n.knoten).forEach(function (k) { if (elemente.knoten[k]) { elemente.knoten[k].classList.add('ist-aktiv'); } });
        Object.keys(n.kanten).forEach(function (k) { if (elemente.kanten[k]) { elemente.kanten[k].classList.add('ist-aktiv'); } });
      }
      if (aktuellesLayout && aktuellesLayout.zentrum && elemente.knoten[aktuellesLayout.zentrum]) {
        elemente.knoten[aktuellesLayout.zentrum].classList.add('ist-aktiv');
      }
    }

    function markieren(id) {
      Object.keys(elemente.knoten).forEach(function (k) { elemente.knoten[k].classList.toggle('ist-gewaehlt', k === id); });
    }

    function knotenPosition(id) {
      var el = elemente.knoten[id];
      if (!el) { return null; }
      var r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }

    return {
      svg: svg,
      zeigen: zeigen,
      einpassen: einpassen,
      zoomen: zoomen,
      hervorheben: hervorheben,
      markieren: markieren,
      knotenPosition: knotenPosition
    };
  }

  HT.graphZeichnen = {
    erstellen: erstellen,
    layoutSpalten: layoutSpalten,
    messen: messen,
    /* Einzelne Knoten für Ansichten mit eigener Anordnung (Beziehungsbild des
       Überblicks) — so sehen Knoten überall gleich aus. */
    schriftLesen: schriftLesen,
    knotenBreite: knotenBreite,
    knotenElement: knotenElement,
    KNOTEN_HOEHE: KNOTEN_HOEHE,
    TYP_SYMBOL: TYP_SYMBOL
  };
}(window));
