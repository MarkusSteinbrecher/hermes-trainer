/* meinHERMES — das nachgebaute Bild der Methode und die Schritte durch sie
   (für den Überblick).

   Die Schritte gehen die Methode entlang der Abbildung 1 durch: zuerst das
   Gesamtbild (die Originalgrafik), dann Phase für Phase — Initialisierung und
   Abschluss als je eine Seite mit allen Modulen, die übrigen Phasen je Modul;
   Projektsteuerung und Projektführung teilen sich wie in der Abbildung eine
   Seite. Klassisch sind das 30 Schritte nach dem Gesamtbild, agil 12. Ein
   Schritt ist nichts anderes als ein Umfang des Graphen ({ vorgehen, phasen,
   module }); welcher gerade gilt, folgt also aus dem Filter.

   Das Bild zeigt einen Umfang so, wie das Zuordnen des Trainers ihn übt —
   dieselben Blöcke (HT.graph.bloecke): je Aufgabe links die verantwortliche
   Rolle, in der Mitte die Aufgabe, rechts die Ergebnisse, die sie in diesem
   Feld erzeugt. Anders als im Trainer ist alles ausgefüllt und in HTML
   gesetzt, damit «Details» unter Aufgaben und Ergebnissen die beteiligten
   Rollen und die Kurzdefinition einblenden kann. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  var h = HT.ui.h;

  /* Phasen, die in der Abbildung schmal sind und als Ganzes eine Seite bilden. */
  var GANZE_PHASEN = ['Initialisierung', 'Abschluss'];
  /* Module, die sich in der Abbildung eine Spalte teilen. */
  var MODUL_GRUPPEN = [
    { module: ['Projektsteuerung', 'Projektführung'], name: 'Projektsteuerung/-führung' }
  ];

  /* --- Schritte ------------------------------------------------------------- */

  var schrittListen = {};

  /** Die Module in der Reihenfolge der Daten, verbundene zu einer Gruppe. */
  function modulGruppen() {
    var gesehen = {}, gruppen = [];
    HT.daten.eintraegeDerKategorie('modul').forEach(function (m) {
      if (gesehen[m.begriff]) { return; }
      var g = MODUL_GRUPPEN.filter(function (x) { return x.module.indexOf(m.begriff) !== -1; })[0];
      var module = g ? g.module : [m.begriff];
      module.forEach(function (n) { gesehen[n] = true; });
      gruppen.push({ module: module, name: g ? g.name : m.begriff });
    });
    return gruppen;
  }

  /** Wie viele verschiedene Aufgaben ein Umfang zeigt. */
  function aufgabenZahl(umfang) {
    var ids = {};
    HT.graph.bloecke(umfang, true).forEach(function (b) { ids[b.aufgabe.id] = true; });
    return Object.keys(ids).length;
  }

  /**
   * Die Schritte einer Vorgehensweise: [{ index, art: 'gesamt'|'phase'|'feld',
   * phase, name, titel, umfang, aufgaben }] — Felder ohne Aufgabe fallen weg.
   */
  function schritte(vorgehen) {
    if (schrittListen[vorgehen]) { return schrittListen[vorgehen]; }
    var liste = [{
      art: 'gesamt', phase: '', name: 'Gesamtbild', titel: 'Gesamtbild', aufgaben: 0,
      umfang: { vorgehen: vorgehen, phasen: [], module: [] }
    }];
    function dazu(s) {
      s.aufgaben = aufgabenZahl(s.umfang);
      if (s.aufgaben) { liste.push(s); }
    }
    HT.graph.phasenDerVorgehensweise(vorgehen).forEach(function (phase) {
      if (GANZE_PHASEN.indexOf(phase) !== -1) {
        dazu({ art: 'phase', phase: phase, name: phase, titel: phase, umfang: { vorgehen: vorgehen, phasen: [phase], module: [] } });
        return;
      }
      modulGruppen().forEach(function (g) {
        dazu({
          art: 'feld', phase: phase, name: g.name, titel: phase + ' · ' + g.name,
          umfang: { vorgehen: vorgehen, phasen: [phase], module: g.module.slice() }
        });
      });
    });
    liste.forEach(function (s, i) { s.index = i; });
    schrittListen[vorgehen] = liste;
    return liste;
  }

  function gleicheMenge(a, b) {
    return a.length === b.length && a.every(function (x) { return b.indexOf(x) !== -1; });
  }

  /** Der Schritt, dem ein Umfang entspricht — oder null (eigene Auswahl). */
  function schrittVon(umfang) {
    return schritte(umfang.vorgehen).filter(function (s) {
      return gleicheMenge(s.umfang.phasen, umfang.phasen) && gleicheMenge(s.umfang.module, umfang.module);
    })[0] || null;
  }

  /**
   * Wo ‹ und › hinführen. Aus einer eigenen Auswahl mit genau einer Phase
   * geht es zum ersten Schritt dieser Phase bzw. zum Schritt davor, sonst
   * zum Gesamtbild bzw. zum ersten Schritt.
   * → { schritt, vorige, naechste, anzahl } (anzahl ohne Gesamtbild)
   */
  function nachbarn(umfang) {
    var liste = schritte(umfang.vorgehen);
    var s = schrittVon(umfang);
    var aus = { schritt: s, vorige: null, naechste: null, anzahl: liste.length - 1 };
    if (s) {
      aus.vorige = liste[s.index - 1] || null;
      aus.naechste = liste[s.index + 1] || null;
      return aus;
    }
    var erster = umfang.phasen.length === 1
      ? liste.filter(function (x) { return x.phase === umfang.phasen[0]; })[0]
      : null;
    aus.vorige = erster ? liste[erster.index - 1] : liste[0];
    aus.naechste = erster || liste[1] || null;
    return aus;
  }

  /** Name eines Umfangs, der kein Schritt ist: Phasen · Module (Szenario mit Namen). */
  function titelVon(umfang) {
    var s = schrittVon(umfang);
    if (s) { return s.titel; }
    var keine = HT.graph.KEINE;
    var vp = HT.graph.phasenDerVorgehensweise(umfang.vorgehen);
    var phasen = umfang.phasen[0] === keine ? 'Keine Phase'
      : vp.filter(function (p) { return umfang.phasen.indexOf(p) !== -1; }).join(', ');
    var module = '';
    if (umfang.module[0] === keine) {
      module = 'Kein Modul';
    } else if (umfang.module.length) {
      var szenario = HT.daten.eintraegeDerKategorie('szenario').filter(function (sz) {
        return gleicheMenge(sz.module, umfang.module);
      })[0];
      module = szenario ? szenario.begriff
        : umfang.module.length > 2 ? umfang.module.length + ' Module' : umfang.module.join(', ');
    }
    return [phasen || 'Alle Phasen', module].filter(Boolean).join(' · ');
  }

  /* --- Bild ------------------------------------------------------------------ */

  function istMeilenstein(k) {
    return k.kategorie === 'ergebnis' && !!k.eintrag && k.eintrag.typ === 'Meilenstein';
  }

  /* Ein Element als Knopf in der Form des Graphen: Aufgabe und Ergebnis im
     Kasten ihrer Farbe, Rolle und Meilenstein ohne Kasten. */
  function knotenBauen(k) {
    var art = istMeilenstein(k) ? 'meilenstein' : k.kategorie;
    return h('button', { type: 'button', class: 'mb-knoten mb-knoten--' + art, dataset: { id: k.id } }, [
      h('span', { class: 'gswatch gswatch--' + k.kategorie, 'aria-hidden': 'true' }, HT.ui.katSymbol(art, 13)),
      h('span', { class: 'mb-knoten__name', text: k.begriff })
    ]);
  }

  function rollenVon(text) {
    return String(text || '').split(',').map(function (r) { return r.trim(); }).filter(Boolean);
  }

  function kurzText(e) {
    var text = e && (e.kurz || e.definition);
    return text ? h('p', { class: 'mb-kurz', text: text }) : null;
  }

  /* Details der Aufgabe: die beteiligten Rollen ohne die verantwortliche,
     darunter die Kurzdefinition. */
  function aufgabeDetails(e) {
    var verantwortlich = rollenVon(e.verantwortlich);
    var beteiligt = (e.beteiligt || []).filter(function (r) { return verantwortlich.indexOf(r) === -1; });
    return [
      beteiligt.length ? h('p', { class: 'mb-beteiligt', title: 'Beteiligt', text: '+ ' + beteiligt.join(', ') }) : null,
      kurzText(e)
    ];
  }

  function blockBauen(b, details) {
    return h('div', { class: 'mb-block' }, [
      h('div', { class: 'mb-zelle mb-zelle--rolle' }, b.rolle ? knotenBauen(b.rolle) : null),
      h('div', { class: 'mb-zelle mb-zelle--aufgabe' }, [knotenBauen(b.aufgabe)].concat(details ? aufgabeDetails(b.aufgabe.eintrag) : [])),
      h('div', { class: 'mb-zelle mb-zelle--ergebnisse' }, b.ergebnisse.map(function (k) {
        return h('div', { class: 'mb-ergebnis' }, [knotenBauen(k), details ? kurzText(k.eintrag) : null]);
      }))
    ]);
  }

  /**
   * Das Bild eines Umfangs. opt: { details, beiZeigen(eintrag), beiKlick(eintrag) }.
   * Titel über Phasen und Modulen nur, wo es mehrere gibt — den Schritt
   * selbst nennt die Leiste.
   */
  function bauen(umfang, opt) {
    opt = opt || {};
    var el = h('div', { class: 'mb', dataset: { details: opt.details ? 'an' : 'aus' } }, [
      h('h2', { class: 'nur-sr', text: titelVon(umfang) })
    ]);
    var bloecke = HT.graph.bloecke(umfang, true);
    if (!bloecke.length) {
      el.appendChild(HT.ui.leerZustand('Keine Aufgaben in dieser Auswahl',
        'Für diese Phasen und Module sind keine Aufgaben erfasst. Einen anderen Schritt wählen oder die Auswahl zurücksetzen.'));
      return el;
    }

    var bahnen = [];
    bloecke.forEach(function (b) {
      var bahn = bahnen[bahnen.length - 1];
      if (!bahn || bahn.name !== b.bahn) { bahn = { name: b.bahn, unter: [] }; bahnen.push(bahn); }
      var unter = bahn.unter[bahn.unter.length - 1];
      if (!unter || unter.name !== b.unter) { unter = { name: b.unter, bloecke: [] }; bahn.unter.push(unter); }
      unter.bloecke.push(b);
    });
    var mehrerePhasen = bahnen.length > 1;

    el.appendChild(h('div', { class: 'mb-spalten', 'aria-hidden': 'true' }, ['rolle', 'aufgabe', 'ergebnis'].map(function (art) {
      return h('span', { class: 'mb-spalten__titel mb-spalten__titel--' + art, text: art === 'ergebnis' ? 'Ergebnisse' : HT.graph.KAT[art].singular });
    })));

    bahnen.forEach(function (bahn) {
      var mehrereModule = bahn.unter.length > 1;
      el.appendChild(h('section', { class: 'mb-phase' }, [
        mehrerePhasen ? h('h3', { class: 'mb-phase__titel' }, [HT.ui.katSymbol('phase', 15), h('span', { text: bahn.name })]) : null
      ].concat(bahn.unter.map(function (unter) {
        return h('section', { class: 'mb-modul' }, [
          mehrereModule || mehrerePhasen
            ? h('h4', { class: 'mb-modul__titel' }, [HT.ui.katSymbol('modul', 14), h('span', { text: unter.name })])
            : null
        ].concat(unter.bloecke.map(function (b) { return blockBauen(b, !!opt.details); })));
      }))));
    });

    /* Zeigen und Klicken für alle Knöpfe an einer Stelle; beim Zeigen sind
       alle Stellen desselben Elements hervorgehoben (ein Ergebnis steht bei
       jeder Aufgabe, die es erzeugt). */
    var gezeigt = null;
    function knotenAus(ziel) {
      var k = ziel && ziel.closest ? ziel.closest('.mb-knoten') : null;
      return k && el.contains(k) ? k : null;
    }
    function gleicheMarkieren(id) {
      Array.prototype.forEach.call(el.querySelectorAll('.mb-knoten.ist-gleich'), function (k) { k.classList.remove('ist-gleich'); });
      if (!id) { return; }
      Array.prototype.forEach.call(el.querySelectorAll('.mb-knoten'), function (k) {
        if (k.dataset.id === id) { k.classList.add('ist-gleich'); }
      });
    }
    function zeigen(k) {
      var id = k ? k.dataset.id : null;
      if (id === gezeigt) { return; }
      gezeigt = id;
      gleicheMarkieren(id);
      var e = id ? HT.daten.eintragMitId(id) : null;
      if (e && opt.beiZeigen) { opt.beiZeigen(e); }
    }
    el.addEventListener('mouseover', function (ev) { zeigen(knotenAus(ev.target)); });
    el.addEventListener('mouseleave', function () { zeigen(null); });
    el.addEventListener('focusin', function (ev) { zeigen(knotenAus(ev.target)); });
    el.addEventListener('click', function (ev) {
      var k = knotenAus(ev.target);
      var e = k ? HT.daten.eintragMitId(k.dataset.id) : null;
      if (e && opt.beiKlick) { opt.beiKlick(e); }
    });
    return el;
  }

  /** Das festgehaltene Element im Bild umranden (alle seine Stellen). */
  function markieren(el, id) {
    if (!el) { return; }
    Array.prototype.forEach.call(el.querySelectorAll('.mb-knoten'), function (k) {
      var an = !!id && k.dataset.id === id;
      k.classList.toggle('ist-gewaehlt', an);
      k.setAttribute('aria-pressed', an ? 'true' : 'false');
    });
  }

  HT.methodenbild = {
    schritte: schritte,
    schrittVon: schrittVon,
    nachbarn: nachbarn,
    titelVon: titelVon,
    bauen: bauen,
    markieren: markieren
  };
}(window));
