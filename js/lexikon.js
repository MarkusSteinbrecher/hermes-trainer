/* meinHERMES — Ansicht «Lexikon».
   Volltextsuche, Kategoriefilter und Karten in drei Stufen (siehe js/karte.js):
   Kurz (erster Satz + Fakten) → Kernpunkte (Definition, Querverweise)
   → Handbuch (vollständiger Text der
   offiziellen Dokumentation, bei Bedarf nachgeladen). */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;
  var SEITE = 40;                 // Einträge je Nachladeschritt

  var STUFEN = HT.karte.STUFEN;

  var zustand = {
    suche: '',
    filter: [],                   // leer = alle Kategorien
    standardStufe: 0,             // Stufe neuer Karten
    stufe: {},                    // id -> Stufe, wenn abweichend gewählt
    limit: SEITE
  };

  var refs = {};
  var suchTimer = null;

  /* --- Karte --------------------------------------------------------------- */

  function stufeVon(e) {
    return zustand.stufe.hasOwnProperty(e.id) ? zustand.stufe[e.id] : zustand.standardStufe;
  }

  /* Grundbegriffe kommen im Graphen nicht vor — dort führt der Knopf ins Leere. */
  function graphLink(e) {
    if (e.kategorie === 'grundbegriff') { return null; }
    return h('a', {
      class: 'btn btn--klein btn--graph',
      href: '#/ueberblick?sicht=graph&id=' + encodeURIComponent(e.id),
      title: e.kategorie === 'phase' || e.kategorie === 'modul' || e.kategorie === 'szenario'
        ? 'Aufgaben, Ergebnisse und Rollen dazu im Graph zeigen'
        : 'Zusammenhänge dieses Elements im Graph anzeigen'
    }, [h('span', { 'aria-hidden': 'true', text: '◎ ' }), 'Im Graph']);
  }

  function karte(e) {
    return HT.karte.bauen(e, {
      stufe: stufeVon(e),
      beiStufe: function (id, stufe) { zustand.stufe[id] = stufe; },
      zusatz: graphLink(e)
    });
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
        key ? HT.ui.katSymbol(key, 15) : null,
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
