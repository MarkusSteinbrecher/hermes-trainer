#!/usr/bin/env python3
"""Importiert die offizielle HERMES-2022-Dokumentation von hermes.admin.ch
als strukturierte Textblöcke in data/handbuch/.

hermes.admin.ch ist gemäss Impressum des Referenzhandbuchs die führende Quelle
(«Digital First»); der Text ist identisch mit dem Referenzhandbuch (PDF). Die
Kapitelnummern und Seitenzahlen des PDF werden aus dessen Inhaltsverzeichnis
übernommen, damit jeder Abschnitt auf das Handbuch verweist.

Aufruf (im Projektverzeichnis):
    python3 tools/handbuch-import.py --pdf-text /pfad/zu/rhb.txt [--cache /tmp/html]

rhb.txt entsteht mit `pdftotext -layout HERMES-Projektmanagement.pdf rhb.txt`
aus dem Referenzhandbuch (Download unter https://www.hermes.admin.ch/de/downloads.html).
Ohne --pdf-text fehlen Kapitelnummern und Seitenzahlen, der Import läuft trotzdem.

Ausgabe:
    data/handbuch/inhaltsverzeichnis.json  Kapitelnummer → Titel, Seite
    data/handbuch/kapitel.json             Kapiteltexte (Methodenüberblick, Einleitungen, Hinweise)
    data/handbuch/elemente-<kategorie>.json Volltext je Lexikoneintrag (nach Eintrags-ID)
    assets/abb/*.svg                        Abbildungen
"""
import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
from html.parser import HTMLParser

BASIS = 'https://www.hermes.admin.ch'
UA = 'Mozilla/5.0 (HERMES-Trainer Import; +https://github.com/MarkusSteinbrecher/hermes-trainer)'

KAPITEL = [
    # id, Titel, Seiten (Pfad relativ zu /de/projektmanagement/), PDF-Kapitelpräfixe
    ('methodenueberblick', 'Methodenüberblick',
     ['methodenueberblick.html', 'methodenueberblick/hermes-projektmanagement-methodenelemente.html'], ['A', 'B']),
    ('phasen', 'Phasen', ['phasen.html'], ['1']),
    ('szenarien', 'Szenarien', ['szenarien.html'], ['2']),
    ('module', 'Module', ['module.html'], ['3']),
    ('ergebnisse', 'Ergebnisse', ['ergebnisse.html'], ['4']),
    ('aufgaben', 'Aufgaben', ['aufgaben.html'], ['5']),
    ('rollen', 'Rollen', ['rollen.html'], ['6']),
    ('hinweise', 'Hinweise zur Anwendung', [
        'hinweise-zur-anwendung.html',
        'hinweise-zur-anwendung/governance.html',
        'hinweise-zur-anwendung/nachhaltigkeit.html',
        'hinweise-zur-anwendung/projektmanagement-und-entwicklungsmanagement.html',
        'hinweise-zur-anwendung/finanzielle-steuerung-und-fuehrung.html',
        'hinweise-zur-anwendung/planung.html',
        'hinweise-zur-anwendung/realisierungseinheiten-bei-klassischer-vorgehensweise.html',
        'hinweise-zur-anwendung/anwendung-mit-anderen-methoden-und-praktiken.html',
        'hinweise-zur-anwendung/integration-von-hermes-in-die-stammorganisation.html',
    ], ['7']),
]

ELEMENT_DATEIEN = [
    ('phase', 'phasen'), ('szenario', 'szenarien'), ('modul', 'module'),
    ('ergebnis', 'ergebnisse'), ('aufgabe', 'aufgaben'), ('rolle', 'rollen'),
    ('grundbegriff', 'grundbegriffe'),
]


# --- Abruf -------------------------------------------------------------------

def abrufen(url, cache):
    os.makedirs(cache, exist_ok=True)
    name = hashlib.sha1(url.encode()).hexdigest()[:16] + '.html'
    pfad = os.path.join(cache, name)
    if os.path.exists(pfad):
        with open(pfad, 'rb') as f:
            return f.read()
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        daten = r.read()
    with open(pfad, 'wb') as f:
        f.write(daten)
    time.sleep(0.2)
    return daten


# --- Mini-DOM ------------------------------------------------------------------

VOID = {'img', 'br', 'hr', 'meta', 'link', 'input', 'source', 'wbr'}


class Knoten:
    __slots__ = ('tag', 'attrs', 'kinder', 'eltern')

    def __init__(self, tag, attrs=None, eltern=None):
        self.tag = tag
        self.attrs = attrs or {}
        self.kinder = []
        self.eltern = eltern


