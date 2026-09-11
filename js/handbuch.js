/* meinHERMES — Ansicht «Handbuch».
   Folgt dem Aufbau des Referenzhandbuchs: Methodenüberblick, 1 Phasen,
   2 Szenarien, 3 Module, 4 Ergebnisse, 5 Aufgaben, 6 Rollen, 7 Hinweise zur
   Anwendung. Die Kapitel sind Chips in der Kopfzeile; ein Kapitel zeigt
   Kernaussagen → Zusammenfassung → vollständigen Handbuchtext und darunter
   seine Elemente als Karten in drei Stufen (siehe js/karte.js). Gesucht wird
   in der Kopfzeile der Anwendung — die Seite hat kein eigenes Suchfeld. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;
  var SEITE = 40;                 // Karten je Nachladeschritt
  var STUFEN = HT.karte.STUFEN;

  var KAPITEL = [
    { id: 'methodenueberblick', nummer: 'A/B', titel: 'Methodenüberblick', kategorie: 'grundbegriff', elementeTitel: 'Grundbegriffe',
      teaser: 'Was HERMES-Projektmanagement ist, welche Vorgehensweisen es unterstützt und wie die Methodenelemente zusammenspielen.' },
    { id: 'phasen', nummer: '1', titel: 'Phasen', kategorie: 'phase',
      teaser: 'Projektlebenszyklus, Phasenmodell für klassische und agile Vorgehensweise, Meilensteine als Quality Gates und die Beschreibung der einzelnen Phasen.' },
    { id: 'szenarien', nummer: '2', titel: 'Szenarien', kategorie: 'szenario',
      teaser: 'Fünf Standardszenarien, ihr Aufbau aus Modulen sowie Sizing und Tailoring für benutzerdefinierte Szenarien.' },
    { id: 'module', nummer: '3', titel: 'Module', kategorie: 'modul',
      teaser: 'Standardmodule, ihre Zuordnung zu den Phasen und die vier Module, die zur Einhaltung der Projekt-Governance zwingend sind.' },
    { id: 'ergebnisse', nummer: '4', titel: 'Ergebnisse', kategorie: 'ergebnis',
      teaser: 'Dokumente und Zustände, minimal geforderte Dokumente, Checklisten und Meilensteine.' },
    { id: 'aufgaben', nummer: '5', titel: 'Aufgaben', kategorie: 'aufgabe',
      teaser: 'Entscheidungsaufgaben der Steuerung und der Führung, sonstige Aufgaben und der Aufbau jeder Aufgabenbeschreibung.' },
    { id: 'rollen', nummer: '6', titel: 'Rollen', kategorie: 'rolle',
      teaser: 'Stammorganisation und Projektorganisation, Partnergruppen, Hierarchieebenen, minimal zu besetzende Rollen und Rollenbesetzung.' },
    { id: 'hinweise', nummer: '7', titel: 'Hinweise zur Anwendung', kategorie: null,
      teaser: 'Governance, Reporting, Nachhaltigkeit, finanzielle Steuerung, Planung, Realisierungseinheiten, andere Methoden und die Integration in die Stammorganisation.' }
  ];

  /* Kuratierte Kernaussagen je Teil der Hinweise zur Anwendung (Schlüssel in data/kernaussagen.json). */
  var HINWEIS_THEMEN = {
    '7': ['hinweise'],
    '7.4.1': ['governance', 'reporting'],
    '7.4.2': ['nachhaltigkeit'],
    '7.4.3': ['pm-entwicklungsmanagement'],
    '7.4.4': ['finanzen'],
    '7.4.5': ['planung'],
    '7.4.6': ['realisierungseinheiten'],
    '7.4.7': ['andere-methoden'],
    '7.4.8': ['integration']
  };

  var zustand = {
    kapitel: 'methodenueberblick',  // zuletzt gelesenes Kapitel
    standardStufe: 0,               // Stufe neuer Karten
    stufe: {},                      // id -> Stufe, wenn abweichend gewählt
    limit: SEITE,
    initialisiert: false
  };

  function kapitelMeta(id) {
    for (var i = 0; i < KAPITEL.length; i++) {
      if (KAPITEL[i].id === id) { return KAPITEL[i]; }
    }
    return null;
  }

  function kapitelDerKategorie(kat) {
    for (var i = 0; i < KAPITEL.length; i++) {
      if (KAPITEL[i].kategorie === kat) { return KAPITEL[i]; }
    }
    return null;
  }

  function kapitelAdresse(id, teil) {
    return '#/handbuch?kapitel=' + encodeURIComponent(id) + (teil ? '&teil=' + encodeURIComponent(teil) : '');
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

  /* --- Phasenmodell (Grafik) ---------------------------------------------- */

  function phasenKasten(name, nummer, definition, id, meilensteine) {
    var kinder = [
      h('span', { class: 'pm-phase__nr', text: 'Phase ' + nummer }),
      h('span', { class: 'pm-phase__name', text: name }),
      definition ? h('span', { class: 'pm-phase__def', text: HT.ui.kuerzen(definition, 72) }) : null,
      meilensteinListe(meilensteine)
    ];
    if (id) {
      return h('a', { class: 'pm-phase', href: '#/handbuch?id=' + encodeURIComponent(id), title: name + ' anzeigen' }, kinder);
    }
    return h('div', { class: 'pm-phase' }, kinder);
  }

  var MS_MAX = 3;                  // mehr Meilensteine überfrachten die Grafik

  function meilensteinKurz(name) {
    return String(name || '').replace(/^Meilenstein\s+/i, '');
  }

  function meilensteinListe(meilensteine) {
    var liste = meilensteine || [];
    if (!liste.length) { return null; }
    var eintraege = liste.slice(0, MS_MAX).map(function (m) {
      return h('li', { class: 'pm-meilenstein', title: m.name }, [
        h('span', { class: 'pm-raute', 'aria-hidden': 'true', text: '◆' }),
        h('span', { text: meilensteinKurz(m.name) })
      ]);
    });
    if (liste.length > MS_MAX) {
      eintraege.push(h('li', { class: 'pm-meilenstein pm-meilenstein--mehr', text: '+ ' + (liste.length - MS_MAX) + ' weitere' }));
    }
    return h('ul', { class: 'pm-ms', 'aria-label': 'Meilensteine dieser Phase' }, eintraege);
  }

  function verbinder(mitPfeil) {
    if (!mitPfeil) { return null; }
    return h('div', { class: 'pm-verbinder' }, [
      h('span', { class: 'pm-pfeil pm-pfeil--schmal', 'aria-hidden': 'true', text: '↓' }),
      h('span', { class: 'pm-pfeil pm-pfeil--breit', 'aria-hidden': 'true', text: '→' })
    ]);
  }

  function phasenmodell(phasen) {
    var behaelter = h('div', { class: 'phasenmodell' });
    phasen.forEach(function (p, i) {
      var e = p.eintrag;
      behaelter.appendChild(phasenKasten(e ? e.begriff : p.name, i + 1, e ? e.kurz : '', e ? e.id : null, e ? e.meilensteine : []));
      var v = verbinder(i < phasen.length - 1);
      if (v) { behaelter.appendChild(v); }
    });
    return behaelter;
  }

  function phasenmodellBlock() {
    return h('div', { class: 'pm-block' }, HT.daten.vorgehensweisen().map(function (v) {
      return h('div', { class: 'vorgehen' }, [
        h('div', { class: 'vorgehen__kopf' }, [
          h('h3', { class: 'vorgehen__titel', text: v.label }),
          h('span', { class: 'vorgehen__zahl', text: v.zusatz })
        ]),
        phasenmodell(v.phasen)
      ]);
    }));
  }

  /* --- Kapitel-Chips ------------------------------------------------------- */

  function chipsBauen(aktiv) {
    var liste = h('ul', { class: 'chips chips--streifen hb-kapitel', 'aria-label': 'Kapitel' });
    KAPITEL.forEach(function (k) {
      var anzahl = k.kategorie ? HT.daten.eintraegeDerKategorie(k.kategorie).length : 0;
      var btn = h('button', {
        type: 'button', class: 'chip', 'aria-pressed': k === aktiv ? 'true' : 'false',
        title: 'Kapitel ' + k.nummer + ' ' + k.titel,
        on: { click: function () { global.location.hash = kapitelAdresse(k.id); } }
      }, [
        h('span', { class: 'hb-kapitel__nr', text: k.nummer }),
        h('span', { text: k.titel }),
        anzahl ? h('span', { class: 'chip__zahl', text: String(anzahl) }) : null
      ]);
      liste.appendChild(h('li', {}, btn));
    });
    return liste;
  }

  /* --- Kapiteltext ------------------------------------------------------- */

  function kernaussagenBlock(daten, titel) {
    if (!daten) { return null; }
    var kinder = [];
    if (titel) { kinder.push(h('h3', { class: 'stufe-box__titel', text: titel })); }
    if (daten.kernaussagen && daten.kernaussagen.length) {
      kinder.push(h('span', { class: 'detail__label', text: 'Das Wichtigste' }));
      kinder.push(h('ol', { class: 'kernaussagen' }, daten.kernaussagen.map(function (s) { return h('li', { text: s }); })));
    }
    if (daten.pruefungsfallen && daten.pruefungsfallen.length) {
      kinder.push(h('span', { class: 'detail__label detail__label--warn', text: 'Prüfungsfallen' }));
      kinder.push(h('ul', { class: 'pruefungsfallen' }, daten.pruefungsfallen.map(function (s) { return h('li', { text: s }); })));
    }
    if (!kinder.length) { return null; }
    return h('div', { class: 'stufe-box stufe-box--1' }, kinder);
  }

  function zusammenfassungBlock(daten, extra) {
    var kinder = [];
    if (daten && daten.zusammenfassung && daten.zusammenfassung.length) {
      daten.zusammenfassung.forEach(function (abs) { kinder.push(h('p', { class: 'hb-p', text: abs })); });
    }
    if (extra) { kinder.push(extra); }
    if (daten && daten.belege && daten.belege.length) {
      kinder.push(h('div', { class: 'belege' }, [
        h('span', { class: 'detail__label', text: 'Belegstellen im Referenzhandbuch' }),
        h('ul', { class: 'belege__liste' }, daten.belege.map(function (b) {
          return h('li', {}, [
            h('span', { class: 'beleg__zitat', text: '«' + b.zitat + '»' }),
            h('span', { class: 'beleg__ort', text: ' — Kap. ' + b.kapitel + (b.seite ? ', S. ' + b.seite : '') })
          ]);
        }))
      ]));
    }
    if (!kinder.length) { return null; }
    return h('details', { class: 'stufe-block stufe-block--2', open: true }, [
      h('summary', {}, [h('span', { class: 'stufe__nr', text: 'Stufe 2' }), ' Zusammenfassung']),
      h('div', { class: 'stufe__inhalt' }, kinder)
    ]);
  }

  /* Fallback, wenn keine kuratierten Kernaussagen vorliegen: erste Absätze des Kapitels. */
  function einleitungFallback(kap) {
    var absaetze = [];
    (kap.teile || []).some(function (t) {
      return (t.abschnitte || []).some(function (a) {
        (a.bloecke || []).forEach(function (b) {
          if (b.t === 'p' && absaetze.length < 3) { absaetze.push(b.text); }
        });
        return absaetze.length >= 3;
      });
    });
    if (!absaetze.length) { return null; }
    return h('div', { class: 'stufe-box stufe-box--1' }, [
      h('span', { class: 'detail__label', text: 'Einleitung' }),
      absaetze.map(function (t) { return h('p', { class: 'hb-p', text: t }); })
    ]);
  }

  function abschnittElement(a, ebeneBasis) {
    var n = Math.min(6, Math.max(2, ebeneBasis + Math.max(0, (a.ebene || 2) - 2)));
    var kinder = [];
    if (a.titel) {
      kinder.push(h('h' + n, { class: 'hb-titel', id: a.nummer ? 'hb-' + a.nummer : null }, [
        a.nummer ? h('span', { class: 'hb-nr', text: a.nummer + ' ' }) : null,
        a.titel,
        a.seite ? h('span', { class: 'hb-seite', text: ' S. ' + a.seite }) : null
      ]));
    }
    if (a.bloecke && a.bloecke.length) {
      kinder.push(HT.ui.bloecke(a.bloecke, { verlinken: true, ebene: n + 1 }));
    }
    return h('section', { class: 'hb-abschnitt' }, kinder);
  }

  /* Gruppiert die Abschnitte eines Teils an den Überschriften der Ebene 2. */
  function gruppen(abschnitte) {
    var aus = [];
    var aktuell = null;
    (abschnitte || []).forEach(function (a) {
      if (a.ebene <= 2 || !aktuell) {
        aktuell = { kopf: a.ebene <= 2 ? a : null, kinder: a.ebene <= 2 ? [] : [a] };
        aus.push(aktuell);
      } else {
        aktuell.kinder.push(a);
      }
    });
    return aus;
  }

  function summaryText(nummer, titel, seite) {
    return [
      nummer ? h('span', { class: 'hb-nr', text: nummer + ' ' }) : null,
      titel,
      seite ? h('span', { class: 'hb-seite', text: ' S. ' + seite }) : null
    ];
  }

  /* Ein Teil des Kapitels (Handbuchtext). Ort für Markierungen: der Teil
     mit seinem Direktlink. */
  function teilElement(teil, kernDaten, offen, einzeln, kapitelId) {
    var inhalt = h('div', { class: 'stufe__inhalt' });
    var markOrt = teil.nummer ? kapitelAdresse(kapitelId, teil.nummer) : null;

    (kernDaten || []).forEach(function (d) {
      var kb = kernaussagenBlock(d.daten, d.titel);
      if (kb) { inhalt.appendChild(kb); }
      if (d.daten && d.daten.zusammenfassung && d.daten.zusammenfassung.length) {
        inhalt.appendChild(h('div', { class: 'hb-zusammenfassung' }, d.daten.zusammenfassung.map(function (abs) {
          return h('p', { class: 'hb-p', text: abs });
        })));
      }
    });

    if (!einzeln) {
      var verweis = HT.ui.handbuchVerweis(teil, { url: teil.url });
      if (verweis) { inhalt.appendChild(verweis); }
    }

    gruppen(teil.abschnitte).forEach(function (g) {
      var kinder = [];
      if (g.kopf && g.kopf.bloecke && g.kopf.bloecke.length) {
        kinder.push(h('section', { class: 'hb-abschnitt' }, HT.ui.bloecke(g.kopf.bloecke, { verlinken: true, ebene: 4 })));
      }
      g.kinder.forEach(function (a) { kinder.push(abschnittElement(a, 4)); });
      if (!kinder.length) { return; }
      if (g.kopf) {
        inhalt.appendChild(h('details', { class: 'hb-gruppe', open: true }, [
          h('summary', {}, summaryText(g.kopf.nummer, g.kopf.titel, g.kopf.seite)),
          h('div', { class: 'hb-gruppe__inhalt' }, kinder)
        ]));
      } else {
        kinder.forEach(function (k) { inhalt.appendChild(k); });
      }
    });

    /* Ein einzelner Teil: der Block «Stufe 3» trägt den Ort (siehe renderKapitel). */
    if (einzeln) { return inhalt; }
    var ort = markOrt ? { markOrt: markOrt, markKomplett: '1' } : null;
    return h('details', { class: 'stufe-block stufe-block--3', open: !!offen, id: teil.nummer ? 'teil-' + teil.nummer : null, dataset: ort }, [
      h('summary', {}, summaryText(teil.nummer, teil.titel, teil.seite)),
      inhalt
    ]);
  }

  /* --- Elemente des Kapitels ------------------------------------------------ */

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
      h('ul', { class: 'chips', role: 'group', 'aria-label': 'Detailtiefe aller Einträge' },
        knoepfe.map(function (b) { return h('li', {}, b); }))
    ]);
  }

  function elementeBlock(meta, zielId) {
    var eintraege = HT.daten.eintraegeDerKategorie(meta.kategorie);
    if (!eintraege.length) { return null; }
    var km = HT.daten.kategorieMeta(meta.kategorie);
    var titel = meta.elementeTitel || (km ? km.label : 'Elemente');
    var liste = h('div', { class: 'eintraege' });

    /* Direktlink: so weit nachladen, bis der gesuchte Eintrag sichtbar ist. */
    if (zielId) {
      for (var p = 0; p < eintraege.length; p++) {
        if (eintraege[p].id === zielId && p >= zustand.limit) {
          zustand.limit = Math.ceil((p + 1) / SEITE) * SEITE;
          break;
        }
      }
    }

    function fuellen() {
      HT.ui.leeren(liste);
      var sichtbar = eintraege.slice(0, zustand.limit);
      var fragment = document.createDocumentFragment();
      sichtbar.forEach(function (e) { fragment.appendChild(karte(e)); });
      liste.appendChild(fragment);
      if (sichtbar.length < eintraege.length) {
        liste.appendChild(h('div', { class: 'mehr-laden' }, [
          h('button', {
            type: 'button', class: 'btn',
            text: 'Weitere ' + Math.min(SEITE, eintraege.length - sichtbar.length) + ' von ' + eintraege.length + ' anzeigen',
            on: { click: function () { zustand.limit += SEITE; fuellen(); } }
          })
        ]));
      }
    }
    fuellen();

    return h('section', { class: 'hb-elemente', id: 'elemente' }, [
      h('div', { class: 'hb-elemente__kopf' }, [
        h('h2', { class: 'stufe__titel' }, [
          h('span', { class: 'hb-elemente__ikone hb-elemente__ikone--' + meta.kategorie, 'aria-hidden': 'true' }, HT.ui.katSymbol(meta.kategorie, 18)),
          titel,
          h('span', { class: 'abschnitt__zahl', text: String(eintraege.length) })
        ]),
        stufenwahlBauen(fuellen)
      ]),
      liste
    ]);
  }

  /* --- Kapitelseite ------------------------------------------------------- */

  function renderKapitel(behaelter, meta, params, zielId) {
    var index = KAPITEL.indexOf(meta);
    var vorher = index > 0 ? KAPITEL[index - 1] : null;
    var nachher = index < KAPITEL.length - 1 ? KAPITEL[index + 1] : null;

    behaelter.appendChild(h('div', { class: 'kopf kopf--handbuch' }, [
      h('h1', { text: 'Handbuch' }),
      h('p', { text: 'HERMES 2022 entlang des Referenzhandbuchs — je Kapitel Kernaussagen, Zusammenfassung, der vollständige Text und die Elemente des Kapitels in drei Stufen.' })
    ]));
    var warnung = HT.app.datenWarnung();
    if (warnung) { behaelter.appendChild(warnung); }
    behaelter.appendChild(chipsBauen(meta));

    behaelter.appendChild(h('div', { class: 'hb-kapitelkopf' }, [
      h('span', { class: 'detail__label', text: 'Kapitel ' + meta.nummer }),
      h('h2', { class: 'hb-kapitelkopf__titel', text: meta.titel }),
      h('p', { class: 'hb-kapitelkopf__teaser', text: meta.teaser })
    ]));

    /* Ort für Markierungen: das Kapitel (Kernaussagen, Zusammenfassung);
       die Handbuchteile darin und die Karten sind eigene Orte. */
    var inhalt = h('div', { class: 'kapitel', dataset: { markOrt: kapitelAdresse(meta.id) } });
    behaelter.appendChild(inhalt);
    inhalt.appendChild(h('p', { class: 'trefferzahl', role: 'status', text: 'Kapitel wird geladen …' }));

    Promise.all([HT.daten.handbuchKapitel(), HT.daten.kernaussagen()]).then(function (res) {
      if (!document.body.contains(inhalt)) { return; }   // inzwischen weitergeblättert
      var kapitel = res[0];
      var kern = res[1] || {};
      var kap = null;
      kapitel.forEach(function (k) { if (k.id === meta.id) { kap = k; } });

      HT.ui.leeren(inhalt);

      if (!kap) {
        inhalt.appendChild(HT.ui.leerZustand('Handbuchtext nicht verfügbar', 'Die Datei data/handbuch/kapitel.json konnte nicht geladen werden.'));
      } else {
        var verweis = HT.ui.handbuchVerweis(kap, { url: kap.url });
        if (verweis) { inhalt.appendChild(verweis); }

        /* Stufe 1 */
        var stufe1 = kernaussagenBlock(kern[meta.id]) || einleitungFallback(kap);
        if (stufe1) { inhalt.appendChild(stufe1); }

        /* Stufe 2 */
        var extra = meta.id === 'phasen'
          ? h('div', {}, [h('span', { class: 'detail__label', text: 'Phasenmodell' }), phasenmodellBlock()])
          : null;
        var stufe2 = zusammenfassungBlock(kern[meta.id], extra);
        if (stufe2) { inhalt.appendChild(stufe2); }

        /* Stufe 3 — zu, wenn darunter die Elemente folgen und kein Teil
           gewünscht ist; sonst auf. */
        var teile = kap.teile || [];
        var gewuenscht = params && params.teil ? String(params.teil) : null;
        var hatElemente = !!meta.kategorie && HT.daten.eintraegeDerKategorie(meta.kategorie).length > 0;
        var stufe3Inhalt = h('div', { class: 'stufe__inhalt' });
        teile.forEach(function (t, i) {
          var themen = meta.id === 'hinweise' ? (HINWEIS_THEMEN[t.nummer] || []) : [];
          var kernDaten = themen.map(function (id) {
            return { daten: kern[id] || null, titel: themen.length > 1 && kern[id] ? (id === 'reporting' ? 'Reporting' : null) : null };
          }).filter(function (d) { return !!d.daten; });
          /* Kernaussagen des Kapitels selbst stehen bereits oben. */
          if (meta.id === 'hinweise' && t.nummer === '7') { kernDaten = []; }
          var offen = gewuenscht ? (t.nummer === gewuenscht) : (teile.length === 1 || i === 0);
          stufe3Inhalt.appendChild(teilElement(t, kernDaten, offen, teile.length === 1, meta.id));
        });
        var einzelOrt = teile.length === 1 && teile[0].nummer ? { markOrt: kapitelAdresse(meta.id, teile[0].nummer), markKomplett: '1' } : null;
        inhalt.appendChild(h('details', { class: 'stufe-block stufe-block--3 stufe-block--text', open: !hatElemente || !!gewuenscht, dataset: einzelOrt }, [
          h('summary', {}, [h('span', { class: 'stufe__nr', text: 'Stufe 3' }), ' Handbuchtext (vollständig)', kap.seite ? h('span', { class: 'hb-seite', text: ' ab S. ' + kap.seite }) : null]),
          stufe3Inhalt
        ]));
      }
      inhalt.dataset.markKomplett = '1';

      /* Elemente des Kapitels */
      if (meta.kategorie) {
        var block = elementeBlock(meta, zielId);
        if (block) { inhalt.appendChild(block); }
      }

      /* Blättern */
      inhalt.appendChild(h('div', { class: 'btn-reihe kapitel-nav' }, [
        vorher ? h('a', { class: 'btn', href: kapitelAdresse(vorher.id), text: '← Kapitel ' + vorher.nummer + ' ' + vorher.titel }) : null,
        nachher ? h('a', { class: 'btn', href: kapitelAdresse(nachher.id), text: 'Kapitel ' + nachher.nummer + ' ' + nachher.titel + ' →' }) : null
      ]));

      /* Erst nach dem Einfügen scrollen — sonst verschiebt der nachgeladene
         Inhalt die Position wieder. */
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

  function cssId(id) {
    if (global.CSS && typeof global.CSS.escape === 'function') { return global.CSS.escape(id); }
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
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

    if (zustand.kapitel !== meta.id) { zustand.limit = SEITE; }
    zustand.kapitel = meta.id;
    speichern();
    renderKapitel(behaelter, meta, params, zielId);
  }

  HT.views.handbuch = { titel: 'Handbuch', render: render };
}(window));
