/* HERMES-Trainer — Ansicht «Lexikon».
   Volltextsuche, Kategoriefilter, aufklappbare Karten mit Quellenlink. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;
  var SEITE = 40;                 // Einträge je Nachladeschritt

  var zustand = {
    suche: '',
    filter: [],                   // leer = alle Kategorien
    offen: {},                    // id -> true
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

  function textBlock(label, text) {
    if (!text) { return null; }
    return h('div', { class: 'detail__block' }, [
      h('span', { class: 'detail__label', text: label }),
      h('p', { class: 'detail__text', text: text })
    ]);
  }

  function detailBereich(e) {
    var bloecke = [];

    bloecke.push(textBlock('Details', e.details));
    bloecke.push(textBlock('Abgrenzung', e.abgrenzung));

    if (e.verantwortlich) {
      bloecke.push(h('div', { class: 'detail__block' }, [
        h('span', { class: 'detail__label', text: 'Verantwortlich' }),
        h('ul', { class: 'werteliste' }, [h('li', {}, verweis(e.verantwortlich, 'rolle'))])
      ]));
    }
    bloecke.push(werteBlock('Beteiligt', e.beteiligt, 'rolle'));
    if (e.ebene) {
      bloecke.push(h('div', { class: 'detail__block' }, [
        h('span', { class: 'detail__label', text: 'Ebene' }),
        h('ul', { class: 'werteliste' }, [h('li', {}, h('span', { class: 'wert', text: e.ebene }))])
      ]));
    }
    bloecke.push(werteBlock('Phasen', e.phasen, 'phase'));
    bloecke.push(werteBlock('Module', e.module, 'modul'));
    bloecke.push(werteBlock('Szenarien', e.szenarien, 'szenario'));
    bloecke.push(werteBlock('Ergebnisse', e.ergebnisse, 'ergebnis'));

    if (e.meilensteine && e.meilensteine.length) {
      bloecke.push(h('div', { class: 'detail__block' }, [
        h('span', { class: 'detail__label', text: 'Meilensteine' }),
        h('ul', { class: 'meilenstein-liste' }, e.meilensteine.map(function (m) {
          return h('li', {}, [
            h('b', { text: m.name }),
            m.beschreibung ? h('span', { text: m.beschreibung }) : null
          ]);
        }))
      ]));
    }

    if (e.pruefungshinweis) {
      bloecke.push(h('div', { class: 'detail__block detail__block--hinweis' }, [
        h('span', { class: 'detail__label', text: 'Prüfungshinweis' }),
        h('p', { class: 'detail__text', text: e.pruefungshinweis })
      ]));
    }

    var vorhanden = bloecke.filter(function (b) { return !!b; });
    if (!vorhanden.length) {
      vorhanden.push(h('p', { class: 'detail__block detail__text', text: 'Keine weiteren Angaben hinterlegt.' }));
    }
    return h('div', { class: 'detail', id: 'detail-' + e.id }, vorhanden);
  }

  function karte(e) {
    var offen = !!zustand.offen[e.id];
    var detail = detailBereich(e);
    detail.hidden = !offen;

    var knopf = h('button', {
      type: 'button',
      class: 'aufklapp',
      'aria-expanded': offen ? 'true' : 'false',
      'aria-controls': 'detail-' + e.id
    }, [
      h('span', { class: 'aufklapp__pfeil', 'aria-hidden': 'true', text: '▶' }),
      h('span', { text: offen ? 'Weniger' : 'Mehr' })
    ]);

    knopf.addEventListener('click', function () {
      var jetztOffen = knopf.getAttribute('aria-expanded') !== 'true';
      knopf.setAttribute('aria-expanded', jetztOffen ? 'true' : 'false');
      knopf.lastChild.textContent = jetztOffen ? 'Weniger' : 'Mehr';
      detail.hidden = !jetztOffen;
      if (jetztOffen) { zustand.offen[e.id] = true; } else { delete zustand.offen[e.id]; }
    });

    var quelle = HT.ui.quellenLink(e.quelle);

    return h('article', {
      class: 'eintrag eintrag--' + e.kategorie,
      id: 'eintrag-' + e.id,
      dataset: { id: e.id }
    }, [
      h('div', { class: 'eintrag__kopf' }, [
        h('div', { class: 'eintrag__titelzeile' }, [
          h('h2', { class: 'eintrag__titel', text: e.begriff }),
          HT.ui.badge(e.kategorie)
        ]),
        h('p', {
          class: 'eintrag__def',
          text: e.definition || 'Keine Definition hinterlegt.'
        })
      ]),
      h('div', { class: 'eintrag__fuss' }, [
        knopf,
        quelle || h('span', { class: 'chip__zahl', text: 'Kein Quellenlink hinterlegt' })
      ]),
      detail
    ]);
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
        try { el.scrollIntoView({ block: 'center' }); } catch (err) { el.scrollIntoView(); }
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
    var liste = h('ul', { class: 'chips' });

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

  /* --- Persistenz der Filter ---------------------------------------------- */

  function speichern() {
    HT.store.schreib('lexikon', { suche: zustand.suche, filter: zustand.filter });
  }

  function wiederherstellen() {
    var g = HT.store.lies('lexikon', null);
    if (g && typeof g === 'object') {
      zustand.suche = typeof g.suche === 'string' ? g.suche : '';
      zustand.filter = Array.isArray(g.filter) ? g.filter.filter(function (k) {
        return !!HT.daten.kategorieMeta(k);
      }) : [];
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
    }
    if (params && params.q) {
      zustand.suche = params.q;
    }
    if (params && params.id) {
      /* Direktlink auf einen Eintrag: Filter offen lassen, Eintrag aufklappen. */
      var ziel = HT.daten.eintragMitId(params.id);
      if (ziel) {
        zustand.suche = '';
        zustand.filter = [];
        zustand.offen[ziel.id] = true;
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
      h('p', { text: 'Alle Methodenelemente von HERMES 2022 — jeder Eintrag verweist auf die offizielle Dokumentation.' })
    ]));

    var warnung = HT.app.datenWarnung();
    if (warnung) { behaelter.appendChild(warnung); }

    behaelter.appendChild(h('div', { class: 'suche' }, [feld, loeschen]));
    behaelter.appendChild(refs.chips);
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
