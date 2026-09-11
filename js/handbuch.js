/* meinHERMES — Ansicht «Handbuch».
   Das Referenzhandbuch Projektmanagement (PDF, Ausgabe 2022) 1:1 als Text
   in seiner Gliederung: Vorwort · A Methodenüberblick · B Methodenelemente ·
   1 Phasen · 2 Szenarien · 3 Module · 4 Ergebnisse · 5 Aufgaben · 6 Rollen ·
   7 Hinweise zur Anwendung · Vokabular. Die Daten kommen aus
   data/handbuch/rhb/ (tools/rhb-import.py); jeder Abschnitt trägt Nummer und
   Seite des PDF, Seitenzahlen sind Links auf die Seite im PDF. Abschnitte, die
   ein Element beschreiben (4.4.1.1 Abnahmeprotokoll), stehen als Karte mit
   Faktenzeile, Link auf HERMES online und ins PDF (siehe js/karte.js).
   Gesucht wird in der Kopfzeile der Anwendung; die Seite hat kein Suchfeld. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;

  /* Kapitel in Handbuchreihenfolge — dieselbe Liste wie im Import; index.json
     liefert Seiten und Inhaltsverzeichnis. */
  var KAPITEL = [
    { id: 'vorwort', nummer: '', titel: 'Vorwort', kategorie: null },
    { id: 'methodenueberblick', nummer: 'A', titel: 'Methodenüberblick', kategorie: null },
    { id: 'methodenelemente', nummer: 'B', titel: 'Methodenelemente', kategorie: null },
    { id: 'phasen', nummer: '1', titel: 'Phasen', kategorie: 'phase' },
    { id: 'szenarien', nummer: '2', titel: 'Szenarien', kategorie: 'szenario' },
    { id: 'module', nummer: '3', titel: 'Module', kategorie: 'modul' },
    { id: 'ergebnisse', nummer: '4', titel: 'Ergebnisse', kategorie: 'ergebnis' },
    { id: 'aufgaben', nummer: '5', titel: 'Aufgaben', kategorie: 'aufgabe' },
    { id: 'rollen', nummer: '6', titel: 'Rollen', kategorie: 'rolle' },
    { id: 'hinweise', nummer: '7', titel: 'Hinweise zur Anwendung', kategorie: null },
    { id: 'vokabular', nummer: '', titel: 'Vokabular', kategorie: null }
  ];

  var zustand = {
    kapitel: 'methodenueberblick',  // zuletzt gelesenes Kapitel
    initialisiert: false
  };

  function kapitelMeta(id) {
    for (var i = 0; i < KAPITEL.length; i++) { if (KAPITEL[i].id === id) { return KAPITEL[i]; } }
    return null;
  }

  function kapitelDerKategorie(kat) {
    for (var i = 0; i < KAPITEL.length; i++) { if (KAPITEL[i].kategorie === kat) { return KAPITEL[i]; } }
    return null;
  }

  function kapitelAdresse(id, teil) {
    return '#/handbuch?kapitel=' + encodeURIComponent(id) + (teil ? '&teil=' + encodeURIComponent(teil) : '');
  }

  /* Ort für Markierungen (js/markieren.js). Kapitel B hiess früher Teil B des
     Methodenüberblicks — der alte Ort bleibt, damit Markierungen dort bleiben. */
  function markOrt(meta, teil) {
    if (meta.id === 'methodenelemente') { return kapitelAdresse('methodenueberblick', 'B'); }
    return kapitelAdresse(meta.id, teil || meta.nummer || meta.id);
  }

  function cssId(id) {
    if (global.CSS && typeof global.CSS.escape === 'function') { return global.CSS.escape(id); }
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function ankerId(a, index) {
    return a.nummer ? 'hb-' + a.nummer : 'hb-t' + index;
  }

  /* --- Persistenz ---------------------------------------------------------- */

  function speichern() {
    HT.store.schreib('handbuch', { kapitel: zustand.kapitel });
  }

  function wiederherstellen() {
    var g = HT.store.lies('handbuch', null);
    if (g && typeof g === 'object') {
      if (kapitelMeta(g.kapitel)) { zustand.kapitel = g.kapitel; }
    }
  }

  /* --- PDF-Verweise -------------------------------------------------------- */

  var quelle = null;   // aus index.json: { pdf, online, ausgabe, ... }

  function pdfSeite(seite) {
    return quelle && quelle.pdf && seite ? quelle.pdf + '#page=' + seite : null;
  }

  /* «S. 50» — als Link auf die Seite im PDF, wenn das PDF bekannt ist. */
  function seiteElement(seite) {
    if (!seite) { return null; }
    var url = pdfSeite(seite);
    if (!url) { return h('span', { class: 'hb-seite', text: ' S. ' + seite }); }
    return h('a', {
      class: 'hb-seite', href: url, target: '_blank', rel: 'noopener',
      title: 'Seite ' + seite + ' im Referenzhandbuch (PDF, neuer Tab)'
    }, ' S. ' + seite);
  }

  /* --- Kapitel-Chips ------------------------------------------------------- */

  function chipsBauen(aktiv) {
    var liste = h('ul', { class: 'chips chips--streifen hb-kapitel', 'aria-label': 'Kapitel' });
    KAPITEL.forEach(function (k) {
      var anzahl = k.kategorie ? HT.daten.eintraegeDerKategorie(k.kategorie).length : 0;
      liste.appendChild(h('li', {}, h('button', {
        type: 'button', class: 'chip', 'aria-pressed': k === aktiv ? 'true' : 'false',
        title: (k.nummer ? 'Kapitel ' + k.nummer + ' ' : '') + k.titel,
        on: { click: function () { global.location.hash = kapitelAdresse(k.id); } }
      }, [
        k.nummer ? h('span', { class: 'hb-kapitel__nr', text: k.nummer }) : null,
        h('span', { text: k.titel }),
        anzahl ? h('span', { class: 'chip__zahl', text: String(anzahl) }) : null
      ])));
    });
    return liste;
  }

  /* --- Karten -------------------------------------------------------------- */

  function graphLink(e) {
    return h('a', {
      class: 'btn btn--klein btn--graph',
      href: '#/ueberblick?sicht=graph&id=' + encodeURIComponent(e.id),
      title: e.kategorie === 'phase' || e.kategorie === 'modul' || e.kategorie === 'szenario'
        ? 'Aufgaben, Ergebnisse und Rollen dazu im Graph zeigen'
        : 'Zusammenhänge dieses Elements im Graph anzeigen'
    }, [h('span', { 'aria-hidden': 'true', text: '◎ ' }), 'Im Graph']);
  }

  /* Karte eines Elements mit dem Text seines Abschnitts im PDF. */
  function karte(e, a) {
    return HT.karte.bauen(e, {
      nurHandbuch: true,
      bloecke: a.bloecke || [],
      zusatz: graphLink(e),
      titelEbene: a.ebene <= 3 ? 'h3' : 'h4',
      nummer: a.nummer || null,
      seite: a.seite || null,
      pdf: quelle && quelle.pdf ? { url: quelle.pdf, seite: a.seite } : null
    });
  }

  /* --- Kapiteltext in Handbuchgliederung ------------------------------------ */

  function titelKinder(a) {
    return [
      a.nummer ? h('span', { class: 'hb-nr', text: a.nummer + ' ' }) : null,
      a.titel,
      seiteElement(a.seite)
    ];
  }

  function verweisZeile(a, mitKapitel) {
    var teile = [];
    if (mitKapitel) {
      teile.push(h('span', { text: 'Referenzhandbuch' + (a.nummer ? ' Kap. ' + a.nummer : '') + (a.seite ? ', S. ' + a.seite : '') }));
    }
    if (a.url) {
      teile.push(h('a', {
        href: a.url, target: '_blank', rel: 'noopener', class: 'hb-online',
        'aria-label': 'Diesen Abschnitt auf HERMES online öffnen (neuer Tab)'
      }, 'HERMES online ↗'));
    }
    var pdf = pdfSeite(a.seite);
    if (pdf) {
      teile.push(h('a', {
        href: pdf, target: '_blank', rel: 'noopener', class: 'hb-online hb-pdf',
        'aria-label': 'Seite ' + a.seite + ' im Referenzhandbuch als PDF öffnen (neuer Tab)'
      }, 'PDF ↗'));
    }
    if (!teile.length) { return null; }
    return h('p', { class: 'hb-verweis' }, teile);
  }

  /* Ein Abschnitt: Titel seiner Ebene und seine Blöcke — oder die Karte, wenn
     er ein Element beschreibt. */
  function abschnittElement(a, index, meta) {
    var e = a.element ? HT.daten.eintragMitId(a.element) : null;
    if (e) {
      return h('div', { class: 'eintraege hb-karten hb-karten--einzeln', id: ankerId(a, index) }, karte(e, a));
    }
    var ebene = Math.min(6, Math.max(2, a.ebene || 2));
    var kinder = [];
    if (a.ebene === 1) {
      /* Kapiteltitel steht im Kapitelkopf; weitere Ebene-1-Titel (Impressum,
         Prolog) als Teiltitel. */
      if (index > 0 || !meta.nummer && a.titel !== meta.titel) {
        kinder.push(h('h2', { class: 'hb-teil__titel', id: ankerId(a, index) }, titelKinder(a)));
      }
    } else {
      kinder.push(h('h' + ebene, { class: 'hb-titel hb-titel--' + ebene, id: ankerId(a, index) }, titelKinder(a)));
      if (a.url) {
        var verweis = verweisZeile(a, false);
        if (verweis) { kinder.push(verweis); }
      }
    }
    if (a.bloecke && a.bloecke.length) {
      kinder.push(HT.ui.bloecke(a.bloecke, { verlinken: true, ebene: ebene + 1 }));
    }
    return h('section', { class: 'hb-abschnitt' + (a.ebene === 1 && index > 0 ? ' hb-abschnitt--teil' : '') }, kinder);
  }

  /* Der Kapiteltext als ein Ort für Markierungen; Abschnitte mit eigener
     Online-Seite (7.4.1 Governance …) sind eigene Orte — wie bisher. */
  function kapitelKoerper(kap, meta) {
    var wurzel = h('section', { class: 'hb-teil', id: 'teil-' + (meta.nummer || meta.id), dataset: { markOrt: markOrt(meta) } });
    var ziel = wurzel;
    var abschnitte = kap.abschnitte || [];
    var offenEbene = 0;
    abschnitte.forEach(function (a, i) {
      if (ziel !== wurzel && (a.ebene || 2) <= offenEbene) { ziel = wurzel; offenEbene = 0; }
      var el = abschnittElement(a, i, meta);
      if (a.url && a.nummer && (a.ebene || 2) >= 2 && !a.element && meta.id === 'hinweise') {
        var teil = h('section', { class: 'hb-teil hb-teil--innen', id: 'teil-' + a.nummer, dataset: { markOrt: markOrt(meta, a.nummer) } }, el);
        wurzel.appendChild(teil);
        ziel = teil;
        offenEbene = a.ebene || 2;
        return;
      }
      ziel.appendChild(el);
    });
    return wurzel;
  }

  /* Inhaltsverzeichnis des Kapitels: Ebene 2 und 3 (auch Sammelkarten wie
     4.4.2 Checklisten), bei
     mehreren Ebene-1-Teilen (Vorwort, Impressum, Prolog) auch diese — als
     Knöpfe, weil «#…»-Links die Route wechseln würden. */
  function inhaltsverzeichnis(kap, indexEintrag) {
    var eintraege = [];
    var ebene1 = (kap.abschnitte || []).filter(function (a) { return a.ebene === 1; }).length;
    (kap.abschnitte || []).forEach(function (a, i) {
      if (a.ebene === 1 && ebene1 > 1 && i > 0) { eintraege.push({ ziel: ankerId(a, i), nummer: a.nummer, titel: a.titel, ebene: 1 }); }
      if (a.ebene === 2 || a.ebene === 3) { eintraege.push({ ziel: ankerId(a, i), nummer: a.nummer, titel: a.titel, ebene: a.ebene }); }
    });
    if (!eintraege.length) { return null; }
    return h('nav', { class: 'hb-inhalt', 'aria-label': 'Inhalt des Kapitels' }, [
      h('span', { class: 'detail__label', text: 'Inhalt' }),
      h('ul', { class: 'hb-inhalt__liste' }, eintraege.map(function (x) {
        return h('li', { class: 'hb-inhalt__eintrag hb-inhalt__eintrag--' + x.ebene }, h('button', {
          type: 'button', class: 'hb-inhalt__knopf',
          on: { click: function () {
            var ziel = document.getElementById(x.ziel);
            if (ziel) { try { ziel.scrollIntoView({ block: 'start' }); } catch (e) { ziel.scrollIntoView(); } }
          } }
        }, [x.nummer ? h('span', { class: 'hb-nr', text: x.nummer + ' ' }) : null, x.titel]));
      }))
    ]);
  }

  /* --- Kapitelseite ------------------------------------------------------- */

  function renderKapitel(behaelter, meta, params, zielId) {
    var index = KAPITEL.indexOf(meta);
    var vorher = index > 0 ? KAPITEL[index - 1] : null;
    var nachher = index < KAPITEL.length - 1 ? KAPITEL[index + 1] : null;

    behaelter.appendChild(h('div', { class: 'kopf kopf--handbuch' }, [
      h('h1', { text: 'Handbuch' }),
      h('p', { text: 'HERMES 2022 — das Referenzhandbuch Projektmanagement (PDF) als Text, Kapitel für Kapitel in seiner Gliederung mit Nummern und Seiten; Phasen, Szenarien, Module, Ergebnisse, Aufgaben und Rollen als Karten an ihrer Stelle.' })
    ]));
    var warnung = HT.app.datenWarnung();
    if (warnung) { behaelter.appendChild(warnung); }
    behaelter.appendChild(chipsBauen(meta));

    /* Kapitelkopf und Text liegen auf einem weissen Blatt, zentriert und
       etwas breiter als die breiteste Abbildung (siehe .hb-blatt). */
    var blatt = h('div', { class: 'hb-blatt' });
    behaelter.appendChild(blatt);

    var kopf = h('div', { class: 'hb-kapitelkopf' }, [
      h('span', { class: 'detail__label', text: meta.nummer ? 'Kapitel ' + meta.nummer : 'Referenzhandbuch' }),
      h('h2', { class: 'hb-kapitelkopf__titel', text: meta.titel })
    ]);
    blatt.appendChild(kopf);

    var inhalt = h('div', { class: 'kapitel' });
    blatt.appendChild(inhalt);
    inhalt.appendChild(h('p', { class: 'trefferzahl', role: 'status', text: 'Kapitel wird geladen …' }));

    Promise.all([HT.daten.rhbIndex(), HT.daten.rhbKapitel(meta.id)]).then(function (res) {
      if (!document.body.contains(inhalt)) { return; }   // inzwischen weitergeblättert
      var idx = res[0], kap = res[1];
      quelle = idx && idx.quelle ? idx.quelle : quelle;
      HT.ui.leeren(inhalt);

      if (!kap) {
        inhalt.appendChild(HT.ui.leerZustand('Handbuchtext nicht verfügbar', 'Die Datei data/handbuch/rhb/' + meta.id + '.json konnte nicht geladen werden.'));
        return;
      }

      var kopfInfo = { nummer: meta.nummer || null, seite: kap.seite, url: kap.url };
      var verweis = verweisZeile(kopfInfo, true);
      if (verweis) { kopf.appendChild(verweis); }

      var toc = inhaltsverzeichnis(kap, idx);
      if (toc) { inhalt.appendChild(toc); }
      inhalt.appendChild(kapitelKoerper(kap, meta));

      /* Blättern */
      function blaetterText(k, pfeil) {
        var t = (k.nummer ? 'Kapitel ' + k.nummer + ' ' : '') + k.titel;
        return pfeil === 'links' ? '← ' + t : t + ' →';
      }
      inhalt.appendChild(h('div', { class: 'btn-reihe kapitel-nav' }, [
        vorher ? h('a', { class: 'btn', href: kapitelAdresse(vorher.id), text: blaetterText(vorher, 'links') }) : null,
        nachher ? h('a', { class: 'btn', href: kapitelAdresse(nachher.id), text: blaetterText(nachher, 'rechts') }) : null
      ]));

      /* Erst nach dem Einfügen scrollen — sonst verschiebt der nachgeladene
         Inhalt die Position wieder. */
      var gewuenscht = params && params.teil ? String(params.teil) : null;
      global.setTimeout(function () {
        var ziel = null;
        if (zielId) {
          ziel = inhalt.querySelector('#eintrag-' + cssId(zielId));
          if (ziel) { ziel.classList.add('ist-hervorgehoben'); }
        } else if (gewuenscht) {
          ziel = inhalt.querySelector('#hb-' + cssId(gewuenscht)) || inhalt.querySelector('#teil-' + cssId(gewuenscht));
        }
        if (ziel) {
          try { ziel.scrollIntoView({ block: 'start' }); } catch (e) { ziel.scrollIntoView(); }
        } else {
          try { global.scrollTo(0, 0); } catch (e2) { /* egal */ }
        }
      }, 0);
    });
  }

  /* --- Render ------------------------------------------------------------- */

  /* Adressen: ?kapitel=<id>[&teil=<nr>] · ?id=<element> (Karte im Kapitel
     seiner Kategorie) · ?kat=<kategorie> · ohne Parameter das zuletzt
     gelesene Kapitel. Alte Adressen (#/methode, #/lexikon) leiten hierher. */
  function render(behaelter, params) {
    if (!zustand.initialisiert) { wiederherstellen(); zustand.initialisiert = true; }
    params = params || {};
    var meta = null, zielId = null;
    if (params.kapitel) { meta = kapitelMeta(params.kapitel); }
    if (meta && meta.id === 'methodenueberblick' && params.teil && /^B(\.|$)/.test(String(params.teil))) {
      meta = kapitelMeta('methodenelemente');   // alter Teil B des Methodenüberblicks
    }
    if (!meta && params.id) {
      var e = HT.daten.eintragMitId(params.id);
      if (e) {
        meta = kapitelDerKategorie(e.kategorie);
        zielId = e.id;
      }
    }
    if (!meta && params.kat) { meta = kapitelDerKategorie(params.kat); }
    if (!meta) { meta = kapitelMeta(zustand.kapitel) || KAPITEL[1]; }
    zustand.kapitel = meta.id;
    speichern();
    renderKapitel(behaelter, meta, params, zielId);
  }

  HT.views.handbuch = { titel: 'Handbuch', render: render };
}(window));
