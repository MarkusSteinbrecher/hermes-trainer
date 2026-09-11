/* meinHERMES — Anwendungsgerüst.
   Lädt die Daten, baut die Navigation und schaltet die Ansichten
   über location.hash um (GitHub Pages braucht so keine Server-Konfiguration). */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  var h = HT.ui.h;

  /* Der Graph ist seit 2026-09-11 eine Sicht des Überblicks (#/graph leitet
     dorthin weiter); Lernkarten und Quiz sind seit 2026-09-11 Teile des
     Trainers (#/trainer?teil=lernkarten, #/trainer?teil=quiz). */
  var ROUTEN = [
    { name: 'ueberblick', label: 'Überblick',  kurz: 'Überblick', pfade: ['M3.5 4.5h17v15h-17Z', 'M3.5 9h17', 'M9 9v10.5', 'M14.5 9v10.5'] },
    { name: 'trainer',    label: 'Trainer',    kurz: 'Trainer',  pfade: ['M4 5h7v6H4Z', 'M13 13h7v6h-7Z', 'M13 5h7v6h-7Z', 'M4 13h7v6H4Z', 'M6 16l1.6 1.6L10 14.8'] },
    { name: 'handbuch',   label: 'Handbuch',   kurz: 'Handbuch', pfade: ['M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z', 'M4 17.5h15'] },
    { name: 'ueber',      label: 'Über',       kurz: 'Über',     pfade: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 11v5.5', 'M12 7.8h.01'] }
  ];

  var STARTROUTE = 'ueberblick';
  /* Alte Links bleiben gültig: Methode und Lexikon sind seit 2026-09-11 das
     Handbuch; Lernkarten und Quiz sind Teile des Trainers — ein Alias mit
     `params` bringt seine Parameter mit (bestehende wie ?kat= bleiben). */
  var ALIASE = {
    uebersicht: 'handbuch', methode: 'handbuch', lexikon: 'handbuch',
    lernkarten: { name: 'trainer', params: { teil: 'lernkarten' } },
    quiz: { name: 'trainer', params: { teil: 'quiz' } }
  };
  var ersterAufruf = true;

  /* --- Suche in der Kopfzeile --------------------------------------------- */

  /* Rechts neben der Marke: eine kleine Pille «Suchen», die beim Anklicken
     breit wird. Sie findet Ergebnisse, Aufgaben, Rollen, Module, Phasen und
     Szenarien. Ist der Überblick offen, wendet er den Treffer selbst an
     (Umfang, Einfärbung, Fokus); sonst führt der Treffer in den Überblick. */
  function sucheBauen() {
    var inner = document.querySelector('.topbar__inner');
    var marke = document.querySelector('.marke');
    if (!inner || !marke || !HT.ui.suchpille) { return; }
    var pille = HT.ui.suchpille({
      platzhalter: 'Suchen',
      label: 'Element, Modul, Phase oder Szenario suchen',
      treffer: function (text) {
        return HT.ui.suchtreffer(text, ['modul', 'phase', 'szenario'], function (t) {
          return HT.daten.suchen(t, ['ergebnis', 'aufgabe', 'rolle']);
        });
      },
      beiWahl: function (e) {
        var ub = HT.views.ueberblick;
        if (routeLesen().name === 'ueberblick' && ub && ub.suchtreffer && ub.suchtreffer(e)) { return; }
        global.location.hash = '#/ueberblick?id=' + encodeURIComponent(e.id);
      }
    });
    var huelle = h('div', { class: 'kopf-suche' }, [pille]);
    inner.insertBefore(huelle, marke.nextSibling);
  }

  /* --- Navigation --------------------------------------------------------- */

  function navBauen() {
    var oben = document.querySelector('[data-nav="top"]');
    var unten = document.querySelector('[data-nav="bottom"]');

    ROUTEN.forEach(function (r) {
      if (oben) {
        oben.appendChild(h('li', {}, h('a', {
          href: '#/' + r.name,
          dataset: { route: r.name },
          text: r.label
        })));
      }
      if (unten) {
        unten.appendChild(h('li', {}, h('a', {
          href: '#/' + r.name,
          dataset: { route: r.name }
        }, [
          h('span', { class: 'nav-icon' }, HT.ui.symbol(r.pfade)),
          h('span', { class: 'nav-label', text: r.kurz })
        ])));
      }
    });
  }

  /* Klick auf einen Link, der bereits die aktuelle Route ist, baut die Ansicht
     trotzdem neu auf — sonst passiert beim Tippen auf «Trainer» im laufenden Quiz nichts. */
  function gleicheRouteAbfangen() {
    document.addEventListener('click', function (ev) {
      var ziel = ev.target;
      while (ziel && ziel !== document && ziel.tagName !== 'A') { ziel = ziel.parentNode; }
      if (!ziel || ziel.tagName !== 'A') { return; }
      var href = ziel.getAttribute('href');
      if (!href || href.charAt(0) !== '#') { return; }
      if (href === global.location.hash) {
        ev.preventDefault();
        zeichnen();
      }
    });
  }

  function navMarkieren(aktiv) {
    var links = document.querySelectorAll('[data-route]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].dataset.route === aktiv) {
        links[i].setAttribute('aria-current', 'page');
      } else {
        links[i].removeAttribute('aria-current');
      }
    }
  }

  /* --- Routing ------------------------------------------------------------ */

  function routeLesen() {
    var roh = String(global.location.hash || '').replace(/^#\/?/, '');
    var teile = roh.split('?');
    var name = decodeURIComponent(teile[0] || '').trim() || STARTROUTE;
    var params = {};

    if (teile[1]) {
      teile[1].split('&').forEach(function (paar) {
        if (!paar) { return; }
        var kv = paar.split('=');
        var k = decodeURIComponent(kv[0] || '').trim();
        if (!k) { return; }
        try {
          params[k] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
        } catch (e) {
          params[k] = kv[1] || '';
        }
      });
    }

    var alias = ALIASE[name];
    if (typeof alias === 'string') { name = alias; }
    else if (alias) {
      name = alias.name;
      for (var k2 in alias.params) {
        if (Object.prototype.hasOwnProperty.call(alias.params, k2)) { params[k2] = alias.params[k2]; }
      }
    }
    if (!HT.views[name]) { name = STARTROUTE; }
    return { name: name, params: params };
  }

  function zeichnen() {
    var route = routeLesen();
    var view = HT.views[route.name];
    var behaelter = document.getElementById('view');
    if (!behaelter || !view) { return; }

    HT.ui.leeren(behaelter);
    behaelter.setAttribute('aria-busy', 'false');
    document.body.dataset.route = route.name;
    /* Eine Ansicht mit mehreren Teilen (Trainer) trägt den Teil selbst ein. */
    delete document.body.dataset.teil;

    try {
      view.render(behaelter, route.params);
    } catch (fehler) {
      behaelter.appendChild(HT.ui.leerZustand(
        'Diese Ansicht konnte nicht aufgebaut werden',
        'Bitte die Seite neu laden. Technische Meldung: ' + (fehler && fehler.message ? fehler.message : String(fehler))
      ));
      if (global.console && global.console.error) { global.console.error(fehler); }
    }

    /* Seiten, die je Parameter eine eigene Seite sind (Feld der Abbildung),
       stellen den Titel als Funktion bereit; `nav` sagt, welcher Menüpunkt
       dazu gehört. */
    var titel = typeof view.titel === 'function' ? view.titel(route.params) : view.titel;
    document.title = titel + ' · meinHERMES';
    navMarkieren(view.nav || route.name);

    if (!ersterAufruf && !route.params.id) {
      var haupt = document.getElementById('hauptinhalt');
      try {
        global.scrollTo(0, 0);
        if (haupt) { haupt.focus({ preventScroll: true }); }
      } catch (e) {
        if (haupt) { haupt.focus(); }
      }
    }
    ersterAufruf = false;
  }

  /* --- Hinweis auf nicht geladene Datendateien ---------------------------- */

  function datenWarnung() {
    var fehler = HT.daten.fehlerhafteDateien();
    if (!fehler.length) { return null; }

    var alleFehlen = fehler.length >= 8;
    var text = alleFehlen
      ? 'Die Inhalte konnten nicht geladen werden. Wird die Seite direkt aus dem Dateisystem geöffnet (file://), '
        + 'blockiert der Browser das Lesen der JSON-Dateien — dann hilft ein lokaler Webserver, etwa «python3 -m http.server 8000».'
      : 'Nicht geladen werden konnten: ' + fehler.join(', ') + '. Die übrigen Inhalte stehen zur Verfügung.';

    return h('div', { class: 'datenwarnung', role: 'status' }, text);
  }

  /* --- Start -------------------------------------------------------------- */

  function starten() {
    /* Die Ansichten rollen selbst zum gewünschten Element (Direktlink auf
       eine Karte, einen Teil); die Wiederherstellung der Scrollposition
       durch den Browser nach dem Laden würde das wieder aufheben. */
    try { if ('scrollRestoration' in global.history) { global.history.scrollRestoration = 'manual'; } } catch (e) { /* egal */ }
    navBauen();
    sucheBauen();
    gleicheRouteAbfangen();

    HT.daten.laden().then(function () {
      if (!global.location.hash) {
        try {
          global.history.replaceState(null, '', '#/' + STARTROUTE);
        } catch (e) {
          global.location.hash = '#/' + STARTROUTE;
        }
      }
      zeichnen();
    }).catch(function (fehler) {
      var behaelter = document.getElementById('view');
      if (!behaelter) { return; }
      HT.ui.leeren(behaelter);
      behaelter.setAttribute('aria-busy', 'false');
      behaelter.appendChild(HT.ui.leerZustand(
        'Die Inhalte konnten nicht geladen werden',
        'Bitte die Seite neu laden. Technische Meldung: ' + (fehler && fehler.message ? fehler.message : String(fehler))
      ));
    });

    global.addEventListener('hashchange', zeichnen);
  }

  HT.app = {
    datenWarnung: datenWarnung,
    zeichnen: zeichnen,
    routen: ROUTEN
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', starten);
  } else {
    starten();
  }
}(window));
