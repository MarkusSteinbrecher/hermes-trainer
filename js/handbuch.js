/* meinHERMES — Ansicht «Handbuch».
   Das Referenzhandbuch Projektmanagement (PDF, Ausgabe 2022) 1:1 als Text
   in seiner Gliederung: Vorwort · A Methodenüberblick · B Methodenelemente ·
   1 Phasen · 2 Szenarien · 3 Module · 4 Ergebnisse · 5 Aufgaben · 6 Rollen ·
   7 Hinweise zur Anwendung · Vokabular. Die Daten kommen aus
   data/handbuch/rhb/ (tools/rhb-import.py); jeder Abschnitt trägt Nummer und
   Seite des PDF, Seitenzahlen sind Links auf die Seite im PDF. Abschnitte, die
   ein Element beschreiben (4.4.1.1 Abnahmeprotokoll), stehen als Karte mit
   Faktenzeile, Link auf HERMES online und ins PDF (siehe js/karte.js).
   Die Kapitel stehen in einer zweiten Leiste unter der Kopfzeile
   (HT.app.unterleiste), rechts darin ein Info-Icon zu Zweck und Quelle der
   Seite. Gesucht wird in der Kopfzeile; die Seite hat kein Suchfeld. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;

  /* Kapitel in Handbuchreihenfolge — dieselbe Liste wie im Import; index.json
     liefert Seiten und Inhaltsverzeichnis. */
  var KAPITEL = [
    { id: 'vorwort', nummer: '', titel: 'Vorwort', kategorie: null },
    { id: 'methodenueberblick', nummer: 'A', titel: 'Methodenüberblick', kategorie: null },
    { id: 'methodenelemente', nummer: 'B', titel: 'Methodenelemente', kategorie: null },
    { id: 'phasen', nummer: '1', titel: 'Phasen', kategorie: 'phase' },
    { id: 'szenarien', nummer: '2', titel: 'Szenarien', kategorie: 'szenario' },
    { id: 'module', nummer: '3', titel: 'Module', kategorie: 'modul' },
    { id: 'ergebnisse', nummer: '4', titel: 'Ergebnisse', kategorie: 'ergebnis' },
    { id: 'aufgaben', nummer: '5', titel: 'Aufgaben', kategorie: 'aufgabe' },
    { id: 'rollen', nummer: '6', titel: 'Rollen', kategorie: 'rolle' },
    { id: 'hinweise', nummer: '7', titel: 'Hinweise zur Anwendung', kategorie: null },
    { id: 'vokabular', nummer: '', titel: 'Vokabular', kategorie: null }
  ];

  var zustand = {
    kapitel: 'methodenueberblick',  // zuletzt gelesenes Kapitel
    initialisiert: false
  };

  function kapitelMeta(id) {
    for (var i = 0; i < KAPITEL.length; i++) { if (KAPITEL[i].id === id) { return KAPITEL[i]; } }
    return null;
  }

  function kapitelDerKategorie(kat) {
    for (var i = 0; i < KAPITEL.length; i++) { if (KAPITEL[i].kategorie === kat) { return KAPITEL[i]; } }
    return null;
  }

  function kapitelAdresse(id, teil) {
    return '#/handbuch?kapitel=' + encodeURIComponent(id) + (teil ? '&teil=' + encodeURIComponent(teil) : '');
  }

  /* Ort für Markierungen (js/markieren.js). Kapitel B hiess früher Teil B des
     Methodenüberblicks — der alte Ort bleibt, damit Markierungen dort bleiben. */
  function markOrt(meta, teil) {
    if (meta.id === 'methodenelemente') { return kapitelAdresse('methodenueberblick', 'B'); }
    return kapitelAdresse(meta.id, teil || meta.nummer || meta.id);
  }

  function cssId(id) {
    if (global.CSS && typeof global.CSS.escape === 'function') { return global.CSS.escape(id); }
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function ankerId(a, index) {
    return a.nummer ? 'hb-' + a.nummer : 'hb-t' + index;
  }

  /* --- Persistenz ---------------------------------------------------------- */

  function speichern() {
    HT.store.schreib('handbuch', { kapitel: zustand.kapitel });
  }

  function wiederherstellen() {
    var g = HT.store.lies('handbuch', null);
    if (g && typeof g === 'object') {
      if (kapitelMeta(g.kapitel)) { zustand.kapitel = g.kapitel; }
    }
  }

  /* --- PDF-Verweise -------------------------------------------------------- */

  var quelle = null;   // aus index.json: { pdf, online, ausgabe, ... }

  function pdfSeite(seite) {
    return quelle && quelle.pdf && seite ? quelle.pdf + '#page=' + seite : null;
  }

  /* «S. 50» — als Link auf die Seite im PDF, wenn das PDF bekannt ist. */
  function seiteElement(seite) {
    if (!seite) { return null; }
    var url = pdfSeite(seite);
    if (!url) { return h('span', { class: 'hb-seite', text: ' S. ' + seite }); }
    return h('a', {
      class: 'hb-seite', href: url, target: '_blank', rel: 'noopener',
      title: 'Seite ' + seite + ' im Referenzhandbuch (PDF, neuer Tab)'
    }, ' S. ' + seite);
  }

  /* --- Kapitelleiste unter der Kopfzeile ------------------------------------ */

  var IKONE_INFO = ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 11v5.5', 'M12 7.6h.01'];
  var info = null;            // Knopf und Karte der Leiste, die gerade steht
  var infoGebunden = false;

  function infoOffen() {
    return !!info && !info.karte.hidden && document.body.contains(info.karte);
  }

  /* Was die Seite ist und woher der Text kommt. Die Quelle steht in
     index.json; ist sie noch nicht geladen, fehlen Ausgabe und PDF-Link. */
  function infoInhalt() {
    var q = quelle || {};
    var links = [];
    if (q.pdf) {
      links.push(h('a', { class: 'hb-online', href: q.pdf, target: '_blank', rel: 'noopener', text: 'Referenzhandbuch (PDF) ↗' }));
    }
    links.push(h('a', { class: 'hb-online', href: q.online || 'https://www.hermes.admin.ch/de/projektmanagement.html', target: '_blank', rel: 'noopener', text: 'HERMES online ↗' }));
    return h('div', { class: 'gpop__inhalt' }, [
      h('p', { text: 'Das Referenzhandbuch Projektmanagement von HERMES als Text — Kapitel für Kapitel in seiner Gliederung, mit den Nummern und Seitenzahlen des PDF. Phasen, Szenarien, Module, Ergebnisse, Aufgaben und Rollen stehen als Karten an ihrer Stelle.' }),
      h('p', { text: 'Quelle ist das offizielle PDF von hermes.admin.ch' + (q.ausgabe ? ' (' + q.ausgabe + ')' : '')
        + '. Der Text ist daraus maschinell gelesen und 1:1 übernommen, ohne Verzeichnisse und Index; jede Seitenzahl öffnet die Seite im PDF. Massgebend ist die offizielle Fassung.' }),
      h('p', { class: 'hb-verweis' }, links)
    ]);
  }

  /* Info-Icon mit seiner Karte darunter; Klick daneben und Esc schliessen sie. */
  function infoBauen() {
    var knopf = h('button', {
      type: 'button', class: 'unterleiste__info', title: 'Über diese Seite',
      'aria-label': 'Über diese Seite', 'aria-haspopup': 'dialog', 'aria-expanded': 'false'
    }, HT.ui.symbol(IKONE_INFO, 18));
    var karte = h('div', { class: 'gpop gpop--kopf', role: 'dialog', 'aria-label': 'Über diese Seite', hidden: true });

    function fuellen() {
      HT.ui.leeren(karte);
      karte.appendChild(h('div', { class: 'gpop__kopf' }, [
        h('strong', { class: 'gpop__titel', text: 'Über diese Seite' }),
        h('button', { type: 'button', class: 'graph-schliessen', 'aria-label': 'Schliessen', text: '✕', on: { click: function () { schliessen(true); } } })
      ]));
      karte.appendChild(infoInhalt());
    }
    function schliessen(zurueck) {
      if (karte.hidden) { return; }
      karte.hidden = true;
      knopf.setAttribute('aria-expanded', 'false');
      if (zurueck) { knopf.focus(); }
    }
    knopf.addEventListener('click', function () {
      if (!karte.hidden) { schliessen(false); return; }
      fuellen();
      karte.hidden = false;
      knopf.setAttribute('aria-expanded', 'true');
      if (!quelle) {
        HT.daten.rhbIndex().then(function (idx) {
          if (idx && idx.quelle) { quelle = idx.quelle; }
          if (!karte.hidden) { fuellen(); }
        });
      }
    });

    info = { knopf: knopf, karte: karte, schliessen: schliessen };
    if (!infoGebunden) {
      infoGebunden = true;
      document.addEventListener('pointerdown', function (ev) {
        if (infoOffen() && !info.karte.contains(ev.target) && !info.knopf.contains(ev.target)) { info.schliessen(false); }
      });
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && infoOffen()) { info.schliessen(true); }
      });
    }
    return h('div', { class: 'unterleiste__hilfe' }, [knopf, karte]);
  }

  /* Die Kapitel als Links, das gelesene mit aria-current; rechts das Info-Icon. */
  function leisteBauen(aktiv) {
    var liste = h('ul', { class: 'unterleiste__liste' }, KAPITEL.map(function (k) {
      return h('li', {}, h('a', {
        class: 'unterleiste__link', href: kapitelAdresse(k.id),
        'aria-current': k === aktiv ? 'page' : null
      }, [
        k.nummer ? h('span', { class: 'unterleiste__nr', text: k.nummer }) : null,
        h('span', { text: k.titel })
      ]));
    }));
    return h('div', { class: 'unterleiste__inner' }, [
      h('nav', { class: 'unterleiste__nav', 'aria-label': 'Kapitel des Handbuchs' }, liste),
      infoBauen()
    ]);
  }

  /* Rollt die Leiste (schmale Schirme), steht das gelesene Kapitel in der Mitte. */
  function aktivesKapitelZeigen(leiste) {
    var liste = leiste.querySelector('.unterleiste__liste');
    var link = leiste.querySelector('[aria-current="page"]');
    if (!liste || !link || liste.scrollWidth <= liste.clientWidth) { return; }
    liste.scrollLeft = link.offsetLeft - (liste.clientWidth - link.offsetWidth) / 2;
  }

  /* --- Karten -------------------------------------------------------------- */

  function graphLink(e) {
    return h('a', {
      class: 'btn btn--klein btn--graph',
      href: '#/ueberblick?sicht=graph&id=' + encodeURIComponent(e.id),
      title: e.kategorie === 'phase' || e.kategorie === 'modul' || e.kategorie === 'szenario'
        ? 'Aufgaben, Ergebnisse und Rollen dazu im Graph zeigen'
        : 'Zusammenhänge dieses Elements im Graph anzeigen'
    }, [h('span', { 'aria-hidden': 'true', text: '◎ ' }), 'Im Graph']);
  }

  /* Karte eines Elements mit dem Text seines Abschnitts im PDF. */
  function karte(e, a) {
    return HT.karte.bauen(e, {
      nurHandbuch: true,
      bloecke: a.bloecke || [],
      zusatz: graphLink(e),
      titelEbene: a.ebene <= 3 ? 'h3' : 'h4',
      nummer: a.nummer || null,
      seite: a.seite || null,
      pdf: quelle && quelle.pdf ? { url: quelle.pdf, seite: a.seite } : null
    });
  }

  /* --- Kapiteltext in Handbuchgliederung ------------------------------------ */

  function titelKinder(a) {
    return [
      a.nummer ? h('span', { class: 'hb-nr', text: a.nummer + ' ' }) : null,
      a.titel,
      seiteElement(a.seite)
    ];
  }

  function verweisZeile(a, mitKapitel) {
    var teile = [];
    if (mitKapitel) {
      teile.push(h('span', { text: 'Referenzhandbuch' + (a.nummer ? ' Kap. ' + a.nummer : '') + (a.seite ? ', S. ' + a.seite : '') }));
    }
    if (a.url) {
      teile.push(h('a', {
        href: a.url, target: '_blank', rel: 'noopener', class: 'hb-online',
        'aria-label': 'Diesen Abschnitt auf HERMES online öffnen (neuer Tab)'
      }, 'HERMES online ↗'));
    }
    var pdf = pdfSeite(a.seite);
    if (pdf) {
      teile.push(h('a', {
        href: pdf, target: '_blank', rel: 'noopener', class: 'hb-online hb-pdf',
        'aria-label': 'Seite ' + a.seite + ' im Referenzhandbuch als PDF öffnen (neuer Tab)'
      }, 'PDF ↗'));
    }
    if (!teile.length) { return null; }
    return h('p', { class: 'hb-verweis' }, teile);
  }

  /* Ein Abschnitt: Titel seiner Ebene und seine Blöcke — oder die Karte, wenn
     er ein Element beschreibt. */
  function abschnittElement(a, index, meta) {
    var e = a.element ? HT.daten.eintragMitId(a.element) : null;
    if (e) {
      return h('div', { class: 'eintraege hb-karten hb-karten--einzeln', id: ankerId(a, index) }, karte(e, a));
    }
    var ebene = Math.min(6, Math.max(2, a.ebene || 2));
    var kinder = [];
    if (a.ebene === 1) {
      /* Kapiteltitel steht im Kapitelkopf; weitere Ebene-1-Titel (Impressum,
         Prolog) als Teiltitel. */
      if (index > 0 || !meta.nummer && a.titel !== meta.titel) {
        kinder.push(h('h2', { class: 'hb-teil__titel', id: ankerId(a, index) }, titelKinder(a)));
      }
    } else {
      kinder.push(h('h' + ebene, { class: 'hb-titel hb-titel--' + ebene, id: ankerId(a, index) }, titelKinder(a)));
      if (a.url) {
        var verweis = verweisZeile(a, false);
        if (verweis) { kinder.push(verweis); }
      }
    }
    if (a.bloecke && a.bloecke.length) {
      kinder.push(HT.ui.bloecke(a.bloecke, { verlinken: true, ebene: ebene + 1, seite: a.seite, pdf: quelle && quelle.pdf }));
    }
    return h('section', { class: 'hb-abschnitt' + (a.ebene === 1 && index > 0 ? ' hb-abschnitt--teil' : '') }, kinder);
  }

  /* Der Kapiteltext als ein Ort für Markierungen; Abschnitte mit eigener
     Online-Seite (7.4.1 Governance …) sind eigene Orte — wie bisher. */
  function kapitelKoerper(kap, meta) {
    var wurzel = h('section', { class: 'hb-teil', id: 'teil-' + (meta.nummer || meta.id), dataset: { markOrt: markOrt(meta) } });
    var ziel = wurzel;
    var abschnitte = kap.abschnitte || [];
    var offenEbene = 0;
    abschnitte.forEach(function (a, i) {
      if (ziel !== wurzel && (a.ebene || 2) <= offenEbene) { ziel = wurzel; offenEbene = 0; }
      var el = abschnittElement(a, i, meta);
      if (a.url && a.nummer && (a.ebene || 2) >= 2 && !a.element && meta.id === 'hinweise') {
        var teil = h('section', { class: 'hb-teil hb-teil--innen', id: 'teil-' + a.nummer, dataset: { markOrt: markOrt(meta, a.nummer) } }, el);
        wurzel.appendChild(teil);
        ziel = teil;
        offenEbene = a.ebene || 2;
        return;
      }
      ziel.appendChild(el);
    });
    return wurzel;
  }

  /* Inhaltsverzeichnis des Kapitels: Ebene 2 und 3 (auch Sammelkarten wie
     4.4.2 Checklisten), bei
     mehreren Ebene-1-Teilen (Vorwort, Impressum, Prolog) auch diese — als
     Knöpfe, weil «#…»-Links die Route wechseln würden. */
  function inhaltsverzeichnis(kap, indexEintrag) {
    var eintraege = [];
    var ebene1 = (kap.abschnitte || []).filter(function (a) { return a.ebene === 1; }).length;
    (kap.abschnitte || []).forEach(function (a, i) {
      if (a.ebene === 1 && ebene1 > 1 && i > 0) { eintraege.push({ ziel: ankerId(a, i), nummer: a.nummer, titel: a.titel, ebene: 1 }); }
      if (a.ebene === 2 || a.ebene === 3) { eintraege.push({ ziel: ankerId(a, i), nummer: a.nummer, titel: a.titel, ebene: a.ebene }); }
    });
    if (!eintraege.length) { return null; }
    return h('nav', { class: 'hb-inhalt', 'aria-label': 'Inhalt des Kapitels' }, [
      h('span', { class: 'detail__label', text: 'Inhalt' }),
      h('ul', { class: 'hb-inhalt__liste' }, eintraege.map(function (x) {
        return h('li', { class: 'hb-inhalt__eintrag hb-inhalt__eintrag--' + x.ebene }, h('button', {
          type: 'button', class: 'hb-inhalt__knopf',
          on: { click: function () {
            var ziel = document.getElementById(x.ziel);
            if (ziel) { try { ziel.scrollIntoView({ block: 'start' }); } catch (e) { ziel.scrollIntoView(); } }
          } }
        }, [x.nummer ? h('span', { class: 'hb-nr', text: x.nummer + ' ' }) : null, x.titel]));
      }))
    ]);
  }

  /* --- Kapitelseite ------------------------------------------------------- */

  function renderKapitel(behaelter, meta, params, zielId) {
    var index = KAPITEL.indexOf(meta);
    var vorher = index > 0 ? KAPITEL[index - 1] : null;
    var nachher = index < KAPITEL.length - 1 ? KAPITEL[index + 1] : null;

    /* Kein Seitenkopf: die Kapitel stehen in der Leiste unter der Kopfzeile,
       was die Seite ist, sagt ihr Info-Icon. */
    behaelter.appendChild(h('h1', { class: 'nur-sr', text: 'Handbuch' }));
    var leiste = leisteBauen(meta);
    HT.app.unterleiste(leiste);
    aktivesKapitelZeigen(leiste);
    var warnung = HT.app.datenWarnung();
    if (warnung) { behaelter.appendChild(warnung); }

    /* Kapitelkopf und Text liegen auf einem weissen Blatt, zentriert und
       etwas breiter als die breiteste Abbildung (siehe .hb-blatt). */
    var blatt = h('div', { class: 'hb-blatt' });
    behaelter.appendChild(blatt);

    var kopf = h('div', { class: 'hb-kapitelkopf' }, [
      h('span', { class: 'detail__label', text: meta.nummer ? 'Kapitel ' + meta.nummer : 'Referenzhandbuch' }),
      h('h2', { class: 'hb-kapitelkopf__titel', text: meta.titel })
    ]);
    blatt.appendChild(kopf);

    var inhalt = h('div', { class: 'kapitel' });
    blatt.appendChild(inhalt);
    inhalt.appendChild(h('p', { class: 'trefferzahl', role: 'status', text: 'Kapitel wird geladen …' }));

    Promise.all([HT.daten.rhbIndex(), HT.daten.rhbKapitel(meta.id)]).then(function (res) {
      if (!document.body.contains(inhalt)) { return; }   // inzwischen weitergeblättert
      var idx = res[0], kap = res[1];
      quelle = idx && idx.quelle ? idx.quelle : quelle;
      HT.ui.leeren(inhalt);

      if (!kap) {
        inhalt.appendChild(HT.ui.leerZustand('Handbuchtext nicht verfügbar', 'Die Datei data/handbuch/rhb/' + meta.id + '.json konnte nicht geladen werden.'));
        return;
      }

      var kopfInfo = { nummer: meta.nummer || null, seite: kap.seite, url: kap.url };
      var verweis = verweisZeile(kopfInfo, true);
      if (verweis) { kopf.appendChild(verweis); }

      var toc = inhaltsverzeichnis(kap, idx);
      if (toc) { inhalt.appendChild(toc); }
      inhalt.appendChild(kapitelKoerper(kap, meta));

      /* Blättern */
      function blaetterText(k, pfeil) {
        var t = (k.nummer ? 'Kapitel ' + k.nummer + ' ' : '') + k.titel;
        return pfeil === 'links' ? '← ' + t : t + ' →';
      }
      inhalt.appendChild(h('div', { class: 'btn-reihe kapitel-nav' }, [
        vorher ? h('a', { class: 'btn', href: kapitelAdresse(vorher.id), text: blaetterText(vorher, 'links') }) : null,
        nachher ? h('a', { class: 'btn', href: kapitelAdresse(nachher.id), text: blaetterText(nachher, 'rechts') }) : null
      ]));

      /* Erst nach dem Einfügen scrollen — sonst verschiebt der nachgeladene
         Inhalt die Position wieder. */
      var gewuenscht = params && params.teil ? String(params.teil) : null;
      global.setTimeout(function () {
        var ziel = null;
        if (zielId) {
          ziel = inhalt.querySelector('#eintrag-' + cssId(zielId));
          if (ziel) { ziel.classList.add('ist-hervorgehoben'); }
        } else if (gewuenscht) {
          ziel = inhalt.querySelector('#hb-' + cssId(gewuenscht)) || inhalt.querySelector('#teil-' + cssId(gewuenscht));
        }
        if (ziel) {
          try { ziel.scrollIntoView({ block: 'start' }); } catch (e) { ziel.scrollIntoView(); }
        } else {
          try { global.scrollTo(0, 0); } catch (e2) { /* egal */ }
        }
      }, 0);
    });
  }

  /* --- Render ------------------------------------------------------------- */

  /* Adressen: ?kapitel=<id>[&teil=<nr>] · ?id=<element> (Karte im Kapitel
     seiner Kategorie) · ?kat=<kategorie> · ohne Parameter das zuletzt
     gelesene Kapitel. Alte Adressen (#/methode, #/lexikon) leiten hierher. */
  function render(behaelter, params) {
    if (!zustand.initialisiert) { wiederherstellen(); zustand.initialisiert = true; }
    params = params || {};
    var meta = null, zielId = null;
    if (params.kapitel) { meta = kapitelMeta(params.kapitel); }
    if (meta && meta.id === 'methodenueberblick' && params.teil && /^B(\.|$)/.test(String(params.teil))) {
      meta = kapitelMeta('methodenelemente');   // alter Teil B des Methodenüberblicks
    }
    if (!meta && params.id) {
      var e = HT.daten.eintragMitId(params.id);
      if (e) {
        meta = kapitelDerKategorie(e.kategorie);
        zielId = e.id;
      }
    }
    if (!meta && params.kat) { meta = kapitelDerKategorie(params.kat); }
    if (!meta) { meta = kapitelMeta(zustand.kapitel) || KAPITEL[1]; }
    zustand.kapitel = meta.id;
    speichern();
    renderKapitel(behaelter, meta, params, zielId);
  }

  HT.views.handbuch = { titel: 'Handbuch', render: render };
}(window));
