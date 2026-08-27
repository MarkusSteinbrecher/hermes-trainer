/* HERMES-Trainer — Datenzugriff.
   Lädt die JSON-Dateien aus data/ (relative Pfade, GitHub-Pages-tauglich),
   normalisiert die Einträge und stellt Such-/Filterfunktionen bereit.
   Fehlende, leere oder fehlerhafte Dateien blockieren die App nicht. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};

  /* Feste Dateiliste gemäss SCHEMA.md */
  var KATEGORIEN = [
    { key: 'phase',        datei: 'phasen',        label: 'Phasen',        singular: 'Phase' },
    { key: 'szenario',     datei: 'szenarien',     label: 'Szenarien',     singular: 'Szenario' },
    { key: 'modul',        datei: 'module',        label: 'Module',        singular: 'Modul' },
    { key: 'aufgabe',      datei: 'aufgaben',      label: 'Aufgaben',      singular: 'Aufgabe' },
    { key: 'ergebnis',     datei: 'ergebnisse',    label: 'Ergebnisse',    singular: 'Ergebnis' },
    { key: 'rolle',        datei: 'rollen',        label: 'Rollen',        singular: 'Rolle' },
    { key: 'grundbegriff', datei: 'grundbegriffe', label: 'Grundbegriffe', singular: 'Grundbegriff' }
  ];

  var QUIZ_DATEI = 'quizfragen';

  var KAT_NACH_KEY = {};
  KATEGORIEN.forEach(function (k) { KAT_NACH_KEY[k.key] = k; });

  /* Kanonische Phasenreihenfolge (HERMES 2022). */
  var PHASEN_ORDNUNG = ['initialisierung', 'konzept', 'realisierung', 'einführung', 'einfuehrung'];

  var zustand = {
    eintraege: [],
    nachId: {},
    nachKategorie: {},
    quizfragen: [],
    fehler: [],       // Namen der Dateien, die nicht geladen werden konnten
    geladen: false
  };

  /* --- Textnormalisierung für die Suche ---------------------------------- */

  function umlauteAusschreiben(text) {
    return text
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
      .replace(/Ä/g, 'ae').replace(/Ö/g, 'oe').replace(/Ü/g, 'ue')
      .replace(/ß/g, 'ss');
  }

  function diakritikaEntfernen(text) {
    try {
      return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {
      return text;
    }
  }

  function normalisieren(text) {
    var t = String(text === null || text === undefined ? '' : text).toLowerCase();
    return t.replace(/\s+/g, ' ').trim();
  }

  /** Beide Schreibvarianten, damit «grundsätze», «grundsaetze» und «grundsatze» treffen. */
  function suchvarianten(text) {
    var t = normalisieren(text);
    var a = umlauteAusschreiben(t);
    var b = diakritikaEntfernen(t);
    return a === b ? [a] : [a, b];
  }

  /* --- Normalisierung der Einträge --------------------------------------- */

  function alsArray(wert) {
    if (Array.isArray(wert)) {
      return wert.filter(function (x) { return x !== null && x !== undefined && x !== ''; });
    }
    if (typeof wert === 'string' && wert.trim()) { return [wert.trim()]; }
    return [];
  }

  function alsText(wert) {
    if (typeof wert === 'string') { return wert.trim(); }
    if (typeof wert === 'number') { return String(wert); }
    return '';
  }

  function slug(text) {
    return diakritikaEntfernen(umlauteAusschreiben(String(text || '').toLowerCase()))
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'eintrag';
  }

  function normEintrag(roh, kategorieKey, index) {
    if (!roh || typeof roh !== 'object') { return null; }

    var begriff = alsText(roh.begriff);
    if (!begriff) { return null; }              // ohne Begriff kein brauchbarer Eintrag

    var kategorie = alsText(roh.kategorie) || kategorieKey;
    if (!KAT_NACH_KEY[kategorie]) { kategorie = kategorieKey; }

    var quelle = null;
    if (roh.quelle && typeof roh.quelle === 'object' && alsText(roh.quelle.url)) {
      quelle = {
        url: alsText(roh.quelle.url),
        bezeichnung: alsText(roh.quelle.bezeichnung) || 'HERMES online'
      };
    }

    var meilensteine = [];
    if (Array.isArray(roh.meilensteine)) {
      roh.meilensteine.forEach(function (m) {
        if (typeof m === 'string' && m.trim()) {
          meilensteine.push({ name: m.trim(), beschreibung: '' });
        } else if (m && typeof m === 'object' && alsText(m.name)) {
          meilensteine.push({ name: alsText(m.name), beschreibung: alsText(m.beschreibung) });
        }
      });
    }

    var e = {
      id: alsText(roh.id) || (kategorie + '-' + slug(begriff) + '-' + index),
      kategorie: kategorie,
      begriff: begriff,
      definition: alsText(roh.definition),
      details: alsText(roh.details),
      abgrenzung: alsText(roh.abgrenzung),
      pruefungshinweis: alsText(roh.pruefungshinweis),
      verantwortlich: alsText(roh.verantwortlich),
      ebene: alsText(roh.ebene),
      beteiligt: alsArray(roh.beteiligt),
      phasen: alsArray(roh.phasen),
      module: alsArray(roh.module),
      szenarien: alsArray(roh.szenarien),
      ergebnisse: alsArray(roh.ergebnisse),
      meilensteine: meilensteine,
      quelle: quelle,
      reihenfolge: index
    };

    e.suchtext = suchvarianten([
      e.begriff, e.definition, e.details, e.abgrenzung, e.pruefungshinweis,
      e.verantwortlich, e.ebene,
      e.beteiligt.join(' '), e.phasen.join(' '), e.module.join(' '),
      e.szenarien.join(' '), e.ergebnisse.join(' '),
      meilensteine.map(function (m) { return m.name + ' ' + m.beschreibung; }).join(' ')
    ].join(' ')).join('  ');

    return e;
  }

  function normQuizfrage(roh, index) {
    if (!roh || typeof roh !== 'object') { return null; }
    var frage = alsText(roh.frage);
    var antworten = Array.isArray(roh.antworten)
      ? roh.antworten.map(alsText).filter(function (a) { return !!a; })
      : [];
    var richtig = typeof roh.richtig === 'number' ? roh.richtig : parseInt(roh.richtig, 10);

    if (!frage || antworten.length < 2) { return null; }
    if (!isFinite(richtig) || richtig < 0 || richtig >= antworten.length) { return null; }

    var quelle = null;
    if (roh.quelle && typeof roh.quelle === 'object' && alsText(roh.quelle.url)) {
      quelle = {
        url: alsText(roh.quelle.url),
        bezeichnung: alsText(roh.quelle.bezeichnung) || 'HERMES online'
      };
    }

    return {
      id: alsText(roh.id) || ('q-kuratiert-' + index),
      herkunft: 'kuratiert',
      kategorie: alsText(roh.kategorie) || '',
      frage: frage,
      zitat: '',
      antworten: antworten,
      richtig: richtig,
      erklaerung: alsText(roh.erklaerung),
      quelle: quelle
    };
  }

  /* --- Laden -------------------------------------------------------------- */

  function ladeJson(dateiname) {
    return fetch('data/' + dateiname + '.json', { credentials: 'same-origin' })
      .then(function (antwort) {
        if (!antwort.ok) { throw new Error('HTTP ' + antwort.status); }
        return antwort.json();
      })
      .then(function (json) {
        return Array.isArray(json) ? json : [];
      })
      .catch(function () {
        zustand.fehler.push(dateiname + '.json');
        return [];
      });
  }

  function laden() {
    if (zustand.geladen) { return Promise.resolve(zustand); }

    var aufgaben = KATEGORIEN.map(function (kat) { return ladeJson(kat.datei); });
    aufgaben.push(ladeJson(QUIZ_DATEI));

    return Promise.all(aufgaben).then(function (ergebnisse) {
      var alle = [];
      var gesehen = {};

      KATEGORIEN.forEach(function (kat, i) {
        var liste = ergebnisse[i] || [];
        zustand.nachKategorie[kat.key] = [];
        liste.forEach(function (roh, idx) {
          var e = normEintrag(roh, kat.key, idx);
          if (!e) { return; }
          if (gesehen[e.id]) { e.id = e.id + '-' + idx; }   // doppelte IDs entschärfen
          gesehen[e.id] = true;
          alle.push(e);
          if (!zustand.nachKategorie[e.kategorie]) { zustand.nachKategorie[e.kategorie] = []; }
          zustand.nachKategorie[e.kategorie].push(e);
          zustand.nachId[e.id] = e;
        });
      });

      zustand.eintraege = alle;

      var rohFragen = ergebnisse[ergebnisse.length - 1] || [];
      zustand.quizfragen = rohFragen
        .map(normQuizfrage)
        .filter(function (f) { return !!f; });

      zustand.geladen = true;
      return zustand;
    });
  }

  /* --- Zugriff ------------------------------------------------------------ */

  function kategorien() {
    return KATEGORIEN.slice();
  }

  function kategorieMeta(key) {
    return KAT_NACH_KEY[key] || null;
  }

  function alleEintraege() {
    return zustand.eintraege;
  }

  function eintragMitId(id) {
    return zustand.nachId[id] || null;
  }

  function eintraegeDerKategorie(key) {
    return zustand.nachKategorie[key] || [];
  }

  function eintragMitBegriff(begriff, kategorieKey) {
    var ziel = normalisieren(begriff);
    var kandidaten = kategorieKey ? eintraegeDerKategorie(kategorieKey) : zustand.eintraege;
    for (var i = 0; i < kandidaten.length; i++) {
      if (normalisieren(kandidaten[i].begriff) === ziel) { return kandidaten[i]; }
    }
    return null;
  }

  /** Volltextsuche über begriff/definition/details und Zusatzfelder. */
  function suchen(text, kategorienFilter) {
    var basis = zustand.eintraege;

    if (kategorienFilter && kategorienFilter.length) {
      basis = basis.filter(function (e) { return kategorienFilter.indexOf(e.kategorie) !== -1; });
    }

    var abfrage = normalisieren(text);
    if (!abfrage) { return basis.slice(); }

    var begriffe = abfrage.split(' ').filter(function (w) { return w.length > 0; });
    var muster = begriffe.map(suchvarianten);

    var treffer = basis.filter(function (e) {
      return muster.every(function (varianten) {
        return varianten.some(function (v) { return e.suchtext.indexOf(v) !== -1; });
      });
    });

    /* Rangfolge: Treffer im Begriff zuerst, dann Präfixtreffer, dann alphabetisch. */
    var ersteVarianten = muster.length ? muster[0] : [];
    return treffer.sort(function (a, b) {
      var pa = trefferRang(a, ersteVarianten);
      var pb = trefferRang(b, ersteVarianten);
      if (pa !== pb) { return pa - pb; }
      return a.begriff.localeCompare(b.begriff, 'de');
    });
  }

  function trefferRang(eintrag, varianten) {
    var begriff = suchvarianten(eintrag.begriff);
    for (var i = 0; i < varianten.length; i++) {
      for (var j = 0; j < begriff.length; j++) {
        if (begriff[j] === varianten[i]) { return 0; }
        if (begriff[j].indexOf(varianten[i]) === 0) { return 1; }
        if (begriff[j].indexOf(varianten[i]) !== -1) { return 2; }
      }
    }
    return 3;
  }

  /** Phasen in kanonischer Reihenfolge. */
  function phasenGeordnet() {
    var liste = eintraegeDerKategorie('phase').slice();
    return liste.sort(function (a, b) {
      var ia = phasenIndex(a.begriff);
      var ib = phasenIndex(b.begriff);
      if (ia !== ib) { return ia - ib; }
      return a.reihenfolge - b.reihenfolge;
    });
  }

  /** Die vier Kernphasen in kanonischer Reihenfolge. */
  function kernPhasen() {
    return phasenGeordnet().filter(function (p) { return phasenIndex(p.begriff) < 90; });
  }

  /** Weitere Phaseneinträge (z. B. agile Varianten), Reihenfolge wie in der Datei. */
  function weiterePhasen() {
    return eintraegeDerKategorie('phase').filter(function (p) { return phasenIndex(p.begriff) >= 90; });
  }

  function phasenIndex(begriff) {
    var n = normalisieren(begriff);
    for (var i = 0; i < PHASEN_ORDNUNG.length; i++) {
      if (n.indexOf(PHASEN_ORDNUNG[i]) !== -1) {
        return PHASEN_ORDNUNG[i] === 'einfuehrung' ? 3 : i;
      }
    }
    return 99;
  }

  function alphabetisch(liste) {
    return liste.slice().sort(function (a, b) {
      return a.begriff.localeCompare(b.begriff, 'de');
    });
  }

  function quizfragen() {
    return zustand.quizfragen;
  }

  function fehlerhafteDateien() {
    return zustand.fehler.slice();
  }

  function istLeer() {
    return zustand.eintraege.length === 0 && zustand.quizfragen.length === 0;
  }

  HT.daten = {
    laden: laden,
    kategorien: kategorien,
    kategorieMeta: kategorieMeta,
    alleEintraege: alleEintraege,
    eintragMitId: eintragMitId,
    eintragMitBegriff: eintragMitBegriff,
    eintraegeDerKategorie: eintraegeDerKategorie,
    suchen: suchen,
    phasenGeordnet: phasenGeordnet,
    kernPhasen: kernPhasen,
    weiterePhasen: weiterePhasen,
    alphabetisch: alphabetisch,
    quizfragen: quizfragen,
    fehlerhafteDateien: fehlerhafteDateien,
    istLeer: istLeer,
    normalisieren: normalisieren
  };
}(window));
