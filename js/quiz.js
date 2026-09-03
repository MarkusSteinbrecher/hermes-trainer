/* HERMES-Trainer — Ansicht «Quiz».
   Multiple Choice mit vier Antworten, sofortiger Rückmeldung und Auswertung.
   Fragen stammen aus data/quizfragen.json und aus generierten Lexikonfragen. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;
  var DEF_MAX = 170;               // Obergrenze je Antwortoption (Kürzung an Satz-/Wortgrenze)
  var REST_MIN = 45;               // so viel lesbarer Text muss nach dem Maskieren bleiben
  var BUCHSTABEN = ['A', 'B', 'C', 'D', 'E', 'F'];

  var konfig = {
    anzahl: 10,
    filter: [],
    herkunft: 'gemischt'           // 'gemischt' | 'kuratiert' | 'generiert'
  };

  var lauf = null;                 // { fragen, index, gegeben[], beantwortet }
  var hinweis = '';                // Meldung für die Konfigurationsansicht
  var refs = {};

  /* --- Persistenz --------------------------------------------------------- */

  function konfigSpeichern() {
    HT.store.schreib('quiz-konfig', {
      anzahl: konfig.anzahl,
      filter: konfig.filter,
      herkunft: konfig.herkunft
    });
  }

  function konfigLaden() {
    var g = HT.store.lies('quiz-konfig', null);
    if (g && typeof g === 'object') {
      if ([10, 20, 50].indexOf(g.anzahl) !== -1) { konfig.anzahl = g.anzahl; }
      if (['gemischt', 'kuratiert', 'generiert'].indexOf(g.herkunft) !== -1) { konfig.herkunft = g.herkunft; }
      konfig.filter = Array.isArray(g.filter)
        ? g.filter.filter(function (k) { return !!HT.daten.kategorieMeta(k); })
        : [];
    }
  }

  function statistik() {
    var s = HT.store.lies('quiz-statistik', null);
    if (!s || typeof s !== 'object') { s = {}; }
    return {
      laeufe: typeof s.laeufe === 'number' ? s.laeufe : 0,
      fragen: typeof s.fragen === 'number' ? s.fragen : 0,
      richtig: typeof s.richtig === 'number' ? s.richtig : 0
    };
  }

  function statistikErgaenzen(fragen, richtig) {
    var s = statistik();
    s.laeufe += 1;
    s.fragen += fragen;
    s.richtig += richtig;
    HT.store.schreib('quiz-statistik', s);
  }

  /* --- Fragengenerierung -------------------------------------------------- */

  /** Erster Satz einer Definition; bei Überlänge an der Wortgrenze gekürzt. */
  function definitionKurz(text) {
    var satz = HT.daten.ersterSatz(text);
    return satz.length <= DEF_MAX ? satz : HT.ui.kuerzen(satz, DEF_MAX);
  }

  /** Nur einzelne Begriffe, keine Aufzählungen. */
  function einzelwert(text) {
    return !!text && !/[,;\/]| und /.test(text);
  }

  function eindeutig(liste) {
    var gesehen = {};
    return liste.filter(function (x) {
      var k = HT.daten.normalisieren(x);
      if (!k || gesehen[k]) { return false; }
      gesehen[k] = true;
      return true;
    });
  }

  /** Zieht bis zu «anzahl» Distraktoren, die von den ausgeschlossenen Werten abweichen. */
  function distraktoren(kandidaten, ausschluss, anzahl) {
    var verboten = {};
    (ausschluss || []).forEach(function (a) {
      verboten[HT.daten.normalisieren(a)] = true;
    });
    var frei = eindeutig(kandidaten).filter(function (k) {
      return !verboten[HT.daten.normalisieren(k)];
    });
    return HT.ui.mischen(frei).slice(0, anzahl);
  }

  function frageBauen(basis, richtigeAntwort, falsche) {
    if (falsche.length < 3) { return null; }
    var optionen = HT.ui.mischen([richtigeAntwort].concat(falsche.slice(0, 3)));
    basis.antworten = optionen;
    basis.richtig = optionen.indexOf(richtigeAntwort);
    basis.herkunft = 'generiert';
    return basis;
  }

  function generiereFragen(eintraege) {
    var fragen = [];
    var nachKategorie = {};

    eintraege.forEach(function (e) {
      if (!nachKategorie[e.kategorie]) { nachKategorie[e.kategorie] = []; }
      nachKategorie[e.kategorie].push(e);
    });

    var alleRollen = HT.daten.eintraegeDerKategorie('rolle').map(function (r) { return r.begriff; });
    var alleModule = HT.daten.eintraegeDerKategorie('modul').map(function (m) { return m.begriff; });

    /* Zusätzliche Kandidaten aus den Querverweisen selbst, falls die
       Rollen-/Moduldatei noch dünn ist. */
    HT.daten.alleEintraege().forEach(function (e) {
      if (e.verantwortlich) { alleRollen.push(e.verantwortlich); }
      if (e.module && e.module.length) { alleModule = alleModule.concat(e.module); }
    });
    /* Mehrfachnennungen wie «Projektleiter, Testverantwortlicher» taugen nicht als
       Antwortoption: eine abweichend gebaute Option verrät sich sofort. */
    alleRollen = eindeutig(alleRollen).filter(einzelwert);
    alleModule = eindeutig(alleModule).filter(einzelwert);

    /* Dokumente, die laut Tabelle 16 nicht minimal gefordert sind — Distraktoren für Typ (7). */
    var nichtMinimal = HT.daten.eintraegeDerKategorie('ergebnis')
      .filter(function (x) { return x.typ === 'Dokument' && !x.minimalGefordert; })
      .map(function (x) { return x.begriff; });

    /* Manche Einträge teilen sich einen Formulierungsbaustein — «Checkliste
       Projektabbruch» und «Checkliste Releasefreigabe» sind nach dem Maskieren
       wortgleich. Solche Zitate passen auf mehrere Begriffe und taugen nicht
       als Frage. */
    var maskenZaehler = {};
    function maskenSchluessel(e) {
      return e.kategorie + '|' + HT.daten.normalisieren(HT.ui.ohneBegriff(e.definition, e.begriff));
    }
    eintraege.forEach(function (e) {
      if (!e.definition) { return; }
      var s = maskenSchluessel(e);
      maskenZaehler[s] = (maskenZaehler[s] || 0) + 1;
    });

    eintraege.forEach(function (e) {
      var geschwister = nachKategorie[e.kategorie] || [];
      var meta = HT.daten.kategorieMeta(e.kategorie);
      var bezeichnung = meta ? meta.singular : 'Begriff';

      /* (1) Definition → Begriff */
      var maskierteDef = HT.ui.ohneBegriff(e.definition, e.begriff);
      if (e.definition
          && HT.ui.restlaenge(maskierteDef) >= REST_MIN
          && !HT.ui.enthaeltBegriff(maskierteDef, e.begriff)
          && maskenZaehler[maskenSchluessel(e)] === 1) {
        var begriffe = geschwister.map(function (g) { return g.begriff; });
        var f1 = frageBauen({
          id: 'gen-def-begriff-' + e.id,
          kategorie: e.kategorie,
          frage: 'Welcher Begriff ist so definiert?',
          zitat: maskierteDef,
          erklaerung: 'Richtig ist ' + HT.ui.zitat(e.begriff) + '. '
            + (e.pruefungshinweis || e.abgrenzung || ''),
          quelle: e.quelle
        }, e.begriff, distraktoren(begriffe, [e.begriff], 3));
        if (f1) { fragen.push(f1); }
      }

      /* (2) Begriff → Definition */
      var richtigeDef = definitionKurz(HT.ui.ohneBegriff(e.definition, e.begriff));
      if (e.definition && !HT.ui.enthaeltBegriff(richtigeDef, e.begriff)) {
        /* Jede Option wird um ihren eigenen Begriff bereinigt, damit keine
           Antwort durch den enthaltenen Suchbegriff auffällt. Optionen, in
           denen der gefragte Begriff noch steckt, fallen ganz weg — sie
           würden auf die falsche Antwort zeigen. */
        var defs = geschwister
          .filter(function (g) { return g.definition && g.id !== e.id; })
          .map(function (g) { return definitionKurz(HT.ui.ohneBegriff(g.definition, g.begriff)); })
          .filter(function (d) { return !HT.ui.enthaeltBegriff(d, e.begriff); });
        var f2 = frageBauen({
          id: 'gen-begriff-def-' + e.id,
          kategorie: e.kategorie,
          frage: 'Welche Definition gehört zu ' + bezeichnung + ' ' + HT.ui.zitat(e.begriff) + '?',
          zitat: '',
          erklaerung: (e.pruefungshinweis || e.abgrenzung || e.definition),
          quelle: e.quelle
        }, richtigeDef, distraktoren(defs, [richtigeDef], 3));
        if (f2) { fragen.push(f2); }
      }

      /* (3) Aufgabe → verantwortliche Rolle (nur bei genau einer Rolle) */
      if (e.kategorie === 'aufgabe' && einzelwert(e.verantwortlich)) {
        var f3 = frageBauen({
          id: 'gen-verantwortlich-' + e.id,
          kategorie: 'rolle',
          frage: 'Welche Rolle ist für die Aufgabe ' + HT.ui.zitat(e.begriff) + ' verantwortlich?',
          zitat: '',
          erklaerung: 'Verantwortlich ist ' + HT.ui.zitat(e.verantwortlich) + '. '
            + (e.pruefungshinweis || ''),
          quelle: e.quelle
        }, e.verantwortlich, distraktoren(alleRollen, [e.verantwortlich], 3));
        if (f3) { fragen.push(f3); }
      }

      /* (5) Ergebnis → verantwortliche Rolle (nur bei genau einer Rolle) */
      if (e.kategorie === 'ergebnis' && einzelwert(e.verantwortlich)) {
        var f5 = frageBauen({
          id: 'gen-erg-rolle-' + e.id,
          kategorie: 'rolle',
          frage: 'Welche Rolle verantwortet das Ergebnis ' + HT.ui.zitat(e.begriff) + '?',
          zitat: '',
          erklaerung: 'Verantwortlich ist ' + HT.ui.zitat(e.verantwortlich) + '. ' + (e.pruefungshinweis || ''),
          quelle: e.quelle
        }, e.verantwortlich, distraktoren(alleRollen, [e.verantwortlich], 3));
        if (f5) { fragen.push(f5); }
      }

      /* (6) Aufgabe → Modul (nur bei eindeutiger Zuordnung) */
      if (e.kategorie === 'aufgabe' && e.module && e.module.length === 1 && einzelwert(e.module[0])) {
        var f6 = frageBauen({
          id: 'gen-aufg-modul-' + e.id,
          kategorie: 'modul',
          frage: 'Zu welchem Modul gehört die Aufgabe ' + HT.ui.zitat(e.begriff) + '?',
          zitat: '',
          erklaerung: 'Die Aufgabe ' + HT.ui.zitat(e.begriff) + ' gehört zum Modul '
            + HT.ui.zitat(e.module[0]) + '. ' + (e.pruefungshinweis || ''),
          quelle: e.quelle
        }, e.module[0], distraktoren(alleModule, e.module, 3));
        if (f6) { fragen.push(f6); }
      }

      /* (7) Minimal gefordertes Dokument erkennen (Tabelle 16 des Handbuchs) */
      if (e.kategorie === 'ergebnis' && e.typ === 'Dokument' && e.minimalGefordert && nichtMinimal.length >= 3) {
        var f7 = frageBauen({
          id: 'gen-minimal-' + e.id,
          kategorie: 'ergebnis',
          frage: 'Welches dieser Dokumente gehört zu den minimal geforderten Dokumenten?',
          zitat: '',
          erklaerung: HT.ui.zitat(e.begriff) + ' ist ein minimal gefordertes Dokument; seine Erarbeitung ist zur Erfüllung der Projekt-Governance obligatorisch. '
            + 'Die anderen drei Dokumente sind in Tabelle 16 des Referenzhandbuchs nicht als minimal gefordert markiert.',
          quelle: e.quelle
        }, e.begriff, distraktoren(nichtMinimal, [e.begriff], 3));
        if (f7) { fragen.push(f7); }
      }

      /* (4) Ergebnis → Modul (nur bei eindeutiger Zuordnung) */
      if (e.kategorie === 'ergebnis' && e.module && e.module.length === 1 && einzelwert(e.module[0])) {
        var f4 = frageBauen({
          id: 'gen-modul-' + e.id,
          kategorie: 'modul',
          frage: 'Zu welchem Modul gehört das Ergebnis ' + HT.ui.zitat(e.begriff) + '?',
          zitat: '',
          erklaerung: 'Das Ergebnis ' + HT.ui.zitat(e.begriff) + ' gehört zum Modul '
            + HT.ui.zitat(e.module[0]) + '. ' + (e.pruefungshinweis || ''),
          quelle: e.quelle
        }, e.module[0], distraktoren(alleModule, e.module, 3));
        if (f4) { fragen.push(f4); }
      }
    });

    return fragen;
  }

  function passendeEintraege() {
    var alle = HT.daten.alleEintraege();
    if (!konfig.filter.length) { return alle; }
    return alle.filter(function (e) { return konfig.filter.indexOf(e.kategorie) !== -1; });
  }

  function kuratiertePool() {
    var alle = HT.daten.quizfragen();
    if (!konfig.filter.length) { return alle.slice(); }
    return alle.filter(function (f) {
      if (!f.kategorie) { return true; }        // ohne Kategorieangabe immer zulassen
      return konfig.filter.indexOf(f.kategorie) !== -1;
    });
  }

  function fragenZusammenstellen() {
    var kuratiert = HT.ui.mischen(kuratiertePool());
    var generiert = konfig.herkunft === 'kuratiert' ? [] : HT.ui.mischen(generiereFragen(passendeEintraege()));

    if (konfig.herkunft === 'kuratiert') { generiert = []; }
    if (konfig.herkunft === 'generiert') { kuratiert = []; }

    var ziel = konfig.anzahl;
    var auswahl = [];

    if (konfig.herkunft === 'gemischt') {
      var ausKuratiert = Math.min(kuratiert.length, Math.ceil(ziel * 2 / 3));
      auswahl = kuratiert.slice(0, ausKuratiert);
      auswahl = auswahl.concat(generiert.slice(0, ziel - auswahl.length));
      if (auswahl.length < ziel) {
        auswahl = auswahl.concat(kuratiert.slice(ausKuratiert, ausKuratiert + (ziel - auswahl.length)));
      }
    } else {
      auswahl = kuratiert.concat(generiert).slice(0, ziel);
    }

    /* Nicht zweimal dieselbe Frage im selben Lauf. */
    var gesehen = {};
    auswahl = auswahl.filter(function (f) {
      if (gesehen[f.id]) { return false; }
      gesehen[f.id] = true;
      return true;
    });

    return HT.ui.mischen(auswahl);
  }

  /* --- Ablauf ------------------------------------------------------------- */

  function starten() {
    var fragen = fragenZusammenstellen();
    if (!fragen.length) {
      lauf = null;
      hinweis = konfig.herkunft === 'kuratiert'
        ? 'Für diese Auswahl gibt es keine Prüfungsfragen. Quelle auf «Gemischt» oder «Nur Lexikonfragen» umstellen.'
        : 'Für diese Auswahl lassen sich keine Fragen bilden — eine Kategorie braucht mindestens vier Einträge, '
          + 'damit plausible falsche Antworten entstehen. Bitte weitere Kategorien zulassen.';
      zeichnen();
      return;
    }
    hinweis = '';
    lauf = { fragen: fragen, index: 0, gegeben: [], beantwortet: false };
    zeichnen();
  }

  function antworten(index) {
    if (!lauf || lauf.beantwortet) { return; }
    lauf.beantwortet = true;
    lauf.gegeben[lauf.index] = index;
    zeichnen();
  }

  function weiter() {
    if (!lauf) { return; }
    if (lauf.index + 1 >= lauf.fragen.length) {
      var richtig = zaehleRichtige();
      statistikErgaenzen(lauf.fragen.length, richtig);
      lauf.fertig = true;
    } else {
      lauf.index += 1;
      lauf.beantwortet = false;
    }
    zeichnen();
  }

  function zaehleRichtige() {
    if (!lauf) { return 0; }
    var n = 0;
    lauf.fragen.forEach(function (f, i) {
      if (lauf.gegeben[i] === f.richtig) { n++; }
    });
    return n;
  }

  /* --- Darstellung: Konfiguration ---------------------------------------- */

  function schalterGruppe(titel, optionen, istAktiv, beiWahl) {
    var liste = h('ul', { class: 'chips' });
    var knoepfe = [];

    function markieren() {
      knoepfe.forEach(function (b) {
        b.setAttribute('aria-pressed', istAktiv(b.dataset.wert) ? 'true' : 'false');
      });
    }

    optionen.forEach(function (opt) {
      var btn = h('button', {
        type: 'button', class: 'chip', 'aria-pressed': 'false',
        dataset: { wert: String(opt.wert) },
        text: opt.label
      });
      btn.addEventListener('click', function () {
        beiWahl(opt.wert);
        markieren();
        konfigSpeichern();
      });
      knoepfe.push(btn);
      liste.appendChild(h('li', {}, btn));
    });

    markieren();
    return h('div', { class: 'feldgruppe' }, [
      h('p', { class: 'feldgruppe__titel', text: titel }),
      liste
    ]);
  }

  function konfigAnsicht(behaelter) {
    var st = statistik();

    behaelter.appendChild(h('div', { class: 'kopf' }, [
      h('h1', { text: 'Quiz' }),
      h('p', { text: 'Vier Antworten, eine ist richtig. Rückmeldung samt Quellenlink kommt sofort.' })
    ]));

    var warnung = HT.app.datenWarnung();
    if (warnung) { behaelter.appendChild(warnung); }

    if (hinweis) {
      behaelter.appendChild(h('div', { class: 'datenwarnung', role: 'status', text: hinweis }));
      hinweis = '';
    }

    if (st.fragen > 0) {
      behaelter.appendChild(h('div', { class: 'statistik' }, [
        h('div', { class: 'statistik__feld' }, [
          h('span', { class: 'statistik__wert', text: String(st.laeufe) }),
          h('span', { class: 'statistik__label', text: st.laeufe === 1 ? 'Quiz' : 'Quiz-Läufe' })
        ]),
        h('div', { class: 'statistik__feld' }, [
          h('span', { class: 'statistik__wert', text: String(st.fragen) }),
          h('span', { class: 'statistik__label', text: 'Fragen' })
        ]),
        h('div', { class: 'statistik__feld' }, [
          h('span', { class: 'statistik__wert', text: HT.ui.prozent(st.richtig, st.fragen) + ' %' }),
          h('span', { class: 'statistik__label', text: 'richtig' })
        ])
      ]));
    }

    behaelter.appendChild(schalterGruppe('Anzahl Fragen',
      [{ wert: 10, label: '10' }, { wert: 20, label: '20' }, { wert: 50, label: '50' }],
      function (w) { return String(konfig.anzahl) === w; },
      function (w) { konfig.anzahl = w; }));

    behaelter.appendChild(schalterGruppe('Fragenquelle', [
      { wert: 'gemischt', label: 'Gemischt' },
      { wert: 'kuratiert', label: 'Nur Prüfungsfragen' },
      { wert: 'generiert', label: 'Nur Lexikonfragen' }
    ], function (w) { return konfig.herkunft === w; },
      function (w) { konfig.herkunft = w; }));

    behaelter.appendChild(h('p', {
      class: 'trefferzahl',
      text: 'Im Bestand: ' + HT.daten.quizfragen().length + ' kuratierte Prüfungsfragen mit Belegstelle im Referenzhandbuch'
        + ' · Lexikonfragen entstehen automatisch aus ' + HT.daten.alleEintraege().length + ' Einträgen.'
    }));

    /* Kategorienfilter */
    var katListe = h('ul', { class: 'chips chips--streifen', 'aria-label': 'Kategorien filtern' });
    var katKnoepfe = [];

    function katMarkieren() {
      katKnoepfe.forEach(function (b) {
        var kat = b.dataset.kat;
        var aktiv = kat === '' ? konfig.filter.length === 0 : konfig.filter.indexOf(kat) !== -1;
        b.setAttribute('aria-pressed', aktiv ? 'true' : 'false');
      });
    }

    function katChip(key, label) {
      var btn = h('button', {
        type: 'button', class: 'chip', 'aria-pressed': 'false',
        dataset: { kat: key }, text: label
      });
      btn.addEventListener('click', function () {
        if (key === '') {
          konfig.filter = [];
        } else {
          var i = konfig.filter.indexOf(key);
          if (i === -1) { konfig.filter.push(key); } else { konfig.filter.splice(i, 1); }
        }
        katMarkieren();
        konfigSpeichern();
      });
      katKnoepfe.push(btn);
      katListe.appendChild(h('li', {}, btn));
    }

    katChip('', 'Alle');
    HT.daten.kategorien().forEach(function (kat) {
      if (!HT.daten.eintraegeDerKategorie(kat.key).length) { return; }
      katChip(kat.key, kat.label);
    });
    katMarkieren();

    behaelter.appendChild(h('div', { class: 'feldgruppe' }, [
      h('p', { class: 'feldgruppe__titel', text: 'Kategorien' }),
      katListe
    ]));

    var vorrat = HT.daten.quizfragen().length + HT.daten.alleEintraege().length;
    if (!vorrat) {
      behaelter.appendChild(HT.ui.leerZustand(
        'Noch keine Fragen verfügbar',
        'Sobald Inhalte in data/ erfasst sind, entstehen daraus Quizfragen.'
      ));
      return;
    }

    behaelter.appendChild(h('button', {
      type: 'button', class: 'btn btn--primaer btn--breit', text: 'Quiz starten',
      on: { click: starten }
    }));

    if (st.fragen > 0) {
      behaelter.appendChild(h('p', { class: 'mehr-laden' }, h('button', {
        type: 'button', class: 'btn btn--klein', text: 'Statistik zurücksetzen',
        on: { click: function () {
          if (global.confirm('Quiz-Statistik wirklich zurücksetzen?')) {
            HT.store.loesche('quiz-statistik');
            zeichnen();
          }
        } }
      })));
    }
  }

  /** Belegzitat aus dem Referenzhandbuch mit Kapitel und Seite. */
  function belegElement(beleg) {
    if (!beleg || !beleg.zitat) { return null; }
    var ort = [];
    if (beleg.kapitel) { ort.push('Kap. ' + beleg.kapitel); }
    if (beleg.seite) { ort.push('S. ' + beleg.seite); }
    return h('div', { class: 'beleg' }, [
      h('span', { class: 'beleg__kopf', text: 'Beleg im Referenzhandbuch' + (ort.length ? ' · ' + ort.join(', ') : '') }),
      h('p', { text: '«' + beleg.zitat + '»' })
    ]);
  }

  /* --- Darstellung: Frage ------------------------------------------------- */

  function frageAnsicht(behaelter) {
    var f = lauf.fragen[lauf.index];
    var gegeben = lauf.gegeben[lauf.index];
    var istBeantwortet = lauf.beantwortet;

    behaelter.appendChild(h('div', { class: 'quiz-kopf' }, [
      h('span', { text: 'Frage ' + (lauf.index + 1) + ' von ' + lauf.fragen.length }),
      h('span', { text: f.herkunft === 'kuratiert' ? 'Prüfungsfrage' : 'Lexikonfrage (generiert)' })
    ]));

    var anteil = HT.ui.prozent(lauf.index, lauf.fragen.length);
    var fuellung = h('div', { class: 'fortschritt__fuellung' });
    fuellung.style.width = anteil + '%';
    behaelter.appendChild(h('div', { class: 'fortschritt__balken', 'aria-hidden': 'true' }, fuellung));

    behaelter.appendChild(h('h1', { class: 'frage' }, [
      h('span', { text: f.frage }),
      f.zitat ? h('span', { class: 'frage__zitat', text: HT.ui.zitat(f.zitat) }) : null
    ]));

    var liste = h('ul', { class: 'antwort-liste' });
    f.antworten.forEach(function (a, i) {
      var klasse = 'antwort';
      if (istBeantwortet) {
        if (i === f.richtig) {
          klasse += ' antwort--richtig';
        } else if (i === gegeben) {
          klasse += ' antwort--falsch';
        } else {
          klasse += ' antwort--blass';
        }
      }
      var btn = h('button', {
        type: 'button',
        class: klasse,
        disabled: istBeantwortet
      }, [
        h('span', { class: 'antwort__marke', 'aria-hidden': 'true', text: BUCHSTABEN[i] || String(i + 1) }),
        h('span', { text: a })
      ]);
      if (istBeantwortet && i === f.richtig) {
        btn.setAttribute('aria-label', 'Richtige Antwort: ' + a);
      }
      btn.addEventListener('click', function () { antworten(i); });
      liste.appendChild(h('li', {}, btn));
    });
    behaelter.appendChild(liste);

    if (istBeantwortet) {
      var richtig = gegeben === f.richtig;
      var rueck = h('div', {
        class: 'rueckmeldung ' + (richtig ? 'rueckmeldung--gut' : 'rueckmeldung--schlecht'),
        tabindex: '-1',
        role: 'status'
      }, [
        h('p', { class: 'rueckmeldung__titel', text: richtig ? 'Richtig' : 'Falsch' }),
        richtig ? null : h('p', { text: 'Richtig wäre: ' + f.antworten[f.richtig] }),
        f.erklaerung ? h('p', { text: f.erklaerung }) : null,
        belegElement(f.beleg),
        HT.ui.quellenLink(f.quelle)
      ]);
      behaelter.appendChild(rueck);

      behaelter.appendChild(h('button', {
        type: 'button', class: 'btn btn--primaer btn--breit',
        text: lauf.index + 1 >= lauf.fragen.length ? 'Auswertung anzeigen' : 'Weiter',
        on: { click: weiter }
      }));

      try { rueck.focus({ preventScroll: false }); } catch (e) { rueck.focus(); }
    }

    behaelter.appendChild(h('p', { class: 'mehr-laden' }, h('button', {
      type: 'button', class: 'btn btn--klein', text: 'Quiz abbrechen',
      on: { click: function () { lauf = null; zeichnen(); } }
    })));
  }

  /* --- Darstellung: Auswertung ------------------------------------------- */

  function auswertungAnsicht(behaelter) {
    var richtig = zaehleRichtige();
    var gesamt = lauf.fragen.length;
    var anteil = HT.ui.prozent(richtig, gesamt);

    behaelter.appendChild(h('div', { class: 'kopf' }, [
      h('h1', { text: 'Auswertung' })
    ]));

    behaelter.appendChild(h('div', { class: 'box abschluss' }, [
      h('p', { class: 'abschluss__zahl', text: richtig + ' / ' + gesamt }),
      h('p', { text: anteil + ' % richtig beantwortet' })
    ]));

    var fehler = [];
    lauf.fragen.forEach(function (f, i) {
      if (lauf.gegeben[i] !== f.richtig) { fehler.push({ f: f, gegeben: lauf.gegeben[i] }); }
    });

    if (fehler.length) {
      behaelter.appendChild(h('h2', { text: fehler.length === 1 ? 'Ein Fehler' : fehler.length + ' Fehler' }));
      behaelter.appendChild(h('ul', { class: 'ergebnis-liste' }, fehler.map(function (x) {
        var gegebenText = (typeof x.gegeben === 'number' && x.f.antworten[x.gegeben])
          ? x.f.antworten[x.gegeben]
          : 'keine Antwort';
        return h('li', { class: 'fehler-eintrag' }, [
          h('p', { class: 'fehler-eintrag__frage', text: x.f.frage }),
          x.f.zitat ? h('p', { class: 'fehler-eintrag__zeile', text: HT.ui.zitat(x.f.zitat) }) : null,
          h('p', { class: 'fehler-eintrag__zeile' }, [
            h('b', { class: 'tag-schlecht', text: 'Gewählt: ' }),
            h('span', { text: gegebenText })
          ]),
          h('p', { class: 'fehler-eintrag__zeile' }, [
            h('b', { class: 'tag-gut', text: 'Richtig: ' }),
            h('span', { text: x.f.antworten[x.f.richtig] })
          ]),
          x.f.erklaerung ? h('p', { class: 'fehler-eintrag__zeile', text: x.f.erklaerung }) : null,
          belegElement(x.f.beleg),
          HT.ui.quellenLink(x.f.quelle)
        ]);
      })));
    } else {
      behaelter.appendChild(h('p', { text: 'Alle Fragen richtig beantwortet.' }));
    }

    behaelter.appendChild(h('div', { class: 'btn-reihe', style: 'margin-top:1rem' }, [
      h('button', {
        type: 'button', class: 'btn btn--primaer', text: 'Neues Quiz, gleiche Einstellungen',
        on: { click: starten }
      }),
      h('button', {
        type: 'button', class: 'btn', text: 'Einstellungen ändern',
        on: { click: function () { lauf = null; zeichnen(); } }
      })
    ]));
  }

  /* --- Zeichnen ----------------------------------------------------------- */

  function zeichnen() {
    if (!refs.behaelter) { return; }
    HT.ui.leeren(refs.behaelter);

    if (!lauf) {
      konfigAnsicht(refs.behaelter);
      return;
    }
    if (lauf.fertig) {
      auswertungAnsicht(refs.behaelter);
      return;
    }
    frageAnsicht(refs.behaelter);
  }

  function render(behaelter, params) {
    if (!konfig.geladen) {
      konfigLaden();
      konfig.geladen = true;
    }
    if (params && params.kat && HT.daten.kategorieMeta(params.kat)) {
      konfig.filter = [params.kat];
    }
    lauf = null;
    refs.behaelter = behaelter;
    zeichnen();
  }

  HT.views.quiz = {
    titel: 'Quiz',
    render: render
  };
}(window));
