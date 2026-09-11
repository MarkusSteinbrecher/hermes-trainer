/* meinHERMES — Ansicht «Handbuch».
   Folgt dem Referenzhandbuch: Methodenüberblick (A/B), 1 Phasen, 2 Szenarien,
   3 Module, 4 Ergebnisse, 5 Aufgaben, 6 Rollen, 7 Hinweise zur Anwendung.
   Die Kapitel sind Chips in der Kopfzeile; ein Kapitel zeigt seinen Text in
   der Gliederung des Handbuchs (Nummern, Seiten), und an der Stelle
   «Beschreibung der …» stehen die Elemente als Karten in drei Stufen
   (siehe js/karte.js) unter den Zwischentiteln des Handbuchs — Abnahme-
   protokoll etwa als 4.4.1.1 unter 4.4.1 Dokumente. Gesucht wird in der
   Kopfzeile der Anwendung; die Seite hat kein eigenes Suchfeld. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;
  var STUFEN = HT.karte.STUFEN;

  var KAPITEL = [
    { id: 'methodenueberblick', nummer: 'A/B', titel: 'Methodenüberblick', kategorie: 'grundbegriff' },
    /* beschreibung: der Abschnitt «Beschreibung der …», unter dem die Karten stehen. */
    { id: 'phasen', nummer: '1', titel: 'Phasen', kategorie: 'phase', beschreibung: '1.4' },
    { id: 'szenarien', nummer: '2', titel: 'Szenarien', kategorie: 'szenario', beschreibung: '2.4' },
    { id: 'module', nummer: '3', titel: 'Module', kategorie: 'modul', beschreibung: '3.4' },
    { id: 'ergebnisse', nummer: '4', titel: 'Ergebnisse', kategorie: 'ergebnis', beschreibung: '4.4' },
    { id: 'aufgaben', nummer: '5', titel: 'Aufgaben', kategorie: 'aufgabe', beschreibung: '5.4' },
    { id: 'rollen', nummer: '6', titel: 'Rollen', kategorie: 'rolle', beschreibung: '6.4' },
    { id: 'hinweise', nummer: '7', titel: 'Hinweise zur Anwendung', kategorie: null }
  ];

  var zustand = {
    kapitel: 'methodenueberblick',  // zuletzt gelesenes Kapitel
    standardStufe: 0,               // Stufe neuer Karten
    stufe: {},                      // id -> Stufe, wenn abweichend gewählt
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

  function cssId(id) {
    if (global.CSS && typeof global.CSS.escape === 'function') { return global.CSS.escape(id); }
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  /* Handbuchnummern vergleichen: 4.4.1.10 kommt nach 4.4.1.9. */
  function nummerTeile(n) {
    return String(n || '').split('.').map(function (x) { var z = parseInt(x, 10); return isNaN(z) ? x : z; });
  }
  function nummerVergleich(a, b) {
    var ta = nummerTeile(a), tb = nummerTeile(b);
    for (var i = 0; i < Math.max(ta.length, tb.length); i++) {
      if (ta[i] === undefined) { return -1; }
      if (tb[i] === undefined) { return 1; }
      if (ta[i] !== tb[i]) { return ta[i] < tb[i] ? -1 : 1; }
    }
    return 0;
  }
  function elternNummer(n) {
    var t = String(n || '').split('.');
    return t.length > 1 ? t.slice(0, -1).join('.') : '';
  }

  /* --- Persistenz ---------------------------------------------------------- */

  function speichern() {
    HT.store.schreib('handbuch', { kapitel: zustand.kapitel, stufe: zustand.standardStufe });
  }

  function wiederherstellen() {
    var g = HT.store.lies('handbuch', null);
    if (g && typeof g === 'object') {
      if (kapitelMeta(g.kapitel)) { zustand.kapitel = g.kapitel; }
      if ([0, 1, 2].indexOf(g.stufe) !== -1) { zustand.standardStufe = g.stufe; }
    }
  }

  /* --- Kapitel-Chips ------------------------------------------------------- */

  function chipsBauen(aktiv) {
    var liste = h('ul', { class: 'chips chips--streifen hb-kapitel', 'aria-label': 'Kapitel' });
    KAPITEL.forEach(function (k) {
      var anzahl = k.kategorie ? HT.daten.eintraegeDerKategorie(k.kategorie).length : 0;
      liste.appendChild(h('li', {}, h('button', {
        type: 'button', class: 'chip', 'aria-pressed': k === aktiv ? 'true' : 'false',
        title: 'Kapitel ' + k.nummer + ' ' + k.titel,
        on: { click: function () { global.location.hash = kapitelAdresse(k.id); } }
      }, [
        h('span', { class: 'hb-kapitel__nr', text: k.nummer }),
        h('span', { text: k.titel }),
        anzahl ? h('span', { class: 'chip__zahl', text: String(anzahl) }) : null
      ])));
    });
    return liste;
  }

  /* --- Karten -------------------------------------------------------------- */

  /* Stufe einer Karte: ausdrücklich gewählt, sonst die Standardstufe — und
     «Handbuch», wenn Markierungen zu diesem Element gespeichert sind, damit
     eine Markierung aus dem Überblick hier auch zu sehen ist. */
  function stufeVon(e) {
    if (zustand.stufe.hasOwnProperty(e.id)) { return zustand.stufe[e.id]; }
    if (HT.markieren && HT.markieren.fuerOrt('#/handbuch?id=' + encodeURIComponent(e.id)).length) { return 2; }
    return zustand.standardStufe;
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

  function karte(e, hb) {
    return HT.karte.bauen(e, {
      stufe: stufeVon(e),
      beiStufe: function (id, stufe) { zustand.stufe[id] = stufe; },
      zusatz: graphLink(e),
      titelEbene: 'h4',
      nummer: hb ? hb.nummer : null,
      seite: hb ? hb.seite : null
    });
  }

  /* «Ansicht»: Stufe aller Karten des Kapitels; zeichnet die Karten neu. */
  function stufenwahlBauen(neuZeichnen) {
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
        neuZeichnen();
      });
      knoepfe.push(b);
    });
    markieren();
    return h('div', { class: 'stufenwahl' }, [
      h('span', { class: 'stufenwahl__label', text: 'Ansicht' }),
      h('ul', { class: 'chips', role: 'group', 'aria-label': 'Detailtiefe aller Karten' },
        knoepfe.map(function (b) { return h('li', {}, b); }))
    ]);
  }

  /* Die Elemente eines Kapitels nach ihrem Zwischentitel im Handbuch:
     Eltern-Nummer (z. B. 4.4.1) -> Einträge in Handbuchreihenfolge. Ein
     Sammeleintrag, dessen Nummer der Zwischentitel selbst ist (4.4.2
     Checklisten), steht dort als erste Karte. */
  function elementeNachEltern(meta, index) {
    var nachEltern = {};
    HT.daten.eintraegeDerKategorie(meta.kategorie).forEach(function (e) {
      var hb = index[e.id] || null;
      var eltern = '';
      if (hb && hb.nummer) { eltern = nummerTeile(hb.nummer).length < 4 ? String(hb.nummer) : elternNummer(hb.nummer); }
      if (!nachEltern[eltern]) { nachEltern[eltern] = []; }
      nachEltern[eltern].push({ eintrag: e, hb: hb });
    });
    Object.keys(nachEltern).forEach(function (k) {
      nachEltern[k].sort(function (a, b) {
        if (a.hb && b.hb && a.hb.nummer && b.hb.nummer) { return nummerVergleich(a.hb.nummer, b.hb.nummer); }
        return a.eintrag.begriff.localeCompare(b.eintrag.begriff, 'de');
      });
    });
    return nachEltern;
  }

  function kartenListe(gruppe, listen) {
    var liste = h('div', { class: 'eintraege hb-karten' });
    function fuellen() {
      HT.ui.leeren(liste);
      var fragment = document.createDocumentFragment();
      gruppe.forEach(function (x) { fragment.appendChild(karte(x.eintrag, x.hb)); });
      liste.appendChild(fragment);
    }
    fuellen();
    listen.push(fuellen);
    return liste;
  }

  /* --- Kapiteltext in Handbuchgliederung ------------------------------------ */

  function titelKinder(a) {
    return [
      a.nummer ? h('span', { class: 'hb-nr', text: a.nummer + ' ' }) : null,
      a.titel,
      a.seite ? h('span', { class: 'hb-seite', text: ' S. ' + a.seite }) : null
    ];
  }

  /* Der Handbuchtext listet unter «Beschreibung der …» nur die Namen der
     Elemente — an ihrer Stelle stehen hier die Karten. */
  function ohneNamensliste(bloecke, namen) {
    return (bloecke || []).filter(function (b) {
      if (b.t !== 'ul' || !b.items || !b.items.length) { return true; }
      return !b.items.every(function (it) { return namen[HT.daten.normalisieren(it.text || '')]; });
    });
  }

  function abschnittElement(a, ctx) {
    var ebene = Math.min(6, Math.max(2, (a.ebene || 2) + ctx.versatz));
    var kinder = [];
    if (a.titel) {
      kinder.push(h('h' + ebene, { class: 'hb-titel hb-titel--' + ebene, id: a.nummer ? 'hb-' + a.nummer : null }, titelKinder(a)));
    }
    var gruppe = a.nummer ? ctx.nachEltern[a.nummer] : null;
    if (a.nummer && ctx.stufenwahlBei === a.nummer) { kinder.push(ctx.stufenwahl); }
    var bloecke = gruppe ? ohneNamensliste(a.bloecke, ctx.namen) : (a.bloecke || []);
    if (bloecke.length) { kinder.push(HT.ui.bloecke(bloecke, { verlinken: true, ebene: ebene + 1 })); }
    if (gruppe) { kinder.push(kartenListe(gruppe, ctx.listen)); }
    return h('section', { class: 'hb-abschnitt' + (gruppe ? ' hb-abschnitt--karten' : '') }, kinder);
  }

  /* Ein Teil des Kapitels (im Handbuch ein Kapitel oder Unterkapitel); Ort
     für Markierungen mit seinem Direktlink. */
  function teilElement(teil, ctx, mitTitel) {
    var kinder = [];
    if (mitTitel) {
      kinder.push(h('h2', { class: 'hb-teil__titel', id: teil.nummer ? 'hb-' + teil.nummer : null }, titelKinder(teil)));
      var verweis = HT.ui.handbuchVerweis(teil, { url: teil.url });
      if (verweis) { kinder.push(verweis); }
    }
    (teil.abschnitte || []).forEach(function (a) { kinder.push(abschnittElement(a, ctx)); });
    var ort = teil.nummer ? { markOrt: kapitelAdresse(ctx.meta.id, teil.nummer) } : null;
    return h('section', { class: 'hb-teil', id: teil.nummer ? 'teil-' + teil.nummer : null, dataset: ort }, kinder);
  }

  /* Inhaltsverzeichnis des Kapitels: Teile und Abschnitte der Ebene 2, zum
     Springen — als Knöpfe, weil «#…»-Links die Route wechseln würden. */
  function inhaltsverzeichnis(kap, mehrereTeile) {
    var eintraege = [];
    (kap.teile || []).forEach(function (t) {
      if (mehrereTeile && t.nummer) { eintraege.push({ nummer: t.nummer, titel: t.titel, ebene: 1 }); }
      (t.abschnitte || []).forEach(function (a) {
        if (a.nummer && a.titel && (a.ebene || 2) <= 2) { eintraege.push({ nummer: a.nummer, titel: a.titel, ebene: 2 }); }
      });
    });
    if (!eintraege.length) { return null; }
    return h('nav', { class: 'hb-inhalt', 'aria-label': 'Inhalt des Kapitels' }, [
      h('span', { class: 'detail__label', text: 'Inhalt' }),
      h('ul', { class: 'hb-inhalt__liste' }, eintraege.map(function (x) {
        return h('li', { class: 'hb-inhalt__eintrag hb-inhalt__eintrag--' + x.ebene }, h('button', {
          type: 'button', class: 'hb-inhalt__knopf',
          on: { click: function () {
            var ziel = document.getElementById('hb-' + x.nummer);
            if (ziel) { try { ziel.scrollIntoView({ block: 'start' }); } catch (e) { ziel.scrollIntoView(); } }
          } }
        }, [h('span', { class: 'hb-nr', text: x.nummer + ' ' }), x.titel]));
      }))
    ]);
  }

  /* Grundbegriffe haben keine Nummer im Handbuch: sie stehen am Ende des
     Methodenüberblicks, alphabetisch. */
  function grundbegriffeBlock(ctx) {
    var gruppe = ctx.nachEltern[''] || [];
    if (!gruppe.length) { return null; }
    gruppe.sort(function (a, b) { return a.eintrag.begriff.localeCompare(b.eintrag.begriff, 'de'); });
    return h('section', { class: 'hb-abschnitt hb-abschnitt--karten', id: 'hb-grundbegriffe' }, [
      h('h2', { class: 'hb-teil__titel', text: 'Grundbegriffe' }),
      h('p', { class: 'hb-p', text: 'Begriffe, die das Referenzhandbuch durchgehend verwendet — mit Verweis auf die Stelle bei HERMES online.' }),
      ctx.stufenwahl,
      kartenListe(gruppe, ctx.listen)
    ]);
  }

  /* --- Kapitelseite ------------------------------------------------------- */

  function renderKapitel(behaelter, meta, params, zielId) {
    var index = KAPITEL.indexOf(meta);
    var vorher = index > 0 ? KAPITEL[index - 1] : null;
    var nachher = index < KAPITEL.length - 1 ? KAPITEL[index + 1] : null;

    behaelter.appendChild(h('div', { class: 'kopf kopf--handbuch' }, [
      h('h1', { text: 'Handbuch' }),
      h('p', { text: 'HERMES 2022 — das Referenzhandbuch in seiner Gliederung, Kapitel für Kapitel; die Phasen, Szenarien, Module, Ergebnisse, Aufgaben und Rollen stehen als Karten an ihrer Stelle im Text.' })
    ]));
    var warnung = HT.app.datenWarnung();
    if (warnung) { behaelter.appendChild(warnung); }
    behaelter.appendChild(chipsBauen(meta));

    var kopf = h('div', { class: 'hb-kapitelkopf' }, [
      h('span', { class: 'detail__label', text: 'Kapitel ' + meta.nummer }),
      h('h2', { class: 'hb-kapitelkopf__titel', text: meta.titel })
    ]);
    behaelter.appendChild(kopf);

    var inhalt = h('div', { class: 'kapitel' });
    behaelter.appendChild(inhalt);
    inhalt.appendChild(h('p', { class: 'trefferzahl', role: 'status', text: 'Kapitel wird geladen …' }));

    var indexLaden = meta.kategorie ? HT.daten.handbuchIndex(meta.kategorie) : Promise.resolve({});
    Promise.all([HT.daten.handbuchKapitel(), indexLaden]).then(function (res) {
      if (!document.body.contains(inhalt)) { return; }   // inzwischen weitergeblättert
      var kap = null;
      res[0].forEach(function (k) { if (k.id === meta.id) { kap = k; } });
      HT.ui.leeren(inhalt);

      if (!kap) {
        inhalt.appendChild(HT.ui.leerZustand('Handbuchtext nicht verfügbar', 'Die Datei data/handbuch/kapitel.json konnte nicht geladen werden.'));
        return;
      }

      var verweis = HT.ui.handbuchVerweis(kap, { url: kap.url });
      if (verweis) { kopf.appendChild(verweis); }

      /* Elemente nach Zwischentitel; die Stufenwahl steht am Abschnitt
         «Beschreibung der …», dem gemeinsamen Elternteil. */
      var ctx = { meta: meta, nachEltern: {}, namen: {}, listen: [], versatz: 0, stufenwahl: null, stufenwahlBei: null };
      if (meta.kategorie) {
        ctx.nachEltern = elementeNachEltern(meta, res[1] || {});
        HT.daten.eintraegeDerKategorie(meta.kategorie).forEach(function (e) { ctx.namen[HT.daten.normalisieren(e.begriff)] = true; });
        ctx.stufenwahlBei = meta.beschreibung || null;
        ctx.stufenwahl = stufenwahlBauen(function () { ctx.listen.forEach(function (f) { f(); }); });
      }

      var teile = kap.teile || [];
      var mehrereTeile = teile.length > 1;
      var toc = inhaltsverzeichnis(kap, mehrereTeile);
      if (toc) { inhalt.appendChild(toc); }
      teile.forEach(function (t) { inhalt.appendChild(teilElement(t, ctx, mehrereTeile)); });
      if (meta.kategorie === 'grundbegriff') {
        var gb = grundbegriffeBlock(ctx);
        if (gb) { inhalt.appendChild(gb); }
      }

      /* Blättern */
      inhalt.appendChild(h('div', { class: 'btn-reihe kapitel-nav' }, [
        vorher ? h('a', { class: 'btn', href: kapitelAdresse(vorher.id), text: '← Kapitel ' + vorher.nummer + ' ' + vorher.titel }) : null,
        nachher ? h('a', { class: 'btn', href: kapitelAdresse(nachher.id), text: 'Kapitel ' + nachher.nummer + ' ' + nachher.titel + ' →' }) : null
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
          ziel = inhalt.querySelector('#teil-' + cssId(gewuenscht));
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
    if (!meta && params.id) {
      var e = HT.daten.eintragMitId(params.id);
      if (e) {
        meta = kapitelDerKategorie(e.kategorie);
        zielId = e.id;
        zustand.stufe[e.id] = Math.max(1, stufeVon(e));
      }
    }
    if (!meta && params.kat) { meta = kapitelDerKategorie(params.kat); }
    if (!meta) { meta = kapitelMeta(zustand.kapitel) || KAPITEL[0]; }
    zustand.kapitel = meta.id;
    speichern();
    renderKapitel(behaelter, meta, params, zielId);
  }

  HT.views.handbuch = { titel: 'Handbuch', render: render };
}(window));
