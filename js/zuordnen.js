/* meinHERMES — Trainer, Teil «Zuordnen»: Rollen, Aufgaben und Ergebnisse in
   den Graph der Methode legen.

   Jede Übung ist ein Ausschnitt aus dem Graphen des Überblicks in der
   klassischen Vorgehensweise, nach Phasen gegliedert: eine Phase (eine Bahn,
   darin die Module als Unterbahnen), ein Modul (die Phasen als Bahnen, darin
   nur dieses Modul) oder das Gesamtbild. Auswahl, Reihenfolge, Layout und
   Knotenformen kommen aus js/graph-modell.js und js/graph-zeichnen.js — die
   Übung zeigt dasselbe Bild wie der Graph, nur mit leeren Kästen, und die
   Elemente im Pool sehen aus wie seine Knoten.

   Welche Elementarten leer sind, wählen drei Schalter (Rollen, Aufgaben,
   Ergebnisse); die übrigen stehen ausgefüllt als Anhaltspunkte im Bild. Die
   Verbindungen «Rolle ist verantwortlich für die Aufgabe» und «Aufgabe
   erzeugt Ergebnis» bleiben immer sichtbar — sie sind der Schlüssel, um
   einen leeren Kasten zu bestimmen. «Beteiligt» fehlt absichtlich: im
   Konzept wären das 83 Linien und vier Rollen mehr.

   Richtig ist ein Kasten, wenn das gelegte Element dort nicht vom gesuchten
   zu unterscheiden ist: gleiche Art, gleiche Phase und gleiches Modul (Rollen
   haben beides nicht) und dieselben Verbindungen zu denselben Kästen. Zwei
   Ergebnisse, die dieselbe Aufgabe im selben Modul erzeugt, sind so
   vertauschbar — ihre Reihenfolge im Bild ist kein Prüfungsstoff.

   Adressen: #/trainer?phase=<Phase>, #/trainer?modul=<Modul>,
   #/trainer?alles=1 — je eine eigene Seite in voller Breite. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.trainerTeile = HT.trainerTeile || {};

  var h = HT.ui.h;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SPEICHER = 'trainer';
  var VERSION = 2;          // 1: Ausschnitte der Abbildung 1 (bis 2026-09-14) — andere Kästen, Quoten nicht vergleichbar
  var VORGEHEN = 'klassisch';
  var RELATIONEN = { verantwortlich: true, beteiligt: false, erzeugt: true, ergebnisrolle: false };
  var ARTEN = ['rolle', 'aufgabe', 'ergebnis'];
  var ZIEL_ZUSTAENDE = ['tr-ziel--offen', 'tr-ziel--bereit', 'tr-ziel--belegt', 'tr-ziel--richtig', 'tr-ziel--falsch', 'tr-ziel--leer'];

  var SPALTEN_ABSTAND = 80; // enger als im Graph (104): das Bild soll in die Bühne passen
  var RAND = 20;            // Luft um das Bild (Layout-Einheiten)
  var RAHMEN = 3;           // Abstand des Rahmens (Zeiger, Prüfung) um einen Kasten
  var ZOOM_MIN = 0.4;
  var ZOOM_MAX = 2;
  var ZOOM_SCHRITT = 1.2;
  var SCHMAL = 900;         // unterhalb: Bühne über dem Pool (siehe css/trainer.css)
  var LESBAR = 0.7;         // kleinster Grundmassstab auf schmalen Schirmen
  var POOL_MASS = 0.8;      // Knoten im Pool gegenüber dem Knoten im Bild
  var SUCHE_AB = 12;        // ab so vielen Elementen bekommt der Pool ein Suchfeld
  var ROLLZONE = 48;        // Randzone der Bühne, in der ein Zug sie mitrollt (px)

  var zustand = { beste: {}, leer: { rolle: true, aufgabe: true, ergebnis: true }, initialisiert: false };
  var refs = {};
  var uebung = null;        // laufende Übung, siehe uebungStarten()
  var zoom = 1;
  var liste = null;         // die Übungen, einmal je Sitzung
  var vorbereitung = null;  // Versprechen: Schrift geladen, Reihenfolge der Abbildung 1 gesetzt

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] !== null && attrs[k] !== undefined) {
        el.setAttribute(k, String(attrs[k]));
      }
    }
    return el;
  }

  function rund(n) { return Math.round(n * 10) / 10; }

  /* «Rolle», «Aufgabe», «Ergebnis» — Meilensteine heissen wie im Graph. */
  function artName(e) {
    return e.eintrag && e.eintrag.typ === 'Meilenstein' ? 'Meilenstein' : HT.graph.KAT[e.kategorie].singular;
  }

  /* --- Gespeichert: beste Quote je Übung und leere Arten, welche Arten leer sind */

  function speichern() {
    HT.store.schreib(SPEICHER, { version: VERSION, beste: zustand.beste, leer: zustand.leer });
  }

  function wiederherstellen() {
    var g = HT.store.lies(SPEICHER, null);
    if (!g || typeof g !== 'object' || g.version !== VERSION) { return; }
    if (g.beste && typeof g.beste === 'object') { zustand.beste = g.beste; }
    if (g.leer && typeof g.leer === 'object') {
      var leer = {};
      ARTEN.forEach(function (art) { leer[art] = g.leer[art] !== false; });
      if (ARTEN.some(function (art) { return leer[art]; })) { zustand.leer = leer; }
    }
  }

  function leereArten() {
    return ARTEN.filter(function (art) { return zustand.leer[art]; });
  }

  /* Die beste Runde gilt je Übung und Auswahl der leeren Arten («phase:Konzept|rae»). */
  function bestSchluessel(def) {
    return def.id + '|' + leereArten().map(function (art) { return art.charAt(0); }).join('');
  }

  /* --- Übungen -------------------------------------------------------------- */

  function teilgraphVon(def) {
    return HT.graph.teilgraph({
      umfang: def.umfang,
      kategorien: { rolle: true, aufgabe: true, ergebnis: true },
      relationen: RELATIONEN,
      gruppierung: 'phase'
    });
  }

  function uebungen() {
    if (liste) { return liste; }
    liste = [];
    HT.graph.phasenDerVorgehensweise(VORGEHEN).forEach(function (name) {
      liste.push({
        id: 'phase:' + name, art: 'phase', name: name, titel: 'Phase ' + name,
        eintrag: HT.daten.eintragMitBegriff(name, 'phase'),
        adresse: '#/trainer?phase=' + encodeURIComponent(name),
        umfang: { vorgehen: VORGEHEN, phasen: [name], module: [] }
      });
    });
    HT.daten.eintraegeDerKategorie('modul').forEach(function (m) {
      liste.push({
        id: 'modul:' + m.begriff, art: 'modul', name: m.begriff, titel: 'Modul ' + m.begriff,
        eintrag: m,
        adresse: '#/trainer?modul=' + encodeURIComponent(m.begriff),
        umfang: { vorgehen: VORGEHEN, phasen: [], module: [m.begriff] }
      });
    });
    liste.push({
      id: 'alles', art: 'alles', name: 'Gesamtbild', titel: 'Gesamtbild', eintrag: null,
      adresse: '#/trainer?alles=1',
      umfang: { vorgehen: VORGEHEN, phasen: [], module: [] }
    });
    liste.forEach(function (def) { def.zahlen = teilgraphVon(def).gezeigt; });
    liste = liste.filter(function (def) { return def.zahlen.aufgabe + def.zahlen.ergebnis > 0; });
    return liste;
  }

  function leereAnzahl(def) {
    return leereArten().reduce(function (summe, art) { return summe + def.zahlen[art]; }, 0);
  }

  function istUebung(params) {
    return !!(params && (params.phase || params.modul || params.alles));
  }

  function uebungFinden(params) {
    var n = HT.daten.normalisieren;
    var treffer = uebungen().filter(function (u) {
      if (params.alles) { return u.art === 'alles'; }
      if (params.phase) { return u.art === 'phase' && n(u.name) === n(params.phase); }
      return u.art === 'modul' && n(u.name) === n(params.modul);
    });
    return treffer[0] || null;
  }

  /* Vor dem ersten Bild: die Schrift muss geladen sein, sonst misst der Graph
     die Knotenbreiten mit der Ersatzschrift; und die Reihenfolge der Aufgaben
     und Ergebnisse kommt wie im Graph aus der Abbildung 1. Fehlt die Grafik,
     gilt die Ordnung nach Phase und Name — geübt wird trotzdem. */
  function vorbereiten() {
    if (vorbereitung) { return vorbereitung; }
    var schrift = document.fonts && document.fonts.ready
      ? global.Promise.race([
          document.fonts.ready.catch(function () {}),
          new global.Promise(function (fertig) { global.setTimeout(fertig, 2000); })
        ])
      : global.Promise.resolve();
    var reihenfolge = HT.abbildung
      ? HT.abbildung.holen().then(function (text) {
          HT.graph.abbildungLagenSetzen(HT.abbildung.lagen(HT.abbildung.kaesten(HT.abbildung.lesen(text))));
        }).catch(function () {})
      : global.Promise.resolve();
    vorbereitung = global.Promise.all([schrift, reihenfolge]).then(function () {
      HT.graphZeichnen.schriftLesen(document.body);
    });
    return vorbereitung;
  }

  /* --- Übung: Zustand ------------------------------------------------------ */

  /* uebung = { def, layout, ziele: [{ n, sig, chip, status, gruppe, inhalt, rahmen, titel }],
                gegeben: [Knoten], chips: [{ id, kategorie, begriff, eintrag, entscheid, w, sig, ziel, el }],
                nachbarn: { id: { knoten, kanten } }, knotenEl, kantenEl,
                gewaehlt: Chip | null, geprueft: false | { richtig, gesamt }, suche, hover }
     vorher: { Knoten-Id des Kastens: Id des gelegten Elements } — beim Umschalten
     der leeren Arten bleibt liegen, was noch einen Kasten hat. */
  function uebungStarten(def, vorher) {
    var tg = teilgraphVon(def);
    var layout = HT.graphZeichnen.layoutSpalten(tg, { gleicheBreite: true, spaltenAbstand: SPALTEN_ABSTAND });

    /* Feld je Element: Bahn (Phase) und Unterbahn (Modul); Rollen haben keins. */
    var feld = {};
    tg.spalten.forEach(function (sp) {
      sp.knoten.forEach(function (k) {
        feld[k.id] = sp.gruppeVon
          ? (sp.gruppeVon[k.id] || '') + '/' + (sp.untergruppeVon ? sp.untergruppeVon[k.id] || '' : '')
          : '';
      });
    });

    /* Signatur je Kasten: Art, Feld und die Verbindungen zu den Kästen daneben
       (über deren Platz im Bild, nicht über ihren Inhalt). */
    var platz = {}, nachbarn = {}, verbindungen = {};
    layout.knoten.forEach(function (n, i) {
      platz[n.id] = i;
      nachbarn[n.id] = { knoten: {}, kanten: {} };
      verbindungen[n.id] = [];
    });
    layout.kanten.forEach(function (ka) {
      verbindungen[ka.von].push(ka.rel + '>' + platz[ka.nach]);
      verbindungen[ka.nach].push(ka.rel + '<' + platz[ka.von]);
      nachbarn[ka.von].knoten[ka.nach] = true;
      nachbarn[ka.nach].knoten[ka.von] = true;
      nachbarn[ka.von].kanten[ka.id] = true;
      nachbarn[ka.nach].kanten[ka.id] = true;
    });
    var sig = {};
    layout.knoten.forEach(function (n) {
      sig[n.id] = n.kategorie + '|' + (feld[n.id] || '') + '|' + verbindungen[n.id].sort().join(',');
    });

    var ziele = [], gegeben = [], chips = [];
    layout.knoten.forEach(function (n) {
      if (!zustand.leer[n.kategorie]) { gegeben.push(n); return; }
      ziele.push({ n: n, sig: sig[n.id], chip: null, status: '' });
      chips.push({
        id: n.id, kategorie: n.kategorie, begriff: n.begriff, eintrag: n.eintrag, entscheid: n.entscheid,
        w: HT.graphZeichnen.knotenBreite(n), sig: sig[n.id], ziel: null, el: null
      });
    });
    chips.sort(function (a, b) {
      return (ARTEN.indexOf(a.kategorie) - ARTEN.indexOf(b.kategorie)) || a.begriff.localeCompare(b.begriff, 'de');
    });

    if (vorher) {
      var chipVon = {};
      chips.forEach(function (c) { chipVon[c.id] = c; });
      ziele.forEach(function (z) {
        var c = vorher[z.n.id] ? chipVon[vorher[z.n.id]] : null;
        if (c && !c.ziel) { z.chip = c; c.ziel = z; }
      });
    }

    uebung = {
      def: def, layout: layout, ziele: ziele, gegeben: gegeben, chips: chips, nachbarn: nachbarn,
      knotenEl: {}, kantenEl: {}, gewaehlt: null, geprueft: false, suche: '', hover: null
    };
  }

  function belegung() {
    var b = {};
    if (uebung && !uebung.geprueft) {
      uebung.ziele.forEach(function (z) { if (z.chip) { b[z.n.id] = z.chip.id; } });
    }
    return b;
  }

  function chipsImPool() {
    return uebung.chips.filter(function (c) { return !c.ziel; });
  }

  /* Suche im Pool: Umlaute und Diakritika tolerant («losung» trifft «Lösung»). */
  function suchform(text) {
    var t = HT.daten.normalisieren(text).replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
    try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (x) { /* ältere Browser */ }
    return t;
  }

  function trifft(chip, suche) {
    return !suche || suchform(chip.begriff).indexOf(suche) !== -1;
  }

  /* Ein Element passt nur in einen Kasten seiner Art. Liegt im Zielkasten
     schon eines, tauschen die beiden — kommt das neue aus dem Pool, geht das
     alte dorthin zurück. */
  function setzen(chip, ziel) {
    if (uebung.geprueft || chip.kategorie !== ziel.n.kategorie) { return; }
    if (ziel.chip !== chip) {
      var herkunft = chip.ziel;
      var verdraengt = ziel.chip;
      if (herkunft) { herkunft.chip = null; }
      if (verdraengt) {
        verdraengt.ziel = herkunft || null;
        if (herkunft) { herkunft.chip = verdraengt; }
      }
      ziel.chip = chip;
      chip.ziel = ziel;
    }
    uebung.gewaehlt = null;
    zeichnen();
  }

  function loesen(ziel) {
    if (uebung.geprueft || !ziel.chip) { return; }
    ziel.chip.ziel = null;
    ziel.chip = null;
    zeichnen();
  }

  function zielGeklickt(ziel) {
    if (uebung.geprueft) { return; }
    if (uebung.gewaehlt) {
      if (uebung.gewaehlt.kategorie === ziel.n.kategorie) { setzen(uebung.gewaehlt, ziel); }
    } else if (ziel.chip) {
      loesen(ziel);
    }
  }

  function chipGeklickt(chip) {
    if (uebung.geprueft) { return; }
    uebung.gewaehlt = uebung.gewaehlt === chip ? null : chip;
    zeichnen();
  }

  function pruefen() {
    var richtig = 0;
    uebung.ziele.forEach(function (z) {
      z.status = !z.chip ? 'leer' : (z.chip.sig === z.sig ? 'richtig' : 'falsch');
      if (z.status === 'richtig') { richtig++; }
    });
    uebung.geprueft = { richtig: richtig, gesamt: uebung.ziele.length };
    uebung.gewaehlt = null;

    var schluessel = bestSchluessel(uebung.def);
    var alt = zustand.beste[schluessel];
    if (!alt || richtig > alt.richtig || (richtig === alt.richtig && uebung.ziele.length !== alt.gesamt)) {
      zustand.beste[schluessel] = { richtig: richtig, gesamt: uebung.ziele.length, wann: new Date().toISOString().slice(0, 10) };
      speichern();
    }
    zeichnen();
    besteZeigen();
    if (refs.ergebnis) {
      try { refs.ergebnis.focus({ preventScroll: true }); } catch (x) { refs.ergebnis.focus(); }
    }
  }

  /* Zurück auf Anfang — an den bestehenden Objekten, denn die Ziele tragen
     die Verweise auf ihre SVG-Elemente. */
  function zuruecksetzen() {
    uebung.ziele.forEach(function (z) { z.chip = null; z.status = ''; });
    uebung.chips.forEach(function (c) { c.ziel = null; c.el = null; c.gezogen = false; });
    uebung.gewaehlt = null;
    uebung.geprueft = false;
    uebung.suche = '';
    if (refs.suche && refs.suche.feld) { refs.suche.feld.value = ''; }
    zeichnen();
  }

  /* --- Bild ----------------------------------------------------------------- */

  /* Ein Knoten wie im Graph — für das Bild, den Pool und den Geist beim
     Ziehen. Nicht fokussierbar: die Tastatur bedient den Kasten bzw. den
     Knopf darum. Ohne Namen ist es die Form eines leeren Kastens. */
  function knotenBild(e, w, x, y) {
    var g = HT.graphZeichnen.knotenElement({
      id: e.id || '', kategorie: e.kategorie, begriff: e.begriff || '', eintrag: e.eintrag || null,
      entscheid: !!e.entscheid, w: w, h: HT.graphZeichnen.KNOTEN_HOEHE, x: x || 0, y: y || 0
    });
    g.removeAttribute('tabindex');
    g.removeAttribute('role');
    g.removeAttribute('data-id');
    return g;
  }

  /* Ein Knoten als eigenes kleines SVG (Pool, Geist), mit Luft für die Kontur. */
  function knotenSvg(chip, mass) {
    var kh = HT.graphZeichnen.KNOTEN_HOEHE, luft = 3;
    var svg = svgEl('svg', {
      'class': 'tr-knotenbild',
      width: rund((chip.w + 2 * luft) * mass), height: rund((kh + 2 * luft) * mass),
      viewBox: [-luft, -luft, chip.w + 2 * luft, kh + 2 * luft].join(' '),
      'aria-hidden': 'true', focusable: 'false'
    });
    var g = knotenBild(chip, chip.w);
    g.removeAttribute('aria-label');
    svg.appendChild(g);
    return svg;
  }

  /* Umriss des Layouts: Bänder, Knoten, Linien und Texte (deren Breite
     geschätzt — Versalien mit Sperrung). */
  function umriss(layout) {
    var x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    function nimm(ax, ay, bx, by) {
      x0 = Math.min(x0, ax); y0 = Math.min(y0, ay);
      x1 = Math.max(x1, bx); y1 = Math.max(y1, by);
    }
    layout.baender.forEach(function (b) { nimm(b.x, b.y, b.x + b.w, b.y + b.h); });
    layout.knoten.forEach(function (n) { nimm(n.x, n.y, n.x + n.w, n.y + n.h); });
    layout.linien.forEach(function (l) { nimm(l.x1, l.y1, l.x2, l.y2); });
    layout.texte.forEach(function (t) {
      var gross = t.klasse.indexOf('gtext--spalte') !== -1 ? 16 : 14;
      var breite = HT.graphZeichnen.messen(String(t.text).toUpperCase(), 'normal') * gross / 14 * 1.1;
      nimm(t.x, t.y - gross, t.x + breite, t.y + gross);
    });
    return { x: x0 - RAND, y: y0 - RAND, w: x1 - x0 + 2 * RAND, h: y1 - y0 + 2 * RAND };
  }

  function bildBauen() {
    var layout = uebung.layout;
    var u = umriss(layout);
    var svg = svgEl('svg', {
      'class': 'tr-graph', viewBox: [rund(u.x), rund(u.y), rund(u.w), rund(u.h)].join(' '),
      role: 'group', 'aria-label': uebung.def.titel + ' — Rollen, Aufgaben und Ergebnisse zum Zuordnen',
      'data-breite': rund(u.w)
    });

    var defs = svgEl('defs', {});
    var pfeil = svgEl('marker', { id: 'tr-pfeil', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
    pfeil.appendChild(svgEl('path', { d: 'M0 0L10 5L0 10Z', 'class': 'gpfeil' }));
    defs.appendChild(pfeil);
    svg.appendChild(defs);

    var bahnen = svgEl('g', { 'class': 'tr-bahnen' });
    layout.baender.forEach(function (b) {
      bahnen.appendChild(svgEl('rect', {
        'class': 'gbahn' + (b.gerade ? '' : ' gbahn--ungerade'),
        x: rund(b.x), y: rund(b.y), width: rund(b.w), height: rund(b.h)
      }));
    });
    svg.appendChild(bahnen);

    var kanten = svgEl('g', { 'class': 'tr-kanten' });
    layout.kanten.forEach(function (ka) {
      var el = svgEl('path', {
        'class': 'gkante gkante--' + HT.graph.REL[ka.rel].stil + (ka.weit ? ' gkante--weit' : ''),
        d: ka.pfad,
        'marker-end': ka.rel === 'erzeugt' ? 'url(#tr-pfeil)' : null
      });
      uebung.kantenEl[ka.id] = el;
      kanten.appendChild(el);
    });
    svg.appendChild(kanten);

    var texte = svgEl('g', { 'class': 'tr-texte' });
    layout.linien.forEach(function (l) {
      texte.appendChild(svgEl('line', {
        'class': 'ggruppenlinie' + (l.klasse ? ' ' + l.klasse : ''),
        x1: rund(l.x1), y1: rund(l.y1), x2: rund(l.x2), y2: rund(l.y2)
      }));
    });
    layout.texte.forEach(function (t) {
      var el = svgEl('text', { 'class': t.klasse, x: rund(t.x), y: rund(t.y), 'text-anchor': t.anker || 'start' });
      el.textContent = t.text;
      texte.appendChild(el);
    });
    svg.appendChild(texte);

    var knoten = svgEl('g', { 'class': 'tr-knoten' });
    uebung.gegeben.forEach(function (n) {
      var g = knotenBild(n, n.w, n.x, n.y);
      g.classList.add('tr-gegeben');
      g.setAttribute('data-knoten', n.id);
      g.setAttribute('role', 'img');
      uebung.knotenEl[n.id] = g;
      knoten.appendChild(g);
    });
    uebung.ziele.forEach(function (z, i) {
      var n = z.n;
      var g = svgEl('g', {
        'class': 'tr-ziel tr-ziel--' + n.kategorie, 'data-ziel': i, 'data-knoten': n.id,
        tabindex: '0', role: 'button', transform: 'translate(' + rund(n.x) + ',' + rund(n.y) + ')'
      });
      z.inhalt = svgEl('g', { 'class': 'tr-ziel__inhalt' });
      /* Rahmen und Trefferfläche zugleich: etwas grösser als der Knoten, damit
         die Kontur des Knotens darunter sichtbar bleibt. */
      z.rahmen = svgEl('rect', {
        'class': 'tr-ziel__rahmen', x: -RAHMEN, y: -RAHMEN,
        width: rund(n.w + 2 * RAHMEN), height: n.h + 2 * RAHMEN,
        rx: n.kategorie === 'rolle' ? n.h / 2 + RAHMEN : 6 + RAHMEN,
        fill: '#ffffff', 'fill-opacity': '0'
      });
      z.titel = svgEl('title', {});
      g.appendChild(z.inhalt);
      g.appendChild(z.rahmen);
      g.appendChild(z.titel);
      z.gruppe = g;
      uebung.knotenEl[n.id] = g;

      g.addEventListener('click', function () { if (z.gezogen) { z.gezogen = false; return; } zielGeklickt(z); });
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') { ev.preventDefault(); zielGeklickt(z); }
      });
      zielZiehbar(z, g);
      knoten.appendChild(g);
    });
    svg.appendChild(knoten);

    /* Überfahren oder Fokus: Kasten samt Nachbarn und Verbindungen hervorheben. */
    function knotenAus(ev) {
      var g = ev.target && ev.target.closest ? ev.target.closest('[data-knoten]') : null;
      return g ? g.getAttribute('data-knoten') : null;
    }
    svg.addEventListener('pointerover', function (ev) { hervorheben(knotenAus(ev)); });
    svg.addEventListener('pointerleave', function () { hervorheben(null); });
    svg.addEventListener('focusin', function (ev) { hervorheben(knotenAus(ev)); });
    svg.addEventListener('focusout', function () { hervorheben(null); });
    return svg;
  }

  function hervorheben(id) {
    if (!uebung || !refs.bild || id === uebung.hover) { return; }
    uebung.hover = id;
    var nb = id ? uebung.nachbarn[id] : null;
    refs.bild.classList.toggle('ist-hervorhebung', !!nb);
    Object.keys(uebung.knotenEl).forEach(function (k) {
      uebung.knotenEl[k].classList.toggle('ist-aktiv', !!nb && (k === id || !!nb.knoten[k]));
    });
    Object.keys(uebung.kantenEl).forEach(function (k) {
      uebung.kantenEl[k].classList.toggle('ist-aktiv', !!nb && !!nb.kanten[k]);
    });
  }

  /* --- Zoom ---------------------------------------------------------------- */

  /* Passend in die Breite der Bühne, nie grösser als im Graph; in der Höhe
     rollt die Bühne — eine Phase ist höher als ein Bildschirm. */
  function grundmass() {
    if (!refs.buehne || !refs.bild) { return 1; }
    var b = Number(refs.bild.getAttribute('data-breite')) || 1;
    var passend = Math.min(1, (refs.buehne.clientWidth - 28) / b);
    /* Auf dem Telefon wäre «passend» unlesbar klein; dort rollt die Bühne auch seitlich. */
    if (global.innerWidth < SCHMAL) { passend = Math.max(passend, LESBAR); }
    return Math.max(0.1, passend);
  }

  function bildMass() {
    return grundmass() * zoom;
  }

  function zoomAnwenden() {
    if (!refs.bild) { return; }
    var b = Number(refs.bild.getAttribute('data-breite')) || 1;
    refs.bild.style.width = Math.round(b * bildMass()) + 'px';
    if (refs.zoomWert) { refs.zoomWert.textContent = Math.round(zoom * 100) + ' %'; }
  }

  function zoomSetzen(wert) {
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, wert));
    zoomAnwenden();
  }

  function zoomSkalieren(faktor) {
    var alt = zoom;
    zoomSetzen(alt * faktor);
    return zoom / alt;
  }

  /* --- Übung: zeichnen ----------------------------------------------------- */

  function zeichnen() {
    if (!uebung || !refs.pool) { return; }
    var gepr = uebung.geprueft;
    var gewaehlt = gepr ? null : uebung.gewaehlt;

    /* Kästen */
    uebung.ziele.forEach(function (z) {
      if (!z.gruppe) { return; }
      z.gezogen = false;
      var art = HT.graph.KAT[z.n.kategorie].singular;
      var passend = !!gewaehlt && gewaehlt.kategorie === z.n.kategorie;
      var klassen, zeigen, beschreibung;
      if (gepr) {
        klassen = ['tr-ziel--' + z.status];
        zeigen = z.status === 'richtig' ? z.chip : z.n;
        beschreibung = z.status === 'richtig' ? 'Richtig: ' + z.chip.begriff
          : z.status === 'falsch' ? 'Falsch — hier gehört ' + z.n.begriff + ' hin, gelegt war ' + z.chip.begriff
          : 'Offen — hier gehört ' + z.n.begriff + ' hin';
      } else if (z.chip) {
        klassen = ['tr-ziel--belegt'];
        zeigen = z.chip;
        beschreibung = artName(z.chip) + ' ' + z.chip.begriff + ' — Klick oder Enter legt es zurück, Ziehen verschiebt es';
      } else {
        klassen = passend ? ['tr-ziel--offen', 'tr-ziel--bereit'] : ['tr-ziel--offen'];
        zeigen = { kategorie: z.n.kategorie };
        beschreibung = 'Leerer Kasten (' + art + ')' + (passend ? ' — Klick oder Enter legt ' + gewaehlt.begriff + ' hierher' : '');
      }
      ZIEL_ZUSTAENDE.forEach(function (k) { z.gruppe.classList.remove(k); });
      klassen.forEach(function (k) { z.gruppe.classList.add(k); });
      HT.ui.leeren(z.inhalt);
      var bild = knotenBild(zeigen, z.n.w);
      bild.removeAttribute('aria-label');
      z.inhalt.appendChild(bild);
      z.titel.textContent = beschreibung;
      z.gruppe.setAttribute('aria-label', beschreibung);
    });
    if (refs.bild) {
      refs.bild.classList.toggle('ist-bereit', !!gewaehlt);
      refs.bild.classList.toggle('ist-geprueft', !!gepr);
    }

    /* Pool, nach Art gruppiert */
    HT.ui.leeren(refs.pool);
    var alleOffen = chipsImPool();
    var suche = suchform(uebung.suche);
    var offen = alleOffen.filter(function (c) { return trifft(c, suche); });
    if (!alleOffen.length) {
      refs.pool.appendChild(h('p', { class: 'tr-pool__leer', text: gepr ? 'Alle Elemente lagen im Bild.' : 'Alle Elemente liegen im Bild — jetzt prüfen.' }));
    } else if (!offen.length) {
      refs.pool.appendChild(h('p', { class: 'tr-pool__leer', text: 'Kein Element passt zu «' + uebung.suche.trim() + '».' }));
    }
    if (refs.suche) {
      refs.suche.hidden = alleOffen.length < SUCHE_AB && !uebung.suche;
      refs.sucheStand.textContent = suche ? offen.length + ' von ' + alleOffen.length + ' Elementen' : alleOffen.length + ' Elemente';
    }
    ARTEN.forEach(function (art) {
      var inArt = offen.filter(function (c) { return c.kategorie === art; });
      if (!inArt.length) { return; }
      var gesamt = alleOffen.filter(function (c) { return c.kategorie === art; }).length;
      var label = HT.graph.KAT[art].label;
      refs.pool.appendChild(h('h3', { class: 'tr-mikro tr-pool__titel', text: label + ' · ' + (suche ? inArt.length + ' von ' + gesamt : gesamt) }));
      refs.pool.appendChild(h('div', { class: 'tr-pool__gruppe', role: 'group', 'aria-label': label }, inArt.map(function (c) {
        var el = h('button', {
          type: 'button',
          class: 'tr-chip' + (gewaehlt === c ? ' ist-gewaehlt' : ''),
          'aria-label': artName(c) + ' ' + c.begriff,
          'aria-pressed': gewaehlt === c ? 'true' : 'false',
          disabled: gepr ? 'disabled' : null
        }, knotenSvg(c, POOL_MASS));
        c.el = el;
        c.gezogen = false;
        el.addEventListener('click', function () { if (!c.gezogen) { chipGeklickt(c); } c.gezogen = false; });
        chipZiehbar(c, el);
        return el;
      })));
    });

    /* Zähler und Knöpfe */
    var gelegt = uebung.ziele.filter(function (z) { return z.chip; }).length;
    refs.zaehler.textContent = gelegt + ' von ' + uebung.ziele.length + ' zugeordnet';
    refs.knopfPruefen.hidden = !!gepr;
    refs.knopfPruefen.disabled = gelegt === 0;
    refs.knopfReset.hidden = !!gepr;
    refs.knopfNochmals.hidden = !gepr;

    /* Auswertung */
    HT.ui.leeren(refs.ergebnis);
    refs.ergebnis.hidden = !gepr;
    if (gepr) { refs.ergebnis.appendChild(auswertung()); }

    refs.hinweis.hidden = !!gepr;
    hervorhebungErneuern();
  }

  /* Nach dem Neuzeichnen trägt die Hervorhebung noch die Klassen von vorher —
     einmal neu setzen, falls der Zeiger noch über einem Kasten steht. */
  function hervorhebungErneuern() {
    if (!uebung || !uebung.hover) { return; }
    var id = uebung.hover;
    uebung.hover = null;
    hervorheben(id);
  }

  function elementLink(e) {
    return h('a', { href: '#/handbuch?id=' + encodeURIComponent(e.id), text: e.begriff });
  }

  function auswertung() {
    var g = uebung.geprueft;
    var falsch = uebung.ziele.filter(function (z) { return z.status === 'falsch'; });
    var leer = uebung.ziele.filter(function (z) { return z.status === 'leer'; });
    var beste = zustand.beste[bestSchluessel(uebung.def)];
    var quote = Math.round(100 * g.richtig / g.gesamt);

    var kinder = [
      h('p', { class: 'tr-ergebnis__zahl' }, [
        h('b', { text: g.richtig + ' von ' + g.gesamt }),
        ' richtig · ' + quote + ' %'
        + (beste && beste.richtig > g.richtig ? ' · beste Runde ' + beste.richtig + '/' + beste.gesamt : '')
        + (g.richtig === g.gesamt ? ' · alles richtig' : '')
      ])
    ];
    if (falsch.length) {
      kinder.push(h('h3', { class: 'tr-mikro', text: 'Falsch gelegt' }));
      kinder.push(h('ul', { class: 'tr-liste' }, falsch.map(function (z) {
        return h('li', {}, [
          h('span', { class: 'tr-liste__falsch', text: z.chip.begriff }),
          ' — hier gehört ', elementLink(z.n), ' hin'
        ]);
      })));
    }
    if (leer.length) {
      kinder.push(h('h3', { class: 'tr-mikro', text: 'Offen geblieben' }));
      kinder.push(h('ul', { class: 'tr-liste' }, leer.map(function (z) { return h('li', {}, elementLink(z.n)); })));
    }
    return h('div', {}, kinder);
  }

  /* --- Ziehen mit Maus oder Stift ----------------------------------------- */

  /* Ziehen mit der Maus — vom Element im Pool oder aus einem belegten Kasten.
     Der Geist folgt dem Zeiger; ein Kasten derselben Art darunter leuchtet
     auf, am oberen und unteren Rand rollt die Bühne mit. Loslassen auf einem
     Kasten legt das Element dorthin (ein belegter tauscht), Loslassen
     irgendwo sonst legt ein aus dem Kasten gezogenes Element in den Pool
     zurück. Ein Zug unter 6 px bleibt ein Klick. Auf Touch-Geräten bleibt es
     beim Antippen (Element, dann Kasten) — ein Ziehen stritte dort mit dem
     Scrollen. */
  function ziehen(ev, chip, quelle) {
    var start = { x: ev.clientX, y: ev.clientY };
    var griff = { x: ev.clientX - quelle.mass.left, y: ev.clientY - quelle.mass.top };
    var geist = null;
    var drueber = null;
    var zeiger = null;
    var lauf = null;

    function zielUnter(x, y) {
      var unter = document.elementFromPoint(x, y);
      var g = unter && unter.closest ? unter.closest('[data-ziel]') : null;
      var z = g ? uebung.ziele[Number(g.getAttribute('data-ziel'))] : null;
      return z && z.n.kategorie === chip.kategorie ? z : null;
    }

    function drueberSetzen(z) {
      if (z === drueber) { return; }
      if (drueber && drueber.gruppe) { drueber.gruppe.classList.remove('ist-drueber'); }
      drueber = z;
      if (drueber && drueber.gruppe) { drueber.gruppe.classList.add('ist-drueber'); }
    }

    /* Hohe Übungen passen nicht auf den Schirm: in der Randzone oben und
       unten rollt die Bühne, je näher am Rand, desto schneller. */
    function rollen() {
      lauf = null;
      if (!geist || !zeiger || !refs.buehne) { return; }
      var r = refs.buehne.getBoundingClientRect();
      if (zeiger.x < r.left || zeiger.x > r.right) { return; }
      var d = 0;
      if (zeiger.y < r.top + ROLLZONE) { d = zeiger.y - (r.top + ROLLZONE); }
      else if (zeiger.y > r.bottom - ROLLZONE) { d = zeiger.y - (r.bottom - ROLLZONE); }
      if (!d) { return; }
      var vorher = refs.buehne.scrollTop;
      refs.buehne.scrollTop += (d < 0 ? -1 : 1) * Math.max(1, Math.min(24, Math.round(Math.abs(d) / 3)));
      if (refs.buehne.scrollTop === vorher) { return; }
      drueberSetzen(zielUnter(zeiger.x, zeiger.y));
      lauf = global.requestAnimationFrame(rollen);
    }

    /* Die Bewegung hört das Dokument, nicht das Element: ein Zug verlässt es
       sofort, und Pointer Capture kommt nicht überall zuverlässig an. */
    function bewegen(e) {
      if (!geist) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) { return; }
        geist = h('div', { class: 'tr-geist' }, knotenSvg(chip, quelle.ziel ? bildMass() : POOL_MASS));
        document.body.appendChild(geist);
        quelle.el.classList.add('ist-am-ziehen');
        document.body.classList.add('tr-zieht');
        if (refs.bild) { refs.bild.setAttribute('data-zieht', chip.kategorie); }
      }
      zeiger = { x: e.clientX, y: e.clientY };
      geist.style.left = (e.clientX - griff.x) + 'px';
      geist.style.top = (e.clientY - griff.y) + 'px';
      drueberSetzen(zielUnter(e.clientX, e.clientY));
      if (!lauf) { lauf = global.requestAnimationFrame(rollen); }
      e.preventDefault();
    }

    function ende(e) {
      document.removeEventListener('pointermove', bewegen);
      document.removeEventListener('pointerup', ende);
      document.removeEventListener('pointercancel', ende);
      global.removeEventListener('blur', ende);
      if (lauf) { global.cancelAnimationFrame(lauf); lauf = null; }
      var punkt = e && typeof e.clientX === 'number' ? e : null;
      /* Ohne Zwischenbewegung (sehr schneller Zug) zählt der Weg bis zum
         Loslassen; ein Klick an Ort und Stelle bleibt ein Klick. */
      var weit = punkt ? Math.hypot(punkt.clientX - start.x, punkt.clientY - start.y) >= 6 : false;
      if (geist) { geist.parentNode.removeChild(geist); }
      quelle.el.classList.remove('ist-am-ziehen');
      document.body.classList.remove('tr-zieht');
      if (refs.bild) { refs.bild.removeAttribute('data-zieht'); }
      drueberSetzen(null);
      if (!geist && !weit) { return; }
      /* Der Klick, der dem Loslassen folgt, darf nichts mehr auslösen. Die
         Sperre fällt beim nächsten Aufbau (zeichnen) bzw. beim Klick. */
      quelle.gezogen();
      var z = punkt && e.type === 'pointerup' ? zielUnter(punkt.clientX, punkt.clientY) : null;
      if (z) { setzen(chip, z); }
      else if (quelle.ziel && e && e.type === 'pointerup') { loesen(quelle.ziel); }
    }

    document.addEventListener('pointermove', bewegen);
    document.addEventListener('pointerup', ende);
    document.addEventListener('pointercancel', ende);
    global.addEventListener('blur', ende);
  }

  function chipZiehbar(chip, el) {
    el.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || ev.pointerType === 'touch' || uebung.geprueft) { return; }
      /* Griffpunkt im Element: der Geist erscheint an derselben Stelle unter
         dem Zeiger, an der es angefasst wurde. */
      ziehen(ev, chip, { el: el, mass: el.getBoundingClientRect(), ziel: null, gezogen: function () { chip.gezogen = true; } });
    });
  }

  /* Belegter Kasten: sein Element lässt sich wieder herausziehen — in einen
     anderen Kasten oder zurück in den Pool. Das Ereignis bleibt beim Kasten,
     sonst verschöbe die Bühne sich zugleich (HT.ui.radZoomAnbinden). */
  function zielZiehbar(ziel, g) {
    g.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || ev.pointerType === 'touch' || uebung.geprueft || !ziel.chip) { return; }
      ev.stopPropagation();
      ziel.gezogen = false;
      ziehen(ev, ziel.chip, { el: g, mass: g.getBoundingClientRect(), ziel: ziel, gezogen: function () { ziel.gezogen = true; } });
    });
  }

  /* --- Bausteine der Seiten ------------------------------------------------- */

  /* Schalter «Leere Kästen: Rollen · Aufgaben · Ergebnisse» — gedrückt heisst
     leer, also zu üben. Die letzte leere Art bleibt: ohne leere Kästen gäbe
     es nichts zu tun. */
  function artenLeiste(beiAenderung) {
    var knoepfe = {};
    function aktualisieren() {
      var an = leereArten();
      ARTEN.forEach(function (art) {
        knoepfe[art].setAttribute('aria-pressed', zustand.leer[art] ? 'true' : 'false');
        knoepfe[art].title = zustand.leer[art] && an.length === 1 ? 'Mindestens eine Art bleibt leer' : '';
      });
    }
    var leiste = h('div', { class: 'tr-arten', role: 'group', 'aria-label': 'Leere Kästen' }, [
      h('span', { class: 'tr-arten__titel', text: 'Leere Kästen' })
    ]);
    ARTEN.forEach(function (art) {
      var knopf = h('button', { type: 'button', class: 'tr-art' }, [
        h('span', { class: 'gswatch gswatch--' + art }, HT.ui.katSymbol(art, 14)),
        h('span', { text: HT.graph.KAT[art].label })
      ]);
      knopf.addEventListener('click', function () {
        if (zustand.leer[art] && leereArten().length === 1) { return; }
        zustand.leer[art] = !zustand.leer[art];
        speichern();
        aktualisieren();
        beiAenderung();
      });
      knoepfe[art] = knopf;
      leiste.appendChild(knopf);
    });
    aktualisieren();
    return leiste;
  }

  function besteZeigen() {
    if (!refs.beste || !uebung) { return; }
    var b = zustand.beste[bestSchluessel(uebung.def)];
    refs.beste.textContent = b ? 'Beste ' + b.richtig + '/' + b.gesamt : '';
    refs.beste.hidden = !b;
  }

  function werkzeug(text, klasse, aufruf, attrs) {
    var a = { type: 'button', 'class': klasse, text: text };
    for (var k in (attrs || {})) { if (Object.prototype.hasOwnProperty.call(attrs, k)) { a[k] = attrs[k]; } }
    var el = h('button', a);
    el.addEventListener('click', aufruf);
    return el;
  }

  /* Bei vielen Elementen (Gesamtbild: über 180) ein Suchfeld über dem Pool. */
  function suchfeld() {
    var feld = h('input', {
      type: 'search', class: 'suche__feld tr-suche__feld', placeholder: 'Element suchen …',
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Elemente durchsuchen'
    });
    var loeschen = h('button', { type: 'button', class: 'suche__loeschen', 'aria-label': 'Suche löschen', text: '✕' });
    refs.sucheStand = h('span', { class: 'tr-suche__stand', role: 'status' });
    feld.addEventListener('input', function () { uebung.suche = feld.value; zeichnen(); });
    feld.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { feld.value = ''; uebung.suche = ''; zeichnen(); } });
    loeschen.addEventListener('click', function () { feld.value = ''; uebung.suche = ''; zeichnen(); feld.focus(); });
    var huelle = h('div', { class: 'suche tr-suche', hidden: true }, [feld, loeschen, refs.sucheStand]);
    huelle.feld = feld;
    return huelle;
  }

  /* --- Seiten -------------------------------------------------------------- */

  function karte(def) {
    var anzahl = h('span');
    var beste = h('span', { class: 'tr-karte__beste' });
    var el = h('a', { class: 'tr-karte', href: def.adresse }, [
      h('span', { class: 'tr-karte__kopf' }, [
        def.eintrag ? HT.ui.katSymbol(def.eintrag.kategorie, 16) : HT.ui.symbol(['M3.5 4.5h17v15h-17Z', 'M3.5 9h17', 'M9 9v10.5', 'M14.5 9v10.5'], 16),
        h('span', { class: 'tr-karte__titel', text: def.name })
      ]),
      h('span', { class: 'tr-karte__meta' }, [anzahl, beste])
    ]);
    function aktualisieren() {
      var b = zustand.beste[bestSchluessel(def)];
      var voll = !!b && b.richtig === b.gesamt;
      el.classList.toggle('tr-karte--voll', voll);
      anzahl.textContent = leereAnzahl(def) + ' Kästen';
      beste.textContent = b ? (voll ? '✓ ' : '') + 'Beste ' + b.richtig + '/' + b.gesamt : '';
    }
    aktualisieren();
    return { el: el, aktualisieren: aktualisieren };
  }

  function hubRendern(behaelter) {
    var alle = uebungen();
    var karten = [];
    function gruppe(art) {
      return h('div', { class: 'tr-karten' }, alle.filter(function (u) { return u.art === art; }).map(function (def) {
        var k = karte(def);
        karten.push(k);
        return k.el;
      }));
    }

    behaelter.appendChild(h('section', { class: 'tr-hub' }, [
      h('div', { class: 'kopf kopf--teil' }, [
        h('h2', { text: 'Zuordnen' }),
        h('p', { text: 'Ausschnitte aus dem Graph der Methode in der klassischen Vorgehensweise — je Phase, je Modul oder alles auf einmal. '
          + 'Die Kästen sind leer, Phasen, Module und Verbindungen stehen da; die Rollen, Aufgaben und Ergebnisse liegen daneben bereit und wollen an ihren Platz. '
          + 'Am Ende zeigt die Prüfung, was richtig, falsch oder offen geblieben ist.' })
      ]),
      artenLeiste(function () { karten.forEach(function (k) { k.aktualisieren(); }); }),
      h('h2', { class: 'tr-mikro tr-mikro--gruppe', text: 'Phasen' }),
      gruppe('phase'),
      h('h2', { class: 'tr-mikro tr-mikro--gruppe', text: 'Module' }),
      gruppe('modul'),
      h('h2', { class: 'tr-mikro tr-mikro--gruppe', text: 'Alles auf einmal' }),
      gruppe('alles'),
      h('p', { class: 'tr-quelle' }, [
        'Grundlage: der Graph im ',
        h('a', { href: '#/ueberblick', text: 'Überblick' }),
        ' — Rollen, Aufgaben und Ergebnisse mit den Querverweisen der offiziellen Dokumentation (verantwortliche Rolle je Aufgabe, Ergebnisse je Aufgabe).'
      ])
    ]));
  }

  function naechste(def) {
    var alle = uebungen();
    var i = alle.indexOf(def);
    return i === -1 ? null : alle[(i + 1) % alle.length];
  }

  function uebungRendern(behaelter, def) {
    uebungStarten(def, null);
    zoom = 1;

    refs.bild = bildBauen();
    refs.zoomWert = h('span', { class: 'tr-zoom__wert', role: 'status', text: '100 %' });
    refs.buehne = h('div', { class: 'tr-buehne' }, [refs.bild]);
    /* Das Rad rollt die hohe Bühne; zoomen mit Strg + Rad oder zwei Fingern. */
    HT.ui.radZoomAnbinden(refs.buehne, function () { return refs.bild; }, zoomSkalieren, { nurMitTaste: true });

    var zoomLeiste = h('div', { class: 'tr-zoom', role: 'group', 'aria-label': 'Zoom' }, [
      werkzeug('−', 'tr-zoom__knopf', function () { zoomSetzen(zoom / ZOOM_SCHRITT); }, { 'aria-label': 'Verkleinern' }),
      refs.zoomWert,
      werkzeug('+', 'tr-zoom__knopf', function () { zoomSetzen(zoom * ZOOM_SCHRITT); }, { 'aria-label': 'Vergrössern' }),
      werkzeug('Passend', 'tr-zoom__passend', function () { zoomSetzen(1); })
    ]);

    refs.pool = h('div', { class: 'tr-pool', 'aria-label': 'Elemente' });
    refs.suche = suchfeld();
    refs.zaehler = h('span', { class: 'tr-zaehler', role: 'status' });
    refs.beste = h('span', { class: 'tr-beste', hidden: true });
    refs.hinweis = h('p', { class: 'tr-hinweis', text:
      'Element in einen leeren Kasten seiner Art ziehen — oder antippen und dann den Kasten. '
      + 'Die Linien sagen, welche Rolle für welche Aufgabe verantwortlich ist und welche Aufgabe welches Ergebnis erzeugt; '
      + 'beim Überfahren eines Kastens treten seine Verbindungen hervor. Aus einem belegten Kasten lässt sich das Element wieder herausziehen, ein Klick legt es zurück.' });
    refs.ergebnis = h('div', { class: 'tr-ergebnis', tabindex: '-1', 'aria-live': 'polite', hidden: true });
    var legende = h('ul', { class: 'tr-legende', 'aria-label': 'Verbindungen' }, ['verantwortlich', 'erzeugt'].map(function (rel) {
      var r = HT.graph.REL[rel];
      return h('li', {}, [h('span', { class: 'glinie glinie--' + r.stil, 'aria-hidden': 'true' }), r.label]);
    }));

    refs.knopfPruefen = werkzeug('Prüfen', 'btn btn--primaer', pruefen);
    refs.knopfReset = werkzeug('Zurücksetzen', 'btn', function () { zuruecksetzen(); });
    refs.knopfNochmals = werkzeug('Nochmals', 'btn btn--primaer', function () { zuruecksetzen(); });
    var weiter = naechste(def);
    var knopfWeiter = weiter && weiter !== def ? h('a', { class: 'btn', href: weiter.adresse, text: 'Nächste: ' + weiter.name + ' →' }) : null;

    /* Andere leere Arten: neues Bild, was schon liegt und noch einen Kasten hat, bleibt liegen. */
    function neuAufbauen() {
      var vorher = belegung();
      uebungStarten(def, vorher);
      var neu = bildBauen();
      refs.buehne.replaceChild(neu, refs.bild);
      refs.bild = neu;
      if (refs.suche && refs.suche.feld) { refs.suche.feld.value = ''; }
      besteZeigen();
      zeichnen();
      zoomAnwenden();
    }

    var seite = h('section', { class: 'tr-uebung', 'data-art': def.art }, [
      h('div', { class: 'tr-kopf' }, [
        h('a', { class: 'tr-zurueck', href: '#/trainer', text: '← Alle Übungen' }),
        h('div', { class: 'tr-kopf__zeile' }, [
          h('span', { class: 'tr-kicker', text: def.art === 'phase' ? 'Phase' : def.art === 'modul' ? 'Modul' : 'Alles' }),
          h('h1', { class: 'tr-titel', text: def.name }),
          refs.zaehler,
          refs.beste
        ])
      ]),
      h('div', { class: 'tr-buehne-huelle' }, [refs.buehne, zoomLeiste]),
      h('aside', { class: 'tr-seite', 'aria-label': 'Elemente und Auswertung' }, [
        artenLeiste(neuAufbauen),
        h('div', { class: 'btn-reihe tr-knoepfe' }, [refs.knopfPruefen, refs.knopfReset, refs.knopfNochmals, knopfWeiter]),
        refs.ergebnis,
        refs.hinweis,
        legende,
        refs.suche,
        refs.pool
      ])
    ]);
    behaelter.appendChild(seite);

    besteZeigen();
    zeichnen();
    zoomAnwenden();
    groesseAnmelden();
  }

  var groesseAngemeldet = false;
  function groesseAnmelden() {
    if (groesseAngemeldet) { return; }
    groesseAngemeldet = true;
    global.addEventListener('resize', function () {
      if (refs.buehne && document.body.contains(refs.buehne)) { zoomAnwenden(); }
    });
  }

  /* --- Teil «Zuordnen» ------------------------------------------------------ */

  /* Ohne phase/modul/alles: die Übersicht der Übungen (unter der Leiste des
     Trainers); mit: die Übung selbst als eigene Seite in voller Breite. */
  function zuordnenRendern(behaelter, params) {
    if (!zustand.initialisiert) { wiederherstellen(); zustand.initialisiert = true; }
    refs = {};
    uebung = null;
    params = params || {};

    if (!istUebung(params)) {
      hubRendern(behaelter);
      return;
    }
    var def = uebungFinden(params);
    if (!def) {
      behaelter.appendChild(HT.ui.leerZustand('Diese Übung gibt es nicht',
        'Der Link zeigt auf eine Phase oder ein Modul, das in der klassischen Vorgehensweise nicht vorkommt.',
        h('a', { class: 'btn btn--klein', href: '#/trainer', text: 'Alle Übungen' })));
      return;
    }

    var laden = h('p', { class: 'ladehinweis', text: 'Übung wird vorbereitet …' });
    behaelter.appendChild(laden);
    vorbereiten().then(function () {
      if (!document.body.contains(laden)) { return; }
      behaelter.removeChild(laden);
      uebungRendern(behaelter, def);
    });
  }

  function titel(params) {
    if (params && params.phase) { return 'Trainer · Phase ' + params.phase; }
    if (params && params.modul) { return 'Trainer · Modul ' + params.modul; }
    return 'Trainer · Gesamtbild';
  }

  HT.trainerTeile.zuordnen = {
    id: 'zuordnen',
    label: 'Zuordnen',
    pfade: ['M4 5h7v6H4Z', 'M13 13h7v6h-7Z', 'M13 5h7v6h-7Z', 'M4 13h7v6H4Z', 'M6 16l1.6 1.6L10 14.8'],
    render: zuordnenRendern,
    /* Eigene Seiten in voller Breite — der Trainer zeigt dort weder Kopf noch Leiste. */
    istUebung: istUebung,
    titel: titel
  };
}(window));
