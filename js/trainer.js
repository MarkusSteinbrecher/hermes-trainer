/* meinHERMES — Ansicht «Trainer»: das Dach über allen Übungsformen.

   Der Trainer hat mehrere Teile, umgeschaltet über eine Chip-Leiste unter
   dem Seitenkopf: «Zuordnen» (js/zuordnen.js), «Lernkarten»
   (js/lernkarten.js) und «Quiz» (js/quiz.js). Die Teile melden sich unter
   HT.trainerTeile an; ein Teil ist { id, label, pfade, render(behaelter,
   params) } und zeichnet sich in den Behälter unter der Leiste. Ein Teil mit
   eigenen Seiten in voller Breite (die Übungen des Zuordnens) bringt dazu
   istUebung(params) und titel(params) mit. Weitere Teile (etwa
   Prüfungsfragen anderer Herkunft) kommen dazu, indem sie sich anmelden und
   in TEILE eingetragen werden.

   Adressen: #/trainer (Zuordnen), #/trainer?teil=lernkarten,
   #/trainer?teil=quiz — Parameter der Teile (etwa ?kat=) bleiben daneben
   gültig. Die alten Adressen #/lernkarten und #/quiz leiten hierher. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};
  HT.trainerTeile = HT.trainerTeile || {};

  var h = HT.ui.h;

  /* Reihenfolge der Leiste; der erste Teil ist der ohne ?teil=. */
  var TEILE = ['zuordnen', 'lernkarten', 'quiz'];

  function teile() {
    return TEILE.map(function (id) { return HT.trainerTeile[id]; }).filter(Boolean);
  }

  function teilAdresse(teil) {
    return teil.id === TEILE[0] ? '#/trainer' : '#/trainer?teil=' + encodeURIComponent(teil.id);
  }

  function teilFinden(id) {
    var liste = teile();
    for (var i = 0; i < liste.length; i++) {
      if (liste[i].id === id) { return liste[i]; }
    }
    return liste[0];
  }

  /* Der Teil, dem die Adresse eine eigene Seite zuweist (etwa ?phase=…). */
  function seitenTeil(params) {
    var liste = teile();
    for (var i = 0; i < liste.length; i++) {
      if (liste[i].istUebung && liste[i].istUebung(params)) { return liste[i]; }
    }
    return null;
  }

  function teilLeiste(aktiv) {
    return h('ul', { class: 'chips chips--streifen tr-teile', 'aria-label': 'Übungsform' }, teile().map(function (t) {
      var a = { class: 'chip', href: teilAdresse(t) };
      if (t === aktiv) { a['aria-current'] = 'page'; }
      return h('li', {}, h('a', a, [
        t.pfade ? HT.ui.symbol(t.pfade, 14) : null,
        h('span', { text: t.label })
      ]));
    }));
  }

  function render(behaelter, params) {
    params = params || {};
    var warnung = HT.app.datenWarnung();
    if (warnung) { behaelter.appendChild(warnung); }

    var eigen = seitenTeil(params);
    if (eigen) {
      document.body.dataset.teil = 'uebung';
      eigen.render(behaelter, params);
      return;
    }

    var teil = teilFinden(params.teil);
    document.body.dataset.teil = teil.id;
    behaelter.appendChild(h('div', { class: 'kopf' }, [
      h('h1', { text: 'Trainer' }),
      h('p', { text: 'Üben für die Prüfung auf drei Arten: Rollen, Aufgaben und Ergebnisse einander zuordnen, '
        + 'Lernkarten umdrehen und selbst einschätzen, Prüfungsfragen beantworten. '
        + 'Der Lernstand bleibt in diesem Browser.' })
    ]));
    behaelter.appendChild(teilLeiste(teil));
    var teilBehaelter = h('div', { class: 'tr-teil', 'data-teil': teil.id });
    behaelter.appendChild(teilBehaelter);
    teil.render(teilBehaelter, params);
  }

  function titel(params) {
    var eigen = seitenTeil(params || {});
    if (eigen && eigen.titel) { return eigen.titel(params); }
    var teil = teilFinden(params && params.teil);
    return teil && teil.id !== TEILE[0] ? 'Trainer · ' + teil.label : 'Trainer';
  }

  HT.views.trainer = {
    titel: titel,
    render: render
  };
}(window));
