/* meinHERMES — Graphmodell.
   Der Graph zeigt nur die drei Elemente, die zusammen den Ablauf beschreiben:
   Rolle → Aufgabe → Ergebnis. Phasen, Module und Szenarien sind keine Knoten,
   sondern der Umfang: sie wählen aus, welche Aufgaben und Ergebnisse gezeigt
   werden. Jede Kante entspricht einem Querverweis in den Daten
   (Aufgabe.verantwortlich/beteiligt/ergebnisse, Ergebnis.verantwortlich) —
   es werden keine Beziehungen ergänzt. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};

  /* Reihenfolge = Reihenfolge der Spalten und der Icons: wer tut was, was
     entsteht. Das Icon je Kategorie liefert HT.ui.katSymbol. */
  var KATEGORIEN = [
    { key: 'rolle',    label: 'Rollen',     singular: 'Rolle' },
    { key: 'aufgabe',  label: 'Aufgaben',   singular: 'Aufgabe' },
    { key: 'ergebnis', label: 'Ergebnisse', singular: 'Ergebnis' }
  ];
  var KAT = {};
  KATEGORIEN.forEach(function (k, i) { k.rang = i; KAT[k.key] = k; });

  /* «vor» beschreibt die Kante aus Sicht des Ausgangsknotens, «rueck» aus Sicht
     des Ziels — so lässt sich jede Verbindung als Satz lesen:
     «Auftraggeber → verantwortlich für → Entscheid Zuschlag treffen». */
  var RELATIONEN = [
    { key: 'verantwortlich', label: 'Rolle ist verantwortlich für die Aufgabe', vor: 'verantwortlich für', rueck: 'verantwortlich', stil: 'verantwortlich' },
    { key: 'beteiligt',      label: 'Rolle ist beteiligt',                      vor: 'beteiligt an',       rueck: 'beteiligt',       stil: 'beteiligt' },
    { key: 'erzeugt',        label: 'Aufgabe erzeugt Ergebnis',                 vor: 'erzeugt',            rueck: 'entsteht in',     stil: 'erzeugt' },
    { key: 'ergebnisrolle',  label: 'Rolle verantwortet das Ergebnis',          vor: 'verantwortet',       rueck: 'verantwortlich',  stil: 'ergebnisrolle' }
  ];
  var REL = {};
  RELATIONEN.forEach(function (r, i) { r.rang = i; REL[r.key] = r; });

  var VORGEHEN = {
    klassisch: ['Initialisierung', 'Konzept', 'Realisierung', 'Einführung', 'Abschluss'],
    agil:      ['Initialisierung', 'Umsetzung', 'Abschluss']
  };
  /* Alle Phasen beider Vorgehensweisen im Projektverlauf — Sortierschlüssel
     für Aufgaben und Ergebnisse innerhalb einer Bahn: früheste Phase oben. */
  var PHASEN_REIHE = ['Initialisierung', 'Konzept', 'Realisierung', 'Einführung', 'Umsetzung', 'Abschluss'];

  /** Rang der frühesten Phase eines Elements; Phasen der gewählten
      Vorgehensweise zählen zuerst, sonst alle. Ohne Phase ganz unten. */
  function phasenRang(phasen, vp) {
    var best = 999;
    (phasen || []).forEach(function (name) {
      var i = PHASEN_REIHE.indexOf(name);
      if (i === -1) { return; }
      if (vp.indexOf(name) === -1) { i += 100; }
      if (i < best) { best = i; }
    });
    return best;
  }

  /* Handbuch Kap. 3.2.1: zwingend in jedem Projekt. */
  var ZWINGENDE_MODULE = ['Projektsteuerung', 'Projektführung', 'Projektgrundlagen', 'Einführungsorganisation'];

  var EBENEN = ['Steuerung', 'Führung', 'Ausführung'];

  var modell = null;

  /* --- Aufbau -------------------------------------------------------------- */

  function rollenListe(text) {
    return String(text || '').split(/\s*,\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function bauen() {
    if (modell) { return modell; }

    var knoten = {};
    var liste = [];
    var kanten = [];
    var gesehen = {};

    HT.daten.alleEintraege().forEach(function (e) {
      if (!KAT[e.kategorie]) { return; }
      var k = {
        id: e.id,
        kategorie: e.kategorie,
        begriff: e.begriff,
        eintrag: e,
        kanten: [],
        entscheid: e.kategorie === 'aufgabe' && /^Entscheid\s/.test(e.begriff),
        reihenfolge: e.reihenfolge
      };
      knoten[k.id] = k;
      liste.push(k);
    });

    function finde(begriff, kategorie) {
      var e = HT.daten.eintragMitBegriff(begriff, kategorie);
      return e ? e.id : null;
    }

    function verbinde(vonId, nachId, rel) {
      if (!vonId || !nachId || vonId === nachId) { return; }
      if (!knoten[vonId] || !knoten[nachId]) { return; }
      var schluessel = vonId + '|' + nachId + '|' + rel;
      if (gesehen[schluessel]) { return; }
      gesehen[schluessel] = true;
      var kante = { id: schluessel, von: vonId, nach: nachId, rel: rel };
      kanten.push(kante);
      knoten[vonId].kanten.push(kante);
      knoten[nachId].kanten.push(kante);
    }

    liste.forEach(function (k) {
      var e = k.eintrag;
      if (k.kategorie === 'rolle') { return; }

      var verantw = {};
      rollenListe(e.verantwortlich).forEach(function (r) {
        var id = finde(r, 'rolle');
        if (!id) { return; }
        verantw[id] = true;
        verbinde(id, k.id, k.kategorie === 'aufgabe' ? 'verantwortlich' : 'ergebnisrolle');
      });

      if (k.kategorie === 'aufgabe') {
        /* «Beteiligt» führt die verantwortliche Rolle meist nochmals auf —
           die stärkere Beziehung genügt. */
        e.beteiligt.forEach(function (r) {
          var id = finde(r, 'rolle');
          if (id && !verantw[id]) { verbinde(id, k.id, 'beteiligt'); }
        });
        e.ergebnisse.forEach(function (x) { verbinde(k.id, finde(x, 'ergebnis'), 'erzeugt'); });
      }
    });

    liste.forEach(function (k) { k.grad = k.kanten.length; });

    modell = { knoten: knoten, liste: liste, kanten: kanten };
    return modell;
  }

  /* --- Zugriff ------------------------------------------------------------- */

  function knoten(id) {
    return bauen().knoten[id] || null;
  }

  function alleKnoten() { return bauen().liste; }

  /** Verbindungen eines Knotens: je Nachbar alle Beziehungen aus seiner Sicht. */
  function nachbarn(id) {
    var k = knoten(id);
    if (!k) { return []; }
    var m = bauen();
    var nachId = {};
    var aus = [];
    k.kanten.forEach(function (kante) {
      var anderer = kante.von === id ? kante.nach : kante.von;
      var richtung = kante.von === id ? 'vor' : 'rueck';
      var eintrag = nachId[anderer];
      if (!eintrag) {
        eintrag = { knoten: m.knoten[anderer], relationen: [] };
        nachId[anderer] = eintrag;
        aus.push(eintrag);
      }
      eintrag.relationen.push({ rel: kante.rel, richtung: richtung, label: REL[kante.rel][richtung], kante: kante });
    });
    return aus;
  }

  /* --- Umfang: welche Phasen und Module ------------------------------------ */

  function leererUmfang() {
    return {
      vorgehen: 'klassisch',   // klassisch | agil
      phasen: [],              // Phasennamen, leer = alle der Vorgehensweise
      module: []               // Modulnamen, leer = alle
    };
  }

  function umfangAktiv(u) {
    return !!(u && (u.phasen.length || u.module.length));
  }

  function schneidet(a, b) {
    for (var i = 0; i < a.length; i++) {
      if (b.indexOf(a[i]) !== -1) { return true; }
    }
    return false;
  }

  function phasenDerVorgehensweise(vorgehen) {
    return VORGEHEN[vorgehen] || VORGEHEN.klassisch;
  }

  /** Gehört eine Aufgabe oder ein Ergebnis zum gewählten Umfang? */
  function imUmfang(eintrag, umfang) {
    /* Rollen tragen weder Phasen noch Module — sie hängen an ihren Aufgaben. */
    if (eintrag.kategorie === 'rolle') { return true; }
    var ePhasen = eintrag.phasen || [];
    var eModule = eintrag.module || [];
    /* Sammeleinträge ohne Phasenangabe («Checklisten», «Meilensteine») lassen sich
       nicht im Ablauf verorten und bleiben dem Lexikon vorbehalten. */
    if (!ePhasen.length) { return false; }
    var vp = phasenDerVorgehensweise(umfang.vorgehen);
    if (!schneidet(ePhasen, vp)) { return false; }
    var phasen = umfang.phasen.length ? umfang.phasen : vp;
    if (!schneidet(ePhasen, phasen)) { return false; }
    if (umfang.module.length && !schneidet(eModule, umfang.module)) { return false; }
    return true;
  }

  /** Module eines Szenarios (für die Vorwahl über das Szenario). */
  /* Die Szenarioseiten der Quelle führen Projektgrundlagen nicht in ihrer
     Modulliste; nach Kap. 3.2.1 ist es aber wie Projektsteuerung,
     Projektführung und Einführungsorganisation in jedem Projekt zwingend.
     Ein Szenario umfasst deshalb immer auch die zwingenden Module. */
  function szenarioModule(begriffOderId) {
    var e = HT.daten.eintragMitId(begriffOderId) || HT.daten.eintragMitBegriff(begriffOderId, 'szenario');
    if (!e || e.kategorie !== 'szenario') { return null; }
    var module = e.module.slice();
    ZWINGENDE_MODULE.forEach(function (m) { if (module.indexOf(m) === -1) { module.push(m); } });
    return module;
  }

  /** Wie viele Aufgaben trägt diese Phase bzw. dieses Modul zum aktuellen Umfang bei? */
  function beitrag(art, name, umfang) {
    var vp = phasenDerVorgehensweise(umfang.vorgehen);
    var n = 0;
    bauen().liste.forEach(function (k) {
      if (k.kategorie !== 'aufgabe') { return; }
      var e = k.eintrag;
      if (!schneidet(e.phasen, vp)) { return; }
      if (art === 'phase') {
        if (e.phasen.indexOf(name) === -1) { return; }
        if (umfang.module.length && !schneidet(e.module, umfang.module)) { return; }
      } else {
        if (e.module.indexOf(name) === -1) { return; }
        var phasen = umfang.phasen.length ? umfang.phasen : vp;
        if (!schneidet(e.phasen, phasen)) { return; }
      }
      n++;
    });
    return n;
  }

  /* --- Teilgraph ------------------------------------------------------------ */

  function modulOrdnung() {
    var o = {};
    HT.daten.eintraegeDerKategorie('modul').forEach(function (m, i) { o[m.begriff] = i; });
    return o;
  }

  /**
   * Sichtbarer Graph zum Zustand.
   * zustand: { umfang, kategorien: {key:bool}, relationen: {key:bool},
   *            gruppierung: 'phase'|'modul', nurMinimal, nurEntscheide,
   *            isolierteAusblenden, fokus: id|null }
   * fokus zeigt nur ein Element mit seiner Nachbarschaft (siehe fokusMenge).
   * Rückgabe: Spalten in Reihenfolge Rolle, Aufgabe, Ergebnis; die
   * Aufgaben und Ergebnisse tragen ihre Bahn (Phase bzw. Modul) für das
   * Swimlane-Layout; Rollen haben keine.
   */
  function teilgraph(zustand) {
    var m = bauen();
    var u = zustand.umfang || leererUmfang();
    var kat = zustand.kategorien || {};
    var rel = zustand.relationen || {};
    var vp = phasenDerVorgehensweise(u.vorgehen);
    var gruppenNamen = zustand.gruppierung === 'phase'
      ? (u.phasen.length ? vp.filter(function (p) { return u.phasen.indexOf(p) !== -1; }) : vp)
      : (function () {
          var alle = HT.daten.eintraegeDerKategorie('modul').map(function (x) { return x.begriff; });
          return u.module.length ? alle.filter(function (x) { return u.module.indexOf(x) !== -1; }) : alle;
        }());

    /* 1. Umfang bestimmen — im Fokus zusätzlich nur die Nachbarschaft */
    var fokus = zustand.fokus ? fokusMenge(zustand.fokus) : null;
    function imFokus(id) { return !fokus || !!fokus[id]; }
    var aufgabenAlle = [], ergebnisseAlle = [];
    m.liste.forEach(function (k) {
      if (k.kategorie === 'rolle') { return; }
      if (!imUmfang(k.eintrag, u)) { return; }
      if (!imFokus(k.id)) { return; }
      if (k.kategorie === 'aufgabe') {
        if (zustand.nurEntscheide && !k.entscheid) { return; }
        aufgabenAlle.push(k);
      } else {
        if (zustand.nurMinimal && !(k.eintrag.minimalGefordert && k.eintrag.typ === 'Dokument')) { return; }
        ergebnisseAlle.push(k);
      }
    });

    /* 2. Aufgaben nach der gewählten Achse gruppieren und sortieren.
          Eine Aufgabe steht in der ersten Gruppe, zu der sie gehört. */
    var gruppeVon = {};
    aufgabenAlle.forEach(function (k) {
      var werte = zustand.gruppierung === 'phase' ? k.eintrag.phasen : k.eintrag.module;
      var g = '';
      for (var i = 0; i < gruppenNamen.length; i++) {
        if (werte.indexOf(gruppenNamen[i]) !== -1) { g = gruppenNamen[i]; break; }
      }
      gruppeVon[k.id] = g;
    });
    /* Innerhalb der Bahn nach der frühesten Phase, dann nach Name. */
    aufgabenAlle.sort(function (a, b) {
      var ga = gruppenNamen.indexOf(gruppeVon[a.id]);
      var gb = gruppenNamen.indexOf(gruppeVon[b.id]);
      if (ga !== gb) { return ga - gb; }
      var pa = phasenRang(a.eintrag.phasen, vp);
      var pb = phasenRang(b.eintrag.phasen, vp);
      if (pa !== pb) { return pa - pb; }
      return a.begriff.localeCompare(b.begriff, 'de');
    });

    var aufgaben = kat.aufgabe ? aufgabenAlle : [];

    /* 3. Ergebnisse in der Reihenfolge der erzeugenden Aufgabe */
    var rang = {};
    var quelleVon = {};
    if (rel.erzeugt) {
      aufgaben.forEach(function (k, i) {
        k.eintrag.ergebnisse.forEach(function (name) {
          var e = HT.daten.eintragMitBegriff(name, 'ergebnis');
          if (e && rang[e.id] === undefined) { rang[e.id] = i; quelleVon[e.id] = k.id; }
        });
      });
    }

    /* Ergebnisse liegen in der Bahn ihrer erzeugenden Aufgabe — so bleibt die
       Kante «erzeugt» waagrecht. Ohne erzeugende Aufgabe zählt die eigene
       erste Phase bzw. das erste Modul. */
    var gruppeVonErgebnis = {};
    ergebnisseAlle.forEach(function (k) {
      var g = quelleVon[k.id] ? (gruppeVon[quelleVon[k.id]] || '') : '';
      if (!g) {
        var werte = zustand.gruppierung === 'phase' ? k.eintrag.phasen : k.eintrag.module;
        for (var i = 0; i < gruppenNamen.length; i++) {
          if (werte.indexOf(gruppenNamen[i]) !== -1) { g = gruppenNamen[i]; break; }
        }
      }
      gruppeVonErgebnis[k.id] = g;
    });
    var mo = modulOrdnung();
    function modulRang(k) {
      var mm = k.eintrag.module.length ? k.eintrag.module[0] : '';
      return mo.hasOwnProperty(mm) ? mo[mm] : 999;
    }
    /* Ergebnisse folgen der Phase ihrer erzeugenden Aufgabe (sonst der
       eigenen), dann der Reihenfolge der Aufgaben — so bleiben die
       Kanten «erzeugt» gebündelt und die frühesten Phasen stehen oben. */
    function ergebnisPhasenRang(k) {
      var q = quelleVon[k.id] ? m.knoten[quelleVon[k.id]] : null;
      return phasenRang(q ? q.eintrag.phasen : k.eintrag.phasen, vp);
    }
    ergebnisseAlle.sort(function (a, b) {
      var ga = gruppenNamen.indexOf(gruppeVonErgebnis[a.id]);
      var gb = gruppenNamen.indexOf(gruppeVonErgebnis[b.id]);
      if (ga !== gb) { return ga - gb; }
      var pa = ergebnisPhasenRang(a), pb = ergebnisPhasenRang(b);
      if (pa !== pb) { return pa - pb; }
      var ra = rang[a.id] === undefined ? 9999 : rang[a.id];
      var rb = rang[b.id] === undefined ? 9999 : rang[b.id];
      if (ra !== rb) { return ra - rb; }
      var d = modulRang(a) - modulRang(b);
      return d !== 0 ? d : a.begriff.localeCompare(b.begriff, 'de');
    });
    var ergebnisse = kat.ergebnis ? ergebnisseAlle : [];
    if (zustand.isolierteAusblenden) {
      ergebnisse = ergebnisse.filter(function (k) { return rang[k.id] !== undefined; });
    }

    /* 4. Rollen aus dem ganzen Umfang, nicht nur aus der sichtbaren Spalte:
          sonst verschwinden sie, sobald man die Aufgaben ausblendet. Zuerst
          die gezeichneten Aufgaben, damit die Reihenfolge zu den Kanten passt. */
    var sichtbarE = {};
    ergebnisse.forEach(function (k) { sichtbarE[k.id] = true; });
    var rollenReihe = [];
    function rolleMerken(id) { if (id && imFokus(id) && rollenReihe.indexOf(id) === -1) { rollenReihe.push(id); } }
    function rollenAus(liste) {
      liste.forEach(function (k) {
        k.kanten.forEach(function (kante) {
          if (kante.nach !== k.id) { return; }
          if (kante.rel === 'verantwortlich' && rel.verantwortlich) { rolleMerken(kante.von); }
          if (kante.rel === 'beteiligt' && rel.beteiligt) { rolleMerken(kante.von); }
        });
      });
    }
    rollenAus(aufgaben);
    rollenAus(aufgabenAlle);
    if (rel.ergebnisrolle) {
      ergebnisseAlle.forEach(function (k) {
        k.kanten.forEach(function (kante) {
          if (kante.nach === k.id && kante.rel === 'ergebnisrolle') { rolleMerken(kante.von); }
        });
      });
    }
    var rollen = kat.rolle ? rollenReihe.map(function (id) { return m.knoten[id]; }).filter(Boolean) : [];

    /* 5. Kanten zwischen sichtbaren Knoten */
    var sichtbar = {};
    [rollen, aufgaben, ergebnisse].forEach(function (sp) {
      sp.forEach(function (k) { sichtbar[k.id] = true; });
    });
    var kanten = m.kanten.filter(function (kante) {
      return rel[kante.rel] && sichtbar[kante.von] && sichtbar[kante.nach];
    });

    if (zustand.isolierteAusblenden) {
      var grad = {};
      kanten.forEach(function (kante) { grad[kante.von] = true; grad[kante.nach] = true; });
      rollen = rollen.filter(function (k) { return grad[k.id]; });
      aufgaben = aufgaben.filter(function (k) { return grad[k.id]; });
      ergebnisse = ergebnisse.filter(function (k) { return grad[k.id]; });
      sichtbar = {};
      [rollen, aufgaben, ergebnisse].forEach(function (sp) { sp.forEach(function (k) { sichtbar[k.id] = true; }); });
      kanten = kanten.filter(function (kante) { return sichtbar[kante.von] && sichtbar[kante.nach]; });
    }

    return {
      spalten: [
        { kategorie: 'rolle', knoten: rollen },
        /* Im Fokus ohne Bahnen: die wenigen Elemente rücken zu drei
           schlichten Spalten zusammen statt über die Modul- oder
           Phasenbahnen des ganzen Graphen verteilt zu bleiben. */
        { kategorie: 'aufgabe', knoten: aufgaben, gruppeVon: fokus ? null : gruppeVon },
        { kategorie: 'ergebnis', knoten: ergebnisse, gruppeVon: fokus ? null : gruppeVonErgebnis }
      ].filter(function (sp) { return kat[sp.kategorie]; }),
      /* Bahnen des Swimlane-Layouts, in der Reihenfolge der Methode. */
      bahnen: gruppenNamen,
      achse: zustand.gruppierung === 'phase' ? 'phase' : 'modul',
      kanten: kanten,
      /* Zahlen im Umfang — unabhängig davon, ob die Spalte gerade sichtbar ist. */
      zahlen: { rolle: rollenReihe.length, aufgabe: aufgabenAlle.length, ergebnis: ergebnisseAlle.length },
      gezeigt: { rolle: rollen.length, aufgabe: aufgaben.length, ergebnis: ergebnisse.length }
    };
  }

  /* --- Fokus: ein Element mit seiner Nachbarschaft ------------------------- */

  /**
   * Menge der Knoten-IDs, die zum Fokus auf `id` gehören: das Element und
   * alles, was mit ihm direkt verbunden ist (eine Rolle mit ihren Aufgaben
   * und den Ergebnissen, die sie verantwortet; eine Aufgabe mit ihren Rollen
   * und Ergebnissen; ein Ergebnis mit den Aufgaben, die es erzeugen, und den
   * Rollen, die es verantworten). Keine zweite Stufe — sonst sieht ein Fokus
   * auf eine Rolle nach dem ganzen Graphen aus.
   */
  function fokusMenge(id) {
    var m = bauen();
    var k = m.knoten[id];
    if (!k) { return null; }
    var menge = {};
    menge[id] = true;
    k.kanten.forEach(function (kante) {
      menge[kante.von === id ? kante.nach : kante.von] = true;
    });
    return menge;
  }

  /* --- Einstieg über einen Lexikoneintrag ---------------------------------- */

  /**
   * Umfang, der einen Lexikoneintrag im Graphen sichtbar macht.
   * Aufgaben, Ergebnisse und Rollen werden ausgewählt; Phasen, Module und
   * Szenarien setzen den Umfang. Rückgabe null, wenn der Eintrag im Graphen
   * nicht vorkommt (Grundbegriffe).
   */
  function einstieg(id) {
    var e = HT.daten.eintragMitId(id);
    if (!e) { return null; }
    switch (e.kategorie) {
      case 'aufgabe':
      case 'ergebnis': {
        var vorgehen = e.phasen.indexOf('Umsetzung') !== -1 && !schneidet(e.phasen, VORGEHEN.klassisch) ? 'agil' : 'klassisch';
        return {
          auswahlId: id,
          umfang: { vorgehen: vorgehen, phasen: [], module: e.module.length ? [e.module[0]] : [] },
          ansicht: 'module'
        };
      }
      case 'rolle':
        return { auswahlId: id, umfang: leererUmfang(), ansicht: 'module' };
      case 'phase': {
        var agil = VORGEHEN.agil.indexOf(e.begriff) !== -1 && VORGEHEN.klassisch.indexOf(e.begriff) === -1;
        return { umfang: { vorgehen: agil ? 'agil' : 'klassisch', phasen: [e.begriff], module: [] }, ansicht: 'phasen' };
      }
      case 'modul':
        return { umfang: { vorgehen: 'klassisch', phasen: [], module: [e.begriff] }, ansicht: 'module' };
      case 'szenario':
        return { umfang: { vorgehen: 'klassisch', phasen: [], module: e.module.slice() }, ansicht: 'module' };
      default:
        return null;
    }
  }

  /* --- Suche --------------------------------------------------------------- */

  function suchen(text, max) {
    return HT.daten.suchen(text, [])
      .map(function (e) { return knoten(e.id); })
      .filter(Boolean)
      .slice(0, max || 8);
  }

  HT.graph = {
    KATEGORIEN: KATEGORIEN,
    KAT: KAT,
    RELATIONEN: RELATIONEN,
    REL: REL,
    VORGEHEN: VORGEHEN,
    EBENEN: EBENEN,
    ZWINGENDE_MODULE: ZWINGENDE_MODULE,
    bauen: bauen,
    knoten: knoten,
    fokusMenge: fokusMenge,
    alleKnoten: alleKnoten,
    nachbarn: nachbarn,
    leererUmfang: leererUmfang,
    umfangAktiv: umfangAktiv,
    phasenDerVorgehensweise: phasenDerVorgehensweise,
    imUmfang: imUmfang,
    szenarioModule: szenarioModule,
    beitrag: beitrag,
    teilgraph: teilgraph,
    einstieg: einstieg,
    suchen: suchen
  };
}(window));
