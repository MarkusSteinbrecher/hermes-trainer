/* HERMES-Trainer — Ansicht «Lexikon».
   Volltextsuche, Kategoriefilter und Karten in drei Stufen:
   Kurz (erster Satz + Fakten) → Kernpunkte (Definition, Abgrenzung,
   Prüfungshinweis, Querverweise) → Handbuch (vollständiger Text der
   offiziellen Dokumentation, bei Bedarf nachgeladen). */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;
  var SEITE = 40;                 // Einträge je Nachladeschritt

  var STUFEN = [
    { wert: 0, label: 'Kurz',       titel: 'Nur das Wichtigste: erster Satz und Fakten' },
    { wert: 1, label: 'Kernpunkte', titel: 'Definition, Abgrenzung, Prüfungshinweis und Querverweise' },
    { wert: 2, label: 'Handbuch',   titel: 'Vollständiger Text aus dem Referenzhandbuch' }
  ];

  /* Handbuch Kap. 3.2.1: Module, die zur Einhaltung der Projekt-Governance
     zwingend in jedem Projekt vorkommen. */
  var ZWINGENDE_MODULE = ['Projektsteuerung', 'Projektführung', 'Projektgrundlagen', 'Einführungsorganisation'];

  var zustand = {
    suche: '',
    filter: [],                   // leer = alle Kategorien
    standardStufe: 0,             // Stufe neuer Karten
    stufe: {},                    // id -> Stufe, wenn abweichend gewählt
    limit: SEITE
  };

  var refs = {};
  var suchTimer = null;

  /* --- Querverweis: exakter Begriffs-String -> Lexikonlink ---------------- */
  function verweis(begriff, bevorzugteKategorie) {
    var ziel = HT.daten.eintragMitBegriff(begriff, bevorzugteKategorie)
      || HT.daten.eintragMitBegriff(begriff);
    if (!ziel) {
      return h('span', { class: 'wert', text: begriff });
    }
    return h('a', {
      class: 'wert',
      href: '#/lexikon?id=' + encodeURIComponent(ziel.id),
      title: 'Im Lexikon anzeigen'
    }, begriff);
  }

  function werteBlock(label, werte, bevorzugteKategorie) {
    if (!werte || !werte.length) { return null; }
    return h('div', { class: 'detail__block' }, [
      h('span', { class: 'detail__label', text: label }),
      h('ul', { class: 'werteliste' }, werte.map(function (w) {
        return h('li', {}, verweis(String(w), bevorzugteKategorie));
      }))
    ]);
  }

  function textBlock(label, text, klasse) {
    if (!text) { return null; }
    return h('div', { class: 'detail__block' + (klasse ? ' ' + klasse : '') }, [
      h('span', { class: 'detail__label', text: label }),
      h('p', { class: 'detail__text', text: text })
    ]);
  }

  /* --- Stufe 0: Faktenzeile ------------------------------------------------ */

  function phasenStreifen(phasen) {
    if (!phasen || !phasen.length) { return null; }
    var aktiv = {};
    phasen.forEach(function (p) { aktiv[HT.daten.normalisieren(p)] = true; });
    var alle = HT.daten.phasenKurz;
    var kinder = alle.map(function (p) {
      var ist = !!aktiv[HT.daten.normalisieren(p[0])];
      return h('span', {
        class: 'phasenstreifen__feld' + (ist ? ' ist-aktiv' : ''),
        title: p[0] + (ist ? '' : ' (nicht betroffen)'),
        'aria-hidden': 'true',
        text: p[1]
      });
    });
    var namen = HT.daten.phasenSortiert(phasen).join(', ');
    return HT.ui.faktenChip('Phasen', [
      h('span', { class: 'phasenstreifen', role: 'img', 'aria-label': namen }, kinder)
    ]);
  }

  function rollenChip(label, name) {
    if (!name) { return null; }
    var ziel = HT.daten.eintragMitBegriff(name, 'rolle');
    return HT.ui.faktenChip(label, [ziel ? HT.ui.eintragLink(ziel, name) : document.createTextNode(name)]);
  }

  function listenChip(label, werte, kategorie, max) {
    if (!werte || !werte.length) { return null; }
    var kinder = [];
    werte.slice(0, max).forEach(function (w, i) {
      if (i) { kinder.push(document.createTextNode(', ')); }
      var ziel = HT.daten.eintragMitBegriff(w, kategorie);
      kinder.push(ziel ? HT.ui.eintragLink(ziel, w) : document.createTextNode(w));
    });
    if (werte.length > max) {
      kinder.push(document.createTextNode(' +' + (werte.length - max)));
    }
    return HT.ui.faktenChip(label, kinder);
  }

  function markerChip(text, titel) {
    return h('span', { class: 'fakt fakt--marker', title: titel || null, text: text });
  }

  function fakten(e) {
    var chips = [];
    var istZwingend = e.kategorie === 'modul' && ZWINGENDE_MODULE.indexOf(e.begriff) !== -1;

    if (e.kategorie === 'ergebnis') {
      if (e.typ) { chips.push(HT.ui.faktenChip('Typ', [document.createTextNode(e.typ)])); }
      if (e.minimalGefordert && e.typ === 'Dokument') {
        chips.push(markerChip('minimal gefordert', 'Minimal gefordertes Dokument (Tabelle 16 des Referenzhandbuchs)'));
      }
    }
    if (istZwingend) {
      chips.push(markerChip('zwingend in jedem Projekt', 'Eines der vier Module, die zur Einhaltung der Projekt-Governance zwingend vorkommen müssen'));
    }
    if (e.kategorie === 'rolle' && e.ebene) {
      chips.push(HT.ui.faktenChip('Hierarchieebene', [document.createTextNode(e.ebene)]));
    }
    if (e.verantwortlich && (e.kategorie === 'aufgabe' || e.kategorie === 'ergebnis')) {
      chips.push(rollenChip('Verantwortlich', e.verantwortlich));
    }
    if (e.kategorie === 'aufgabe' || e.kategorie === 'ergebnis') {
      chips.push(listenChip(e.module.length === 1 ? 'Modul' : 'Module', e.module, 'modul', 2));
    }
    if (e.kategorie !== 'phase' && e.kategorie !== 'grundbegriff') {
      chips.push(phasenStreifen(e.phasen));
    }
    if (e.kategorie === 'szenario') {
      chips.push(HT.ui.faktenChip('Module', [document.createTextNode(String(e.module.length))]));
    }
    if (e.kategorie === 'phase' && e.meilensteine.length) {
      chips.push(listenChip('Meilensteine', e.meilensteine.map(function (m) {
        return m.name.replace(/^Meilenstein\s+/i, '');
      }), 'ergebnis', 3));
    }

    var vorhanden = chips.filter(function (c) { return !!c; });
    if (!vorhanden.length) { return null; }
    return h('div', { class: 'fakten' }, vorhanden);
  }

  /* --- Stufe 1: Kernpunkte ------------------------------------------------- */

  function kernpunkte(e) {
    var bloecke = [];

    if (e.definition && e.definition !== e.kurz) {
      bloecke.push(textBlock('Definition', e.definition));
    }
    bloecke.push(textBlock('Abgrenzung', e.abgrenzung));

    if (e.verantwortlich) {
      bloecke.push(h('div', { class: 'detail__block' }, [
        h('span', { class: 'detail__label', text: 'Verantwortlich' }),
        h('ul', { class: 'werteliste' }, [h('li', {}, verweis(e.verantwortlich, 'rolle'))])
      ]));
    }
    bloecke.push(werteBlock('Beteiligt', e.beteiligt, 'rolle'));
    if (e.ebene && e.kategorie !== 'rolle') {
      bloecke.push(h('div', { class: 'detail__block' }, [
        h('span', { class: 'detail__label', text: 'Ebene' }),
        h('ul', { class: 'werteliste' }, [h('li', {}, h('span', { class: 'wert', text: e.ebene }))])
      ]));
    }
    bloecke.push(werteBlock('Phasen', HT.daten.phasenSortiert(e.phasen), 'phase'));
    bloecke.push(werteBlock('Module', e.module, 'modul'));
    bloecke.push(werteBlock('Szenarien', e.szenarien, 'szenario'));
    bloecke.push(werteBlock('Ergebnisse', e.ergebnisse, 'ergebnis'));

    if (e.meilensteine && e.meilensteine.length) {
      bloecke.push(h('div', { class: 'detail__block' }, [
        h('span', { class: 'detail__label', text: 'Meilensteine' }),
        h('ul', { class: 'meilenstein-liste' }, e.meilensteine.map(function (m) {
          var ziel = HT.daten.eintragMitBegriff(m.name, 'ergebnis');
          return h('li', {}, [
            h('b', {}, ziel ? HT.ui.eintragLink(ziel, m.name) : document.createTextNode(m.name)),
            m.beschreibung ? h('span', { text: m.beschreibung }) : null
          ]);
        }))
      ]));
    }

    if (e.pruefungshinweis) {
      bloecke.push(textBlock('Prüfungshinweis', e.pruefungshinweis, 'detail__block--hinweis'));
    }

    var vorhanden = bloecke.filter(function (b) { return !!b; });
    if (!vorhanden.length) {
      vorhanden.push(h('p', { class: 'detail__block detail__text', text: 'Keine weiteren Angaben hinterlegt.' }));
    }
    return vorhanden;
  }

  /* --- Stufe 2: Handbuchtext ---------------------------------------------- */

  /* Kapitel, zu dem ein Grundbegriff gehört — aus dem Pfad seiner Quelle. */
  var HINWEIS_TEILE = {
    'governance': '7.4.1', 'nachhaltigkeit': '7.4.2',
    'projektmanagement-und-entwicklungsmanagement': '7.4.3',
    'finanzielle-steuerung-und-fuehrung': '7.4.4', 'planung': '7.4.5',
    'realisierungseinheiten-bei-klassischer-vorgehensweise': '7.4.6',
    'anwendung-mit-anderen-methoden-und-praktiken': '7.4.7',
    'integration-von-hermes-in-die-stammorganisation': '7.4.8'
  };

  /* Rückgabe: Query-String für die Methode-Ansicht («kapitel=…[&teil=…]») oder null. */
  function kapitelAusUrl(url) {
    var m = /\/de\/projektmanagement\/([a-z-]+)(?:\/([a-z-]+))?/.exec(url || '');
    if (!m) { return null; }
    var teil = m[1];
    if (teil === 'hinweise-zur-anwendung') {
      var nr = m[2] ? HINWEIS_TEILE[m[2]] : null;
      return 'kapitel=hinweise' + (nr ? '&teil=' + encodeURIComponent(nr) : '');
    }
    if (['methodenueberblick', 'phasen', 'szenarien', 'module', 'ergebnisse', 'aufgaben', 'rollen'].indexOf(teil) !== -1) {
      return 'kapitel=' + teil;
    }
    return null;
  }

  /* Die kuratierten Details tragen Absätze mit Voranstellung wie
     «Grundidee:» — daraus werden beschriftete Blöcke. */
  function detailsAlsBloecke(text) {
    var absaetze = String(text || '').split(/\n\s*\n/);
    return absaetze.map(function (abs) {
      var t = abs.trim();
      if (!t) { return null; }
      var m = /^([A-ZÄÖÜ][^:\n]{2,60}):\s*([\s\S]*)$/.exec(t);
      if (m && m[2]) {
        return h('div', { class: 'detail__block' }, [
          h('span', { class: 'detail__label', text: m[1] }),
          h('p', { class: 'detail__text', text: m[2] })
        ]);
      }
      return h('p', { class: 'detail__text detail__block', text: t });
    }).filter(function (x) { return !!x; });
  }

  function handbuchFallback(e) {
    var kinder = [];
    if (e.details) {
      kinder.push(h('p', { class: 'hb-verweis', text: 'Ausführliche Beschreibung (kuratiert nach der offiziellen Dokumentation)' }));
      kinder = kinder.concat(detailsAlsBloecke(e.details));
    }
    var kap = kapitelAusUrl(e.quelle && e.quelle.url);
    if (kap) {
      kinder.push(h('p', { class: 'detail__block' }, h('a', {
        class: 'btn btn--klein',
        href: '#/methode?' + kap,
        text: 'Zum Handbuchkapitel in der Methode'
      })));
    }
    if (HT.ui.quellenLink(e.quelle)) {
      kinder.push(h('p', { class: 'detail__block' }, HT.ui.quellenLink(e.quelle)));
    }
    if (!kinder.length) {
      kinder.push(h('p', { class: 'detail__text', text: 'Für diesen Eintrag liegt kein Handbuchtext vor.' }));
    }
    return kinder;
  }

  function handbuchFuellen(e, behaelter) {
    if (behaelter.dataset.geladen) { return; }
    behaelter.dataset.geladen = '1';
    HT.ui.leeren(behaelter);
    behaelter.appendChild(h('p', { class: 'trefferzahl', text: 'Handbuchtext wird geladen …' }));

    HT.daten.handbuchElement(e).then(function (text) {
      HT.ui.leeren(behaelter);
      if (!text) {
        handbuchFallback(e).forEach(function (k) { behaelter.appendChild(k); });
        return;
      }
      var verweisEl = HT.ui.handbuchVerweis(text, e.quelle);
      if (verweisEl) { behaelter.appendChild(verweisEl); }

      (text.abschnitte || []).forEach(function (a) {
        if (!a.bloecke || !a.bloecke.length) { return; }
        var abschnitt = h('section', { class: 'hb-abschnitt' });
        if (a.titel) { abschnitt.appendChild(h('h3', { class: 'hb-titel', text: a.titel })); }
        abschnitt.appendChild(HT.ui.bloecke(a.bloecke, { verlinken: true, ebene: 4 }));
        behaelter.appendChild(abschnitt);
      });

      if (e.pruefungshinweis) {
        behaelter.appendChild(textBlock('Prüfungshinweis', e.pruefungshinweis, 'detail__block--hinweis'));
      }
    }).catch(function () {
      HT.ui.leeren(behaelter);
      handbuchFallback(e).forEach(function (k) { behaelter.appendChild(k); });
    });
  }

  /* --- Karte --------------------------------------------------------------- */

  function stufeVon(e) {
    return zustand.stufe.hasOwnProperty(e.id) ? zustand.stufe[e.id] : zustand.standardStufe;
  }

  function karte(e) {
    var kern = h('div', { class: 'detail detail--kern', id: 'kern-' + e.id }, kernpunkte(e));
    var handbuch = h('div', { class: 'detail detail--handbuch', id: 'handbuch-' + e.id });
    var knoepfe = [];

    function anwenden(stufe) {
      kern.hidden = stufe < 1;
      handbuch.hidden = stufe < 2;
      knoepfe.forEach(function (b, i) {
        b.setAttribute('aria-pressed', i === stufe ? 'true' : 'false');
      });
      if (stufe >= 2) { handbuchFuellen(e, handbuch); }
    }

    STUFEN.forEach(function (s) {
      var b = h('button', {
        type: 'button', class: 'stufe', 'aria-pressed': 'false',
        title: s.titel, text: s.label,
        'aria-controls': 'kern-' + e.id + ' handbuch-' + e.id
      });
      b.addEventListener('click', function () {
        zustand.stufe[e.id] = s.wert;
        anwenden(s.wert);
      });
      knoepfe.push(b);
    });

    var stufen = h('div', { class: 'stufen', role: 'group', 'aria-label': 'Detailtiefe für ' + e.begriff }, knoepfe);
    var quelle = HT.ui.quellenLink(e.quelle);

    var artikel = h('article', {
      class: 'eintrag eintrag--' + e.kategorie,
      id: 'eintrag-' + e.id,
      dataset: { id: e.id }
    }, [
      h('div', { class: 'eintrag__kopf' }, [
        h('div', { class: 'eintrag__titelzeile' }, [
          h('h2', { class: 'eintrag__titel', text: e.begriff }),
          HT.ui.badge(e.kategorie)
        ]),
        h('p', { class: 'eintrag__def', text: e.kurz || e.definition || 'Keine Definition hinterlegt.' }),
        fakten(e)
      ]),
      h('div', { class: 'eintrag__fuss' }, [
        stufen,
        quelle || h('span', { class: 'chip__zahl', text: 'Kein Quellenlink hinterlegt' })
      ]),
      kern,
      handbuch
    ]);

    anwenden(stufeVon(e));
    return artikel;
  }

  /* --- Liste aktualisieren ------------------------------------------------ */

  function listeAktualisieren(scrollZuId) {
    var treffer = HT.daten.suchen(zustand.suche, zustand.filter);

    /* Direktlink: so weit nachladen, bis der gesuchte Eintrag sichtbar ist. */
    if (scrollZuId) {
      for (var p = 0; p < treffer.length; p++) {
        if (treffer[p].id === scrollZuId && p >= zustand.limit) {
          zustand.limit = Math.ceil((p + 1) / SEITE) * SEITE;
          break;
        }
      }
    }

    var sichtbar = treffer.slice(0, zustand.limit);

    HT.ui.leeren(refs.liste);

    if (!treffer.length) {
      refs.zahl.textContent = '';
      if (!HT.daten.alleEintraege().length) {
        refs.liste.appendChild(HT.ui.leerZustand(
          'Noch keine Inhalte vorhanden',
          'Die Datendateien in data/ sind derzeit leer. Sobald Einträge erfasst sind, erscheinen sie hier.'
        ));
      } else {
        refs.liste.appendChild(HT.ui.leerZustand(
          'Keine Treffer',
          'Suchbegriff anpassen oder Filter zurücksetzen.',
          h('button', {
            type: 'button', class: 'btn btn--klein', text: 'Filter zurücksetzen',
            on: { click: function () {
              zustand.suche = '';
              zustand.filter = [];
              refs.feld.value = '';
              chipsAktualisieren();
              zustand.limit = SEITE;
              speichern();
              listeAktualisieren();
              refs.feld.focus();
            } }
          })
        ));
      }
      return;
    }

    refs.zahl.textContent = treffer.length === 1
      ? '1 Eintrag'
      : treffer.length + ' Einträge' + (sichtbar.length < treffer.length ? ' · ' + sichtbar.length + ' angezeigt' : '');

    var fragment = document.createDocumentFragment();
    sichtbar.forEach(function (e) { fragment.appendChild(karte(e)); });
    refs.liste.appendChild(fragment);

    if (sichtbar.length < treffer.length) {
      refs.liste.appendChild(h('div', { class: 'mehr-laden' }, [
        h('button', {
          type: 'button',
          class: 'btn',
          text: 'Weitere ' + Math.min(SEITE, treffer.length - sichtbar.length) + ' anzeigen',
          on: { click: function () {
            zustand.limit += SEITE;
            listeAktualisieren();
          } }
        })
      ]));
    }

    if (scrollZuId) {
      var el = refs.liste.querySelector('#eintrag-' + cssId(scrollZuId));
      if (el) {
        el.classList.add('ist-hervorgehoben');
        try { el.scrollIntoView({ block: 'start' }); } catch (err) { el.scrollIntoView(); }
      }
    }
  }

  function cssId(id) {
    if (global.CSS && typeof global.CSS.escape === 'function') { return global.CSS.escape(id); }
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  /* --- Filter-Chips ------------------------------------------------------- */

  function chipsAktualisieren() {
    if (!refs.chips) { return; }
    var knoepfe = refs.chips.querySelectorAll('[data-kat]');
    for (var i = 0; i < knoepfe.length; i++) {
      var kat = knoepfe[i].dataset.kat;
      var aktiv = kat === '' ? zustand.filter.length === 0 : zustand.filter.indexOf(kat) !== -1;
      knoepfe[i].setAttribute('aria-pressed', aktiv ? 'true' : 'false');
    }
  }

  function chipsBauen() {
    var liste = h('ul', { class: 'chips chips--streifen', 'aria-label': 'Kategorien filtern' });

    function chip(key, label, anzahl) {
      var btn = h('button', {
        type: 'button',
        class: 'chip',
        'aria-pressed': 'false',
        dataset: { kat: key }
      }, [
        h('span', { text: label }),
        anzahl === null ? null : h('span', { class: 'chip__zahl', text: String(anzahl) })
      ]);
      btn.addEventListener('click', function () {
        if (key === '') {
          zustand.filter = [];
        } else {
          var i = zustand.filter.indexOf(key);
          if (i === -1) { zustand.filter.push(key); } else { zustand.filter.splice(i, 1); }
        }
        zustand.limit = SEITE;
        speichern();
        chipsAktualisieren();
        listeAktualisieren();
      });
      liste.appendChild(h('li', {}, btn));
      return btn;
    }

    chip('', 'Alle', HT.daten.alleEintraege().length);
    HT.daten.kategorien().forEach(function (kat) {
      var anzahl = HT.daten.eintraegeDerKategorie(kat.key).length;
      if (!anzahl) { return; }
      chip(kat.key, kat.label, anzahl);
    });

    return liste;
  }

  /* --- Standard-Detailtiefe ------------------------------------------------ */

  function stufenwahlBauen() {
    var knoepfe = [];
    function markieren() {
      knoepfe.forEach(function (b) {
        b.setAttribute('aria-pressed', Number(b.dataset.wert) === zustand.standardStufe ? 'true' : 'false');
      });
    }
    STUFEN.forEach(function (s) {
      var b = h('button', {
        type: 'button', class: 'chip', 'aria-pressed': 'false',
        dataset: { wert: String(s.wert) }, title: s.titel, text: s.label
      });
      b.addEventListener('click', function () {
        zustand.standardStufe = s.wert;
        zustand.stufe = {};
        markieren();
        speichern();
        listeAktualisieren();
      });
      knoepfe.push(b);
    });
    markieren();
    return h('div', { class: 'stufenwahl' }, [
      h('span', { class: 'stufenwahl__label', text: 'Ansicht' }),
      h('ul', { class: 'chips', role: 'group', 'aria-label': 'Detailtiefe aller Einträge' },
        knoepfe.map(function (b) { return h('li', {}, b); }))
    ]);
  }

  /* --- Persistenz der Filter ---------------------------------------------- */

  function speichern() {
    HT.store.schreib('lexikon', { suche: zustand.suche, filter: zustand.filter, stufe: zustand.standardStufe });
  }

  function wiederherstellen() {
    var g = HT.store.lies('lexikon', null);
    if (g && typeof g === 'object') {
      zustand.suche = typeof g.suche === 'string' ? g.suche : '';
      zustand.filter = Array.isArray(g.filter) ? g.filter.filter(function (k) {
        return !!HT.daten.kategorieMeta(k);
      }) : [];
      if ([0, 1, 2].indexOf(g.stufe) !== -1) { zustand.standardStufe = g.stufe; }
    }
  }

  /* --- Render ------------------------------------------------------------- */

  function render(behaelter, params) {
    if (!zustand.initialisiert) {
      wiederherstellen();
      zustand.initialisiert = true;
    }

    if (params && params.kat && HT.daten.kategorieMeta(params.kat)) {
      zustand.filter = [params.kat];
      zustand.suche = '';
    }
    if (params && typeof params.q === 'string') {
      zustand.suche = params.q;
    }
    if (params && params.id) {
      /* Direktlink auf einen Eintrag: Filter offen lassen, Kernpunkte zeigen. */
      var ziel = HT.daten.eintragMitId(params.id);
      if (ziel) {
        zustand.suche = '';
        zustand.filter = [];
        zustand.stufe[ziel.id] = Math.max(1, stufeVon(ziel));
        zustand.limit = Math.max(zustand.limit, SEITE);
      }
    }

    var feld = h('input', {
      type: 'search',
      class: 'suche__feld',
      id: 'lexikon-suche',
      placeholder: 'Begriff, Definition oder Stichwort …',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      'aria-label': 'Lexikon durchsuchen'
    });
    feld.value = zustand.suche;

    var loeschen = h('button', {
      type: 'button',
      class: 'suche__loeschen',
      'aria-label': 'Suche löschen',
      text: '✕'
    });
    loeschen.addEventListener('click', function () {
      zustand.suche = '';
      feld.value = '';
      zustand.limit = SEITE;
      speichern();
      listeAktualisieren();
      feld.focus();
    });

    feld.addEventListener('input', function () {
      zustand.suche = feld.value;
      zustand.limit = SEITE;
      if (suchTimer) { clearTimeout(suchTimer); }
      suchTimer = setTimeout(function () {
        speichern();
        listeAktualisieren();
      }, 140);
    });

    refs.feld = feld;
    refs.chips = chipsBauen();
    refs.zahl = h('p', { class: 'trefferzahl', role: 'status' });
    refs.liste = h('div', { class: 'eintraege' });

    behaelter.appendChild(h('div', { class: 'kopf' }, [
      h('h1', { text: 'Lexikon' }),
      h('p', { text: 'Alle Methodenelemente von HERMES 2022 in drei Stufen: Kurzfassung, Kernpunkte und der vollständige Handbuchtext — jeder Eintrag verweist auf die offizielle Dokumentation.' })
    ]));

    var warnung = HT.app.datenWarnung();
    if (warnung) { behaelter.appendChild(warnung); }

    behaelter.appendChild(h('div', { class: 'suche' }, [feld, loeschen]));
    behaelter.appendChild(refs.chips);
    behaelter.appendChild(stufenwahlBauen());
    behaelter.appendChild(refs.zahl);
    behaelter.appendChild(refs.liste);

    chipsAktualisieren();
    listeAktualisieren(params && params.id ? params.id : null);
  }

  HT.views.lexikon = {
    titel: 'Lexikon',
    render: render
  };
}(window));
