/* HERMES-Trainer — Ansicht «Überblick».
   Zeigt Abbildung 1 des Referenzhandbuchs («Gesamtbild der HERMES-Module und
   der wesentlichen Ergebnisse entlang der Phasen») unverändert — es ist die
   Originalgrafik von hermes.admin.ch aus assets/abb/ — und legt eine
   Interaktionsschicht darüber:

   – Zeigen auf einen Kasten öffnet Kurzfassung, Verantwortung und beteiligte
     Rollen; das gilt auch für die Modulköpfe und die Phasenbalken am Rand.
   – Klick öffnet die Detailseite des Elements.
   – Eine Rollenauswahl färbt die Kästen, die diese Rolle verantwortet oder an
     denen sie beteiligt ist.

   Die Grafik selbst wird nicht nachgebaut: Kästen, Beschriftungen und Pfeile
   stammen aus der SVG-Datei. Zur Laufzeit werden nur die Kästen erkannt (über
   Füllfarbe und Kontur), ihre Beschriftung aus den Textfragmenten
   zusammengesetzt und mit den Einträgen aus data/ verbunden. */
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

  /* Farben, an denen die Grafik ihre Bestandteile unterscheidet. */
  var FARBEN = {
    ergebnis: '#DCEBFA',        // Ergebniskasten (Dokument, eckig)
    ergebnisRand: '#DCEBFA',    // Zustandskasten (weiss gefüllt, gerundet)
    modulRand: '#000000',       // Modulkopf
    phase: ['#B7D5F1', '#D9D9D9', '#EBC9C7']   // Phasenbalken am linken Rand
  };

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

  var SPEICHER = 'ueberblick';
  var ZOOM_MIN = 0.5;
  var ZOOM_MAX = 2.5;

  var zustand = {
    rolle: '',                  // hervorgehobene Rolle (Begriff) oder ''
    nurMinimal: false,          // minimal geforderte Ergebnisse hervorheben
    zoom: 1,
    initialisiert: false
  };

  var refs = {};

  /* --- Zustand sichern und wiederherstellen -------------------------------- */

  function speichern() {
    HT.store.schreib(SPEICHER, {
      rolle: zustand.rolle,
      nurMinimal: zustand.nurMinimal,
      zoom: zustand.zoom
    });
  }

  function wiederherstellen() {
    var g = HT.store.lies(SPEICHER, null);
    if (!g || typeof g !== 'object') { return; }
    if (typeof g.rolle === 'string' && HT.daten.eintragMitBegriff(g.rolle, 'rolle')) {
      zustand.rolle = g.rolle;
    }
    zustand.nurMinimal = !!g.nurMinimal;
    if (typeof g.zoom === 'number' && g.zoom >= ZOOM_MIN && g.zoom <= ZOOM_MAX) {
      zustand.zoom = g.zoom;
    }
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

  /* Die gerundeten Kästen sind Pfade aus M/L/C/Z — ausschliesslich
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
      kaesten.push(r);
    });

    liste(svg, 'path').forEach(function (el) {
      if (farbe(el, 'fill') !== '#FFFFFF' || farbe(el, 'stroke') !== FARBEN.ergebnisRand) { return; }
      var r = rahmenVonPfad(el);
      if (!r || r.w < 4 || r.h < 4) { return; }
      r.art = 'ergebnis';
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

  /* --- Interaktionsschicht ------------------------------------------------- */

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] !== null) {
        el.setAttribute(k, String(attrs[k]));
      }
    }
    return el;
  }

  function detailZiel(e) {
    if (e.kategorie === 'ergebnis') { return '#/ueberblick?id=' + encodeURIComponent(e.id); }
    return '#/lexikon?id=' + encodeURIComponent(e.id);
  }

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

  function flaechenKlasse(eintraege) {
    var e = eintraege[0];
    var klassen = ['ub-feld', 'ub-feld--' + e.kategorie];
    var bezug = rollenBezug(e);
    if (bezug) { klassen.push('ub-feld--' + bezug); }
    if (zustand.nurMinimal && e.kategorie === 'ergebnis' && !e.minimalGefordert) {
      klassen.push('ub-feld--blass');
    }
    return klassen.join(' ');
  }

  function felderFaerben() {
    (refs.felder || []).forEach(function (f) {
      f.flaeche.setAttribute('class', flaechenKlasse(f.eintraege));
    });
  }

  function feldBauen(k, eintraege) {
    var e = eintraege[0];
    var a = svgEl('a', { href: detailZiel(e), tabindex: '0', 'class': 'ub-feld-link' });
    var flaeche = svgEl('rect', {
      x: k.x - 1, y: k.y - 1, width: k.w + 2, height: k.h + 2,
      rx: k.art === 'phase' ? 2 : 3
    });
    var titel = svgEl('title', {});
    titel.appendChild(document.createTextNode(
      eintraege.map(function (x) { return x.begriff; }).join(' / ') + ' — Details öffnen'
    ));

    a.appendChild(flaeche);
    a.appendChild(titel);

    a.addEventListener('mouseenter', function () { fensterZeigen(eintraege, k, a); });
    a.addEventListener('mouseleave', fensterVerbergen);
    a.addEventListener('focus', function () { fensterZeigen(eintraege, k, a); });
    a.addEventListener('blur', fensterVerbergen);

    return { link: a, flaeche: flaeche, eintraege: eintraege, rahmen: k };
  }

  var KATEGORIE_JE_ART = { ergebnis: 'ergebnis', modul: 'modul', phase: 'phase' };

  function diagrammVeredeln(svg) {
    var gruppe = svg.getElementsByTagName('g')[0] || svg;
    var kaesten = kaestenLesen(svg);
    beschriftungVerteilen(kaesten, texteLesen(svg));

    var ebene = svgEl('g', { 'class': 'ub-felder' });
    var felder = [];
    var ohneTreffer = [];

    kaesten.forEach(function (k) {
      if (!k.beschriftung) { return; }
      var eintraege = eintraegeZuBeschriftung(k.beschriftung, KATEGORIE_JE_ART[k.art]);
      if (!eintraege) { ohneTreffer.push(k.beschriftung); return; }
      var feld = feldBauen(k, eintraege);
      felder.push(feld);
      ebene.appendChild(feld.link);
    });

    gruppe.appendChild(ebene);
    refs.felder = felder;
    felderFaerben();

    if (ohneTreffer.length && global.console && global.console.info) {
      global.console.info('Überblick: Kästen ohne Lexikoneintrag —', ohneTreffer.join(' · '));
    }
    return felder.length;
  }

  /* --- Schwebefenster ------------------------------------------------------ */

  function zeile(label, werte, klasse) {
    if (!werte || !werte.length) { return null; }
    return h('p', { class: 'ub-fenster__zeile' + (klasse ? ' ' + klasse : '') }, [
      h('span', { class: 'ub-fenster__label', text: label }),
      h('span', { text: werte.join(', ') })
    ]);
  }

  function fensterInhalt(eintraege) {
    var e = eintraege[0];
    var meta = HT.daten.kategorieMeta(e.kategorie);
    var marke = e.kategorie === 'ergebnis'
      ? (e.typ || (meta ? meta.singular : ''))
      : (meta ? meta.singular : '');

    var kinder = [
      h('div', { class: 'ub-fenster__kopf' }, [
        h('strong', { class: 'ub-fenster__titel', text: e.begriff }),
        h('span', {
          class: 'ub-fenster__typ',
          dataset: { typ: e.kategorie === 'ergebnis' ? (e.typ || '') : e.kategorie },
          text: marke
        })
      ]),
      h('p', { class: 'ub-fenster__text', text: HT.ui.kuerzen(e.kurz || e.definition || '', 190) })
    ];

    if (e.kategorie === 'ergebnis' && e.minimalGefordert) {
      kinder.push(h('p', { class: 'ub-fenster__marker', text: 'Minimal gefordert' }));
    }
    if (e.kategorie === 'modul' && HT.karte.ZWINGENDE_MODULE.indexOf(e.begriff) !== -1) {
      kinder.push(h('p', { class: 'ub-fenster__marker', text: 'Zwingend in jedem Projekt' }));
    }

    kinder.push(zeile('Verantwortlich', e.verantwortlich ? [e.verantwortlich] : null, 'ist-verantwortlich'));
    kinder.push(zeile('Beteiligt', e.beteiligt, null));
    kinder.push(zeile('Module', e.kategorie === 'modul' ? null : e.module, null));
    kinder.push(zeile('Phasen', e.kategorie === 'phase' ? null : HT.daten.phasenSortiert(e.phasen), null));
    if (e.kategorie === 'phase' && e.meilensteine && e.meilensteine.length) {
      kinder.push(zeile('Meilensteine', e.meilensteine.map(function (m) {
        return m.name.replace(/^Meilenstein\s+/i, '');
      }), null));
    }

    if (eintraege.length > 1) {
      kinder.push(h('p', { class: 'ub-fenster__sammel', text:
        'Ein Kasten für ' + eintraege.map(function (x) { return x.begriff; }).join(' und ') + '.' }));
    }
    kinder.push(h('p', { class: 'ub-fenster__tipp', text: 'Klick öffnet die Detailseite' }));

    return kinder.filter(function (k) { return !!k; });
  }

  /* Das Fenster liegt über der Bühne; die Kastenkoordinaten stammen aus dem
     SVG-Raster und werden über den Zoom in Bildschirmpixel umgerechnet. */
  function fensterZeigen(eintraege, k, anker) {
    if (!refs.fenster || !refs.buehne) { return; }
    if (refs.anker && refs.anker !== anker) { refs.anker.removeAttribute('aria-describedby'); }
    refs.anker = anker;
    anker.setAttribute('aria-describedby', 'ub-fenster');

    HT.ui.leeren(refs.fenster);
    fensterInhalt(eintraege).forEach(function (kind) { refs.fenster.appendChild(kind); });
    refs.fenster.hidden = false;

    var z = zustand.zoom;
    var mitteX = (k.x + k.w / 2 + refs.versatzX) * z;
    var obenY = (k.y + refs.versatzY) * z;
    var untenY = (k.y + k.h + refs.versatzY) * z;

    var breite = refs.fenster.offsetWidth;
    var hoehe = refs.fenster.offsetHeight;
    var sichtL = refs.buehne.scrollLeft;
    var sichtB = refs.buehne.clientWidth;

    var links = mitteX - breite / 2;
    links = Math.max(sichtL + 4, Math.min(links, sichtL + sichtB - breite - 4));

    var oben = obenY - hoehe - 8;
    if (oben < refs.buehne.scrollTop + 2) { oben = untenY + 8; }

    refs.fenster.style.left = Math.round(links) + 'px';
    refs.fenster.style.top = Math.round(oben) + 'px';
  }

  function fensterVerbergen() {
    if (refs.anker) { refs.anker.removeAttribute('aria-describedby'); refs.anker = null; }
    if (refs.fenster) { refs.fenster.hidden = true; }
  }

  /* --- Leiste -------------------------------------------------------------- */

  function zoomSetzen(wert) {
    zustand.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, wert));
    if (refs.buehne) { refs.buehne.style.setProperty('--ub-zoom', String(zustand.zoom)); }
    if (refs.zoomWert) { refs.zoomWert.textContent = Math.round(zustand.zoom * 100) + ' %'; }
    fensterVerbergen();
    speichern();
  }

  function rollenHinweis() {
    if (!refs.hinweis) { return; }
    HT.ui.leeren(refs.hinweis);
    if (!zustand.rolle) { return; }

    var verantwortet = 0, beteiligt = 0;
    (refs.felder || []).forEach(function (f) {
      var bezug = rollenBezug(f.eintraege[0]);
      if (bezug === 'verantwortlich') { verantwortet++; }
      if (bezug === 'beteiligt') { beteiligt++; }
    });

    var rolle = HT.daten.eintragMitBegriff(zustand.rolle, 'rolle');
    refs.hinweis.appendChild(h('p', { class: 'ub-rollenhinweis', role: 'status' }, [
      h('span', { class: 'ub-rollenhinweis__marke ist-verantwortlich', 'aria-hidden': 'true' }),
      h('span', { text: ' verantwortlich für ' + verantwortet + ' Kästen · ' }),
      h('span', { class: 'ub-rollenhinweis__marke ist-beteiligt', 'aria-hidden': 'true' }),
      h('span', { text: ' beteiligt an ' + beteiligt + ' — ' }),
      rolle
        ? h('a', { href: '#/lexikon?id=' + encodeURIComponent(rolle.id), text: zustand.rolle })
        : h('span', { text: zustand.rolle })
    ]));
  }

  function leisteBauen() {
    var rollenAuswahl = h('select', {
      class: 'ub-select', id: 'ub-rolle', 'aria-label': 'Rolle im Diagramm hervorheben'
    }, [h('option', { value: '', text: 'Rolle hervorheben …' })].concat(
      HT.daten.alphabetisch(HT.daten.eintraegeDerKategorie('rolle')).map(function (r) {
        return h('option', { value: r.begriff, text: r.begriff });
      })
    ));
    rollenAuswahl.value = zustand.rolle;
    rollenAuswahl.addEventListener('change', function () {
      zustand.rolle = rollenAuswahl.value;
      speichern();
      felderFaerben();
      rollenHinweis();
    });

    var minimal = h('button', {
      type: 'button', class: 'chip',
      'aria-pressed': zustand.nurMinimal ? 'true' : 'false',
      title: 'Alles ausblassen, was das Referenzhandbuch nicht als minimal gefordert führt',
      text: 'Minimal gefordert'
    });
    minimal.addEventListener('click', function () {
      zustand.nurMinimal = !zustand.nurMinimal;
      minimal.setAttribute('aria-pressed', zustand.nurMinimal ? 'true' : 'false');
      speichern();
      felderFaerben();
    });

    var kleiner = h('button', { type: 'button', class: 'ub-zoom__knopf', 'aria-label': 'Verkleinern', text: '−' });
    var groesser = h('button', { type: 'button', class: 'ub-zoom__knopf', 'aria-label': 'Vergrössern', text: '+' });
    refs.zoomWert = h('span', { class: 'ub-zoom__wert', role: 'status', text: Math.round(zustand.zoom * 100) + ' %' });
    kleiner.addEventListener('click', function () { zoomSetzen(zustand.zoom / 1.25); });
    groesser.addEventListener('click', function () { zoomSetzen(zustand.zoom * 1.25); });

    var zuruecksetzen = h('button', { type: 'button', class: 'btn btn--klein', text: 'Zurücksetzen' });
    zuruecksetzen.addEventListener('click', function () {
      zustand.rolle = '';
      zustand.nurMinimal = false;
      rollenAuswahl.value = '';
      minimal.setAttribute('aria-pressed', 'false');
      zoomSetzen(1);
      felderFaerben();
      rollenHinweis();
    });

    return h('div', { class: 'ub-leiste' }, [
      rollenAuswahl,
      minimal,
      h('div', { class: 'ub-zoom', role: 'group', 'aria-label': 'Zoom' }, [kleiner, refs.zoomWert, groesser]),
      zuruecksetzen
    ]);
  }

  /* --- Diagramm laden ------------------------------------------------------ */

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

  function diagrammLaden() {
    return abbildungspfadSuchen().then(function (pfad) {
      return global.fetch(pfad).then(function (antwort) {
        if (!antwort.ok) { throw new Error('HTTP ' + antwort.status); }
        return antwort.text();
      });
    }).then(function (text) {
      var doc = new global.DOMParser().parseFromString(text, 'image/svg+xml');
      var wurzel = doc.documentElement;
      if (!wurzel || String(wurzel.nodeName).toLowerCase() !== 'svg') {
        throw new Error('Keine SVG-Datei');
      }
      return document.importNode(wurzel, true);
    });
  }

  function diagrammEinsetzen(svg) {
    var breite = Number(svg.getAttribute('width')) || 1059;
    var hoehe = Number(svg.getAttribute('height')) || 759;

    /* Der Office-Export verschiebt die Zeichnung um translate(-7 -6); dieselbe
       Verschiebung braucht das Schwebefenster für seine Position. */
    var gruppe = svg.getElementsByTagName('g')[0];
    var versatz = gruppe ? matrixVon(gruppe) : [1, 0, 0, 1, 0, 0];
    refs.versatzX = versatz[4];
    refs.versatzY = versatz[5];

    svg.setAttribute('viewBox', '0 0 ' + breite + ' ' + hoehe);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.removeAttribute('overflow');
    svg.setAttribute('class', 'ub-abb');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', BILDUNTERSCHRIFT);
    svg.style.setProperty('--ub-breite', breite);
    svg.style.setProperty('--ub-hoehe', hoehe);

    diagrammVeredeln(svg);

    HT.ui.leeren(refs.buehne);
    refs.buehne.appendChild(svg);
    refs.buehne.appendChild(refs.fenster);
    refs.buehne.style.setProperty('--ub-zoom', String(zustand.zoom));
    rollenHinweis();
  }

  /* --- Detailseite eines Ergebnisses --------------------------------------- */

  function verweisZiel(ziel) {
    if (ziel && ziel.kategorie === 'ergebnis') { return detailZiel(ziel); }
    return '#/lexikon?id=' + encodeURIComponent(ziel.id);
  }

  function positionBauen(e) {
    var phasen = HT.daten.phasenSortiert(e.phasen || []);
    var module = e.module || [];
    if (!phasen.length || !module.length) { return null; }

    var kopf = h('div', { class: 'ub-pos__zeile ub-pos__zeile--kopf' }, [h('span', { class: 'ub-pos__ecke' })]
      .concat(module.map(function (m) { return h('span', { class: 'ub-pos__modul', text: m }); })));

    var zeilen = phasen.map(function (p) {
      return h('div', { class: 'ub-pos__zeile' }, [h('span', { class: 'ub-pos__phase', text: p })]
        .concat(module.map(function () {
          return h('span', { class: 'ub-pos__feld', 'aria-hidden': 'true', text: '●' });
        })));
    });

    var raster = h('div', { class: 'ub-pos' }, [kopf].concat(zeilen));
    raster.style.setProperty('--ub-pos-spalten', String(module.length));

    return h('section', { class: 'ub-abschnitt' }, [
      h('h2', { text: 'Phasen und Module' }),
      h('p', { class: 'ub-abschnitt__text', text: 'Das Ergebnis kommt in diesen Phasen und Modulen vor.' }),
      raster
    ]);
  }

  function detailRendern(behaelter, e) {
    behaelter.appendChild(h('p', { class: 'ub-zurueck' }, [
      h('a', { href: '#/ueberblick', text: '← Zurück zum Ergebnisdiagramm' })
    ]));

    behaelter.appendChild(h('div', { class: 'kopf kopf--knapp' }, [
      h('div', { class: 'ub-detail__titelzeile' }, [
        h('h1', { text: e.begriff }),
        HT.ui.badge('ergebnis')
      ])
    ]));

    behaelter.appendChild(HT.karte.bauen(e, {
      stufe: 1,
      ohneTitel: true,
      linkZiel: verweisZiel,
      zusatz: h('a', {
        class: 'btn btn--klein',
        href: '#/lexikon?id=' + encodeURIComponent(e.id),
        text: 'Im Lexikon'
      })
    }));

    var pos = positionBauen(e);
    if (pos) { behaelter.appendChild(pos); }

    behaelter.appendChild(h('p', { class: 'ub-zurueck ub-zurueck--fuss' }, [
      h('a', { href: '#/ueberblick', text: '← Zurück zum Ergebnisdiagramm' })
    ]));
  }

  /* --- Render -------------------------------------------------------------- */

  function uebersichtRendern(behaelter) {
    behaelter.appendChild(h('div', { class: 'kopf kopf--knapp' }, [
      h('h1', { text: 'Methodenüberblick' })
    ]));

    var warnung = HT.app.datenWarnung();
    if (warnung) { behaelter.appendChild(warnung); }

    refs.hinweis = h('div', { class: 'ub-hinweis-wrap' });
    refs.fenster = h('div', { class: 'ub-fenster', id: 'ub-fenster', role: 'tooltip', hidden: true });
    refs.buehne = h('div', { class: 'ub-buehne' }, [
      h('p', { class: 'ladehinweis', text: 'Diagramm wird geladen …' })
    ]);

    behaelter.appendChild(leisteBauen());
    behaelter.appendChild(refs.hinweis);
    behaelter.appendChild(refs.buehne);
    behaelter.appendChild(h('p', { class: 'ub-bildunterschrift', text: BILDUNTERSCHRIFT }));

    behaelter.appendChild(h('p', { class: 'ub-weiter' }, [
      h('a', {
        class: 'btn btn--klein', href: '#/methode?kapitel=methodenueberblick',
        text: 'Kapitel «Methodenüberblick»'
      }),
      h('a', { class: 'btn btn--klein', href: '#/graph', text: 'Dieselben Elemente als Graph' })
    ]));

    diagrammLaden().then(diagrammEinsetzen).catch(function (fehler) {
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
    refs.felder = [];
    refs.anker = null;

    /* Ältere Links auf ein Feld der Abbildung: die Feldseite ist eine eigene
       Route geworden. */
    if (params && params.phase && params.modul) {
      global.location.hash = '#/feld?phase=' + encodeURIComponent(params.phase)
        + '&modul=' + encodeURIComponent(params.modul);
      return;
    }

    if (params && params.id) {
      var e = HT.daten.eintragMitId(params.id);
      if (e && e.kategorie === 'ergebnis') {
        detailRendern(behaelter, e);
        return;
      }
      if (e) {
        global.location.hash = '#/lexikon?id=' + encodeURIComponent(e.id);
        return;
      }
      behaelter.appendChild(HT.ui.leerZustand(
        'Dieses Ergebnis gibt es nicht',
        'Der Link zeigt auf einen Eintrag, der nicht erfasst ist.',
        h('a', { class: 'btn btn--klein', href: '#/ueberblick', text: 'Zum Ergebnisdiagramm' })
      ));
      return;
    }

    uebersichtRendern(behaelter);
  }

  HT.views.ueberblick = {
    titel: 'Methodenüberblick',
    render: render
  };
}(window));
