/* HERMES-Trainer — kleine DOM- und Text-Helfer.
   Bewusst ohne innerHTML: alle Inhalte werden als Textknoten gesetzt. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};

  /**
   * Elementfabrik.
   * h('div', { class: 'a b', text: 'Hallo', on: { click: fn } }, [kindA, kindB])
   */
  function h(tag, attrs, kinder) {
    var el = document.createElement(tag);
    var k;

    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) { continue; }
        var wert = attrs[k];
        if (wert === null || wert === undefined || wert === false) { continue; }

        if (k === 'text') {
          el.textContent = String(wert);
        } else if (k === 'class') {
          el.className = String(wert);
        } else if (k === 'on') {
          for (var evt in wert) {
            if (Object.prototype.hasOwnProperty.call(wert, evt)) {
              el.addEventListener(evt, wert[evt]);
            }
          }
        } else if (k === 'dataset') {
          for (var d in wert) {
            if (Object.prototype.hasOwnProperty.call(wert, d)) {
              el.dataset[d] = String(wert[d]);
            }
          }
        } else if (wert === true) {
          el.setAttribute(k, '');
        } else {
          el.setAttribute(k, String(wert));
        }
      }
    }

    anhaengen(el, kinder);
    return el;
  }

  function anhaengen(el, kinder) {
    if (kinder === null || kinder === undefined || kinder === false) { return; }
    if (Array.isArray(kinder)) {
      for (var i = 0; i < kinder.length; i++) { anhaengen(el, kinder[i]); }
      return;
    }
    if (typeof kinder === 'string' || typeof kinder === 'number') {
      el.appendChild(document.createTextNode(String(kinder)));
      return;
    }
    if (kinder && kinder.nodeType) { el.appendChild(kinder); }
  }

  function leeren(el) {
    while (el && el.firstChild) { el.removeChild(el.firstChild); }
    return el;
  }

  /** Guillemets um einen Text. */
  function zitat(text) {
    return '«' + String(text === null || text === undefined ? '' : text) + '»';
  }

  /** Kürzt Text auf ganze Wörter, hängt ein Auslassungszeichen an. */
  function kuerzen(text, max) {
    var t = String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
    if (t.length <= max) { return t; }
    var schnitt = t.slice(0, max);
    var letzte = schnitt.lastIndexOf(' ');
    if (letzte > max * 0.6) { schnitt = schnitt.slice(0, letzte); }
    return schnitt.replace(/[\s.,;:]+$/, '') + ' …';
  }

  var MIND_WORTLAENGE = 6;   // kürzere Wörter («Phase», «Modul») zu maskieren zerstört den Satz
  var WORT_TRENNER = /[\s\u2010-\u2015\-\/,;:.()\u00ab\u00bb\u201e\u201c"'\u2019]+/;

  function regexSchuetzen(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Maskiert ein Muster am Wortanfang. Statt eines Lookbehind — das ältere
   * Safari-Versionen nicht kennen — wird das Zeichen davor mitgefasst und
   * wieder eingesetzt.
   */
  function maskieren(text, muster, mitFortsetzung) {
    var kern = muster + (mitFortsetzung ? '\\p{L}*' : '');
    try {
      return text.replace(new RegExp('(^|[^\\p{L}])(' + kern + ')', 'giu'), '$1…');
    } catch (e) {
      var buchstaben = 'A-Za-zÄÖÜäöüß';
      var ersatz = muster + (mitFortsetzung ? '[' + buchstaben + ']*' : '');
      try {
        return text.replace(new RegExp('(^|[^' + buchstaben + '])(' + ersatz + ')', 'gi'), '$1…');
      } catch (e2) {
        return text;
      }
    }
  }

  /**
   * Ersetzt den gesuchten Begriff im Text durch eine Auslassung — samt seinen
   * längeren Einzelwörtern und deren Beugungen. Sonst steht die Lösung meist
   * noch im Text: bei «Ausschreibung erarbeiten» bliebe «Ausschreibung»
   * oder «Ausschreibungen» sichtbar.
   */
  function ohneBegriff(text, begriff) {
    var t = String(text === null || text === undefined ? '' : text);
    var b = String(begriff === null || begriff === undefined ? '' : begriff).trim();
    if (!t || b.length < 3) { return t; }

    /* Auch der ganze Begriff wird mit Fortsetzung maskiert, sonst bliebe von
       «Umsetzungsorganisation» beim Begriff «Umsetzung» ein «…sorganisation»
       stehen. */
    var ergebnis = maskieren(t, regexSchuetzen(b), true);

    b.split(WORT_TRENNER).forEach(function (wort) {
      if (wort.length < MIND_WORTLAENGE) { return; }
      ergebnis = maskieren(ergebnis, regexSchuetzen(wort), true);
    });

    return ergebnis.replace(/…(\s*…)+/g, '…');
  }

  /** Lesbarer Rest nach der Maskierung — Grundlage für die Brauchbarkeitsprüfung. */
  function restlaenge(text) {
    return String(text === null || text === undefined ? '' : text)
      .replace(/…/g, ' ').replace(/\s+/g, ' ').trim().length;
  }

  /**
   * Steckt der Begriff — auch als Wortende eines Kompositums — noch im Text?
   * «Produktentwickler» verrät die Lösung «Entwickler», lässt sich aber nicht
   * maskieren, ohne einen eigenständigen Fachbegriff zu zerstören. Solche
   * Fälle werden darum als Frage verworfen statt weiter geschwärzt.
   */
  function enthaeltBegriff(text, begriff) {
    var t = String(text === null || text === undefined ? '' : text).toLowerCase();
    var b = String(begriff === null || begriff === undefined ? '' : begriff).trim().toLowerCase();
    if (!t || b.length < 3) { return false; }
    if (t.indexOf(b) !== -1) { return true; }

    var woerter = b.split(WORT_TRENNER);
    for (var i = 0; i < woerter.length; i++) {
      if (woerter[i].length >= MIND_WORTLAENGE && t.indexOf(woerter[i]) !== -1) { return true; }
    }
    return false;
  }

  /** Fisher-Yates auf einer Kopie. */
  function mischen(liste) {
    var a = liste.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function zufallsElement(liste) {
    if (!liste || !liste.length) { return null; }
    return liste[Math.floor(Math.random() * liste.length)];
  }

  /** Prozentwert als ganze Zahl, 0 bei leerem Nenner. */
  function prozent(zaehler, nenner) {
    if (!nenner) { return 0; }
    return Math.round((zaehler / nenner) * 100);
  }

  /** Sichtbarer Quellenlink «HERMES online ↗» — Kernfeature jeder Karte. */
  function quellenLink(quelle, klasse) {
    if (!quelle || !quelle.url) { return null; }
    var bezeichnung = quelle.bezeichnung || 'HERMES online';
    return h('a', {
      class: klasse || 'quelle-link',
      href: quelle.url,
      target: '_blank',
      rel: 'noopener',
      title: bezeichnung,
      'aria-label': bezeichnung + ' (öffnet in neuem Tab)'
    }, [
      h('span', { text: 'HERMES online' }),
      h('span', { class: 'quelle-link__pfeil', 'aria-hidden': 'true', text: '↗' })
    ]);
  }

  function badge(kategorie) {
    var meta = HT.daten && HT.daten.kategorieMeta ? HT.daten.kategorieMeta(kategorie) : null;
    return h('span', {
      class: 'badge badge--' + (kategorie || 'grundbegriff'),
      text: meta ? meta.singular : (kategorie || 'Begriff')
    });
  }

  function leerZustand(titel, text, aktion) {
    return h('div', { class: 'leer' }, [
      h('strong', { text: titel }),
      h('p', { text: text || '' }),
      aktion || null
    ]);
  }

  HT.ui = {
    h: h,
    leeren: leeren,
    zitat: zitat,
    kuerzen: kuerzen,
    ohneBegriff: ohneBegriff,
    restlaenge: restlaenge,
    enthaeltBegriff: enthaeltBegriff,
    mischen: mischen,
    zufallsElement: zufallsElement,
    prozent: prozent,
    quellenLink: quellenLink,
    badge: badge,
    leerZustand: leerZustand
  };
}(window));
