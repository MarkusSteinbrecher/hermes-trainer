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
  /**
   * Wortstamm für Beugungen, die kein blosses Anhängsel sind: «Szenario» →
   * «Szenarien», «Studie» → «Studien», «Benutzerdefiniertes» → «Benutzerdefinierte».
   * Ein abschliessender Vokal oder ein «es» wird abgeschnitten; der Rest wird
   * mit Fortsetzung maskiert.
   */
  function stamm(wort) {
    var w = String(wort || '');
    if (w.length >= MIND_WORTLAENGE + 2 && /es$/i.test(w)) { return w.slice(0, -2); }
    if (w.length >= MIND_WORTLAENGE + 1 && /[aeo]$/i.test(w)) { return w.slice(0, -1); }
    return w;
  }

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
      ergebnis = maskieren(ergebnis, regexSchuetzen(stamm(wort)), true);
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
      if (woerter[i].length < MIND_WORTLAENGE) { continue; }
      if (t.indexOf(woerter[i]) !== -1) { return true; }
      if (t.indexOf(stamm(woerter[i]).toLowerCase()) !== -1) { return true; }
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


  /* --- Handbuchtext: Blöcke aus data/handbuch/ als DOM ------------------- */

  /** Lexikonlink auf einen Eintrag (oder Text, wenn nichts passt). */
  function eintragLink(eintrag, text) {
    if (!eintrag) { return document.createTextNode(text); }
    return h('a', {
      class: 'hb-link',
      href: '#/lexikon?id=' + encodeURIComponent(eintrag.id),
      title: eintrag.begriff + ' im Lexikon anzeigen'
    }, text);
  }

  /**
   * Text, in dem Begriffe aus dem Lexikon verlinkt sind — nur für kurze
   * Zellen/Listenpunkte, die selbst Begriffe sind («Auftraggeber*, Projektleiter»).
   */
  function begriffeText(text, verlinken) {
    var kinder = [];
    if (!verlinken || !HT.daten || !HT.daten.begriffeAufloesen) { return [document.createTextNode(text)]; }
    var teile = HT.daten.begriffeAufloesen(text);
    if (!teile.some(function (t) { return !!t.eintrag; })) { return [document.createTextNode(text)]; }
    teile.forEach(function (t) {
      if (t.trenner || !t.eintrag) { kinder.push(document.createTextNode(t.text)); return; }
      kinder.push(eintragLink(t.eintrag, t.text));
    });
    return kinder;
  }

  function listeElement(block, optionen) {
    var tag = block.t === 'ol' ? 'ol' : 'ul';
    var el = h(tag, { class: 'hb-liste' });
    (block.items || []).forEach(function (item) {
      var li = h('li', {});
      if (item.titel) {
        li.appendChild(h('b', { class: 'hb-li-titel' }, begriffeText(item.titel, optionen.verlinken)));
        li.appendChild(document.createTextNode(item.text ? ' ' : ''));
      }
      begriffeText(item.text || '', optionen.verlinken && (item.text || '').length < 90).forEach(function (k) { li.appendChild(k); });
      if (item.items && item.items.length) {
        li.appendChild(listeElement({ t: 'ul', items: item.items }, optionen));
      }
      el.appendChild(li);
    });
    return el;
  }

  function tabelleElement(block, optionen) {
    var tabelle = h('table', { class: 'hb-tabelle' });
    if (block.titel) { tabelle.appendChild(h('caption', { text: block.titel })); }
    var koerper = h('tbody');
    (block.zeilen || []).forEach(function (zeile) {
      var tr = h('tr');
      zeile.forEach(function (zelle) {
        var text = zelle.text || '';
        var istX = /^x$/i.test(text.trim());
        var td = h(zelle.kopf ? 'th' : 'td', {
          class: istX ? 'hb-x' : null,
          scope: zelle.kopf ? 'col' : null
        }, istX ? [h('span', { class: 'nur-sr', text: 'ja' }), h('span', { 'aria-hidden': 'true', text: '✓' })]
               : begriffeText(text, optionen.verlinken && !zelle.kopf && text.length < 120));
        tr.appendChild(td);
      });
      koerper.appendChild(tr);
    });
    tabelle.appendChild(koerper);
    return h('div', { class: 'hb-tabelle-wrap' }, tabelle);
  }

  function abbildungElement(block) {
    var bild = null;
    if (block.datei) {
      bild = h('img', { src: block.datei, alt: block.text || 'Abbildung aus dem HERMES-Referenzhandbuch', loading: 'lazy' });
    } else if (block.src) {
      bild = h('a', { href: block.src, target: '_blank', rel: 'noopener', class: 'btn btn--klein' },
        (block.text || 'Abbildung') + ' auf HERMES online ansehen ↗');
    }
    if (!bild) { return null; }
    return h('figure', { class: 'hb-abb' + (block.text ? '' : ' hb-abb--ohne') }, [
      bild,
      block.text ? h('figcaption', { text: block.text }) : null
    ]);
  }

  /**
   * Rendert eine Blockliste (p, ul/ol, tabelle, abb, h).
   * optionen.verlinken: Begriffe in Listen/Zellen auf das Lexikon verlinken.
   * optionen.ebene: HTML-Überschriftenebene für «h»-Blöcke (Standard 4).
   */
  function bloecke(liste, optionen) {
    optionen = optionen || {};
    var frag = document.createDocumentFragment();
    (liste || []).forEach(function (b) {
      if (!b || !b.t) { return; }
      var el = null;
      if (b.t === 'p') {
        el = h('p', { class: 'hb-p' }, begriffeText(b.text || '', optionen.verlinken && (b.text || '').length < 60));
      } else if (b.t === 'ul' || b.t === 'ol') {
        el = listeElement(b, optionen);
      } else if (b.t === 'tabelle') {
        el = tabelleElement(b, optionen);
      } else if (b.t === 'abb') {
        el = abbildungElement(b);
      } else if (b.t === 'h') {
        var n = Math.min(6, Math.max(2, (optionen.ebene || 4) + Math.max(0, (b.n || 2) - 2)));
        el = h('h' + n, { class: 'hb-h', text: b.text || '' });
      }
      if (el) { frag.appendChild(el); }
    });
    return frag;
  }

  /** Verweiszeile «Referenzhandbuch Kap. 5.4.3.34 · S. 140 · HERMES online ↗». */
  function handbuchVerweis(info, quelle) {
    var teile = [];
    if (info && info.nummer) {
      teile.push(h('span', { text: 'Referenzhandbuch Kap. ' + info.nummer + (info.seite ? ', S. ' + info.seite : '') }));
    } else if (info && info.seite) {
      teile.push(h('span', { text: 'Referenzhandbuch S. ' + info.seite }));
    }
    var url = (quelle && quelle.url) || (info && info.url);
    if (url) {
      teile.push(h('a', {
        href: url, target: '_blank', rel: 'noopener', class: 'hb-online',
        'aria-label': 'Diese Seite auf HERMES online öffnen (neuer Tab)'
      }, 'HERMES online ↗'));
    }
    if (!teile.length) { return null; }
    return h('p', { class: 'hb-verweis' }, teile);
  }

  /** Kleine Faktenzeile («Verantwortlich: Auftraggeber · Phasen: K R»). */
  function faktenChip(label, kinder, klasse) {
    return h('span', { class: 'fakt' + (klasse ? ' ' + klasse : '') }, [
      h('span', { class: 'fakt__label', text: label + ' ' }),
      h('span', { class: 'fakt__wert' }, kinder)
    ]);
  }

  HT.ui = {
    h: h,
    bloecke: bloecke,
    eintragLink: eintragLink,
    handbuchVerweis: handbuchVerweis,
    faktenChip: faktenChip,
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
