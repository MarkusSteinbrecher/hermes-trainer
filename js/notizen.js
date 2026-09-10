/* HERMES-Trainer — Persönliche Notizen: Markierungen, Kommentare, freie Notizen.

   Alles bleibt im Browser (localStorage, Schlüssel «notizen») und lässt sich
   als Datei sichern und wieder einlesen — die Site hat keinen Server.

   Verankerung nach dem Muster der Web-Annotation (TextQuoteSelector): eine
   Markierung merkt sich nicht Zeichenpositionen, sondern das Zitat samt ein
   paar Zeichen davor und danach, dazu den Ort — den nächsten Block mit
   `data-nz-ort` (Lexikonkarte, Kapitelteil, Inhaltsseite des Überblicks).
   Beim Rendern sucht das Modul das Zitat im Block wieder; was nicht mehr
   gefunden wird, bleibt als «verwaist» in der Notizenliste stehen.

   Ein Block kennzeichnet sich mit data-nz-ort (Adresse, zugleich Schlüssel)
   und data-nz-titel (Anzeigename). Ein MutationObserver auf #view legt die
   Markierungen nach jedem Aufbau und Nachladen neu — die Ansichten müssen
   nichts aufrufen, nur die Attribute setzen und bei Bedarf HT.notizen.panel()
   für die freien Notizen einhängen. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;
  var SPEICHER = 'notizen';
  var VERSION = 1;
  var KONTEXT = 32;                       // Zeichen vor und nach dem Zitat
  var FARBEN = ['gelb', 'gruen', 'blau', 'rosa'];
  var FARBNAMEN = { gelb: 'Gelb', gruen: 'Grün', blau: 'Blau', rosa: 'Rosa' };
  var LERNSTAND = ['lernkarten', 'quiz-statistik', 'quiz-konfig', 'trainer'];

  var daten = null;                       // { version, eintraege: [] }
  var blase = null;                       // Auswahlblase
  var editor = null;                      // offener Editor { el, eintrag }
  var stumm = 0;                          // > 0: eigene DOM-Änderungen laufen
  var beobachter = null;
  var sprungErledigt = '';                // Hash, für den bereits gescrollt wurde

  /* --- Daten --------------------------------------------------------------- */

  function laden() {
    if (daten) { return daten; }
    var g = HT.store.lies(SPEICHER, null);
    daten = (g && typeof g === 'object' && Array.isArray(g.eintraege)) ? g : { version: VERSION, eintraege: [] };
    daten.eintraege = daten.eintraege.filter(function (e) { return e && typeof e === 'object' && e.id && e.ort; });
    return daten;
  }

  function speichern() {
    laden();
    HT.store.schreib(SPEICHER, daten);
    var ev;
    try { ev = new global.CustomEvent('nz:geaendert'); } catch (x) { ev = document.createEvent('Event'); ev.initEvent('nz:geaendert', false, false); }
    document.dispatchEvent(ev);
  }

  function neueId() {
    return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function jetzt() { return new Date().toISOString(); }

  function alle() { return laden().eintraege; }

  function mitId(id) {
    var raus = null;
    alle().forEach(function (e) { if (e.id === id) { raus = e; } });
    return raus;
  }

  function fuerOrt(ort) {
    return alle().filter(function (e) { return e.ort === ort; });
  }

  function anlegen(felder) {
    var e = {
      id: neueId(), art: felder.art || 'notiz', ort: felder.ort, titel: felder.titel || '',
      farbe: felder.farbe || 'gelb', zitat: felder.zitat || null, kommentar: felder.kommentar || '',
      erstellt: jetzt(), geaendert: jetzt()
    };
    alle().push(e);
    speichern();
    return e;
  }

  function aendern(e, felder) {
    for (var k in felder) { if (Object.prototype.hasOwnProperty.call(felder, k)) { e[k] = felder[k]; } }
    e.geaendert = jetzt();
    speichern();
  }

  function loeschen(e) {
    laden();
    daten.eintraege = daten.eintraege.filter(function (x) { return x.id !== e.id; });
    speichern();
  }

  /* --- Text eines Blocks --------------------------------------------------- */

  function blockVon(knoten) {
    var el = knoten && knoten.nodeType === 3 ? knoten.parentNode : knoten;
    return el && el.closest ? el.closest('[data-nz-ort]') : null;
  }

  /* Alle Textknoten in Dokumentreihenfolge — dieselbe Folge, die Range.toString()
     liefert, damit Auswahl und Modell dieselben Positionen meinen. Die eigene
     Oberfläche (Panels) bleibt aussen vor. */
  function textknoten(block) {
    var raus = [];
    var w = document.createTreeWalker(block, global.NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        while (p && p !== block) {
          if (p.classList && p.classList.contains('nz-ui')) { return global.NodeFilter.FILTER_REJECT; }
          p = p.parentNode;
        }
        return global.NodeFilter.FILTER_ACCEPT;
      }
    }, false);
    var n;
    while ((n = w.nextNode())) { raus.push(n); }
    return raus;
  }

  function modell(block) {
    var knoten = textknoten(block);
    var text = '', stellen = [];
    knoten.forEach(function (n) {
      stellen.push({ knoten: n, start: text.length, ende: text.length + n.data.length });
      text += n.data;
    });
    return { text: text, stellen: stellen };
  }

  /* Position eines Range-Endes im Modell des Blocks. */
  function position(m, container, offset) {
    if (container.nodeType === 3) {
      for (var i = 0; i < m.stellen.length; i++) {
        if (m.stellen[i].knoten === container) { return m.stellen[i].start + offset; }
      }
      return -1;
    }
    /* Elementknoten: der erste Textknoten ab dem Kind an der Stelle. */
    var kind = container.childNodes[offset] || null;
    if (!kind) {
      /* hinter dem letzten Kind: Ende des letzten enthaltenen Textknotens */
      var letzte = -1;
      m.stellen.forEach(function (s) { if (container.contains(s.knoten)) { letzte = s.ende; } });
      return letzte;
    }
    for (var j = 0; j < m.stellen.length; j++) {
      var s = m.stellen[j];
      if (kind === s.knoten || (kind.contains && kind.contains(s.knoten))) { return s.start; }
      if (kind.compareDocumentPosition(s.knoten) & global.Node.DOCUMENT_POSITION_FOLLOWING) { return s.start; }
    }
    return m.text.length;
  }

  function zitatVon(m, start, ende) {
    return {
      exact: m.text.slice(start, ende),
      prefix: m.text.slice(Math.max(0, start - KONTEXT), start),
      suffix: m.text.slice(ende, ende + KONTEXT)
    };
  }

  /* Zitat wiederfinden: erst mit Kontext, dann das Zitat allein — bei mehreren
     Treffern der mit der grössten Übereinstimmung von Vor- und Nachtext. */
  function finden(m, z) {
    if (!z || !z.exact) { return -1; }
    var t = m.text;
    var voll = (z.prefix || '') + z.exact + (z.suffix || '');
    var i = t.indexOf(voll);
    if (i !== -1) { return i + (z.prefix || '').length; }
    var treffer = [];
    var von = 0;
    while ((i = t.indexOf(z.exact, von)) !== -1) { treffer.push(i); von = i + 1; }
    if (!treffer.length) { return -1; }
    if (treffer.length === 1) { return treffer[0]; }
    var beste = treffer[0], bestePunkte = -1;
    treffer.forEach(function (p) {
      var punkte = gemeinsam(t.slice(Math.max(0, p - KONTEXT), p), z.prefix || '', true)
        + gemeinsam(t.slice(p + z.exact.length, p + z.exact.length + KONTEXT), z.suffix || '', false);
      if (punkte > bestePunkte) { bestePunkte = punkte; beste = p; }
    });
    return beste;
  }

  function gemeinsam(a, b, vonHinten) {
    var n = 0;
    while (n < a.length && n < b.length) {
      var ca = vonHinten ? a[a.length - 1 - n] : a[n];
      var cb = vonHinten ? b[b.length - 1 - n] : b[n];
      if (ca !== cb) { break; }
      n++;
    }
    return n;
  }

  /* --- Markierungen legen und entfernen ------------------------------------- */

  function markKlasse(e) {
    return 'nz-mark nz-mark--' + (FARBEN.indexOf(e.farbe) !== -1 ? e.farbe : 'gelb') + (e.kommentar ? ' nz-mark--kommentar' : '');
  }

  function markTitel(e) {
    return e.kommentar ? e.kommentar : 'Markierung — Klick zum Bearbeiten';
  }

  function umhuellen(m, start, ende, e) {
    var marks = [];
    m.stellen.forEach(function (s) {
      if (s.ende <= start || s.start >= ende) { return; }
      var n = s.knoten;
      var a = Math.max(start, s.start) - s.start;
      var b = Math.min(ende, s.ende) - s.start;
      if (b < n.data.length) { n.splitText(b); }
      if (a > 0) { n = n.splitText(a); }
      var mark = document.createElement('mark');
      mark.className = markKlasse(e);
      mark.setAttribute('data-nz-id', e.id);
      mark.setAttribute('title', markTitel(e));
      mark.setAttribute('tabindex', '0');
      mark.setAttribute('role', 'button');
      n.parentNode.insertBefore(mark, n);
      mark.appendChild(n);
      marks.push(mark);
    });
    return marks;
  }

  function entfernen(block) {
    var marks = block.querySelectorAll('mark.nz-mark');
    for (var i = 0; i < marks.length; i++) {
      var mk = marks[i];
      var p = mk.parentNode;
      if (!p) { continue; }
      while (mk.firstChild) { p.insertBefore(mk.firstChild, mk); }
      p.removeChild(mk);
    }
    block.normalize();
  }

  function blockAnwenden(block) {
    var ort = block.getAttribute('data-nz-ort');
    entfernen(block);
    var liste = fuerOrt(ort).filter(function (e) { return e.art === 'markierung' && e.zitat; });
    if (!liste.length) { return; }
    var geaendert = false;
    /* «Verwaist» darf nur ein vollständig geladener Block feststellen
       (data-nz-komplett) — eine Lexikonkarte in der Stufe «Kurz» oder ein
       Kapitel vor dem Nachladen enthält den Text schlicht noch nicht. */
    var komplett = block.hasAttribute('data-nz-komplett');
    liste.forEach(function (e) {
      var m = modell(block);
      var start = finden(m, e.zitat);
      var verwaist = start === -1;
      if (!verwaist && e.verwaist) { e.verwaist = false; geaendert = true; }
      if (verwaist && komplett && !e.verwaist) { e.verwaist = true; geaendert = true; }
      if (verwaist) { return; }
      umhuellen(m, start, start + e.zitat.exact.length, e);
    });
    if (geaendert) { HT.store.schreib(SPEICHER, daten); }
  }

  function anwenden(wurzel) {
    wurzel = wurzel || document.getElementById('view');
    if (!wurzel) { return; }
    stumm++;
    try {
      var bloecke = [];
      if (wurzel.hasAttribute && wurzel.hasAttribute('data-nz-ort')) { bloecke.push(wurzel); }
      var innen = wurzel.querySelectorAll('[data-nz-ort]');
      for (var i = 0; i < innen.length; i++) { bloecke.push(innen[i]); }
      bloecke.forEach(blockAnwenden);
      panelsAuffrischen(wurzel);
      sprung();
    } finally {
      if (beobachter) { beobachter.takeRecords(); }
      stumm--;
    }
  }

  /* Deep-Link «…&nz=<id>»: zur Markierung scrollen und kurz aufleuchten. */
  function sprung() {
    var hash = global.location.hash || '';
    var m = /[?&]nz=([^&]+)/.exec(hash);
    if (!m || sprungErledigt === hash) { return; }
    var id = decodeURIComponent(m[1]);
    var mark = document.querySelector('mark.nz-mark[data-nz-id="' + id + '"]');
    var ziel = mark || document.querySelector('[data-nz-notiz="' + id + '"]');
    if (!ziel) { return; }
    sprungErledigt = hash;
    global.setTimeout(function () {
      try { ziel.scrollIntoView({ block: 'center' }); } catch (x) { ziel.scrollIntoView(); }
      ziel.classList.add('ist-blitz');
      global.setTimeout(function () { ziel.classList.remove('ist-blitz'); }, 1800);
    }, 40);
  }

  /* --- Auswahlblase ---------------------------------------------------------- */

  function auswahlLesen() {
    var sel = global.getSelection ? global.getSelection() : null;
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { return null; }
    var r = sel.getRangeAt(0);
    if (!String(r.toString()).trim()) { return null; }
    var block = blockVon(r.commonAncestorContainer);
    if (!block) { return null; }
    if (blockVon(r.startContainer) !== block || blockVon(r.endContainer) !== block) { return null; }
    /* Nicht in Eingabefeldern oder in unserer eigenen Oberfläche. */
    var el = r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer;
    if (el.closest && el.closest('textarea, input, .nz-ui')) { return null; }
    return { range: r, block: block };
  }

  function blaseBauen() {
    var knoepfe = FARBEN.map(function (f) {
      var b = h('button', { type: 'button', class: 'nz-farbe nz-farbe--' + f, title: 'Markieren: ' + FARBNAMEN[f], 'aria-label': 'Markieren: ' + FARBNAMEN[f] });
      b.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
      b.addEventListener('click', function () { auswahlMarkieren(f, false); });
      return b;
    });
    var komm = h('button', { type: 'button', class: 'nz-blase__kommentar', text: 'Kommentar' });
    komm.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    komm.addEventListener('click', function () { auswahlMarkieren('gelb', true); });
    var el = h('div', { class: 'nz-blase nz-ui', role: 'toolbar', 'aria-label': 'Auswahl markieren', hidden: true }, [
      h('div', { class: 'nz-blase__farben' }, knoepfe), komm
    ]);
    document.body.appendChild(el);
    return el;
  }

  function blaseZeigen() {
    var a = auswahlLesen();
    if (!blase) { blase = blaseBauen(); }
    if (!a) { blase.hidden = true; return; }
    var r = a.range.getBoundingClientRect();
    if (!r || (!r.width && !r.height)) { blase.hidden = true; return; }
    blase.hidden = false;
    var b = blase.getBoundingClientRect();
    var x = Math.max(8, Math.min(global.innerWidth - b.width - 8, r.left + r.width / 2 - b.width / 2));
    var y = r.top - b.height - 8;
    if (y < 8) { y = r.bottom + 8; }
    blase.style.left = Math.round(x) + 'px';
    blase.style.top = Math.round(y) + 'px';
  }

  function auswahlMarkieren(farbe, mitKommentar) {
    var a = auswahlLesen();
    if (!a) { return; }
    var m = modell(a.block);
    var start = position(m, a.range.startContainer, a.range.startOffset);
    var ende = position(m, a.range.endContainer, a.range.endOffset);
    if (start < 0 || ende < 0 || ende <= start) { return; }
    /* Randweiss abschneiden — eine Markierung fängt nicht mit einem Leerzeichen an. */
    while (start < ende && /\s/.test(m.text[start])) { start++; }
    while (ende > start && /\s/.test(m.text[ende - 1])) { ende--; }
    if (ende <= start) { return; }
    var e = anlegen({
      art: 'markierung', ort: a.block.getAttribute('data-nz-ort'), titel: a.block.getAttribute('data-nz-titel') || '',
      farbe: farbe, zitat: zitatVon(m, start, ende)
    });
    try { global.getSelection().removeAllRanges(); } catch (x) { /* egal */ }
    if (blase) { blase.hidden = true; }
    anwenden(a.block);
    if (mitKommentar) {
      var mark = a.block.querySelector('mark.nz-mark[data-nz-id="' + e.id + '"]');
      editorOeffnen(e, mark);
    }
  }

  /* --- Editor zu einer Markierung ------------------------------------------- */

  function editorSchliessen() {
    if (!editor) { return; }
    if (editor.el.parentNode) { editor.el.parentNode.removeChild(editor.el); }
    editor = null;
  }

  function editorOeffnen(e, anker) {
    editorSchliessen();
    var feld = h('textarea', { class: 'nz-editor__feld', rows: '3', placeholder: 'Kommentar zur Markierung …', 'aria-label': 'Kommentar' });
    feld.value = e.kommentar || '';
    var timer = null;
    function sichern() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (feld.value !== e.kommentar) { aendern(e, { kommentar: feld.value }); markeAuffrischen(e); }
    }
    feld.addEventListener('input', function () { if (timer) { clearTimeout(timer); } timer = setTimeout(sichern, 400); });
    feld.addEventListener('blur', sichern);

    var farben = h('div', { class: 'nz-editor__farben', role: 'group', 'aria-label': 'Farbe' }, FARBEN.map(function (f) {
      var b = h('button', { type: 'button', class: 'nz-farbe nz-farbe--' + f + (e.farbe === f ? ' ist-aktiv' : ''), title: FARBNAMEN[f], 'aria-label': FARBNAMEN[f], 'aria-pressed': e.farbe === f ? 'true' : 'false' });
      b.addEventListener('click', function () {
        aendern(e, { farbe: f });
        var alle = farben.querySelectorAll('.nz-farbe');
        for (var i = 0; i < alle.length; i++) { alle[i].classList.toggle('ist-aktiv', alle[i] === b); alle[i].setAttribute('aria-pressed', alle[i] === b ? 'true' : 'false'); }
        markeAuffrischen(e);
      });
      return b;
    }));
    var weg = h('button', { type: 'button', class: 'btn btn--klein', text: 'Löschen' });
    weg.addEventListener('click', function () {
      var block = anker ? blockVon(anker) : null;
      loeschen(e);
      editorSchliessen();
      if (block) { anwenden(block); } else { anwenden(); }
    });
    var fertig = h('button', { type: 'button', class: 'btn btn--klein btn--primaer', text: 'Fertig' });
    fertig.addEventListener('click', function () { sichern(); editorSchliessen(); });

    var el = h('div', { class: 'nz-editor nz-ui', role: 'dialog', 'aria-label': 'Markierung bearbeiten' }, [
      h('p', { class: 'nz-editor__zitat', text: e.zitat ? HT.ui.zitat(kuerz(e.zitat.exact, 140)) : '' }),
      feld,
      h('div', { class: 'nz-editor__fuss' }, [farben, h('div', { class: 'nz-editor__knoepfe' }, [weg, fertig])])
    ]);
    el.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { sichern(); editorSchliessen(); } });
    document.body.appendChild(el);
    editor = { el: el, eintrag: e };

    /* Position: unter dem Anker, im Fenster gehalten. */
    var r = anker ? anker.getBoundingClientRect() : { left: global.innerWidth / 2, right: global.innerWidth / 2, top: global.innerHeight / 2, bottom: global.innerHeight / 2 };
    var b = el.getBoundingClientRect();
    var x = Math.max(8, Math.min(global.innerWidth - b.width - 8, r.left));
    var y = r.bottom + 8;
    if (y + b.height > global.innerHeight - 8) { y = Math.max(8, r.top - b.height - 8); }
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    feld.focus();
  }

  function kuerz(t, n) { return t.length > n ? t.slice(0, n - 1) + '…' : t; }

  function markeAuffrischen(e) {
    var marks = document.querySelectorAll('mark.nz-mark[data-nz-id="' + e.id + '"]');
    for (var i = 0; i < marks.length; i++) { marks[i].className = markKlasse(e); marks[i].setAttribute('title', markTitel(e)); }
    panelsAuffrischen(document.getElementById('view'));
  }

  /* --- Panel «Meine Notizen» je Ort ----------------------------------------- */

  /* Ein aufklappbarer Block für die freien Notizen eines Orts, dazu die Liste
     der Markierungen dort. Die Ansicht hängt ihn ein, wo er hingehört. */
  function panel(ort, titel, optionen) {
    var inhalt = h('div', { class: 'nz-panel__inhalt' });
    var zaehler = h('span', { class: 'nz-panel__zahl' });
    var kompakt = optionen && optionen.kompakt;
    var el = h('details', { class: 'nz-panel nz-ui' + (kompakt ? ' nz-panel--kompakt' : ''), dataset: { nzPanel: ort, nzTitel: titel || '' } }, [
      h('summary', {}, [h('span', { class: 'nz-panel__titel', text: 'Meine Notizen' }), ' ', zaehler]),
      inhalt
    ]);
    el.nzInhalt = inhalt;
    el.nzZaehler = zaehler;
    panelFuellen(el);
    return el;
  }

  function zaehlerSetzen(el) {
    var n = fuerOrt(el.getAttribute('data-nz-panel')).length;
    var z = el.nzZaehler || el.querySelector('.nz-panel__zahl');
    if (z) { z.textContent = n ? String(n) : ''; }
    el.classList.toggle('hat-notizen', n > 0);
  }

  function panelFuellen(el) {
    var ort = el.getAttribute('data-nz-panel');
    var titel = el.getAttribute('data-nz-titel') || '';
    var inhalt = el.nzInhalt || el.querySelector('.nz-panel__inhalt');
    var zaehler = el.nzZaehler || el.querySelector('.nz-panel__zahl');
    if (!inhalt) { return; }
    var liste = fuerOrt(ort);
    var notizen = liste.filter(function (e) { return e.art === 'notiz'; });
    var marks = liste.filter(function (e) { return e.art === 'markierung'; });
    if (zaehler) { zaehler.textContent = liste.length ? String(liste.length) : ''; }
    el.classList.toggle('hat-notizen', liste.length > 0);

    HT.ui.leeren(inhalt);
    notizen.forEach(function (e) { inhalt.appendChild(notizFeld(e)); });

    var neu = h('button', { type: 'button', class: 'btn btn--klein', text: notizen.length ? 'Weitere Notiz' : 'Notiz schreiben' });
    neu.addEventListener('click', function () {
      var e = anlegen({ art: 'notiz', ort: ort, titel: titel, kommentar: '' });
      var feld = notizFeld(e);
      inhalt.insertBefore(feld, neu.parentNode);
      feld.querySelector('textarea').focus();
    });
    inhalt.appendChild(h('div', { class: 'nz-panel__knoepfe' }, [
      neu,
      h('a', { class: 'nz-panel__alle', href: '#/notizen', text: 'Alle Notizen →' })
    ]));

    if (marks.length) {
      inhalt.appendChild(h('h4', { class: 'nz-mikro', text: 'Markierungen hier' }));
      inhalt.appendChild(h('ul', { class: 'nz-markliste' }, marks.map(function (e) { return markZeile(e, true); })));
    }
  }

  function notizFeld(e) {
    var feld = h('textarea', { class: 'nz-notiz__feld', rows: '3', placeholder: 'Eigene Notiz, Merksatz, Frage …', 'aria-label': 'Notiz' });
    feld.value = e.kommentar || '';
    var timer = null;
    function sichern() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (feld.value !== e.kommentar) { aendern(e, { kommentar: feld.value }); }
    }
    feld.addEventListener('input', function () {
      if (timer) { clearTimeout(timer); }
      timer = setTimeout(sichern, 500);
      feld.style.height = 'auto';
      feld.style.height = Math.min(400, feld.scrollHeight + 2) + 'px';
    });
    feld.addEventListener('blur', sichern);
    var weg = h('button', { type: 'button', class: 'nz-notiz__weg', title: 'Notiz löschen', 'aria-label': 'Notiz löschen', text: '✕' });
    var huelle = h('div', { class: 'nz-notiz', dataset: { nzNotiz: e.id } }, [
      feld,
      h('div', { class: 'nz-notiz__zeile' }, [
        h('span', { class: 'nz-notiz__wann', text: datum(e.geaendert || e.erstellt) }),
        weg
      ])
    ]);
    weg.addEventListener('click', function () {
      loeschen(e);
      if (huelle.parentNode) { huelle.parentNode.removeChild(huelle); }
      panelsAuffrischen(document.getElementById('view'));
    });
    global.setTimeout(function () { feld.style.height = 'auto'; feld.style.height = Math.min(400, feld.scrollHeight + 2) + 'px'; }, 0);
    return huelle;
  }

  function markZeile(e, kurz) {
    var text = e.zitat ? e.zitat.exact : '';
    var link = h('a', { class: 'nz-markliste__zitat', href: sprungAdresse(e), text: HT.ui.zitat(kurz ? kuerz(text, 120) : text) });
    link.addEventListener('click', function (ev) {
      /* Auf derselben Seite direkt hinspringen statt neu zu laden. */
      var mark = document.querySelector('mark.nz-mark[data-nz-id="' + e.id + '"]');
      if (mark) {
        ev.preventDefault();
        try { mark.scrollIntoView({ block: 'center' }); } catch (x) { mark.scrollIntoView(); }
        mark.classList.add('ist-blitz');
        global.setTimeout(function () { mark.classList.remove('ist-blitz'); }, 1800);
      }
    });
    return h('li', { class: 'nz-markliste__zeile' + (e.verwaist ? ' ist-verwaist' : '') }, [
      h('span', { class: 'nz-punkt nz-punkt--' + e.farbe, 'aria-label': FARBNAMEN[e.farbe] || '' }),
      h('span', { class: 'nz-markliste__text' }, [
        link,
        e.kommentar ? h('span', { class: 'nz-markliste__kommentar', text: e.kommentar }) : null,
        e.verwaist ? h('span', { class: 'nz-markliste__verwaist', text: 'Textstelle nicht mehr gefunden' }) : null
      ])
    ]);
  }

  function sprungAdresse(e) {
    return e.ort + (e.ort.indexOf('?') === -1 ? '?' : '&') + 'nz=' + encodeURIComponent(e.id);
  }

  function panelsAuffrischen(wurzel) {
    if (!wurzel) { return; }
    var ps = wurzel.querySelectorAll('details.nz-panel');
    stumm++;
    try {
      for (var i = 0; i < ps.length; i++) {
        /* Ein Feld mit Fokus wird nicht unter dem Schreibenden weggezogen. */
        if (ps[i].contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') {
          zaehlerSetzen(ps[i]);
          continue;
        }
        panelFuellen(ps[i]);
      }
    } finally {
      if (beobachter) { beobachter.takeRecords(); }
      stumm--;
    }
  }

  function datum(iso) {
    if (!iso) { return ''; }
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return ''; }
    return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear();
  }

  /* --- Export und Import ------------------------------------------------------ */

  function exportObjekt() {
    var lernstand = {};
    LERNSTAND.forEach(function (k) {
      var w = HT.store.lies(k, null);
      if (w !== null && w !== undefined) { lernstand[k] = w; }
    });
    /* Eine Kopie — der Aufrufer darf am Export ändern, ohne den Bestand zu treffen. */
    return { app: 'hermes-trainer', version: VERSION, exportiert: jetzt(), notizen: JSON.parse(JSON.stringify(laden())), lernstand: lernstand };
  }

  function herunterladen(name, inhalt, typ) {
    var blob = new global.Blob([inhalt], { type: typ });
    var url = global.URL.createObjectURL(blob);
    var a = h('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    global.setTimeout(function () { document.body.removeChild(a); global.URL.revokeObjectURL(url); }, 500);
  }

  function dateiname(endung) {
    return 'hermes-trainer-notizen-' + jetzt().slice(0, 10) + '.' + endung;
  }

  function gruppen() {
    var nach = {};
    alle().forEach(function (e) {
      var g = nach[e.ort];
      if (!g) { g = nach[e.ort] = { ort: e.ort, titel: e.titel || e.ort, eintraege: [] }; }
      if (!g.titel && e.titel) { g.titel = e.titel; }
      g.eintraege.push(e);
    });
    var liste = Object.keys(nach).map(function (k) { return nach[k]; });
    liste.sort(function (a, b) { return a.titel.localeCompare(b.titel, 'de'); });
    liste.forEach(function (g) {
      g.eintraege.sort(function (a, b) { return (a.erstellt || '').localeCompare(b.erstellt || ''); });
    });
    return liste;
  }

  function markdown() {
    var zeilen = ['# Meine Notizen — HERMES-Trainer', '', 'Exportiert am ' + datum(jetzt()) + '.', ''];
    gruppen().forEach(function (g) {
      zeilen.push('## ' + g.titel);
      zeilen.push('');
      zeilen.push('Ort: ' + g.ort);
      zeilen.push('');
      g.eintraege.forEach(function (e) {
        if (e.art === 'markierung' && e.zitat) {
          zeilen.push('- [' + (FARBNAMEN[e.farbe] || e.farbe) + '] «' + e.zitat.exact.replace(/\s+/g, ' ') + '»' + (e.kommentar ? ' — ' + e.kommentar.replace(/\s+/g, ' ') : ''));
        } else if (e.kommentar) {
          zeilen.push('- Notiz: ' + e.kommentar.replace(/\r?\n/g, '\n  '));
        }
      });
      zeilen.push('');
    });
    return zeilen.join('\n');
  }

  function importieren(text, mitLernstand) {
    var obj;
    try { obj = JSON.parse(text); } catch (x) { return { fehler: 'Die Datei ist kein gültiges JSON.' }; }
    if (!obj || obj.app !== 'hermes-trainer' || !obj.notizen || !Array.isArray(obj.notizen.eintraege)) {
      return { fehler: 'Das ist keine Notizen-Datei des HERMES-Trainers.' };
    }
    laden();
    var vorhanden = {};
    daten.eintraege.forEach(function (e) { vorhanden[e.id] = e; });
    var neu = 0, aktualisiert = 0;
    obj.notizen.eintraege.forEach(function (e) {
      if (!e || !e.id || !e.ort) { return; }
      var alt = vorhanden[e.id];
      if (!alt) { daten.eintraege.push(e); vorhanden[e.id] = e; neu++; }
      else if ((e.geaendert || '') > (alt.geaendert || '')) {
        for (var k in e) { if (Object.prototype.hasOwnProperty.call(e, k)) { alt[k] = e[k]; } }
        aktualisiert++;
      }
    });
    speichern();
    var lern = 0;
    if (mitLernstand && obj.lernstand && typeof obj.lernstand === 'object') {
      LERNSTAND.forEach(function (k) {
        if (obj.lernstand[k] !== undefined) { HT.store.schreib(k, obj.lernstand[k]); lern++; }
      });
    }
    return { neu: neu, aktualisiert: aktualisiert, lernstand: lern };
  }

  /* --- Seite «Notizen» ------------------------------------------------------- */

  function seiteRendern(behaelter) {
    var liste = h('div', { class: 'nz-seite__liste' });
    var meldung = h('p', { class: 'nz-meldung', role: 'status', hidden: true });

    function melden(text, schlecht) {
      meldung.hidden = false;
      meldung.textContent = text;
      meldung.classList.toggle('ist-schlecht', !!schlecht);
    }

    var exportJson = h('button', { type: 'button', class: 'btn', text: 'Als Datei sichern (JSON)' });
    exportJson.addEventListener('click', function () {
      herunterladen(dateiname('json'), JSON.stringify(exportObjekt(), null, 2), 'application/json');
      melden('Datei erstellt — der Browser legt sie in den Downloads ab.');
    });
    var exportMd = h('button', { type: 'button', class: 'btn', text: 'Als Text sichern (Markdown)' });
    exportMd.addEventListener('click', function () {
      herunterladen(dateiname('md'), markdown(), 'text/markdown');
      melden('Markdown-Datei erstellt.');
    });

    var datei = h('input', { type: 'file', accept: '.json,application/json', class: 'nz-datei', id: 'nz-import', 'aria-label': 'Notizen-Datei wählen' });
    var lernstandBox = h('input', { type: 'checkbox', id: 'nz-lernstand', checked: true });
    datei.addEventListener('change', function () {
      var f = datei.files && datei.files[0];
      if (!f) { return; }
      var leser = new global.FileReader();
      leser.onload = function () {
        var r = importieren(String(leser.result || ''), lernstandBox.checked);
        if (r.fehler) { melden(r.fehler, true); }
        else {
          melden('Eingelesen: ' + r.neu + ' neu, ' + r.aktualisiert + ' aktualisiert' + (r.lernstand ? ', Lernstand übernommen' : '') + '.');
          listeFuellen();
        }
        datei.value = '';
      };
      leser.onerror = function () { melden('Die Datei konnte nicht gelesen werden.', true); };
      leser.readAsText(f);
    });
    var importKnopf = h('label', { class: 'btn', 'for': 'nz-import', text: 'Datei einlesen …' });

    var allesWeg = h('button', { type: 'button', class: 'btn btn--klein nz-allesweg', text: 'Alle Notizen löschen' });
    var wegTimer = null;
    allesWeg.addEventListener('click', function () {
      if (!allesWeg.classList.contains('ist-scharf')) {
        allesWeg.classList.add('ist-scharf');
        allesWeg.textContent = 'Wirklich alle löschen?';
        wegTimer = global.setTimeout(function () { allesWeg.classList.remove('ist-scharf'); allesWeg.textContent = 'Alle Notizen löschen'; }, 4000);
        return;
      }
      if (wegTimer) { clearTimeout(wegTimer); }
      laden();
      daten.eintraege = [];
      speichern();
      allesWeg.classList.remove('ist-scharf');
      allesWeg.textContent = 'Alle Notizen löschen';
      melden('Alle Notizen gelöscht.');
      listeFuellen();
    });

    function listeFuellen() {
      HT.ui.leeren(liste);
      var gs = gruppen();
      if (!gs.length) {
        liste.appendChild(HT.ui.leerZustand('Noch keine Notizen',
          'Text in der Methode, im Lexikon oder im Überblick auswählen — dann erscheint eine Blase mit vier Farben und «Kommentar». '
          + 'Freie Notizen zu einem Kapitel oder Eintrag stehen unter «Meine Notizen» am Ende der Seite.'));
        return;
      }
      var zahl = alle().length;
      liste.appendChild(h('p', { class: 'nz-seite__zahl', text: zahl + (zahl === 1 ? ' Eintrag' : ' Einträge') + ' an ' + gs.length + (gs.length === 1 ? ' Ort' : ' Orten') }));
      gs.forEach(function (g) {
        var marks = g.eintraege.filter(function (e) { return e.art === 'markierung'; });
        var notizen = g.eintraege.filter(function (e) { return e.art === 'notiz'; });
        liste.appendChild(h('section', { class: 'nz-gruppe' }, [
          h('h2', { class: 'nz-gruppe__titel' }, [h('a', { href: g.ort, text: g.titel })]),
          notizen.length ? h('div', { class: 'nz-gruppe__notizen' }, notizen.map(notizFeld)) : null,
          marks.length ? h('ul', { class: 'nz-markliste' }, marks.map(function (e) {
            var li = markZeile(e, false);
            var weg = h('button', { type: 'button', class: 'nz-notiz__weg', title: 'Markierung löschen', 'aria-label': 'Markierung löschen', text: '✕' });
            weg.addEventListener('click', function () { loeschen(e); listeFuellen(); });
            li.appendChild(weg);
            return li;
          })) : null
        ]));
      });
    }

    behaelter.appendChild(h('div', { class: 'nz-seite' }, [
      h('div', { class: 'kopf' }, [
        h('h1', { text: 'Notizen' }),
        h('p', { text: 'Markierungen, Kommentare und eigene Notizen aus Methode, Lexikon und Überblick. Sie liegen nur in diesem Browser — als Datei gesichert nimmst du sie mit auf ein anderes Gerät.' })
      ]),
      h('div', { class: 'nz-werkzeuge' }, [
        h('div', { class: 'btn-reihe' }, [exportJson, exportMd, importKnopf, datei]),
        h('label', { class: 'nz-lernstand', 'for': 'nz-lernstand' }, [lernstandBox, ' Beim Einlesen auch den Lernstand übernehmen (Lernkarten, Quiz, Trainer)']),
        meldung
      ]),
      liste,
      h('div', { class: 'nz-seite__fuss' }, [allesWeg])
    ]));
    listeFuellen();
  }

  /* --- Ereignisse ------------------------------------------------------------ */

  var selTimer = null;
  function auswahlGeaendert() {
    if (selTimer) { clearTimeout(selTimer); }
    selTimer = setTimeout(blaseZeigen, 120);
  }

  function starten() {
    var view = document.getElementById('view');
    if (!view) { return; }

    document.addEventListener('selectionchange', auswahlGeaendert);
    document.addEventListener('mouseup', auswahlGeaendert);
    document.addEventListener('touchend', auswahlGeaendert);
    document.addEventListener('keyup', function (ev) { if (ev.shiftKey || ev.key === 'Shift') { auswahlGeaendert(); } });

    /* Klick auf eine Markierung öffnet den Editor; Klick daneben schliesst ihn. */
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      var mark = t && t.closest ? t.closest('mark.nz-mark') : null;
      if (mark) {
        ev.preventDefault();
        var e = mitId(mark.getAttribute('data-nz-id'));
        if (e) { editorOeffnen(e, mark); }
        return;
      }
      /* Klicks in der Blase (öffnet gerade den Editor) und im Editor selbst
         schliessen nichts — das Ereignis kommt hier erst nach dem Öffnen an. */
      if (editor && !editor.el.contains(t) && !(t.closest && t.closest('.nz-blase'))) { editorSchliessen(); }
    });
    document.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if ((ev.key === 'Enter' || ev.key === ' ') && t && t.classList && t.classList.contains('nz-mark')) {
        ev.preventDefault();
        var e = mitId(t.getAttribute('data-nz-id'));
        if (e) { editorOeffnen(e, t); }
      }
    });
    global.addEventListener('hashchange', function () { editorSchliessen(); if (blase) { blase.hidden = true; } });
    global.addEventListener('scroll', function () { if (blase && !blase.hidden) { blaseZeigen(); } }, true);

    beobachter = new global.MutationObserver(function (liste) {
      if (stumm > 0) { return; }
      var relevant = false;
      for (var i = 0; i < liste.length; i++) {
        var m = liste[i];
        var ziel = m.target;
        var el = ziel.nodeType === 3 ? ziel.parentNode : ziel;
        if (el && el.closest && el.closest('.nz-ui, .nz-blase, .nz-editor')) { continue; }
        relevant = true;
        break;
      }
      if (relevant) { planen(); }
    });
    beobachter.observe(view, { childList: true, subtree: true });
    planen();
  }

  var planTimer = null;
  function planen() {
    if (planTimer) { clearTimeout(planTimer); }
    planTimer = setTimeout(function () { planTimer = null; anwenden(); }, 60);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', starten);
  } else {
    starten();
  }

  HT.notizen = {
    FARBEN: FARBEN,
    alle: alle,
    fuerOrt: fuerOrt,
    panel: panel,
    anwenden: anwenden,
    exportObjekt: exportObjekt,
    markdown: markdown,
    importieren: importieren
  };

  HT.views.notizen = { titel: 'Notizen', render: seiteRendern };
}(window));
