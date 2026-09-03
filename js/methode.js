/* HERMES-Trainer — Ansicht «Methode».
   Folgt dem Aufbau des Referenzhandbuchs (Methodenüberblick, Phasen,
   Szenarien, Module, Ergebnisse, Aufgaben, Rollen, Hinweise zur Anwendung)
   und zeigt jedes Kapitel in drei Stufen: Kernaussagen → Zusammenfassung →
   vollständiger Handbuchtext. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;

  var KAPITEL = [
    { id: 'methodenueberblick', nummer: 'A/B', titel: 'Methodenüberblick', kategorie: null,
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

  function kapitelMeta(id) {
    for (var i = 0; i < KAPITEL.length; i++) {
      if (KAPITEL[i].id === id) { return KAPITEL[i]; }
    }
    return null;
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
      return h('a', {
        class: 'pm-phase',
        href: '#/lexikon?id=' + encodeURIComponent(id),
        title: name + ' im Lexikon anzeigen'
      }, kinder);
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
      eintraege.push(h('li', {
        class: 'pm-meilenstein pm-meilenstein--mehr',
        text: '+ ' + (liste.length - MS_MAX) + ' weitere'
      }));
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
      behaelter.appendChild(phasenKasten(
        e ? e.begriff : p.name,
        i + 1,
        e ? e.kurz : '',
        e ? e.id : null,
        e ? e.meilensteine : []
      ));
      var v = verbinder(i < phasen.length - 1);
      if (v) { behaelter.appendChild(v); }
    });
    return behaelter;
  }

  function vorgehensweiseBlock(v) {
    return h('div', { class: 'vorgehen' }, [
      h('div', { class: 'vorgehen__kopf' }, [
        h('h3', { class: 'vorgehen__titel', text: v.label }),
        h('span', { class: 'vorgehen__zahl', text: v.zusatz })
      ]),
      phasenmodell(v.phasen)
    ]);
  }

  function phasenmodellBlock() {
    var wege = HT.daten.vorgehensweisen();
    return h('div', { class: 'pm-block' }, wege.map(vorgehensweiseBlock));
  }

  /* --- Hilfen -------------------------------------------------------------- */

  function kapitelLink(id, text, klasse) {
    return h('a', { class: klasse || null, href: '#/methode?kapitel=' + encodeURIComponent(id) }, text);
  }

  function miniListe(kategorieKey) {
    var eintraege = HT.daten.alphabetisch(HT.daten.eintraegeDerKategorie(kategorieKey));
    if (!eintraege.length) { return null; }
    return h('ul', { class: 'mini-liste' }, eintraege.map(function (e) {
      return h('li', {}, h('a', {
        href: '#/lexikon?id=' + encodeURIComponent(e.id),
        title: e.kurz || e.begriff
      }, e.begriff));
    }));
  }

  function ladeHinweis(text) {
    return h('p', { class: 'trefferzahl', role: 'status', text: text });
  }

  /* --- Hub ----------------------------------------------------------------- */

  function renderHub(behaelter) {
    behaelter.appendChild(h('div', { class: 'kopf' }, [
      h('h1', { text: 'Methode' }),
      h('p', { text: 'HERMES 2022 entlang des Referenzhandbuchs — jedes Kapitel in drei Stufen: Kernaussagen, Zusammenfassung und der vollständige Handbuchtext.' })
    ]));

    var warnung = HT.app.datenWarnung();
    if (warnung) { behaelter.appendChild(warnung); }

    behaelter.appendChild(h('section', { class: 'abschnitt' }, [
      h('div', { class: 'abschnitt__kopf' }, [
        h('h2', { text: 'Phasenmodell auf einen Blick' }),
        h('span', { class: 'abschnitt__zahl', text: 'klassisch fünf, agil drei Phasen' })
      ]),
      phasenmodellBlock(),
      h('p', { class: 'trefferzahl' }, [
        'Initialisierung und Abschluss haben alle Projekte gemeinsam; die Lösungsentstehung erfolgt klassisch oder agil. ',
        kapitelLink('phasen', 'Kapitel Phasen lesen')
      ])
    ]));

    var karten = h('div', { class: 'kapitel-raster' });
    KAPITEL.forEach(function (k) {
      var anzahl = k.kategorie ? HT.daten.eintraegeDerKategorie(k.kategorie).length : 0;
      var meta = HT.daten.kategorieMeta(k.kategorie);
      karten.appendChild(h('a', {
        class: 'kapitel-karte',
        href: '#/methode?kapitel=' + encodeURIComponent(k.id)
      }, [
        h('span', { class: 'kapitel-karte__nr', text: 'Kapitel ' + k.nummer }),
        h('span', { class: 'kapitel-karte__titel', text: k.titel }),
        h('span', { class: 'kapitel-karte__teaser', text: k.teaser }),
        anzahl ? h('span', { class: 'kapitel-karte__meta', text: anzahl + ' ' + (meta ? meta.label : 'Einträge') + ' im Lexikon' }) : null
      ]));
    });

    behaelter.appendChild(h('section', { class: 'abschnitt' }, [
      h('div', { class: 'abschnitt__kopf' }, [
        h('h2', { text: 'Kapitel des Referenzhandbuchs' }),
        h('span', { class: 'abschnitt__zahl', text: 'Ausgabe 2022, 3. Auflage' })
      ]),
      karten
    ]));

    behaelter.appendChild(h('section', { class: 'abschnitt hinweisbox' }, [
      h('span', { class: 'detail__label', text: 'Empfohlener Lernweg' }),
      h('ol', { class: 'lernweg' }, [
        h('li', {}, ['Je Kapitel zuerst die ', h('b', { text: 'Kernaussagen' }), ' und Prüfungsfallen lesen.']),
        h('li', {}, ['Dann die ', h('b', { text: 'Zusammenfassung' }), ' — und bei Bedarf den vollständigen Handbuchtext.']),
        h('li', {}, ['Die Elemente im ', h('a', { href: '#/lexikon', text: 'Lexikon' }), ' nachschlagen (Kurz → Kernpunkte → Handbuch).']),
        h('li', {}, ['Mit ', h('a', { href: '#/lernkarten', text: 'Lernkarten' }), ' festigen und im ', h('a', { href: '#/quiz', text: 'Quiz' }), ' prüfen — jede Frage nennt die Belegstelle im Handbuch.'])
      ])
    ]));
  }

  /* --- Kapitelseite ------------------------------------------------------- */

  function kernaussagenBlock(daten, titel) {
    if (!daten) { return null; }
    var kinder = [];
    if (titel) { kinder.push(h('h3', { class: 'stufe-box__titel', text: titel })); }
    if (daten.kernaussagen && daten.kernaussagen.length) {
      kinder.push(h('span', { class: 'detail__label', text: 'Das Wichtigste' }));
      kinder.push(h('ol', { class: 'kernaussagen' }, daten.kernaussagen.map(function (s) {
        return h('li', { text: s });
      })));
    }
    if (daten.pruefungsfallen && daten.pruefungsfallen.length) {
      kinder.push(h('span', { class: 'detail__label detail__label--warn', text: 'Prüfungsfallen' }));
      kinder.push(h('ul', { class: 'pruefungsfallen' }, daten.pruefungsfallen.map(function (s) {
        return h('li', { text: s });
      })));
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

  function teilElement(teil, kernDaten, offen, einzeln) {
    var inhalt = h('div', { class: 'stufe__inhalt' });

    (kernDaten || []).forEach(function (d) {
      var kb = kernaussagenBlock(d.daten, d.titel);
      if (kb) { inhalt.appendChild(kb); }
      var zb = d.daten && d.daten.zusammenfassung && d.daten.zusammenfassung.length
        ? h('div', { class: 'hb-zusammenfassung' }, d.daten.zusammenfassung.map(function (abs) {
            return h('p', { class: 'hb-p', text: abs });
          }))
        : null;
      if (zb) { inhalt.appendChild(zb); }
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

    if (einzeln) {
      inhalt.className = 'stufe-block stufe-block--3 stufe-block--offen';
      return inhalt;
    }
    return h('details', { class: 'stufe-block stufe-block--3', open: !!offen, id: teil.nummer ? 'teil-' + teil.nummer : null }, [
      h('summary', {}, summaryText(teil.nummer, teil.titel, teil.seite)),
      inhalt
    ]);
  }

  function renderKapitel(behaelter, meta, params) {
    var index = KAPITEL.indexOf(meta);
    var vorher = index > 0 ? KAPITEL[index - 1] : null;
    var nachher = index < KAPITEL.length - 1 ? KAPITEL[index + 1] : null;

    behaelter.appendChild(h('nav', { class: 'brotkrumen', 'aria-label': 'Pfad' }, [
      h('a', { href: '#/methode', text: 'Methode' }),
      h('span', { 'aria-hidden': 'true', text: ' › ' }),
      h('span', { text: 'Kapitel ' + meta.nummer })
    ]));
    behaelter.appendChild(h('div', { class: 'kopf' }, [
      h('h1', { text: meta.titel }),
      h('p', { text: meta.teaser })
    ]));

    var inhalt = h('div', { class: 'kapitel' });
    behaelter.appendChild(inhalt);
    inhalt.appendChild(ladeHinweis('Kapitel wird geladen …'));

    Promise.all([HT.daten.handbuchKapitel(), HT.daten.kernaussagen()]).then(function (res) {
      var kapitel = res[0];
      var kern = res[1] || {};
      var kap = null;
      kapitel.forEach(function (k) { if (k.id === meta.id) { kap = k; } });

      HT.ui.leeren(inhalt);

      if (!kap) {
        inhalt.appendChild(HT.ui.leerZustand(
          'Handbuchtext nicht verfügbar',
          'Die Datei data/handbuch/kapitel.json konnte nicht geladen werden.'
        ));
        return;
      }

      var verweis = HT.ui.handbuchVerweis(kap, { url: kap.url });
      if (verweis) { inhalt.appendChild(verweis); }

      /* Stufe 1 */
      var stufe1 = kernaussagenBlock(kern[meta.id]) || einleitungFallback(kap);
      if (stufe1) { inhalt.appendChild(stufe1); }

      /* Stufe 2 */
      var extra = null;
      if (meta.id === 'phasen') {
        extra = h('div', {}, [
          h('span', { class: 'detail__label', text: 'Phasenmodell' }),
          phasenmodellBlock()
        ]);
      }
      var stufe2 = zusammenfassungBlock(kern[meta.id], extra);
      if (stufe2) { inhalt.appendChild(stufe2); }

      /* Elemente */
      if (meta.kategorie) {
        var km = HT.daten.kategorieMeta(meta.kategorie);
        var liste = miniListe(meta.kategorie);
        if (liste) {
          inhalt.appendChild(h('details', { class: 'stufe-block stufe-block--elemente', open: true }, [
            h('summary', {}, [h('span', { class: 'stufe__nr', text: 'Lexikon' }), ' ' + (km ? km.label : 'Elemente') + ' (' + HT.daten.eintraegeDerKategorie(meta.kategorie).length + ')']),
            h('div', { class: 'stufe__inhalt' }, [
              liste,
              h('a', { class: 'btn btn--klein', href: '#/lexikon?kat=' + encodeURIComponent(meta.kategorie), text: 'Alle im Lexikon öffnen' })
            ])
          ]));
        }
      }

      /* Stufe 3 */
      var teile = kap.teile || [];
      var wrapper = h('div', { class: 'stufe-wrap' }, [
        h('h2', { class: 'stufe__titel' }, [h('span', { class: 'stufe__nr', text: 'Stufe 3' }), ' Handbuchtext (vollständig)'])
      ]);
      var gewuenscht = params && params.teil ? String(params.teil) : null;
      teile.forEach(function (t, i) {
        var themen = meta.id === 'hinweise' ? (HINWEIS_THEMEN[t.nummer] || []) : [];
        var kernDaten = themen.map(function (id) {
          return { daten: kern[id] || null, titel: themen.length > 1 && kern[id] ? (id === 'reporting' ? 'Reporting' : null) : null };
        }).filter(function (d) { return !!d.daten; });
        /* Kernaussagen des Kapitels selbst stehen bereits oben. */
        if (meta.id === 'hinweise' && t.nummer === '7') { kernDaten = []; }
        var offen = gewuenscht ? (t.nummer === gewuenscht) : (teile.length === 1 || i === 0);
        wrapper.appendChild(teilElement(t, kernDaten, offen, teile.length === 1));
      });
      inhalt.appendChild(wrapper);

      /* Blättern */
      inhalt.appendChild(h('div', { class: 'btn-reihe kapitel-nav' }, [
        vorher ? kapitelLink(vorher.id, '← Kapitel ' + vorher.nummer + ' ' + vorher.titel, 'btn') : null,
        nachher ? kapitelLink(nachher.id, 'Kapitel ' + nachher.nummer + ' ' + nachher.titel + ' →', 'btn') : null
      ]));

      /* Erst nach dem Einfügen scrollen — sonst verschiebt der nachgeladene
         Inhalt die Position wieder. */
      global.setTimeout(function () {
        var ziel = gewuenscht ? inhalt.querySelector('#teil-' + String(gewuenscht).replace(/\./g, '\\.')) : null;
        if (ziel) {
          try { ziel.scrollIntoView({ block: 'start' }); } catch (e) { ziel.scrollIntoView(); }
        } else {
          try { global.scrollTo(0, 0); } catch (e2) { /* egal */ }
        }
      }, 0);
    });
  }

  function render(behaelter, params) {
    var meta = params && params.kapitel ? kapitelMeta(params.kapitel) : null;
    if (meta) {
      renderKapitel(behaelter, meta, params);
    } else {
      renderHub(behaelter);
    }
  }

  HT.views.methode = { titel: 'Methode', render: render };
}(window));
