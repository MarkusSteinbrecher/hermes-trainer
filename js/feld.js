/* HERMES-Trainer — Ansicht «Feld»: eine Phase in einem Modul.

   Die Abbildung im Methodenüberblick ist ein Raster: Spalten sind Module,
   Zeilen sind Phasen. Wo sie sich kreuzen, steht die Arbeit eines Moduls in
   einer Phase — diese Seite zeigt genau diesen Ausschnitt und sonst nichts:
   die Ergebnisse (Meilensteine zuerst), die Aufgaben und die beteiligten
   Rollen.

   Alles stammt aus den erfassten Feldern der Einträge (`phasen`, `module`,
   `verantwortlich`, `beteiligt`, `ergebnisse`); es werden keine Beziehungen
   ergänzt. Mehrere Module je Seite sind möglich, weil die Grafik
   Projektsteuerung und Projektführung zu einer Spalte zusammenfasst.

   Adresse: #/feld?phase=<Phase>&modul=<Modul>[,<Modul>…] */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;

  /* Jedes Element steht vollständig im Lexikon; der Methodenüberblick zeigt
     seine Kurzfassung inzwischen selbst in der Inhaltsseite. */
  function verweisZiel(e) {
    return '#/lexikon?id=' + encodeURIComponent(e.id);
  }

  var detailZiel = verweisZiel;

  var TYP_RANG = { Meilenstein: 0, Dokument: 1, Zustand: 2, Checkliste: 3 };

  function rollenAusText(text) {
    return String(text || '').split(/\s*,\s*/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return !!s; });
  }

  /* Querverweise stehen als Begriffe in den Daten; verglichen wird normalisiert. */
  function enthaelt(liste, name) {
    var norm = HT.daten.normalisieren(name);
    for (var i = 0; i < (liste || []).length; i++) {
      if (HT.daten.normalisieren(liste[i]) === norm) { return true; }
    }
    return false;
  }

  function feldZiel(modulNamen, phaseName) {
    return '#/feld?phase=' + encodeURIComponent(phaseName)
      + '&modul=' + encodeURIComponent(modulNamen.join(','));
  }

  /* Adresse -> Feld. Unbekannte Namen fallen weg; bleibt nichts übrig, gilt das
     Feld als ungültig und die Ansicht zeigt einen leeren Zustand. */
  function feldLesen(params) {
    var phase = HT.daten.eintragMitBegriff(params.phase, 'phase');
    if (!phase) { return null; }

    var module = [];
    String(params.modul || '').split(',').forEach(function (name) {
      var m = HT.daten.eintragMitBegriff(name.trim(), 'modul');
      if (m && module.indexOf(m) === -1) { module.push(m); }
    });
    if (!module.length) { return null; }

    return {
      phase: phase,
      module: module,
      namen: module.map(function (m) { return m.begriff; })
    };
  }

  function imFeld(e, phaseName, modulNamen) {
    if (!enthaelt(e.phasen, phaseName)) { return false; }
    for (var i = 0; i < modulNamen.length; i++) {
      if (enthaelt(e.module, modulNamen[i])) { return true; }
    }
    return false;
  }

  function feldElemente(kategorie, phaseName, modulNamen) {
    return HT.daten.eintraegeDerKategorie(kategorie).filter(function (e) {
      return imFeld(e, phaseName, modulNamen);
    });
  }

  function feldTitel(feld) {
    var namen = feld.namen;
    var module = namen.length > 1
      ? namen.slice(0, -1).join(', ') + ' und ' + namen[namen.length - 1]
      : namen[0];
    return module + ' in der Phase ' + feld.phase.begriff;
  }

  /* Initialisierung und Abschluss gehören beiden Vorgehensweisen; Konzept,
     Realisierung und Einführung nur der klassischen, Umsetzung nur der agilen. */
  function vorgehenText(phase) {
    var treffer = [];
    HT.daten.vorgehensweisen().forEach(function (v) {
      var drin = v.phasen.some(function (p) {
        return HT.daten.normalisieren(p.name) === HT.daten.normalisieren(phase.begriff);
      });
      if (drin) { treffer.push(v.key); }
    });
    if (treffer.length > 1) { return 'in beiden Vorgehensweisen'; }
    if (treffer[0] === 'klassisch') { return 'nur klassische Vorgehensweise'; }
    if (treffer[0] === 'agil') { return 'nur agile Vorgehensweise'; }
    return null;
  }

  /* --- Bausteine der Seite -------------------------------------------------- */

  function marke(text, klasse, titel) {
    return h('span', {
      class: 'feld-marke' + (klasse ? ' ' + klasse : ''),
      title: titel || null,
      text: text
    });
  }

  function typMarke(typ) {
    if (!typ) { return null; }
    return h('span', { class: 'feld-marke feld-marke--typ', dataset: { typ: typ }, text: typ });
  }

  function begriffLink(name, kategorie) {
    var ziel = HT.daten.eintragMitBegriff(name, kategorie);
    if (!ziel) { return document.createTextNode(name); }
    return h('a', { href: verweisZiel(ziel), text: name });
  }

  function begriffZeile(label, namen, kategorie) {
    if (!namen || !namen.length) { return null; }
    var kinder = [h('span', { class: 'feld-e__label', text: label })];
    namen.forEach(function (name, i) {
      if (i) { kinder.push(document.createTextNode(', ')); }
      kinder.push(begriffLink(name, kategorie));
    });
    return h('p', { class: 'feld-e__zeile' }, kinder);
  }

  /* Zeigt bei mehreren Modulen, in welchem der Eintrag steht. */
  function modulMarke(e, feld) {
    if (feld.namen.length < 2) { return null; }
    var eigene = feld.namen.filter(function (m) { return enthaelt(e.module, m); });
    if (!eigene.length) { return null; }
    return marke(eigene.join(' · '), 'feld-marke--modul');
  }

  function aufgabeEintrag(a, feld) {
    var kopf = [h('a', {
      class: 'feld-e__titel',
      href: '#/lexikon?id=' + encodeURIComponent(a.id),
      text: a.begriff
    })];

    if (/^Entscheid\s/i.test(a.begriff)) {
      kopf.push(marke('Entscheidungsaufgabe', 'feld-marke--entscheid',
        'Mit dieser Aufgabe wird ein Entscheid getroffen; sie führt zu einem Meilenstein.'));
    }
    kopf.push(modulMarke(a, feld));

    var andere = HT.daten.phasenSortiert(a.phasen || []).filter(function (p) {
      return HT.daten.normalisieren(p) !== HT.daten.normalisieren(feld.phase.begriff);
    });
    if (andere.length) {
      kopf.push(marke(andere.length === 1 ? 'auch in einer weiteren Phase'
        : 'auch in ' + andere.length + ' weiteren Phasen', 'feld-marke--leise',
        'Dieselbe Aufgabe läuft auch in: ' + andere.join(', ')));
    }

    return h('li', { class: 'eintrag eintrag--aufgabe feld-e' }, [
      h('p', { class: 'feld-e__kopf' }, kopf.filter(function (k) { return !!k; })),
      h('p', { class: 'feld-e__text', text: HT.ui.kuerzen(a.kurz || a.definition || '', 230) }),
      begriffZeile('Verantwortlich', rollenAusText(a.verantwortlich), 'rolle'),
      begriffZeile('Beteiligt', a.beteiligt, 'rolle'),
      begriffZeile('Erzeugt', a.ergebnisse, 'ergebnis')
    ]);
  }

  function ergebnisEintrag(e, feld, erzeuger, meilensteintexte) {
    var kopf = [
      h('a', { class: 'feld-e__titel', href: detailZiel(e), text: e.begriff }),
      typMarke(e.typ)
    ];

    /* Wie auf der Lexikonkarte: «minimal gefordert» kennzeichnet die Dokumente
       aus Tabelle 16. */
    if (e.minimalGefordert && e.typ === 'Dokument') {
      kopf.push(marke('minimal gefordert', 'feld-marke--min',
        'Minimal gefordertes Dokument (Tabelle 16 des Referenzhandbuchs)'));
    }
    kopf.push(modulMarke(e, feld));

    var eigenerText = meilensteintexte[HT.daten.normalisieren(e.begriff)];
    var text = eigenerText || e.kurz || e.definition || '';
    var quellen = erzeuger[HT.daten.normalisieren(e.begriff)] || [];

    return h('li', { class: 'eintrag eintrag--ergebnis feld-e' }, [
      h('p', { class: 'feld-e__kopf' }, kopf.filter(function (k) { return !!k; })),
      h('p', { class: 'feld-e__text', text: HT.ui.kuerzen(text, eigenerText ? 330 : 230) }),
      begriffZeile('Verantwortlich', rollenAusText(e.verantwortlich), 'rolle'),
      begriffZeile('Beteiligt', e.beteiligt, 'rolle'),
      begriffZeile('Entsteht aus', quellen, 'aufgabe')
    ]);
  }

  /* Welche Aufgabe dieses Felds erzeugt welches Ergebnis? (aufgabe.ergebnisse) */
  function erzeugerKarte(aufgaben) {
    var karte = {};
    aufgaben.forEach(function (a) {
      (a.ergebnisse || []).forEach(function (name) {
        var key = HT.daten.normalisieren(name);
        if (!karte[key]) { karte[key] = []; }
        if (karte[key].indexOf(a.begriff) === -1) { karte[key].push(a.begriff); }
      });
    });
    return karte;
  }

  /* Meilensteine trägt die Phase mit eigener Beschreibung — die ist genauer als
     die allgemeine Definition des Ergebnisses. */
  function meilensteinTexte(phase) {
    var texte = {};
    (phase.meilensteine || []).forEach(function (m) {
      if (m && m.name) { texte[HT.daten.normalisieren(m.name)] = m.beschreibung || ''; }
    });
    return texte;
  }

  /* Je Rolle: was sie in diesem Feld verantwortet und woran sie mitwirkt.
     «Beteiligt» lässt weg, was die Rolle ohnehin verantwortet — sonst steht
     derselbe Eintrag zweimal da (die Daten führen die verantwortliche Rolle
     meist auch unter «beteiligt» auf). */
  function rollenSammeln(elemente) {
    var nachName = {};
    var reihenfolge = [];

    function topf(name) {
      if (!nachName[name]) {
        nachName[name] = {
          name: name,
          eintrag: HT.daten.eintragMitBegriff(name, 'rolle'),
          verantwortlich: [],
          beteiligt: []
        };
        reihenfolge.push(nachName[name]);
      }
      return nachName[name];
    }

    elemente.forEach(function (e) {
      rollenAusText(e.verantwortlich).forEach(function (r) {
        var t = topf(r);
        if (t.verantwortlich.indexOf(e) === -1) { t.verantwortlich.push(e); }
      });
      (e.beteiligt || []).forEach(function (r) { topf(r); });
    });

    elemente.forEach(function (e) {
      (e.beteiligt || []).forEach(function (r) {
        var t = topf(r);
        if (t.verantwortlich.indexOf(e) === -1 && t.beteiligt.indexOf(e) === -1) {
          t.beteiligt.push(e);
        }
      });
    });

    return reihenfolge.sort(function (a, b) {
      if (b.verantwortlich.length !== a.verantwortlich.length) {
        return b.verantwortlich.length - a.verantwortlich.length;
      }
      var gb = b.verantwortlich.length + b.beteiligt.length;
      var ga = a.verantwortlich.length + a.beteiligt.length;
      if (gb !== ga) { return gb - ga; }
      return a.name.localeCompare(b.name, 'de');
    });
  }

  /* Aufgaben zuerst, dann Ergebnisse — dieselbe Reihenfolge wie die Abschnitte. */
  function eintragsZeile(label, eintraege) {
    if (!eintraege.length) { return null; }
    var sortiert = eintraege.slice().sort(function (a, b) {
      if (a.kategorie !== b.kategorie) { return a.kategorie === 'aufgabe' ? -1 : 1; }
      return a.begriff.localeCompare(b.begriff, 'de');
    });

    var kinder = [h('span', { class: 'feld-e__label', text: label })];
    sortiert.forEach(function (e, i) {
      if (i) { kinder.push(document.createTextNode(', ')); }
      kinder.push(h('a', { href: verweisZiel(e), text: e.begriff }));
    });
    return h('p', { class: 'feld-e__zeile' }, kinder);
  }

  function rolleEintrag(r) {
    var kopf = [r.eintrag
      ? h('a', {
          class: 'feld-e__titel',
          href: '#/lexikon?id=' + encodeURIComponent(r.eintrag.id),
          text: r.name
        })
      : h('span', { class: 'feld-e__titel', text: r.name })];

    if (r.eintrag && r.eintrag.ebene) {
      kopf.push(marke(r.eintrag.ebene, 'feld-marke--leise', 'Hierarchieebene der Rolle'));
    }

    var text = r.eintrag ? (r.eintrag.kurz || r.eintrag.definition || '') : '';

    return h('li', { class: 'eintrag eintrag--rolle feld-e' }, [
      h('p', { class: 'feld-e__kopf' }, kopf),
      text ? h('p', { class: 'feld-e__text', text: HT.ui.kuerzen(text, 200) }) : null,
      eintragsZeile('Verantwortlich für', r.verantwortlich),
      eintragsZeile('Beteiligt an', r.beteiligt)
    ]);
  }

  /* --- Nachbarfelder -------------------------------------------------------- */

  function feldInhalt(phaseName, modulNamen) {
    return feldElemente('aufgabe', phaseName, modulNamen).length
      + feldElemente('ergebnis', phaseName, modulNamen).length;
  }

  function bandChip(text, ziel, aktiv, anzahl) {
    var kinder = [h('span', { text: text })];
    var titel = null;
    if (anzahl) {
      kinder.push(h('span', { class: 'chip__zahl', text: String(anzahl) }));
      titel = anzahl + ' Aufgaben und Ergebnisse';
    }
    if (aktiv) {
      return h('li', {}, h('span', { class: 'chip', 'aria-current': 'page', title: titel }, kinder));
    }
    return h('li', {}, h('a', { class: 'chip', href: ziel, title: titel }, kinder));
  }

  function bandPhasen(feld) {
    var chips = [];
    HT.daten.phasenKurz.forEach(function (p) {
      var name = p[0];
      var aktiv = HT.daten.normalisieren(name) === HT.daten.normalisieren(feld.phase.begriff);
      var anzahl = feldInhalt(name, feld.namen);
      /* Leere Felder bleiben weg — das eigene bleibt stehen, sonst fehlt der
         Anker im Band. */
      if (!anzahl && !aktiv) { return; }
      chips.push(bandChip(name, feldZiel(feld.namen, name), aktiv, anzahl));
    });
    return chips.length > 1 ? h('ul', { class: 'chips chips--streifen' }, chips) : null;
  }

  function bandModule(feld) {
    var chips = [];
    var eigenesGesetzt = false;

    /* Reihenfolge der Datei module.json — sie folgt den Spalten der Abbildung.
       Die Module dieses Felds stehen als ein Chip (die Grafik zeigt sie als
       eine Spalte). */
    HT.daten.eintraegeDerKategorie('modul').forEach(function (m) {
      if (enthaelt(feld.namen, m.begriff)) {
        if (eigenesGesetzt) { return; }
        eigenesGesetzt = true;
        chips.push(bandChip(feld.namen.join(' / '), null, true,
          feldInhalt(feld.phase.begriff, feld.namen)));
        return;
      }
      var anzahl = feldInhalt(feld.phase.begriff, [m.begriff]);
      if (!anzahl) { return; }
      chips.push(bandChip(m.begriff, feldZiel([m.begriff], feld.phase.begriff), false, anzahl));
    });

    return chips.length > 1 ? h('ul', { class: 'chips chips--streifen' }, chips) : null;
  }

  /* --- Seite ---------------------------------------------------------------- */

  function feldKopf(feld, aufgaben, ergebnisse, rollen) {
    var vorgehen = vorgehenText(feld.phase);
    var minimal = ergebnisse.filter(function (e) {
      return e.minimalGefordert && e.typ === 'Dokument';
    }).length;

    var badges = feld.module.map(function (m) {
      return h('a', { class: 'badge badge--modul', href: '#/lexikon?id=' + encodeURIComponent(m.id) }, [
        HT.ui.katSymbol('modul', 13), h('span', { text: m.begriff })
      ]);
    });
    badges.push(h('a', { class: 'badge badge--phase', href: '#/lexikon?id=' + encodeURIComponent(feld.phase.id) }, [
      HT.ui.katSymbol('phase', 13), h('span', { text: feld.phase.begriff })
    ]));
    if (vorgehen) { badges.push(marke(vorgehen, 'feld-marke--leise')); }

    var kennzahlen = null;
    if (aufgaben.length || ergebnisse.length) {
      var chips = [
        HT.ui.faktenChip('Aufgaben', [document.createTextNode(String(aufgaben.length))]),
        HT.ui.faktenChip('Ergebnisse', [document.createTextNode(String(ergebnisse.length))]),
        HT.ui.faktenChip('Rollen', [document.createTextNode(String(rollen.length))])
      ];
      if (minimal) {
        chips.push(HT.ui.faktenChip('minimal geforderte Dokumente',
          [document.createTextNode(String(minimal))]));
      }
      kennzahlen = h('div', { class: 'fakten' }, chips);
    }

    return h('div', { class: 'kopf kopf--knapp' }, [
      h('div', { class: 'feld-badges' }, badges),
      h('h1', { text: feldTitel(feld) }),
      kennzahlen
    ]);
  }

  function einordnung(feld) {
    var punkte = feld.module.map(function (m) {
      return h('li', {}, [
        h('a', { class: 'feld-e__titel', href: '#/lexikon?id=' + encodeURIComponent(m.id), text: 'Modul ' + m.begriff }),
        h('span', { text: ' — ' + HT.ui.kuerzen(m.kurz || m.definition || '', 200) })
      ]);
    });
    punkte.push(h('li', {}, [
      h('a', {
        class: 'feld-e__titel',
        href: '#/lexikon?id=' + encodeURIComponent(feld.phase.id),
        text: 'Phase ' + feld.phase.begriff
      }),
      h('span', { text: ' — ' + HT.ui.kuerzen(feld.phase.kurz || feld.phase.definition || '', 200) })
    ]));
    return h('ul', { class: 'feld-einordnung' }, punkte);
  }

  function nachbarAbschnitt(feld) {
    var phasenband = bandPhasen(feld);
    var modulband = bandModule(feld);
    if (!phasenband && !modulband) { return null; }

    return h('section', { class: 'feld-abschnitt' }, [
      h('h2', { text: 'Nachbarfelder' }),
      phasenband ? h('p', { class: 'feld-abschnitt__text', text: 'Dasselbe Modul in den anderen Phasen:' }) : null,
      phasenband,
      modulband ? h('p', { class: 'feld-abschnitt__text', text: 'Dieselbe Phase in den anderen Modulen:' }) : null,
      modulband
    ]);
  }

  function feldRendern(behaelter, feld) {
    var aufgaben = feldElemente('aufgabe', feld.phase.begriff, feld.namen)
      .sort(function (a, b) { return a.begriff.localeCompare(b.begriff, 'de'); });

    var ergebnisse = feldElemente('ergebnis', feld.phase.begriff, feld.namen)
      .sort(function (a, b) {
        var ra = TYP_RANG[a.typ] === undefined ? 9 : TYP_RANG[a.typ];
        var rb = TYP_RANG[b.typ] === undefined ? 9 : TYP_RANG[b.typ];
        if (ra !== rb) { return ra - rb; }
        return a.begriff.localeCompare(b.begriff, 'de');
      });

    var rollen = rollenSammeln(aufgaben.concat(ergebnisse));

    behaelter.appendChild(h('p', { class: 'feld-zurueck' }, [
      h('a', { href: '#/ueberblick', text: '← Zurück zum Ergebnisdiagramm' })
    ]));

    behaelter.appendChild(feldKopf(feld, aufgaben, ergebnisse, rollen));
    behaelter.appendChild(einordnung(feld));

    if (!aufgaben.length && !ergebnisse.length) {
      behaelter.appendChild(HT.ui.leerZustand(
        'Für dieses Feld ist nichts erfasst',
        'In dieser Phase sind diesem Modul weder Aufgaben noch Ergebnisse zugeordnet.',
        h('a', { class: 'btn btn--klein', href: '#/ueberblick', text: 'Zum Ergebnisdiagramm' })
      ));
      var nachbarnLeer = nachbarAbschnitt(feld);
      if (nachbarnLeer) { behaelter.appendChild(nachbarnLeer); }
      return;
    }

    if (ergebnisse.length) {
      var erzeuger = erzeugerKarte(aufgaben);
      var texte = meilensteinTexte(feld.phase);
      behaelter.appendChild(h('section', { class: 'feld-abschnitt' }, [
        h('h2', { text: 'Ergebnisse (' + ergebnisse.length + ')' }),
        h('p', { class: 'feld-abschnitt__text', text:
          'Was in dieser Phase in diesem Modul vorliegt — Meilensteine zuerst, danach '
          + 'Dokumente, Zustände und Checklisten.' }),
        h('ul', { class: 'eintraege' }, ergebnisse.map(function (e) {
          return ergebnisEintrag(e, feld, erzeuger, texte);
        }))
      ]));
    }

    if (aufgaben.length) {
      behaelter.appendChild(h('section', { class: 'feld-abschnitt' }, [
        h('h2', { text: 'Aufgaben (' + aufgaben.length + ')' }),
        h('p', { class: 'feld-abschnitt__text', text:
          'Was dafür getan wird. Aufgaben, die auch in anderen Phasen laufen, sind '
          + 'gekennzeichnet.' }),
        h('ul', { class: 'eintraege' }, aufgaben.map(function (a) {
          return aufgabeEintrag(a, feld);
        }))
      ]));
    }

    if (rollen.length) {
      behaelter.appendChild(h('section', { class: 'feld-abschnitt' }, [
        h('h2', { text: 'Rollen (' + rollen.length + ')' }),
        h('p', { class: 'feld-abschnitt__text', text:
          'Wer in diesem Feld mitwirkt — abgeleitet aus den Aufgaben und Ergebnissen '
          + 'oben. «Beteiligt an» lässt weg, was die Rolle ohnehin verantwortet.' }),
        h('ul', { class: 'eintraege' }, rollen.map(rolleEintrag))
      ]));
    }

    var nachbarn = nachbarAbschnitt(feld);
    if (nachbarn) { behaelter.appendChild(nachbarn); }

    behaelter.appendChild(h('p', { class: 'feld-weiter feld-weiter--fuss' }, [
      h('a', {
        class: 'btn btn--klein',
        href: '#/graph?phase=' + encodeURIComponent(feld.phase.begriff)
          + '&modul=' + encodeURIComponent(feld.namen.join(',')),
        text: 'Dieses Feld als Graph'
      }),
      h('a', { class: 'btn btn--klein', href: '#/ueberblick', text: '← Zurück zum Ergebnisdiagramm' })
    ]));
  }


  /* --- Route ---------------------------------------------------------------- */

  function render(behaelter, params) {
    var feld = feldLesen(params || {});
    if (!feld) {
      behaelter.appendChild(HT.ui.leerZustand(
        'Dieses Feld gibt es nicht',
        'Der Link nennt eine Phase oder ein Modul, das nicht erfasst ist.',
        h('a', { class: 'btn btn--klein', href: '#/ueberblick', text: 'Zum Ergebnisdiagramm' })
      ));
      return;
    }
    feldRendern(behaelter, feld);
  }

  /* Der Seitentitel nennt das Feld — jede Kombination ist eine eigene Seite. */
  function titel(params) {
    var feld = feldLesen(params || {});
    return feld ? feldTitel(feld) : 'Feld der Methodenübersicht';
  }

  HT.views.feld = {
    titel: titel,
    nav: 'ueberblick',
    render: render
  };
}(window));
