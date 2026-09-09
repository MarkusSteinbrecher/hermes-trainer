/* HERMES-Trainer — Ansicht «Trainer»: Ausschnitte der Abbildung 1 zum Zuordnen.

   Jede Übung ist ein Ausschnitt aus dem Gesamtbild der Methode — eine Phase
   (die Zeile der Abbildung, darüber die Modulköpfe als Orientierung) oder
   ein Modul (die Spalte, links daneben die Phasenbalken). Die Ergebniskästen
   des Ausschnitts sind leer; ihre Namen liegen als Chips in einem Pool und
   werden per Ziehen oder Antippen in die Kästen gelegt. «Prüfen» deckt auf,
   was richtig, falsch oder offen geblieben ist; die beste Quote je Übung
   bleibt im Browser gespeichert.

   Die Grafik ist dieselbe wie im Überblick (js/abbildung.js): Kästen, Pfeile,
   Modulköpfe und Phasenbalken stammen aus der SVG-Datei. Der Ausschnitt ist
   kein Bildausschnitt im engen Sinn, sondern ein Raster aus Fenstern auf die
   Grafik — je ein verschachteltes <svg> mit eigenem viewBox pro Zeile und
   Spalte des Ausschnitts, damit Phasenbalken und Modulspalte nebeneinander
   stehen können, obwohl sie in der Grafik weit auseinander liegen.

   Adressen: #/trainer (Übersicht), #/trainer?phase=<Phase>,
   #/trainer?modul=<Modul>, #/trainer?alles=1 (Gesamtbild). */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SPEICHER = 'trainer';

  var LUECKE = 18;      // Abstand zwischen zwei Fenstern des Ausschnitts (Grafikeinheiten)
  var RAND = 6;         // Luft um den Ausschnitt
  var SAUM = 3;         // Luft um Balken und Köpfe, damit Konturen nicht angeschnitten werden
  var ZOOM_MIN = 0.5;
  var ZOOM_MAX = 3;
  var ZOOM_SCHRITT = 1.2;

  var abb = null;       // { svg, breite, hoehe, kaesten, uebungen } — einmal je Sitzung
  var abbLaeuft = null; // laufendes Versprechen, damit zwei Aufrufe nicht zweimal laden
  var zustand = { beste: {}, initialisiert: false };
  var refs = {};
  var uebung = null;    // laufende Übung, siehe uebungStarten()
  var zoom = 1;

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] !== null && attrs[k] !== undefined) {
        el.setAttribute(k, String(attrs[k]));
      }
    }
    return el;
  }

  function namenVon(eintraege) {
    return eintraege.map(function (x) { return x.begriff; }).join(' / ');
  }

  function idsVon(eintraege) {
    return eintraege.map(function (x) { return x.id; });
  }

  /* Die Beschriftung, wie sie im Kasten gedruckt steht — die Textfragmente
     der Grafik zeilenweise gefügt («Projekt-» «initialisierungs-» «auftrag»),
     Bindestriche am Zeilenende bleiben Umbruchstellen, sonst trennt ein
     Leerzeichen. So bricht ein gelegtes Etikett wie das Original. */
  function druckText(k) {
    var raus = '';
    (k.texte || []).forEach(function (t) {
      var s = String(t.s || '').trim();
      if (!s) { return; }
      /* Der Office-Export legt den Trennstrich oft als eigenes Fragment ab. */
      raus += (!raus || /-$/.test(raus) || /^-/.test(s)) ? s : ' ' + s;
    });
    return raus || (k.eintraege ? namenVon(k.eintraege) : '');
  }

  /* --- Gespeichert: beste Quote je Übung ---------------------------------- */

  function speichern() {
    HT.store.schreib(SPEICHER, { beste: zustand.beste });
  }

  function wiederherstellen() {
    var g = HT.store.lies(SPEICHER, null);
    if (g && typeof g === 'object' && g.beste && typeof g.beste === 'object') { zustand.beste = g.beste; }
  }

  /* --- Abbildung analysieren: Übungen aus Balken und Köpfen ---------------- */

  function mitte(k) { return { x: k.x + k.w / 2, y: k.y + k.h / 2 }; }

  function drin(wert, bereiche) {
    for (var i = 0; i < bereiche.length; i++) {
      if (wert >= bereiche[i][0] && wert <= bereiche[i][1]) { return true; }
    }
    return false;
  }

  /* Die Ergebniskästen, deren Mitte in einem Fenster des Ausschnitts liegt. */
  function kaestenIm(def) {
    return abb.kaesten.filter(function (k) {
      if (k.art !== 'ergebnis' || !k.eintraege) { return false; }
      var m = mitte(k);
      return drin(m.x, def.xs) && drin(m.y, def.ys);
    });
  }

  /* Modulköpfe zu Zeilen bündeln (die Grafik hat zwei: Initialisierung und
     das Raster darunter). */
  function kopfzeilen(koepfe) {
    var zeilen = [];
    koepfe.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (k) {
      var z = zeilen[zeilen.length - 1];
      if (z && Math.abs(z.y0 - k.y) < 10) {
        z.y0 = Math.min(z.y0, k.y); z.y1 = Math.max(z.y1, k.y + k.h);
      } else {
        zeilen.push({ y0: k.y, y1: k.y + k.h });
      }
    });
    return zeilen;
  }

  function ueberlappt(a0, a1, b0, b1) { return a0 < b1 && b0 < a1; }

  function uebungenAbleiten() {
    var kaesten = abb.kaesten;
    var balken = kaesten.filter(function (k) { return k.art === 'phase' && k.eintraege; });
    var koepfe = kaesten.filter(function (k) { return k.art === 'modul' && k.eintraege; });
    var zeilen = kopfzeilen(koepfe);
    var unten = balken.reduce(function (m, k) { return Math.max(m, k.y + k.h); }, 0) + SAUM;
    var links = koepfe.reduce(function (m, k) { return Math.min(m, k.x); }, Infinity) - LUECKE / 2;
    var liste = [];

    /* Phasen: die Zeile des Balkens über die ganze Breite; liegt die nächste
       Kopfzeile darüber (und nicht schon in der Zeile), kommt sie als
       schmales Fenster dazu — ohne Modulköpfe fehlte die Orientierung. */
    var namen = HT.daten.phasenSortiert(balken.map(function (k) { return k.eintraege[0].begriff; }));
    /* Umsetzung (agil) umfasst drei Zeilen — sie steht als grösste Phasenübung zuletzt. */
    namen = namen.filter(function (n) { return n !== 'Umsetzung'; }).concat(namen.filter(function (n) { return n === 'Umsetzung'; }));
    namen.forEach(function (name) {
      var k = null;
      balken.forEach(function (b) { if (!k && b.eintraege[0].begriff === name) { k = b; } });
      if (!k) { return; }
      var y0 = k.y - SAUM, y1 = k.y + k.h + SAUM;
      var ys = [[y0, y1]];
      var kopf = null, drin = false;
      zeilen.forEach(function (z) {
        if (ueberlappt(z.y0, z.y1, y0, y1)) { drin = true; }
        else if (z.y1 < y0 && (!kopf || z.y0 > kopf.y0)) { kopf = z; }
      });
      if (kopf && !drin) { ys.unshift([kopf.y0 - SAUM, kopf.y1 + SAUM]); }
      liste.push({
        id: 'phase:' + name, art: 'phase', name: name, eintrag: k.eintraege[0],
        titel: 'Phase ' + name, adresse: '#/trainer?phase=' + encodeURIComponent(name),
        xs: [[0, abb.breite]], ys: ys
      });
    });

    /* Module: die Spalte des Kopfs (mehrere Köpfe gleichen Namens werden
       vereint), links daneben die Phasenbalken. Nach unten reicht die Spalte
       bis zum nächsten anderen Kopf in derselben Spalte, sonst bis zum Ende. */
    var nachName = {};
    koepfe.forEach(function (k) {
      var name = namenVon(k.eintraege);
      var g = nachName[name];
      if (!g) { g = nachName[name] = { name: name, eintraege: k.eintraege, koepfe: [] }; }
      g.koepfe.push(k);
    });
    koepfe.slice().sort(function (a, b) { return (a.x - b.x) || (a.y - b.y); }).forEach(function (k) {
      var g = nachName[namenVon(k.eintraege)];
      if (!g || g.fertig) { return; }
      g.fertig = true;
      var x0 = Math.min.apply(null, g.koepfe.map(function (q) { return q.x; })) - SAUM;
      var x1 = Math.max.apply(null, g.koepfe.map(function (q) { return q.x + q.w; })) + SAUM;
      var y0 = Math.min.apply(null, g.koepfe.map(function (q) { return q.y; })) - SAUM;
      var y1 = unten;
      koepfe.forEach(function (q) {
        if (g.koepfe.indexOf(q) !== -1 || namenVon(q.eintraege) === g.name) { return; }
        if (q.y > y0 && ueberlappt(x0, x1, q.x, q.x + q.w)) { y1 = Math.min(y1, q.y - LUECKE / 2); }
      });
      liste.push({
        id: 'modul:' + g.name, art: 'modul', name: g.name, eintrag: g.eintraege[0],
        titel: 'Modul ' + g.name, adresse: '#/trainer?modul=' + encodeURIComponent(g.eintraege[0].begriff),
        xs: [[0, links], [x0, x1]], ys: [[y0, y1]]
      });
    });

    liste.push({
      id: 'alles', art: 'alles', name: 'Gesamtbild', titel: 'Gesamtbild der Methode',
      adresse: '#/trainer?alles=1', xs: [[0, abb.breite]], ys: [[0, abb.hoehe]]
    });

    liste.forEach(function (u) { u.anzahl = kaestenIm(u).length; });
    return liste.filter(function (u) { return u.anzahl > 0; });
  }

  /* Die Kästen werden in den Koordinaten der ersten Gruppe der Grafik
     gemessen; die trägt im Office-Export ein «translate(-7 -6)». Der Überblick
     legt seine Trefferschicht in diese Gruppe, der Trainer zeichnet in der
     Wurzel — also einmal umrechnen (nur Verschiebung und Massstab). */
  function inWurzelkoordinaten(svg, kaesten) {
    var g = svg.getElementsByTagName('g')[0];
    var t = g ? (g.getAttribute('transform') || '') : '';
    var a = 1, d = 1, e = 0, f = 0;
    var m = /matrix\(([^)]*)\)/.exec(t);
    var tr = /translate\(\s*([-\d.eE+]+)[\s,]+([-\d.eE+]+)/.exec(t);
    if (m) {
      var p = m[1].trim().split(/[\s,]+/).map(Number);
      if (p.length >= 6) { a = p[0]; d = p[3]; e = p[4]; f = p[5]; }
    } else if (tr) {
      e = Number(tr[1]); f = Number(tr[2]);
    }
    kaesten.forEach(function (k) {
      k.x = k.x * a + e; k.y = k.y * d + f; k.w = k.w * a; k.h = k.h * d;
    });
    return kaesten;
  }

  function abbildungBereit() {
    if (abb) { return global.Promise.resolve(abb); }
    if (abbLaeuft) { return abbLaeuft; }
    abbLaeuft = HT.abbildung.holen().then(function (text) {
      var svg = HT.abbildung.lesen(text);
      var m = HT.abbildung.masse(svg);
      abb = { svg: svg, breite: m.breite, hoehe: m.hoehe, kaesten: inWurzelkoordinaten(svg, HT.abbildung.kaesten(svg)) };
      abb.uebungen = uebungenAbleiten();
      return abb;
    });
    abbLaeuft.catch(function () { abbLaeuft = null; });
    return abbLaeuft;
  }

  /* --- Ausschnitt zeichnen ------------------------------------------------- */

  /* Fenster nebeneinander (Spalten) und untereinander (Zeilen), dazwischen
     eine Lücke. Liefert die Gesamtmasse und je Fenster den Versatz. */
  function raster(def) {
    var spalten = [], zeilen = [];
    var b = RAND, hh = RAND;
    def.xs.forEach(function (r) { spalten.push({ o: b, a: r[0], w: r[1] - r[0] }); b += r[1] - r[0] + LUECKE; });
    def.ys.forEach(function (r) { zeilen.push({ o: hh, a: r[0], w: r[1] - r[0] }); hh += r[1] - r[0] + LUECKE; });
    return { breite: b - LUECKE + RAND, hoehe: hh - LUECKE + RAND, spalten: spalten, zeilen: zeilen };
  }

  function versatz(bahnen, wert) {
    for (var i = 0; i < bahnen.length; i++) {
      var s = bahnen[i];
      if (wert >= s.a && wert <= s.a + s.w) { return s.o + (wert - s.a); }
    }
    return null;
  }

  function ausschnittBauen(def, ziele) {
    var r = raster(def);
    var svg = svgEl('svg', {
      'class': 'tr-abb', viewBox: '0 0 ' + r.breite + ' ' + r.hoehe,
      role: 'group', 'aria-label': def.titel + ' — Ausschnitt aus der Abbildung 1'
    });

    /* Die Grafik einmal als Vorlage, jedes Fenster zeigt sie mit eigenem viewBox. */
    var defs = svgEl('defs', {});
    var quelle = svgEl('g', { id: 'tr-quelle' });
    var kopie = abb.svg.cloneNode(true);
    while (kopie.firstChild) { quelle.appendChild(kopie.firstChild); }
    defs.appendChild(quelle);
    svg.appendChild(defs);

    var fenster = svgEl('g', { 'class': 'tr-fenster' });
    r.zeilen.forEach(function (z) {
      r.spalten.forEach(function (s) {
        var f = svgEl('svg', { x: s.o, y: z.o, width: s.w, height: z.w, viewBox: s.a + ' ' + z.a + ' ' + s.w + ' ' + z.w });
        var use = svgEl('use', { href: '#tr-quelle' });
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#tr-quelle');
        f.appendChild(use);
        fenster.appendChild(f);
      });
    });
    svg.appendChild(fenster);

    /* Schnittkanten: eine feine gepunktete Linie in jeder Lücke. */
    var kanten = svgEl('g', { 'class': 'tr-kanten' });
    r.spalten.slice(1).forEach(function (s) {
      var x = s.o - LUECKE / 2;
      kanten.appendChild(svgEl('line', { x1: x, y1: RAND, x2: x, y2: r.hoehe - RAND }));
    });
    r.zeilen.slice(1).forEach(function (z) {
      var y = z.o - LUECKE / 2;
      kanten.appendChild(svgEl('line', { x1: RAND, y1: y, x2: r.breite - RAND, y2: y }));
    });
    svg.appendChild(kanten);

    /* Je Ziel: Deckel in der Originalfüllung, Etikett, Trefferfläche. */
    var ebene = svgEl('g', { 'class': 'tr-ziele' });
    ziele.forEach(function (z, i) {
      var k = z.k;
      var x = versatz(r.spalten, k.x), y = versatz(r.zeilen, k.y);
      if (x === null || y === null) { return; }
      z.x = x; z.y = y;
      var g = svgEl('g', { 'class': 'tr-ziel', 'data-ziel': i, tabindex: '0', role: 'button' });
      g.appendChild(svgEl('rect', {
        'class': 'tr-ziel__deckel', x: x + 1, y: y + 1,
        width: Math.max(0, k.w - 2), height: Math.max(0, k.h - 2), fill: k.fuell
      }));
      /* Volle Kastenhöhe: dreizeilige Namen («Rechts-grundlagen-analyse»)
         füllen den Kasten im Druck bis an den Rand. */
      var fo = svgEl('foreignObject', { x: x + 1, y: y, width: Math.max(0, k.w - 2), height: k.h });
      var etikett = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      etikett.setAttribute('class', 'tr-etikett');
      etikett.setAttribute('lang', 'de');
      fo.appendChild(etikett);
      g.appendChild(fo);
      var flaeche = svgEl('rect', {
        'class': 'tr-ziel__flaeche', x: x - 1, y: y - 1, width: k.w + 2, height: k.h + 2,
        fill: '#ffffff', 'fill-opacity': '0'
      });
      g.appendChild(flaeche);
      var titel = svgEl('title', {});
      g.appendChild(titel);
      z.gruppe = g; z.etikett = etikett; z.flaeche = flaeche; z.titel = titel;

      g.addEventListener('click', function () { zielGeklickt(z); });
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') { ev.preventDefault(); zielGeklickt(z); }
      });
      ebene.appendChild(g);
    });
    svg.appendChild(ebene);

    svg.setAttribute('data-breite', String(r.breite));
    svg.setAttribute('data-hoehe', String(r.hoehe));
    return svg;
  }

  /* --- Zoom ---------------------------------------------------------------- */

  /* Passend: in die Breite der Bühne und in die Höhe des Fensters — hohe
     Modulspalten werden sonst über den Schirm hinaus gross. */
  function grundmass() {
    if (!refs.buehne || !refs.abb) { return 1; }
    var b = Number(refs.abb.getAttribute('data-breite')) || 1;
    var hh = Number(refs.abb.getAttribute('data-hoehe')) || 1;
    var platzB = refs.buehne.clientWidth - 28;
    var platzH = Math.max(320, global.innerHeight - refs.buehne.getBoundingClientRect().top - 48);
    return Math.max(0.1, Math.min(platzB / b, platzH / hh));
  }

  function zoomAnwenden() {
    if (!refs.abb) { return; }
    var b = Number(refs.abb.getAttribute('data-breite')) || 1;
    refs.abb.style.width = Math.round(b * grundmass() * zoom) + 'px';
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

  /* --- Übung: Zustand ------------------------------------------------------ */

  /* uebung = { def, ziele: [{ k, name, ids, chip }], chips: [{ name, ids, ziel, el }],
                gewaehlt: Chip | null, geprueft: false | { richtig, gesamt } } */
  function uebungStarten(def) {
    var ziele = kaestenIm(def).map(function (k) {
      return { k: k, name: namenVon(k.eintraege), druck: druckText(k), ids: idsVon(k.eintraege), chip: null, status: '' };
    });
    /* Die Reihenfolge der Ziele folgt der Grafik (Zeile, dann Spalte) — sie
       spielt für die Chips keine Rolle, aber für die Tastaturreihenfolge. */
    ziele.sort(function (a, b) { return (a.k.y - b.k.y) || (a.k.x - b.k.x); });
    var chips = ziele.map(function (z) { return { name: z.name, druck: z.druck, ids: z.ids, ziel: null, el: null }; });
    chips.sort(function (a, b) { return a.name.localeCompare(b.name, 'de'); });
    uebung = { def: def, ziele: ziele, chips: chips, gewaehlt: null, geprueft: false };
  }

  function chipsImPool() {
    return uebung.chips.filter(function (c) { return !c.ziel; });
  }

  function setzen(chip, ziel) {
    if (uebung.geprueft) { return; }
    if (ziel.chip === chip) { return; }
    if (chip.ziel) { chip.ziel.chip = null; }
    if (ziel.chip) { ziel.chip.ziel = null; }
    ziel.chip = chip;
    chip.ziel = ziel;
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
    if (uebung.gewaehlt) { setzen(uebung.gewaehlt, ziel); }
    else if (ziel.chip) { loesen(ziel); }
  }

  function chipGeklickt(chip) {
    if (uebung.geprueft) { return; }
    uebung.gewaehlt = uebung.gewaehlt === chip ? null : chip;
    zeichnen();
  }

  function passt(chip, ziel) {
    return chip.ids.some(function (id) { return ziel.ids.indexOf(id) !== -1; });
  }

  function pruefen() {
    var richtig = 0;
    uebung.ziele.forEach(function (z) {
      z.status = !z.chip ? 'leer' : (passt(z.chip, z) ? 'richtig' : 'falsch');
      if (z.status === 'richtig') { richtig++; }
    });
    uebung.geprueft = { richtig: richtig, gesamt: uebung.ziele.length };
    uebung.gewaehlt = null;

    var alt = zustand.beste[uebung.def.id];
    if (!alt || richtig > alt.richtig || (richtig === alt.richtig && uebung.ziele.length !== alt.gesamt)) {
      zustand.beste[uebung.def.id] = { richtig: richtig, gesamt: uebung.ziele.length, wann: new Date().toISOString().slice(0, 10) };
      speichern();
    }
    zeichnen();
    if (refs.ergebnis) {
      try { refs.ergebnis.focus({ preventScroll: true }); } catch (x) { refs.ergebnis.focus(); }
    }
  }

  function zuruecksetzen() {
    uebungStarten(uebung.def);
    zeichnen();
  }

  /* --- Übung: zeichnen ----------------------------------------------------- */

  function zeichnen() {
    if (!uebung || !refs.pool) { return; }
    var gepr = uebung.geprueft;

    /* Ziele */
    uebung.ziele.forEach(function (z) {
      if (!z.gruppe) { return; }
      var text = '', klasse = 'tr-ziel';
      if (gepr) {
        klasse += ' tr-ziel--' + z.status;
        text = z.druck;
      } else if (z.chip) {
        klasse += ' tr-ziel--belegt';
        text = z.chip.druck;
      } else if (uebung.gewaehlt) {
        klasse += ' tr-ziel--bereit';
      }
      z.gruppe.setAttribute('class', klasse);
      z.etikett.textContent = text;
      var beschreibung;
      if (gepr) {
        beschreibung = z.status === 'richtig' ? 'Richtig: ' + z.name
          : z.status === 'falsch' ? 'Falsch — hier gehört ' + z.name + ' hin, gelegt war ' + z.chip.name
          : 'Offen — hier gehört ' + z.name + ' hin';
      } else if (z.chip) {
        beschreibung = z.chip.name + ' — Klick oder Enter legt den Chip zurück';
      } else {
        beschreibung = uebung.gewaehlt ? 'Leerer Kasten — Klick oder Enter legt ' + uebung.gewaehlt.name + ' hierher' : 'Leerer Kasten';
      }
      z.titel.textContent = beschreibung;
      z.gruppe.setAttribute('aria-label', beschreibung);
    });
    if (refs.abb) { refs.abb.classList.toggle('ist-bereit', !!uebung.gewaehlt && !gepr); }

    /* Pool */
    HT.ui.leeren(refs.pool);
    var offen = chipsImPool();
    if (!offen.length) {
      refs.pool.appendChild(h('p', { class: 'tr-pool__leer', text: gepr ? 'Alle Chips lagen im Bild.' : 'Alle Chips liegen im Bild — jetzt prüfen.' }));
    }
    offen.forEach(function (c) {
      var el = h('button', {
        type: 'button',
        class: 'tr-chip' + (uebung.gewaehlt === c ? ' ist-gewaehlt' : ''),
        text: c.name,
        'aria-pressed': uebung.gewaehlt === c ? 'true' : 'false',
        disabled: gepr ? 'disabled' : null
      });
      c.el = el;
      el.addEventListener('click', function () { if (!c.gezogen) { chipGeklickt(c); } c.gezogen = false; });
      chipZiehbar(c, el);
      refs.pool.appendChild(el);
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
  }

  function auswertung() {
    var g = uebung.geprueft;
    var falsch = uebung.ziele.filter(function (z) { return z.status === 'falsch'; });
    var leer = uebung.ziele.filter(function (z) { return z.status === 'leer'; });
    var beste = zustand.beste[uebung.def.id];
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
          h('span', { class: 'tr-liste__falsch', text: z.chip.name }),
          ' — hier gehört ',
          h('a', { href: '#/lexikon?id=' + encodeURIComponent(z.k.eintraege[0].id), text: z.name }),
          ' hin'
        ]);
      })));
    }
    if (leer.length) {
      kinder.push(h('h3', { class: 'tr-mikro', text: 'Offen geblieben' }));
      kinder.push(h('ul', { class: 'tr-liste' }, leer.map(function (z) {
        return h('li', {}, h('a', { href: '#/lexikon?id=' + encodeURIComponent(z.k.eintraege[0].id), text: z.name }));
      })));
    }
    return h('div', {}, kinder);
  }

  /* --- Ziehen mit Maus oder Stift ----------------------------------------- */

  /* Auf Touch-Geräten bleibt es beim Antippen (Chip, dann Kasten) — ein
     Ziehen stritte dort mit dem Scrollen des Pools. */
  function chipZiehbar(chip, el) {
    el.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || ev.pointerType === 'touch' || uebung.geprueft) { return; }
      var start = { x: ev.clientX, y: ev.clientY };
      var geist = null;
      var drueber = null;

      function zielUnter(e) {
        var unter = document.elementFromPoint(e.clientX, e.clientY);
        var g = unter && unter.closest ? unter.closest('[data-ziel]') : null;
        return g ? uebung.ziele[Number(g.getAttribute('data-ziel'))] : null;
      }

      /* Die Bewegung hört das Dokument, nicht der Chip: ein Zug verlässt den
         Chip sofort, und Pointer Capture auf einem Button kommt nicht überall
         zuverlässig an. */
      function bewegen(e) {
        if (!geist) {
          if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) { return; }
          geist = h('div', { class: 'tr-geist', text: chip.name });
          document.body.appendChild(geist);
          el.classList.add('ist-am-ziehen');
          document.body.classList.add('tr-zieht');
        }
        geist.style.left = e.clientX + 'px';
        geist.style.top = e.clientY + 'px';
        var z = zielUnter(e);
        if (z !== drueber) {
          if (drueber && drueber.gruppe) { drueber.gruppe.classList.remove('ist-drueber'); }
          drueber = z;
          if (drueber && drueber.gruppe) { drueber.gruppe.classList.add('ist-drueber'); }
        }
        e.preventDefault();
      }

      function ende(e) {
        document.removeEventListener('pointermove', bewegen);
        document.removeEventListener('pointerup', ende);
        document.removeEventListener('pointercancel', ende);
        global.removeEventListener('blur', ende);
        var punkt = e && typeof e.clientX === 'number' ? e : null;
        /* Ohne Zwischenbewegung (sehr schneller Zug) zählt der Weg bis zum
           Loslassen; ein Klick an Ort und Stelle bleibt ein Klick. */
        var weit = punkt ? Math.hypot(punkt.clientX - start.x, punkt.clientY - start.y) >= 6 : false;
        if (geist) { geist.parentNode.removeChild(geist); }
        el.classList.remove('ist-am-ziehen');
        document.body.classList.remove('tr-zieht');
        if (drueber && drueber.gruppe) { drueber.gruppe.classList.remove('ist-drueber'); }
        if (!geist && !weit) { return; }
        chip.gezogen = true;
        var z = punkt && e.type === 'pointerup' ? zielUnter(punkt) : null;
        if (z) { setzen(chip, z); }
      }

      document.addEventListener('pointermove', bewegen);
      document.addEventListener('pointerup', ende);
      document.addEventListener('pointercancel', ende);
      global.addEventListener('blur', ende);
    });
  }

  /* --- Seiten -------------------------------------------------------------- */

  function bestText(def) {
    var b = zustand.beste[def.id];
    return b ? b.richtig + '/' + b.gesamt : '';
  }

  function karte(def) {
    var b = zustand.beste[def.id];
    var voll = b && b.richtig === b.gesamt;
    return h('a', { class: 'tr-karte' + (voll ? ' tr-karte--voll' : ''), href: def.adresse }, [
      h('span', { class: 'tr-karte__kopf' }, [
        def.eintrag ? HT.ui.katSymbol(def.eintrag.kategorie, 16) : HT.ui.symbol(['M3.5 4.5h17v15h-17Z', 'M3.5 9h17', 'M9 9v10.5', 'M14.5 9v10.5'], 16),
        h('span', { class: 'tr-karte__titel', text: def.name })
      ]),
      h('span', { class: 'tr-karte__meta' }, [
        h('span', { text: def.anzahl + ' Kästen' }),
        b ? h('span', { class: 'tr-karte__beste', text: (voll ? '✓ ' : '') + 'Beste ' + b.richtig + '/' + b.gesamt }) : null
      ])
    ]);
  }

  function hubRendern(behaelter) {
    var phasen = abb.uebungen.filter(function (u) { return u.art === 'phase'; });
    var module = abb.uebungen.filter(function (u) { return u.art === 'modul'; });
    var alles = abb.uebungen.filter(function (u) { return u.art === 'alles'; });

    behaelter.appendChild(h('section', { class: 'tr-hub' }, [
      h('div', { class: 'kopf' }, [
        h('h1', { text: 'Trainer' }),
        h('p', { text: 'Ausschnitte aus dem Gesamtbild der Methode, leer bis auf Modulköpfe, Phasenbalken und Pfeile. '
          + 'Die Ergebnisse liegen als Chips bereit und wollen an ihren Platz — pro Phase, pro Modul oder das ganze Bild. '
          + 'Am Ende zeigt die Prüfung, was richtig, falsch oder offen geblieben ist.' })
      ]),
      h('h2', { class: 'tr-mikro tr-mikro--gruppe', text: 'Phasen' }),
      h('div', { class: 'tr-karten' }, phasen.map(karte)),
      h('h2', { class: 'tr-mikro tr-mikro--gruppe', text: 'Module' }),
      h('div', { class: 'tr-karten' }, module.map(karte)),
      h('h2', { class: 'tr-mikro tr-mikro--gruppe', text: 'Alles auf einmal' }),
      h('div', { class: 'tr-karten' }, alles.map(karte)),
      h('p', { class: 'tr-quelle' }, [
        'Grundlage: ' + HT.abbildung.BILDUNTERSCHRIFT + ' — Originalgrafik, ',
        h('a', { href: HT.abbildung.QUELLE, target: '_blank', rel: 'noopener', text: 'hermes.admin.ch ↗' })
      ])
    ]));
  }

  function naechste(def) {
    var liste = abb.uebungen;
    var i = liste.indexOf(def);
    return i === -1 ? null : liste[(i + 1) % liste.length];
  }

  function werkzeug(text, klasse, aufruf, attrs) {
    var a = { type: 'button', 'class': klasse, text: text };
    for (var k in (attrs || {})) { if (Object.prototype.hasOwnProperty.call(attrs, k)) { a[k] = attrs[k]; } }
    var el = h('button', a);
    el.addEventListener('click', aufruf);
    return el;
  }

  function uebungRendern(behaelter, def) {
    uebungStarten(def);
    zoom = 1;

    refs.abb = ausschnittBauen(def, uebung.ziele);
    refs.zoomWert = h('span', { class: 'tr-zoom__wert', role: 'status', text: '100 %' });
    refs.buehne = h('div', { class: 'tr-buehne' }, [refs.abb]);
    HT.ui.radZoomAnbinden(refs.buehne, function () { return refs.abb; }, zoomSkalieren);

    var zoomLeiste = h('div', { class: 'tr-zoom', role: 'group', 'aria-label': 'Zoom' }, [
      werkzeug('−', 'tr-zoom__knopf', function () { zoomSetzen(zoom / ZOOM_SCHRITT); }, { 'aria-label': 'Verkleinern' }),
      refs.zoomWert,
      werkzeug('+', 'tr-zoom__knopf', function () { zoomSetzen(zoom * ZOOM_SCHRITT); }, { 'aria-label': 'Vergrössern' }),
      werkzeug('Passend', 'tr-zoom__passend', function () { zoomSetzen(1); })
    ]);

    refs.pool = h('div', { class: 'tr-pool', role: 'list', 'aria-label': 'Chips' });
    refs.zaehler = h('span', { class: 'tr-zaehler', role: 'status' });
    refs.hinweis = h('p', { class: 'tr-hinweis', text:
      'Chip in einen leeren Kasten ziehen — oder Chip antippen und dann den Kasten. '
      + 'Ein Klick auf einen belegten Kasten legt den Chip zurück.' });
    refs.ergebnis = h('div', { class: 'tr-ergebnis', tabindex: '-1', 'aria-live': 'polite', hidden: true });

    refs.knopfPruefen = werkzeug('Prüfen', 'btn btn--primaer', pruefen);
    refs.knopfReset = werkzeug('Zurücksetzen', 'btn', function () { zuruecksetzen(); });
    refs.knopfNochmals = werkzeug('Nochmals', 'btn btn--primaer', function () { zuruecksetzen(); });
    var weiter = naechste(def);
    var knopfWeiter = weiter ? h('a', { class: 'btn', href: weiter.adresse, text: 'Nächste: ' + weiter.name + ' →' }) : null;

    var seite = h('section', { class: 'tr-uebung', 'data-art': def.art }, [
      h('div', { class: 'tr-kopf' }, [
        h('a', { class: 'tr-zurueck', href: '#/trainer', text: '← Alle Übungen' }),
        h('div', { class: 'tr-kopf__zeile' }, [
          h('span', { class: 'tr-kicker', text: def.art === 'phase' ? 'Phase' : def.art === 'modul' ? 'Modul' : 'Gesamtbild' }),
          h('h1', { class: 'tr-titel', text: def.name }),
          refs.zaehler,
          bestText(def) ? h('span', { class: 'tr-beste', text: 'Beste ' + bestText(def) }) : null
        ])
      ]),
      h('div', { class: 'tr-buehne-huelle' }, [refs.buehne, zoomLeiste]),
      h('aside', { class: 'tr-seite', 'aria-label': 'Chips und Auswertung' }, [
        h('div', { class: 'btn-reihe tr-knoepfe' }, [refs.knopfPruefen, refs.knopfReset, refs.knopfNochmals, knopfWeiter]),
        refs.ergebnis,
        refs.hinweis,
        refs.pool
      ])
    ]);
    behaelter.appendChild(seite);

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

  function render(behaelter, params) {
    if (!zustand.initialisiert) { wiederherstellen(); zustand.initialisiert = true; }
    refs = {};
    uebung = null;
    params = params || {};

    var warnung = HT.app.datenWarnung();
    if (warnung) { behaelter.appendChild(warnung); }
    var laden = h('p', { class: 'ladehinweis', text: 'Abbildung wird geladen …' });
    behaelter.appendChild(laden);

    abbildungBereit().then(function () {
      if (!document.body.contains(laden)) { return; }
      behaelter.removeChild(laden);
      var def = null;
      if (params.phase || params.modul || params.alles) {
        abb.uebungen.forEach(function (u) {
          if (def) { return; }
          if (params.alles && u.art === 'alles') { def = u; }
          else if (params.phase && u.art === 'phase' && HT.daten.normalisieren(u.name) === HT.daten.normalisieren(params.phase)) { def = u; }
          else if (params.modul && u.art === 'modul' && u.eintrag && HT.daten.normalisieren(u.eintrag.begriff) === HT.daten.normalisieren(params.modul)) { def = u; }
        });
        if (!def) {
          behaelter.appendChild(HT.ui.leerZustand('Diese Übung gibt es nicht',
            'Der Link zeigt auf eine Phase oder ein Modul, das im Gesamtbild nicht vorkommt.',
            h('a', { class: 'btn btn--klein', href: '#/trainer', text: 'Alle Übungen' })));
          return;
        }
        uebungRendern(behaelter, def);
      } else {
        hubRendern(behaelter);
      }
    }).catch(function (fehler) {
      if (!document.body.contains(laden)) { return; }
      behaelter.removeChild(laden);
      behaelter.appendChild(HT.ui.leerZustand(
        'Die Abbildung konnte nicht geladen werden',
        'Die Originalabbildung liegt in assets/abb/. Wird die Seite direkt aus dem Dateisystem geöffnet '
          + '(file://), blockiert der Browser das Lesen — dann hilft ein lokaler Webserver. '
          + 'Technische Meldung: ' + (fehler && fehler.message ? fehler.message : String(fehler))
      ));
    });
  }

  function titel(params) {
    if (params && params.phase) { return 'Trainer · Phase ' + params.phase; }
    if (params && params.modul) { return 'Trainer · Modul ' + params.modul; }
    if (params && params.alles) { return 'Trainer · Gesamtbild'; }
    return 'Trainer';
  }

  HT.views.trainer = {
    titel: titel,
    render: render
  };
}(window));
