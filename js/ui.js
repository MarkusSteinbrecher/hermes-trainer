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

  /**
   * Ersetzt den gesuchten Begriff im Text durch eine Auslassung.
   * Ohne das steht die Lösung meist wörtlich in der Definition.
   */
  function ohneBegriff(text, begriff) {
    var t = String(text === null || text === undefined ? '' : text);
    var b = String(begriff === null || begriff === undefined ? '' : begriff).trim();
    if (!t || b.length < 3) { return t; }
    try {
      var muster = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return t.replace(new RegExp(muster, 'gi'), '…').replace(/…(\s*…)+/g, '…');
    } catch (e) {
      return t;
    }
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
    mischen: mischen,
    zufallsElement: zufallsElement,
    prozent: prozent,
    quellenLink: quellenLink,
    badge: badge,
    leerZustand: leerZustand
  };
}(window));
