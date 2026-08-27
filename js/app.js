/* HERMES-Trainer — Anwendungsgerüst.
   Lädt die Daten, baut die Navigation und schaltet die Ansichten
   über location.hash um (GitHub Pages braucht so keine Server-Konfiguration). */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  var h = HT.ui.h;

  var SVG_NS = 'http://www.w3.org/2000/svg';

  var ROUTEN = [
    { name: 'lexikon',    label: 'Lexikon',    kurz: 'Lexikon',  pfade: ['M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z', 'M4 17.5h15'] },
    { name: 'lernkarten', label: 'Lernkarten', kurz: 'Karten',   pfade: ['M8 3h10a2 2 0 0 1 2 2v9', 'M5 7h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z'] },
    { name: 'quiz',       label: 'Quiz',       kurz: 'Quiz',     pfade: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M9.3 9.4a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 3.9', 'M12 17.4h.01'] },
    { name: 'uebersicht', label: 'Übersicht',  kurz: 'Übersicht', pfade: ['M4 5h6v6H4Z', 'M14 5h6v6h-6Z', 'M4 15h6v4H4Z', 'M14 15h6v4h-6Z'] },
    { name: 'ueber',      label: 'Über',       kurz: 'Über',     pfade: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 11v5.5', 'M12 7.8h.01'] }
  ];

  var STARTROUTE = 'lexikon';
  var ersterAufruf = true;

  /* --- Inline-SVG-Symbole (keine externen Abhängigkeiten) ----------------- */

  function symbol(pfade) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    pfade.forEach(function (d) {
      var p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    });
    return svg;
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
          h('span', { class: 'nav-icon' }, symbol(r.pfade)),
          h('span', { class: 'nav-label', text: r.kurz })
        ])));
      }
    });
  }

  /* Klick auf einen Link, der bereits die aktuelle Route ist, baut die Ansicht
     trotzdem neu auf — sonst passiert beim Tippen auf «Quiz» im laufenden Quiz nichts. */
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

    try {
      view.render(behaelter, route.params);
    } catch (fehler) {
      behaelter.appendChild(HT.ui.leerZustand(
        'Diese Ansicht konnte nicht aufgebaut werden',
        'Bitte die Seite neu laden. Technische Meldung: ' + (fehler && fehler.message ? fehler.message : String(fehler))
      ));
      if (global.console && global.console.error) { global.console.error(fehler); }
    }

    document.title = view.titel + ' · HERMES-Trainer';
    navMarkieren(route.name);

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
    navBauen();
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
