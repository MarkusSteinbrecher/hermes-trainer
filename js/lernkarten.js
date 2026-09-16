/* meinHERMES — Teil «Lernkarten» des Trainers (#/trainer?teil=lernkarten).
   Karten für Aufgaben und Ergebnisse. Worum es geht, ist der Zusammenhang
   von Phase, Modul, Aufgabe, Ergebnis und Rolle: vorn steht der Begriff
   (oder die Definition) und darunter je Bezug ein Feld — Phase, Modul,
   verantwortliche Rolle und das Gegenstück (die Ergebnisse einer Aufgabe
   bzw. die Aufgaben, aus denen ein Ergebnis entsteht). Gesucht sind je
   Zeile alle Werte, die dort richtig sind (49 der 71 Aufgaben erzeugen
   mehrere Ergebnisse, die meisten Elemente stehen in mehreren Phasen); die
   Zeile zählt mit («2 von 4 gefunden»). Jede Wahl wird sofort geprüft, die
   erste falsche beendet die Zeile; sind alle Zeilen fertig, dreht sich die
   Karte zur Lösung. Die Werte kommen aus einem Kombinationsfeld, bei langen
   Listen (Aufgaben, Ergebnisse) mit Suche. Ohne Wahl geht es auch: Karte drehen und selbst einschätzen.
   Dazu die Grundbegriffe (data/grundbegriffe.json, nur hier geladen): ihre
   Karte zeigt immer die Definition und fragt allein den Begriff ab.
   «Nochmals» kehrt im Stapel zurück. Fortschritt liegt im localStorage und
   ist zurücksetzbar. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.trainerTeile = HT.trainerTeile || {};

  var h = HT.ui.h;
  var KATEGORIEN = ['aufgabe', 'ergebnis', 'grundbegriff'];
  /* 1 (ohne Angabe): Begriff ↔ Definition für alle Kategorien — «Gewusst» galt nur der Definition
     2: Bezüge auf der Rückseite (Rolle, Ergebnisse/Aufgaben, Modul)
     3: Bezüge als Dropdown auf der Vorderseite, dazu die Phase */
  var VERSION = 3;

  /* Wie lange die Rückmeldung der letzten Wahl stehen bleibt, bevor sich
     die Karte von selbst dreht (ms). */
  var DREH_VERZUG = 550;

  var zustand = {
    initialisiert: false,
    richtung: 'bd',        // 'bd' = vorne Begriff, 'db' = vorne Definition
    filter: [],            // leer = Aufgaben, Ergebnisse und Grundbegriffe
    fortschritt: {},       // id -> 'gewusst' | 'nochmals'
    stapel: [],            // offene Karten-IDs der laufenden Runde
    gedreht: false,
    antworten: {}          // Bezug-Schlüssel -> { wert, richtig } der laufenden Karte
  };

  var refs = {};
  var entstehtAus = null;  // Ergebnis-Begriff -> [Aufgaben-Begriffe]
  var pool = null;         // Kategorie -> Werteliste der Dropdowns

  /* --- Persistenz --------------------------------------------------------- */

  function speichern() {
    HT.store.schreib('lernkarten', {
      version: VERSION,
      richtung: zustand.richtung,
      filter: zustand.filter,
      fortschritt: zustand.fortschritt
    });
  }

  function wiederherstellen() {
    var g = HT.store.lies('lernkarten', null);
    if (g && typeof g === 'object') {
      zustand.richtung = (g.richtung === 'db') ? 'db' : 'bd';
      zustand.filter = Array.isArray(g.filter)
        ? g.filter.filter(function (k) { return KATEGORIEN.indexOf(k) !== -1; })
        : [];
      zustand.fortschritt = (g.version === VERSION && g.fortschritt && typeof g.fortschritt === 'object')
        ? g.fortschritt
        : {};
    }
  }

  /* --- Beziehungen -------------------------------------------------------- */

  function rollenVon(e) {
    return e.verantwortlich
      ? e.verantwortlich.split(',').map(function (r) { return r.trim(); }).filter(function (r) { return !!r; })
      : [];
  }

  function aufgabenZu(ergebnis) {
    if (!entstehtAus) {
      entstehtAus = {};
      HT.daten.eintraegeDerKategorie('aufgabe').forEach(function (a) {
        a.ergebnisse.forEach(function (name) {
          (entstehtAus[name] = entstehtAus[name] || []).push(a.begriff);
        });
      });
    }
    return entstehtAus[ergebnis.begriff] || [];
  }

  /* Die agile Phase muss nicht genannt werden, wenn das Element daneben noch
     in anderen Phasen steht; die Lösung zeigt sie trotzdem. Steht es nur in
     der Umsetzung (die Release-Karten), bleibt sie gesucht. */
  var FREIWILLIGE_PHASE = 'Umsetzung';

  function phasenZeile(e) {
    var werte = HT.daten.phasenSortiert(e.phasen);
    var pflicht = werte.length > 1
      ? werte.filter(function (p) { return p !== FREIWILLIGE_PHASE; })
      : werte;
    return {
      key: 'phase', kategorie: 'phase', werte: werte, pflicht: pflicht,
      label: pflicht.length === 1 ? 'Phase' : 'Phasen',
      labelLoesung: werte.length === 1 ? 'Phase' : 'Phasen'
    };
  }

  /**
   * Die Bezüge einer Karte in der Reihenfolge der Methode: Phase, Modul,
   * verantwortliche Rolle, dann das Gegenstück. Nur Zeilen mit Werten —
   * das lässt die Sammeleinträge «Checklisten» und «Meilensteine» aussen vor.
   * [{ key, label, kategorie, werte, pflicht?, labelLoesung? }] — werte sind
   * alle richtigen Werte, pflicht (ohne Angabe: werte) die gesuchten.
   */
  function bezuege(e) {
    if (istGrundbegriff(e)) { return []; }
    var zeilen = [
      phasenZeile(e),
      { key: 'modul', label: e.module.length === 1 ? 'Modul' : 'Module', kategorie: 'modul', werte: e.module },
      { key: 'rolle', label: 'Verantwortlich', kategorie: 'rolle', werte: rollenVon(e) }
    ];
    if (e.kategorie === 'aufgabe') {
      zeilen.push({ key: 'ergebnis', label: e.ergebnisse.length === 1 ? 'Ergebnis' : 'Ergebnisse', kategorie: 'ergebnis', werte: e.ergebnisse });
    } else {
      zeilen.push({ key: 'aufgabe', label: 'Entsteht aus', kategorie: 'aufgabe', werte: aufgabenZu(e) });
    }
    return zeilen.filter(function (z) { return z.werte.length > 0; });
  }

  /* Grundbegriffe haben keine Bezüge (Phase, Modul usw. werden bei ihnen nicht
     abgefragt, auch wo die Daten welche nennen): ihre Karte zeigt immer die
     Definition und fragt nur den Begriff. */
  function istGrundbegriff(e) {
    return e.kategorie === 'grundbegriff';
  }

  /** Steht vorn die Definition? Bei «Vorne: Definition» und bei Grundbegriffen. */
  function begriffGesucht(e) {
    return zustand.richtung === 'db' || istGrundbegriff(e);
  }

  /** Was die Vorderseite abfragt: ist der Begriff gesucht, zuerst er selbst. */
  function fragen(e) {
    var vorweg = begriffGesucht(e)
      ? [{ key: 'begriff', label: 'Begriff', kategorie: e.kategorie, werte: [e.begriff] }]
      : [];
    return vorweg.concat(bezuege(e));
  }

  /**
   * Die Auswahl eines Dropdowns: alle Werte, die auf irgendeiner Karte
   * richtig sein können — nicht alle Einträge der Kategorie. So ist jede
   * Option eine mögliche Antwort (bei den Rollen etwa nur die neun, die
   * überhaupt verantwortlich zeichnen).
   */
  function poolVon(kategorie) {
    if (!pool) {
      pool = {};
      var gesehen = {};
      var merken = function (kat, werte) {
        if (!pool[kat]) { pool[kat] = []; gesehen[kat] = {}; }
        werte.forEach(function (w) {
          if (gesehen[kat][w]) { return; }
          gesehen[kat][w] = true;
          pool[kat].push(w);
        });
      };
      KATEGORIEN.forEach(function (kat) {
        kartenDerKategorie(kat).forEach(function (e) {
          merken(kat, [e.begriff]);
          bezuege(e).forEach(function (z) { merken(z.kategorie, z.werte); });
        });
      });
      Object.keys(pool).forEach(function (kat) {
        pool[kat] = kat === 'phase'
          ? HT.daten.phasenSortiert(pool[kat])
          : pool[kat].sort(function (a, b) { return a.localeCompare(b, 'de'); });
      });
    }
    return pool[kategorie] || [];
  }

  /* --- Stapel ------------------------------------------------------------- */

  /* Ohne Definition keine Karte, bei Aufgaben und Ergebnissen auch nicht ohne Bezüge. */
  function kartenDerKategorie(kat) {
    return HT.daten.eintraegeDerKategorie(kat).filter(function (e) {
      return !!e.definition && (istGrundbegriff(e) || bezuege(e).length > 0);
    });
  }

  /* Grundbegriffe stehen nicht unter HT.daten.eintragMitId (nur die Lernkarten kennen sie). */
  function eintragFuer(id) {
    return HT.daten.eintragMitId(id)
      || HT.daten.eintraegeDerKategorie('grundbegriff').filter(function (e) { return e.id === id; })[0]
      || null;
  }

  function auswahl() {
    var kats = zustand.filter.length ? zustand.filter : KATEGORIEN;
    return kats.reduce(function (alle, k) { return alle.concat(kartenDerKategorie(k)); }, []);
  }

  function neueKarte() {
    zustand.gedreht = false;
    zustand.antworten = {};
  }

  function stapelAufbauen(auchGewusste) {
    var karten = auswahl();
    var ids = karten
      .filter(function (e) { return auchGewusste || zustand.fortschritt[e.id] !== 'gewusst'; })
      .map(function (e) { return e.id; });
    zustand.stapel = HT.ui.mischen(ids);
    neueKarte();
  }

  function zaehlen() {
    var karten = auswahl();
    var gewusst = 0;
    karten.forEach(function (e) {
      if (zustand.fortschritt[e.id] === 'gewusst') { gewusst++; }
    });
    return { gesamt: karten.length, gewusst: gewusst, offen: zustand.stapel.length };
  }

  /** Stand der laufenden Karte über alle Zeilen; angefangene zählen nicht. */
  function auswertung(e) {
    var alle = fragen(e);
    var beantwortet = 0;
    var richtig = 0;
    alle.forEach(function (z) {
      var a = zustand.antworten[z.key];
      if (!a || !a.fertig) { return; }
      beantwortet++;
      if (a.richtig) { richtig++; }
    });
    return {
      gesamt: alle.length,
      beantwortet: beantwortet,
      richtig: richtig,
      fertig: beantwortet === alle.length
    };
  }

  /* --- Kartenaufbau ------------------------------------------------------- */

  function zeichenFuer(richtig) {
    return h('span', {
      class: 'lk-zeichen lk-zeichen--' + (richtig ? 'gut' : 'schlecht'),
      role: 'img',
      'aria-label': richtig ? 'richtig' : 'falsch',
      text: richtig ? '✓' : '✗'
    });
  }

  /* Ab so vielen Optionen bekommt das Kombinationsfeld ein Suchfeld: Phasen
     (6), Module (12) und die neun verantwortlichen Rollen sucht man nicht,
     Aufgaben (71) und Ergebnisse (110) schon. */
  var SUCHE_AB = 14;
  var kombiNummer = 0;
  var offeneListe = null;      // nur eine Liste steht offen

  function passt(wert, suche) {
    if (!suche) { return true; }
    return HT.daten.normalisieren(wert).indexOf(HT.daten.normalisieren(suche)) !== -1;
  }

  /**
   * Kombinationsfeld: Liste zum Aufklappen, bei langen Listen mit Suche.
   * Mehrfachauswahl — was gewählt ist, verschwindet aus der Liste; die Zeile
   * selbst entscheidet, was die Wahl bedeutet (opt.beiWahl).
   * opt: { label, vergeben: [Werte], beiWahl(wert) }
   */
  function kombiFeld(optionen, opt) {
    var id = 'lk-liste-' + (++kombiNummer);
    var mitSuche = optionen.length >= SUCHE_AB;
    var feld = h('input', {
      type: 'text', class: 'lk-kombi__feld',
      role: 'combobox', 'aria-expanded': 'false', 'aria-controls': id,
      'aria-autocomplete': mitSuche ? 'list' : 'none', 'aria-label': opt.label,
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      placeholder: mitSuche ? 'suchen oder wählen …' : 'wählen …'
    });
    if (!mitSuche) { feld.readOnly = true; }
    var liste = h('ul', { class: 'lk-kombi__liste', id: id, role: 'listbox', 'aria-label': opt.label, hidden: true });
    var el = h('div', { class: 'lk-kombi' }, [feld, liste]);
    var offen = false, aktiv = -1, sichtbar = [], vergeben = {};
    (opt.vergeben || []).forEach(function (w) { vergeben[w] = true; });

    /* Die offene Liste schwebt (position: fixed) und hängt am body: in der
       Karte stünde sie im Fluss und würde sie auseinanderziehen — die Karte
       rollt bei max-height 70vh und schnitte die Liste ab. Geschlossen kehrt
       sie in die Hülle zurück, damit ein Neuaufbau sie mitnimmt. */
    function positionieren() {
      var r = feld.getBoundingClientRect();
      var unten = global.innerHeight - r.bottom - 10;
      var oben = r.top - 10;
      var nachOben = unten < 170 && oben > unten;
      var hoehe = Math.max(110, Math.min(240, nachOben ? oben : unten));
      liste.style.left = Math.round(r.left) + 'px';
      liste.style.width = Math.round(r.width) + 'px';
      liste.style.maxHeight = Math.round(hoehe) + 'px';
      if (nachOben) {
        liste.style.top = 'auto';
        liste.style.bottom = Math.round(global.innerHeight - r.top + 4) + 'px';
      } else {
        liste.style.bottom = 'auto';
        liste.style.top = Math.round(r.bottom + 4) + 'px';
      }
    }

    function zeichnen() {
      HT.ui.leeren(liste);
      sichtbar = optionen.filter(function (w) { return !vergeben[w] && passt(w, mitSuche ? feld.value : ''); });
      if (aktiv >= sichtbar.length) { aktiv = sichtbar.length - 1; }
      if (!sichtbar.length) {
        liste.appendChild(h('li', { class: 'lk-kombi__leer', text: 'Nichts gefunden' }));
        feld.removeAttribute('aria-activedescendant');
        return;
      }
      sichtbar.forEach(function (w, i) {
        var o = h('li', {
          class: 'lk-kombi__option' + (i === aktiv ? ' ist-aktiv' : ''),
          role: 'option', id: id + '-o' + i, 'aria-selected': i === aktiv ? 'true' : 'false', text: w
        });
        /* mousedown statt click: sonst nimmt der Fokuswechsel die Liste weg,
           bevor die Wahl ankommt. */
        o.addEventListener('mousedown', function (ev) { ev.preventDefault(); waehlen(w); });
        liste.appendChild(o);
      });
      if (aktiv >= 0) {
        feld.setAttribute('aria-activedescendant', id + '-o' + aktiv);
        var el2 = liste.children[aktiv];
        if (el2 && el2.scrollIntoView) { el2.scrollIntoView({ block: 'nearest' }); }
      } else {
        feld.removeAttribute('aria-activedescendant');
      }
    }

    function oeffnen() {
      if (offen || feld.disabled) { return; }
      if (offeneListe && offeneListe !== schliessen) { offeneListe(); }
      offeneListe = schliessen;
      offen = true;
      aktiv = -1;
      document.body.appendChild(liste);
      liste.hidden = false;
      feld.setAttribute('aria-expanded', 'true');
      zeichnen();
      positionieren();
      /* true: auch das Rollen der Karte selbst führt die Liste nach. */
      global.addEventListener('scroll', positionieren, true);
      global.addEventListener('resize', positionieren);
    }

    function schliessen() {
      if (!offen) { return; }
      offen = false;
      liste.hidden = true;
      el.appendChild(liste);
      global.removeEventListener('scroll', positionieren, true);
      global.removeEventListener('resize', positionieren);
      feld.setAttribute('aria-expanded', 'false');
      feld.removeAttribute('aria-activedescendant');
      if (offeneListe === schliessen) { offeneListe = null; }
    }

    function waehlen(w) {
      vergeben[w] = true;
      feld.value = '';
      opt.beiWahl(w);
      if (!feld.disabled) { zeichnen(); positionieren(); feld.focus(); }
    }

    function bewegen(schritt) {
      if (!offen) { oeffnen(); return; }
      if (!sichtbar.length) { return; }
      aktiv = (aktiv + schritt + sichtbar.length + 1) % (sichtbar.length + 1);
      if (aktiv === sichtbar.length) { aktiv = schritt > 0 ? 0 : sichtbar.length - 1; }
      zeichnen();
    }

    feld.addEventListener('focus', oeffnen);
    feld.addEventListener('mousedown', function () { if (offen) { schliessen(); } else { oeffnen(); } });
    feld.addEventListener('input', function () { aktiv = -1; if (!offen) { oeffnen(); } else { zeichnen(); } });
    feld.addEventListener('blur', schliessen);
    feld.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); bewegen(1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); bewegen(-1); }
      else if (ev.key === 'Escape') { if (offen) { ev.stopPropagation(); schliessen(); } }
      else if (ev.key === 'Enter') {
        ev.preventDefault();
        if (aktiv >= 0 && sichtbar[aktiv]) { waehlen(sichtbar[aktiv]); }
        else if (sichtbar.length === 1) { waehlen(sichtbar[0]); }
      }
    });

    return {
      el: el,
      sperren: function () {
        schliessen();
        feld.disabled = true;
        feld.value = '';
        el.classList.add('ist-gesperrt');
      }
    };
  }

  /**
   * Eine Abfragezeile der Vorderseite: Bezeichnung, die schon gewählten
   * Werte, das Kombinationsfeld und der Stand. Gesucht sind alle Werte der
   * Zeile (z.pflicht); jede Wahl wird sofort geprüft, die erste falsche
   * beendet sie. Ein freiwilliger Wert (Umsetzung) zählt als richtig, aber
   * nicht zum Gefundenen.
   */
  function frageZeile(z, beiAntwort) {
    var a = zustand.antworten[z.key];
    if (!a || !Array.isArray(a.gewaehlt)) {
      a = zustand.antworten[z.key] = { gewaehlt: [], fertig: false, richtig: false };
    }
    var pflicht = z.pflicht || z.werte;
    var mehrere = pflicht.length > 1;
    var chips = h('div', { class: 'lk-chips', hidden: true });
    var stand = h('span', { class: 'lk-frage__stand' });
    var kombi = kombiFeld(poolVon(z.kategorie), {
      label: z.label,
      vergeben: a.gewaehlt.map(function (g) { return g.wert; }),
      beiWahl: function (w) { waehlen(w); }
    });

    var zeile = h('div', { class: 'lk-frage', role: 'group', 'aria-label': z.label, dataset: { stand: 'offen' } }, [
      h('span', { class: 'lk-frage__label' }, [
        HT.ui.katSymbol(z.kategorie, 14),
        h('span', { text: z.label })
      ]),
      h('div', { class: 'lk-frage__feld' }, [chips, kombi.el]),
      stand
    ]);

    function gefunden() {
      return a.gewaehlt.filter(function (g) { return g.richtig && pflicht.indexOf(g.wert) !== -1; }).length;
    }

    function zeichnen() {
      HT.ui.leeren(chips);
      a.gewaehlt.forEach(function (g) {
        chips.appendChild(h('span', { class: 'lk-chip lk-chip--' + (g.richtig ? 'gut' : 'schlecht') }, [
          h('span', { 'aria-hidden': 'true', text: g.richtig ? '✓' : '✗' }),
          h('span', { text: g.wert })
        ]));
      });
      chips.hidden = !a.gewaehlt.length;
      /* Bei einem einzigen gesuchten Wert sagt das Zeichen alles — «1 von 1»
         wäre nur Lärm. */
      HT.ui.leeren(stand);
      if (a.fertig) {
        stand.appendChild(zeichenFuer(a.richtig));
        if (mehrere) { stand.appendChild(h('span', { text: gefunden() + ' von ' + pflicht.length })); }
      } else if (mehrere) {
        stand.appendChild(h('span', { text: gefunden() + ' von ' + pflicht.length + ' gefunden' }));
      }
      zeile.dataset.stand = a.fertig ? (a.richtig ? 'richtig' : 'falsch') : (a.gewaehlt.length ? 'begonnen' : 'offen');
    }

    function waehlen(w) {
      if (a.fertig) { return; }
      var richtig = z.werte.indexOf(w) !== -1;
      a.gewaehlt.push({ wert: w, richtig: richtig });
      if (!richtig) { a.fertig = true; a.richtig = false; }
      else if (gefunden() >= pflicht.length) { a.fertig = true; a.richtig = true; }
      if (a.fertig) { kombi.sperren(); }
      zeichnen();
      beiAntwort();
    }

    if (a.fertig) { kombi.sperren(); }
    zeichnen();
    return { el: zeile, sperren: kombi.sperren };
  }

  /** Am Fuss beider Seiten die drei Wege weiter: das Element im Überblick, im
      Handbuch und auf der offiziellen Seite. Solange der Begriff gesucht ist
      (Vorderseite «Definition»), nennen die Tooltips ihn nicht. Grundbegriffe
      stehen weder im Überblick noch im Handbuch — bei ihnen nur HERMES online. */
  function verweise(e, mitBegriff) {
    var name = mitBegriff ? e.begriff : 'Das Element';
    var offiziell = HT.ui.quellenLink(e.quelle, 'lk-verweis lk-verweis--akzent');
    if (offiziell && !mitBegriff) {
      offiziell.setAttribute('title', 'HERMES online');
      offiziell.setAttribute('aria-label', 'HERMES online (öffnet in neuem Tab)');
    }
    if (istGrundbegriff(e)) {
      return h('div', { class: 'flip__hinweis lk-verweise' }, [offiziell]);
    }
    return h('div', { class: 'flip__hinweis lk-verweise' }, [
      h('a', {
        class: 'lk-verweis', href: '#/ueberblick?id=' + encodeURIComponent(e.id),
        text: 'Im Überblick', title: name + ' im Überblick zeigen'
      }),
      h('a', {
        class: 'lk-verweis', href: '#/handbuch?id=' + encodeURIComponent(e.id),
        text: 'Im Handbuch', title: name + ' im Handbuch zeigen'
      }),
      offiziell
    ]);
  }

  function seiteVorne(e, beiAntwort) {
    var istBegriff = !begriffGesucht(e);
    var sperren = [];

    var kopf = h('div', { class: 'flip__rolle' }, [
      h('span', { text: istBegriff ? 'Begriff' : 'Definition' }),
      ' · ',
      HT.ui.badge(e.kategorie)
    ]);

    var inhalt = h('div', {
      class: 'flip__inhalt' + (istBegriff ? '' : ' flip__inhalt--klein'),
      /* Beim Abfragen der Definition darf der gesuchte Begriff nicht darin stehen. */
      text: istBegriff ? e.begriff : HT.ui.ohneBegriff(e.definition, e.begriff)
    });

    var liste = h('div', { class: 'lk-fragen' }, fragen(e).map(function (z) {
      var zeile = frageZeile(z, beiAntwort);
      sperren.push(zeile.sperren);
      return zeile.el;
    }));

    var seite = h('div', {
      class: 'flip__seite flip__seite--vorne',
      tabindex: '-1',
      'aria-hidden': 'false'
    }, [kopf, inhalt, h('p', {
      class: 'lk-auftrag',
      text: istGrundbegriff(e)
        ? 'Welcher Begriff ist gemeint? Die Wahl wird sofort geprüft:'
        : 'Zuordnen — gesucht sind alle Werte je Zeile, jede Wahl wird sofort geprüft:'
    }), liste, verweise(e, istBegriff)]);

    return { el: seite, sperren: sperren };
  }

  /** Eine Bezugszeile der Lösung: alle gesuchten Werte — was man selbst
      gefunden hat, ist markiert —, dahinter die falsche Wahl, an der die
      Zeile endete. */
  function loesungZeile(z) {
    var a = zustand.antworten[z.key];
    var gefunden = {}, falsche = [];
    if (a) {
      a.gewaehlt.forEach(function (g) {
        if (g.richtig) { gefunden[g.wert] = true; } else { falsche.push(g.wert); }
      });
    }
    var werte = z.werte.map(function (w) {
      return h('li', { class: gefunden[w] ? 'ist-gewaehlt' : null }, [
        HT.ui.katSymbol(z.kategorie, 14),
        h('span', { text: w })
      ]);
    });
    falsche.forEach(function (w) {
      werte.push(h('li', { class: 'ist-falsch' }, [
        HT.ui.katSymbol(z.kategorie, 14),
        h('span', { text: w })
      ]));
    });
    return h('div', { class: 'lk-bezug' }, [
      h('dt', {}, [a && a.fertig ? zeichenFuer(a.richtig) : null, h('span', { text: z.labelLoesung || z.label })]),
      h('dd', {}, [h('ul', { class: 'lk-werte' }, werte)])
    ]);
  }

  /** Inhalt der Rückseite; er entsteht erst beim Drehen, mit den Zeichen der eigenen Wahl. */
  function hintenFuellen(el, e) {
    var st = auswertung(e);
    var begriffAntwort = zustand.antworten.begriff;

    /* Wer die Karte vor der letzten Wahl dreht, soll die offenen Zuordnungen
       nicht als Fehler gezählt sehen. */
    var bilanz = !st.beantwortet
      ? h('span', { text: 'ohne Zuordnung' })
      : h('span', {
        class: st.richtig === st.beantwortet ? 'tag-gut' : 'tag-schlecht',
        /* Eine Karte mit einer einzigen Frage (Grundbegriffe) braucht kein «1 von 1». */
        text: st.gesamt === 1
          ? (st.richtig ? 'richtig' : 'falsch')
          : st.fertig
            ? st.richtig + ' von ' + st.gesamt + ' richtig'
            : st.richtig + ' von ' + st.beantwortet + ' richtig, ' + (st.gesamt - st.beantwortet) + ' offen'
      });

    el.appendChild(h('div', { class: 'flip__rolle' }, [
      h('span', { text: 'Lösung' }),
      ' · ',
      bilanz,
      ' · ',
      HT.ui.badge(e.kategorie)
    ]));

    el.appendChild(h('div', { class: 'flip__inhalt' }, [
      begriffAntwort && begriffAntwort.fertig ? zeichenFuer(begriffAntwort.richtig) : null,
      h('span', { text: e.begriff })
    ]));
    if (begriffAntwort && begriffAntwort.fertig && !begriffAntwort.richtig) {
      el.appendChild(h('p', {
        class: 'lk-gewaehlt',
        text: 'Gewählt: ' + begriffAntwort.gewaehlt.map(function (g) { return g.wert; }).join(', ')
      }));
    }

    if (bezuege(e).length) {
      el.appendChild(h('dl', { class: 'lk-bezuege' }, bezuege(e).map(loesungZeile)));
    }
    el.appendChild(h('div', { class: 'flip__inhalt flip__inhalt--klein', text: e.definition }));

    el.appendChild(verweise(e, true));
  }

  function kartenBereichAufbauen() {
    var bereich = h('div', {});
    var st = zaehlen();

    if (!st.gesamt) {
      bereich.appendChild(HT.ui.leerZustand(
        'Keine Karten im gewählten Umfang',
        HT.daten.alleEintraege().length
          ? 'Für die gewählten Kategorien gibt es keine Karten. Filter anpassen.'
          : 'Die Datendateien in data/ sind derzeit leer. Sobald Einträge erfasst sind, entstehen daraus Lernkarten.'
      ));
      return bereich;
    }

    if (!zustand.stapel.length) {
      bereich.appendChild(h('div', { class: 'box abschluss' }, [
        h('p', { class: 'abschluss__zahl', text: st.gewusst + ' / ' + st.gesamt }),
        h('p', { text: 'Stapel durchgearbeitet — alle Karten als «Gewusst» eingestuft.' }),
        h('div', { class: 'btn-reihe', style: 'justify-content:center' }, [
          h('button', {
            type: 'button', class: 'btn btn--primaer', text: 'Stapel neu mischen',
            on: { click: function () { stapelAufbauen(true); neuZeichnen(true); } }
          }),
          h('button', {
            type: 'button', class: 'btn', text: 'Fortschritt zurücksetzen',
            on: { click: zuruecksetzen }
          })
        ])
      ]));
      return bereich;
    }

    var e = eintragFuer(zustand.stapel[0]);
    if (!e) {                              // Datenlage hat sich geändert
      zustand.stapel.shift();
      return kartenBereichAufbauen();
    }

    var stand = h('p', { class: 'lk-stand', role: 'status' });
    var vorne = seiteVorne(e, function () { antwortGezaehlt(); });
    var hinten = h('div', { class: 'flip__seite flip__seite--hinten', 'aria-hidden': 'true' });
    var flip = h('div', { class: 'flip' }, [vorne.el, hinten]);

    var drehKnopf = h('button', {
      type: 'button', class: 'btn lk-drehen', text: 'Lösung zeigen'
    });
    var gewusstBtn = h('button', {
      type: 'button', class: 'btn btn--gut', text: 'Gewusst', disabled: true
    });
    var nochmalsBtn = h('button', {
      type: 'button', class: 'btn btn--schlecht', text: 'Nochmals', disabled: true
    });

    function standSetzen() {
      var s = auswertung(e);
      if (!s.beantwortet) {
        stand.textContent = s.gesamt + ' ' + (s.gesamt === 1 ? 'Zuordnung' : 'Zuordnungen') + ' offen';
      } else if (!s.fertig) {
        stand.textContent = s.beantwortet + ' von ' + s.gesamt + ' zugeordnet, ' + s.richtig + ' richtig';
      } else {
        stand.textContent = s.richtig === s.gesamt
          ? 'Alle ' + s.gesamt + ' Zuordnungen richtig'
          : s.richtig + ' von ' + s.gesamt + ' richtig';
      }
    }

    function drehen() {
      if (zustand.gedreht) { return; }
      zustand.gedreht = true;
      hintenFuellen(hinten, e);
      flip.classList.add('ist-gedreht');
      vorne.el.setAttribute('aria-hidden', 'true');
      hinten.setAttribute('aria-hidden', 'false');
      /* Hinter der Rückseite darf nichts mehr zu bedienen sein; wie viel
         richtig war, sagt jetzt der Kopf der Lösung. */
      vorne.sperren.forEach(function (sperre) { sperre(); });
      stand.hidden = true;
      drehKnopf.hidden = true;
      gewusstBtn.disabled = false;
      nochmalsBtn.disabled = false;
      var s = auswertung(e);
      (s.beantwortet && s.richtig < s.gesamt ? nochmalsBtn : gewusstBtn).focus();
    }

    /* Fortschritt (js/fortschritt.js): Hat die Karte Phase und Modul richtig
       zugeordnet und steht das Element in diesem Feld wirklich, zählt das
       Feld eine richtige Antwort. Falsche Wahlen melden nichts — eine Karte
       sagt nicht, in welchem Feld es gehakt hat. */
    function fortschrittMelden() {
      if (!HT.fortschritt) { return; }
      var p = zustand.antworten.phase, m = zustand.antworten.modul;
      if (!p || !p.richtig || !m || !m.richtig) { return; }
      /* Beide Zeilen sind vollständig richtig — also zählt jedes Feld, das
         aus einer genannten Phase und einem genannten Modul besteht. */
      var liste = [];
      m.gewaehlt.forEach(function (gm) {
        var phasen = HT.daten.phasenImModul(e, gm.wert);
        p.gewaehlt.forEach(function (gp) {
          if (phasen.indexOf(gp.wert) !== -1) {
            liste.push({ phase: gp.wert, modul: gm.wert, id: e.id, richtig: true });
          }
        });
      });
      HT.fortschritt.melden(liste);
    }

    /* Ist die letzte Zuordnung getroffen, dreht sich die Karte von selbst —
       kurz danach, damit das Zeichen der letzten Wahl noch zu sehen ist. */
    function antwortGezaehlt() {
      standSetzen();
      if (!auswertung(e).fertig || zustand.gedreht) { return; }
      fortschrittMelden();
      global.setTimeout(function () {
        if (zustand.stapel[0] === e.id) { drehen(); }
      }, DREH_VERZUG);
    }

    drehKnopf.addEventListener('click', drehen);
    gewusstBtn.addEventListener('click', function () { bewerten('gewusst'); });
    nochmalsBtn.addEventListener('click', function () { bewerten('nochmals'); });

    standSetzen();
    bereich.appendChild(h('div', { class: 'flip-wrap' }, flip));
    bereich.appendChild(stand);
    bereich.appendChild(drehKnopf);
    bereich.appendChild(h('div', { class: 'lk-aktionen' }, [nochmalsBtn, gewusstBtn]));

    return bereich;
  }

  function bewerten(wert) {
    var id = zustand.stapel[0];
    if (!id) { return; }
    zustand.fortschritt[id] = wert;
    zustand.stapel.shift();
    if (wert === 'nochmals') { zustand.stapel.push(id); }
    neueKarte();
    speichern();
    neuZeichnen(true);
  }

  function zuruecksetzen() {
    var etwasVorhanden = Object.keys(zustand.fortschritt).length > 0;
    if (etwasVorhanden && !global.confirm('Lernfortschritt wirklich zurücksetzen? Alle Einschätzungen gehen verloren.')) {
      return;
    }
    zustand.fortschritt = {};
    stapelAufbauen(true);
    speichern();
    neuZeichnen(true);
  }

  /* --- Fortschrittsanzeige ------------------------------------------------ */

  function fortschrittAufbauen() {
    var st = zaehlen();
    var anteil = HT.ui.prozent(st.gewusst, st.gesamt);
    var fuellung = h('div', { class: 'fortschritt__fuellung' });
    fuellung.style.width = anteil + '%';

    return h('div', { class: 'fortschritt' }, [
      h('div', { class: 'fortschritt__zeile' }, [
        h('span', { text: 'Gewusst ' + st.gewusst + ' / ' + st.gesamt }),
        h('span', { text: anteil + ' %' })
      ]),
      h('div', {
        class: 'fortschritt__balken',
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': String(anteil),
        'aria-label': 'Anteil gewusster Karten'
      }, fuellung)
    ]);
  }

  function neuZeichnen(fokusKarte) {
    if (!refs.spiel) { return; }
    HT.ui.leeren(refs.fortschritt).appendChild(fortschrittAufbauen());
    HT.ui.leeren(refs.spiel).appendChild(kartenBereichAufbauen());
    if (fokusKarte) {
      /* Die Karte selbst, nicht das erste Dropdown: ein versehentlicher
         Tastendruck soll keine Zuordnung setzen. */
      var vorne = refs.spiel.querySelector('.flip__seite--vorne');
      if (vorne) { vorne.focus(); }
    }
  }

  /* --- Steuerleiste ------------------------------------------------------- */

  function richtungsKnopf() {
    var btn = h('button', { type: 'button', class: 'btn btn--klein' });

    function beschriften() {
      var text = zustand.richtung === 'bd' ? 'Vorne: Begriff' : 'Vorne: Definition';
      btn.textContent = text;
      btn.setAttribute('aria-label', 'Vorderseite umschalten, aktuell ' + text);
      btn.setAttribute('title', 'Vorderseite umschalten: Begriff oder Definition');
    }

    btn.addEventListener('click', function () {
      zustand.richtung = zustand.richtung === 'bd' ? 'db' : 'bd';
      neueKarte();
      beschriften();
      speichern();
      neuZeichnen(true);
    });

    beschriften();
    return btn;
  }

  function chipsAufbauen() {
    var liste = h('ul', { class: 'chips chips--streifen', 'aria-label': 'Kategorien filtern' });
    var knoepfe = [];

    function markieren() {
      knoepfe.forEach(function (b) {
        var kat = b.dataset.kat;
        var aktiv = kat === '' ? zustand.filter.length === 0 : zustand.filter.indexOf(kat) !== -1;
        b.setAttribute('aria-pressed', aktiv ? 'true' : 'false');
      });
    }

    function chip(key, label, anzahl) {
      var btn = h('button', {
        type: 'button', class: 'chip', 'aria-pressed': 'false', dataset: { kat: key }
      }, [
        key ? HT.ui.katSymbol(key, 15) : null,
        h('span', { text: label }),
        anzahl === null ? null : h('span', { class: 'chip__zahl', text: String(anzahl) })
      ]);
      btn.addEventListener('click', function () {
        if (key === '') {
          zustand.filter = [];
        } else {
          var i = zustand.filter.indexOf(key);
          if (i === -1) { zustand.filter.push(key); } else { zustand.filter.splice(i, 1); }
        }
        markieren();
        stapelAufbauen(false);
        speichern();
        neuZeichnen(false);
      });
      knoepfe.push(btn);
      liste.appendChild(h('li', {}, btn));
    }

    chip('', 'Alle', null);
    KATEGORIEN.forEach(function (key) {
      var anzahl = kartenDerKategorie(key).length;
      if (!anzahl) { return; }
      chip(key, HT.daten.kategorieMeta(key).label, anzahl);
    });

    markieren();
    return liste;
  }

  /* --- Render ------------------------------------------------------------- */

  function render(behaelter, params, leiste) {
    if (!zustand.initialisiert) {
      wiederherstellen();
      zustand.initialisiert = true;
    }
    if (params && params.kat && KATEGORIEN.indexOf(params.kat) !== -1) {
      zustand.filter = [params.kat];
    }
    stapelAufbauen(false);

    /* Was die Lernkarten sind, steht vorn in der Karte hinter dem Info-Icon der Leiste. */
    if (leiste) {
      leiste(null, function () {
        return [
          h('h3', { class: 'gpop__abschnitt', text: 'Lernkarten' }),
          h('p', { text: 'Aufgaben und Ergebnisse und ihr Zusammenhang: In welcher Phase, in welchem Modul, wer ist '
            + 'verantwortlich, was entsteht woraus? Je Bezug eine Zeile auf der Vorderseite, und gesucht sind alle '
            + 'Werte, die dort richtig sind — die meisten Elemente stehen in mehreren Phasen, die meisten Aufgaben '
            + 'erzeugen mehrere Ergebnisse. Die Zeile zählt mit («2 von 4 gefunden»). Die agile Phase Umsetzung '
            + 'muss nicht genannt werden, wenn das Element auch in anderen Phasen steht; die Lösung zeigt sie trotzdem.' }),
          h('p', { text: 'Jede Wahl wird sofort geprüft; die erste falsche beendet die Zeile, die Lösung zeigt dann, '
            + 'was gefehlt hat. Sind alle Zeilen fertig, dreht sich die Karte. In langen Listen (Aufgaben, Ergebnisse) '
            + 'sucht man durch Tippen, kurze Listen klappen einfach auf.' }),
          h('p', { text: 'Grundbegriffe haben eigene Karten: Sie zeigen immer die Definition und fragen nur, welcher '
            + 'Begriff gemeint ist — ohne Phase, Modul und die übrigen Zeilen. Der Umschalter «Vorne: Begriff/Definition» '
            + 'gilt nur für Aufgaben und Ergebnisse.' }),
          h('p', { text: 'Ohne Wahl geht es auch: Karte drehen und selbst einschätzen. Was «Nochmals» erhält, kehrt im '
            + 'Stapel zurück. Zur Auswahl stehen nur Werte, die auf irgendeiner Karte richtig sind.' }),
          h('p', { text: 'Am Fuss der Karte führen drei Verweise weiter, vorn wie hinten: das Element im Überblick, im Handbuch und auf '
            + 'der offiziellen Seite (bei Grundbegriffen nur diese).' })
        ];
      });
    }

    behaelter.appendChild(h('div', { class: 'lk-leiste' }, [
      richtungsKnopf(),
      h('button', {
        type: 'button', class: 'btn btn--klein', text: 'Zurücksetzen',
        'aria-label': 'Lernfortschritt zurücksetzen',
        on: { click: zuruecksetzen }
      })
    ]));

    behaelter.appendChild(chipsAufbauen());

    refs.fortschritt = h('div', {});
    refs.spiel = h('div', {});
    behaelter.appendChild(refs.fortschritt);
    behaelter.appendChild(refs.spiel);

    if (!HT.store.verfuegbar) {
      behaelter.appendChild(h('p', {
        class: 'trefferzahl',
        text: 'Hinweis: Dieser Browser erlaubt keine lokale Speicherung — der Fortschritt gilt nur für diese Sitzung.'
      }));
    }

    neuZeichnen(false);
  }

  HT.trainerTeile.lernkarten = {
    id: 'lernkarten',
    label: 'Lernkarten',
    pfade: ['M8 3h10a2 2 0 0 1 2 2v9', 'M5 7h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z'],
    render: render
  };
}(window));