class Baum(HTMLParser):
    """Baut nur den Teilbaum von div.container__main auf."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.wurzel = None
        self.aktuell = None
        self.tiefe = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self.wurzel is None:
            if tag == 'div' and 'container__main' in (a.get('class') or ''):
                self.wurzel = Knoten('root')
                self.aktuell = self.wurzel
                self.tiefe = 1
            return
        if self.aktuell is None:
            return                       # container__main ist bereits zu Ende
        if tag in ('td', 'th') and self.aktuell.tag in ('td', 'th'):
            self.aktuell = self.aktuell.eltern
        if tag == 'tr':
            while self.aktuell.tag in ('td', 'th', 'tr'):
                self.aktuell = self.aktuell.eltern
        k = Knoten(tag, a, self.aktuell)
        self.aktuell.kinder.append(k)
        if tag in VOID:
            return
        self.aktuell = k
        if tag == 'div':
            self.tiefe += 1

    def handle_startendtag(self, tag, attrs):
        if self.wurzel is None or self.aktuell is None:
            return
        self.aktuell.kinder.append(Knoten(tag, dict(attrs), self.aktuell))

    def handle_endtag(self, tag):
        if self.wurzel is None or self.aktuell is None:
            return
        if tag in VOID:
            return
        n = self.aktuell
        while n is not None and n.tag != tag:
            n = n.eltern
        if n is None:
            if tag == 'div':
                self.tiefe -= 1
                if self.tiefe <= 0:
                    self.aktuell = None  # schliessendes div von container__main
            return
        if tag == 'div':
            self.tiefe -= 1
            if self.tiefe <= 0:
                self.aktuell = None      # Ende von container__main
                return
        self.aktuell = n.eltern

    def handle_data(self, data):
        if self.wurzel is None or self.aktuell is None:
            return
        if data:
            self.aktuell.kinder.append(data)


def parsen(html):
    b = Baum()
    b.feed(html.decode('utf-8', 'replace'))
    return b.wurzel


# --- Text ----------------------------------------------------------------------

def norm(text):
    t = re.sub(r'[ \t\r\f\v]*\n[ \t\r\f\v]*', '\n', text)   # Zeilenumbrüche (<br>) behalten
    t = re.sub(r'[ \t\r\f\v]+', ' ', t)
    t = re.sub(r'\n+', '\n', t).strip('\n ')
    t = t.replace('\n', ' \n ')
    t = re.sub(r'[ ]+', ' ', t)
    t = re.sub(r'\s+([,.;:!?)])', r'\1', t)
    t = re.sub(r'\(\s+', '(', t)
    return t.strip()


BLOCK_TAGS = {'p', 'ul', 'ol', 'table', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'div', 'section', 'li', 'tr'}


def inline_text(knoten, links):
    """Text eines Inline-Bereichs; nested Blöcke werden ausgelassen."""
    teile = []
    for k in knoten.kinder:
        if isinstance(k, str):
            teile.append(k)
        elif k.tag == 'br':
            teile.append('\n')
        elif k.tag in BLOCK_TAGS:
            continue
        else:
            if k.tag == 'a' and k.attrs.get('href'):
                links.append((norm(inline_text(k, [])), k.attrs['href']))
            teile.append(inline_text(k, links))
    return ''.join(teile)


def href_abs(href):
    if not href:
        return None
    if href.startswith('/'):
        return BASIS + href
    return href


def liste(knoten):
    items = []
    for k in knoten.kinder:
        if isinstance(k, str) or k.tag != 'li':
            continue
        links = []
        text = norm(inline_text(k, links))
        item = {'text': text}
        if '\n' in text:
            kopf, rest = text.split('\n', 1)
            kopf, rest = kopf.strip(), re.sub(r'\s*\n\s*', ' ', rest).strip()
            if 0 < len(kopf) <= 60 and rest and not kopf.endswith(('.', ';', ',')):
                item = {'titel': kopf, 'text': rest}
            else:
                item = {'text': re.sub(r'\s*\n\s*', ' ', text)}
        unter = []
        for kk in k.kinder:
            if not isinstance(kk, str) and kk.tag in ('ul', 'ol'):
                unter.extend(liste(kk))
            elif not isinstance(kk, str) and kk.tag == 'p':
                extra = flach(norm(inline_text(kk, [])))
                if extra:
                    item['text'] = (item['text'] + ' ' + extra).strip()
        if unter:
            item['items'] = unter
        if item['text'] or unter:
            items.append(item)
    return items


def tabelle(knoten):
    titel = ''
    zeilen = []

    def zeile(tr):
        zellen = []
        for z in tr.kinder:
            if isinstance(z, str) or z.tag not in ('td', 'th'):
                continue
            links = []
            text = re.sub(r'\s*\n\s*', ' ', norm(inline_text(z, links)))
            zelle = {'text': text}
            if z.tag == 'th':
                zelle['kopf'] = True
            zellen.append(zelle)
        return zellen

    lose = []                         # Zellen ohne umschliessendes <tr> (Kopfzeile)

    def lose_abschliessen():
        if lose:
            zeilen.append([z for z in lose])
            del lose[:]

    def gehen(n):
        nonlocal titel
        for k in n.kinder:
            if isinstance(k, str):
                if flach(norm(k)) and not titel and n is knoten:
                    titel = flach(norm(k))
                continue
            if k.tag == 'caption':
                titel = norm(inline_text(k, []))
            elif k.tag == 'tr':
                lose_abschliessen()
                z = zeile(k)
                if z:
                    zeilen.append(z)
            elif k.tag in ('td', 'th'):
                links = []
                text = re.sub(r'\s*\n\s*', ' ', norm(inline_text(k, links)))
                zelle = {'text': text}
                if k.tag == 'th':
                    zelle['kopf'] = True
                lose.append(zelle)
            elif k.tag in ('thead', 'tbody', 'tfoot'):
                gehen(k)
    gehen(knoten)
    lose_abschliessen()
    return {'t': 'tabelle', 'titel': titel, 'zeilen': zeilen}


def figur(knoten):
    src = None
    text = ''

    def gehen(n):
        nonlocal src, text
        for k in n.kinder:
            if isinstance(k, str):
                continue
            if k.tag == 'img' and not src:
                src = k.attrs.get('src')
            elif k.tag == 'figcaption':
                text = flach(norm(inline_text(k, [])))
            else:
                gehen(k)
    gehen(knoten)
    return {'t': 'abb', 'src': href_abs(src), 'text': text}


def flach(text):
    return re.sub(r'\s*\n\s*', ' ', text).strip()


def bloecke(knoten, aus):
    for k in knoten.kinder:
        if isinstance(k, str):
            t = flach(norm(k))
            if t:
                aus.append({'t': 'p', 'text': t})
            continue
        tag = k.tag
        if tag == 'h1':
            aus.append({'t': 'h1', 'text': flach(norm(inline_text(k, [])))})
        elif tag in ('h2', 'h3', 'h4', 'h5'):
            aus.append({'t': 'h', 'n': int(tag[1]), 'text': flach(norm(inline_text(k, [])))})
        elif tag == 'p':
            links = []
            t = flach(norm(inline_text(k, links)))
            if t:
                aus.append({'t': 'p', 'text': t})
        elif tag in ('ul', 'ol'):
            items = liste(k)
            if items:
                aus.append({'t': tag, 'items': items})
        elif tag == 'table':
            tb = tabelle(k)
            if tb['zeilen']:
                aus.append(tb)
        elif tag == 'figure':
            aus.append(figur(k))
        elif tag in ('div', 'section', 'article', 'span'):
            bloecke(k, aus)
        elif tag in ('a', 'strong', 'em', 'b', 'i'):
            t = flach(norm(inline_text(k, [])))
            if t:
                aus.append({'t': 'p', 'text': t})
        # alles andere (script, nav, img ausserhalb figure ...) ignorieren
    return aus


def seite_lesen(url, cache):
    wurzel = parsen(abrufen(url, cache))
    if wurzel is None:
        raise RuntimeError('container__main nicht gefunden: ' + url)
    return bloecke(wurzel, [])


# --- Inhaltsverzeichnis (PDF) --------------------------------------------------

def toc_lesen(pfad):
    """Liest das Inhaltsverzeichnis am Ende des pdftotext-Extrakts."""
    eintraege = []
    muster = re.compile(r'^\s*([AB](?:\.\d+)*|\d+(?:\.\d+)*)\s+(.+?)(?:\s*\.(?:\s*\.)+)?\s+(\d{1,3})\s*$')
    with open(pfad, encoding='utf-8') as f:
        zeilen = f.read().split('\n')
    # Das Inhaltsverzeichnis steht am Ende (nach «Vokabular»); die erste Zeile
    # «A Methodenüberblick … 6» nach der Hälfte der Datei markiert den Beginn.
    start = None
    for i in range(len(zeilen) // 2, len(zeilen)):
        if re.match(r'^\s*A Methodenüberblick\s+\d+\s*$', zeilen[i]):
            start = i
            break
    if start is None:
        return eintraege
    for z in zeilen[start:]:
        m = muster.match(z)
        if not m:
            continue
        nummer, titel, seite = m.group(1), m.group(2).strip(), int(m.group(3))
        titel = re.sub(r'\s*\.\s*$', '', titel)
        eintraege.append({'nummer': nummer, 'titel': titel, 'seite': seite})
    return eintraege


def schluessel(text):
    t = text.lower()
    t = t.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    t = re.sub(r'[^a-z0-9]+', '', t)
    return t


def toc_index(toc, praefixe=None):
    idx = {}
    for e in toc:
        if praefixe and not any(e['nummer'] == p or e['nummer'].startswith(p + '.') for p in praefixe):
            continue
        idx.setdefault(schluessel(e['titel']), e)
    return idx


# --- Abbildungen -----------------------------------------------------------------

def abbildungen_sichern(alle_bloecke, cache, zielordner):
    os.makedirs(zielordner, exist_ok=True)
    gesehen = {}

    def gehen(bs):
        for b in bs:
            if b.get('t') == 'abb' and b.get('src'):
                src = b['src']
                if src not in gesehen:
                    name = re.sub(r'[^a-z0-9._-]+', '-', os.path.basename(src).lower())
                    kurz = hashlib.sha1(src.encode()).hexdigest()[:8]
                    datei = kurz + '-' + name
                    pfad = os.path.join(zielordner, datei)
                    if not os.path.exists(pfad):
                        try:
                            daten = abrufen(src, cache)
                            if len(daten) > 250000:      # eingebettete Rasterbilder: nur verlinken
                                gesehen[src] = None
                                continue
                            with open(pfad, 'wb') as f:
                                f.write(daten)
                        except Exception as fehler:  # Abbildung fehlt: Text bleibt
                            print('  Abbildung nicht geladen:', src, fehler, file=sys.stderr)
                            gesehen[src] = None
                            continue
                    gesehen[src] = 'assets/abb/' + datei
                if gesehen[src]:
                    b['datei'] = gesehen[src]
    gehen(alle_bloecke)
    return gesehen


# --- Abschnitte ------------------------------------------------------------------

def in_abschnitte(bs, min_ebene=2):
    """Zerlegt eine Blockfolge an Überschriften ≥ min_ebene in Abschnitte."""
    abschnitte = []
    aktuell = {'titel': '', 'ebene': 0, 'bloecke': []}
    for b in bs:
        if b['t'] == 'h1':
            continue
        if b['t'] == 'h' and b['n'] >= min_ebene:
            if aktuell['bloecke'] or aktuell['titel']:
                abschnitte.append(aktuell)
            aktuell = {'titel': b['text'], 'ebene': b['n'], 'bloecke': []}
        else:
            aktuell['bloecke'].append(b)
    if aktuell['bloecke'] or aktuell['titel']:
        abschnitte.append(aktuell)
    return abschnitte


def tiefe(nummer):
    return nummer.count('.') + 1


def nummerieren(abschnitte, toc, praefixe, teil_nummer=None):
    """Ordnet Abschnitten Kapitelnummer und Seite zu — in Dokumentreihenfolge,
    beschränkt auf das Kapitel (Präfixe) bzw. den Teil, und nur wenn die
    Überschriftenebene zur Gliederungstiefe passt (h2 auf einer Seite der
    Tiefe t entspricht der Tiefe t+1)."""
    kandidaten = [e for e in toc if any(e['nummer'] == p or e['nummer'].startswith(p + '.') for p in praefixe)]
    if teil_nummer:
        eng = [e for e in kandidaten if e['nummer'] == teil_nummer or e['nummer'].startswith(teil_nummer + '.')]
        if eng:
            kandidaten = eng
    basis = tiefe(teil_nummer) if teil_nummer else (tiefe(praefixe[0]) if praefixe else 1)
    cursor = 0
    for a in abschnitte:
        if not a['titel']:
            continue
        erwartet = basis + a['ebene'] - 1
        k = schluessel(a['titel'])
        for i in range(cursor, len(kandidaten)):
            e = kandidaten[i]
            if schluessel(e['titel']) == k and tiefe(e['nummer']) == erwartet:
                a['nummer'] = e['nummer']
                a['seite'] = e['seite']
                cursor = i + 1
                break


# --- Hauptprogramm ---------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf-text', help='pdftotext -layout Extrakt des Referenzhandbuchs')
    ap.add_argument('--cache', default='/tmp/hermes-html-cache')
    ap.add_argument('--projekt', default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    args = ap.parse_args()

    projekt = args.projekt
    ausgabe = os.path.join(projekt, 'data', 'handbuch')
    os.makedirs(ausgabe, exist_ok=True)

    toc = toc_lesen(args.pdf_text) if args.pdf_text else []
    print('Inhaltsverzeichnis:', len(toc), 'Einträge')
    with open(os.path.join(ausgabe, 'inhaltsverzeichnis.json'), 'w', encoding='utf-8') as f:
        json.dump(toc, f, ensure_ascii=False, indent=0)

    alle_bloecke_fuer_abb = []

    # Kapitel
    kapitel_aus = []
    for kid, ktitel, seiten, praefixe in KAPITEL:
        idx = toc_index(toc, praefixe)
        haupt = [e for e in toc if e['nummer'] in praefixe]
        kap = {
            'id': kid,
            'titel': ktitel,
            'nummer': '/'.join(praefixe),
            'seite': haupt[0]['seite'] if haupt else None,
            'url': BASIS + '/de/projektmanagement/' + seiten[0],
            'teile': []
        }
        for s in seiten:
            url = BASIS + '/de/projektmanagement/' + s
            print('Kapitel', kid, '←', s)
            bs = seite_lesen(url, args.cache)
            titel = next((b['text'] for b in bs if b['t'] == 'h1'), ktitel)
            abschnitte = in_abschnitte(bs, 2)
            teil = {'titel': titel, 'url': url, 'abschnitte': abschnitte}
            te = idx.get(schluessel(titel))
            if te:
                teil['nummer'] = te['nummer']
                teil['seite'] = te['seite']
            nummerieren(abschnitte, toc, praefixe, teil.get('nummer'))
            kap['teile'].append(teil)
            for a in abschnitte:
                alle_bloecke_fuer_abb.extend(a['bloecke'])
        kapitel_aus.append(kap)

    # Elemente
    elemente_idx = toc_index(toc)
    elemente_aus = {}
    for kat, datei in ELEMENT_DATEIEN:
        with open(os.path.join(projekt, 'data', datei + '.json'), encoding='utf-8') as f:
            eintraege = json.load(f)
        aus = {}
        for e in eintraege:
            url = (e.get('quelle') or {}).get('url')
            if not url:
                continue
            # Grundbegriffe verweisen auf Kapitel-/Übersichtsseiten; die sind schon in kapitel.json
            if kat == 'grundbegriff':
                continue
            print(kat, '←', e['begriff'])
            try:
                bs = seite_lesen(url, args.cache)
            except Exception as fehler:
                print('  FEHLER', url, fehler, file=sys.stderr)
                continue
            titel = next((b['text'] for b in bs if b['t'] == 'h1'), e['begriff'])
            abschnitte = in_abschnitte(bs, 2)
            eintrag = {'titel': titel, 'url': url, 'abschnitte': abschnitte}
            te = elemente_idx.get(schluessel(titel)) or elemente_idx.get(schluessel(e['begriff']))
            if te:
                eintrag['nummer'] = te['nummer']
                eintrag['seite'] = te['seite']
            aus[e['id']] = eintrag
            for a in abschnitte:
                alle_bloecke_fuer_abb.extend(a['bloecke'])
        elemente_aus[kat] = aus
        print('→', kat, len(aus), 'Einträge')

    # Abbildungen lokal sichern (SVG) und Blöcke um «datei» ergänzen
    abb = abbildungen_sichern(alle_bloecke_fuer_abb, args.cache, os.path.join(projekt, 'assets', 'abb'))
    print('Abbildungen:', sum(1 for v in abb.values() if v))

    # Erst jetzt schreiben: die Blockobjekte tragen nun die lokalen Abbildungspfade.
    with open(os.path.join(ausgabe, 'kapitel.json'), 'w', encoding='utf-8') as f:
        json.dump(kapitel_aus, f, ensure_ascii=False, separators=(',', ':'))
    for kat, aus in elemente_aus.items():
        if not aus:
            continue
        with open(os.path.join(ausgabe, 'elemente-' + kat + '.json'), 'w', encoding='utf-8') as f:
            json.dump(aus, f, ensure_ascii=False, separators=(',', ':'))

    return 0


if __name__ == '__main__':
    sys.exit(main())
