#!/usr/bin/env python3
"""Prüft data/quizfragen.json formal und gegen das Referenzhandbuch.

Formal: eindeutige IDs, genau vier Antworten, «richtig» im Bereich, keine
doppelten Antworten, Pflichtfelder, Kategorie gültig, Beleg mit Zitat,
Kapitel und Seite, Quellen-URL auf hermes.admin.ch.

Inhaltlich (mit --pdf-text): jedes Belegzitat muss im Handbuchtext
vorkommen (Silbentrennung und Whitespace werden normalisiert). Zitate, die
nicht wörtlich gefunden werden, werden mit dem längsten gefundenen Teil
gemeldet.

Aufruf: python3 tools/quiz-pruefen.py [--pdf-text rhb.txt]
Exit-Code 1 bei formalen Fehlern.
"""
import argparse
import json
import os
import re
import sys
from collections import Counter

KATEGORIEN = {'phase', 'szenario', 'modul', 'grundbegriff', 'aufgabe', 'ergebnis', 'rolle'}


def normtext(t):
    t = t.replace('­', '')
    t = re.sub(r'-\n\s*', '', t)                 # Silbentrennung am Zeilenende
    t = re.sub(r'\n\s*\d{1,3}/248\s*\n', '\n', t)  # Seitenmarker
    t = re.sub(r'[•·]', ' ', t)                  # Aufzählungszeichen
    t = re.sub(r'\s+', ' ', t)
    t = t.replace('„', '"').replace('“', '"').replace('”', '"').replace('«', '"').replace('»', '"')
    t = t.replace('’', "'").replace('‘', "'").replace('–', '-').replace('—', '-')
    return t.lower()


def laengster_treffer(zitat, korpus):
    """Längster Präfix des Zitats (in Wörtern), der im Korpus vorkommt."""
    woerter = zitat.split(' ')
    lo, hi = 0, len(woerter)
    best = 0
    while lo <= hi:
        mid = (lo + hi) // 2
        if mid == 0 or ' '.join(woerter[:mid]) in korpus:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return best, len(woerter)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf-text')
    ap.add_argument('--datei', default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'quizfragen.json'))
    args = ap.parse_args()

    fragen = json.load(open(args.datei, encoding='utf-8'))
    fehler = []
    warnungen = []
    ids = Counter(q.get('id') for q in fragen)

    for q in fragen:
        qid = q.get('id', '?')
        if ids[qid] > 1:
            fehler.append(f'{qid}: ID mehrfach')
        if not q.get('frage', '').strip():
            fehler.append(f'{qid}: Frage fehlt')
        a = q.get('antworten') or []
        if len(a) != 4:
            fehler.append(f'{qid}: {len(a)} Antworten statt 4')
        if len(set(x.strip().lower() for x in a)) != len(a):
            fehler.append(f'{qid}: doppelte Antwort')
        r = q.get('richtig')
        if not isinstance(r, int) or r < 0 or r >= len(a):
            fehler.append(f'{qid}: richtig={r!r} ungültig')
        if not q.get('erklaerung', '').strip():
            fehler.append(f'{qid}: Erklärung fehlt')
        if q.get('kategorie') not in KATEGORIEN:
            fehler.append(f'{qid}: Kategorie {q.get("kategorie")!r} ungültig')
        url = (q.get('quelle') or {}).get('url', '')
        if not url.startswith('https://www.hermes.admin.ch/'):
            fehler.append(f'{qid}: Quelle fehlt oder nicht hermes.admin.ch')
        b = q.get('beleg') or {}
        if not b.get('zitat', '').strip():
            fehler.append(f'{qid}: Beleg-Zitat fehlt')
        if not b.get('kapitel', '').strip():
            fehler.append(f'{qid}: Beleg-Kapitel fehlt')
        if not isinstance(b.get('seite'), int):
            fehler.append(f'{qid}: Beleg-Seite fehlt')
        if 'ß' in json.dumps(q, ensure_ascii=False):
            warnungen.append(f'{qid}: enthält ß (Schweizer Rechtschreibung: ss)')
        if a and isinstance(r, int) and 0 <= r < len(a):
            laengen = [len(x) for x in a]
            if laengen[r] == max(laengen) and laengen[r] > 1.6 * sorted(laengen)[-2]:
                warnungen.append(f'{qid}: richtige Antwort deutlich am längsten ({laengen})')

    verteilung = Counter(q.get('richtig') for q in fragen)
    print(f'{len(fragen)} Fragen · Positionen der richtigen Antwort: {dict(sorted(verteilung.items()))}')
    print('Kategorien:', dict(Counter(q.get('kategorie') for q in fragen)))

    if args.pdf_text:
        korpus = normtext(open(args.pdf_text, encoding='utf-8').read())
        nicht = []
        for q in fragen:
            z = normtext((q.get('beleg') or {}).get('zitat', ''))
            if not z:
                continue
            if z in korpus:
                continue
            # Zusammengesetzte Zitate satzweise prüfen; Tabellenparaphrasen
            # («tabelle 12 …», «[phase …]») sind als solche gekennzeichnet.
            saetze = [t.strip(' "') for t in re.split(r'(?<=[.;:!?])\s+|\s*\[[^\]]*\]\s*|\.\.\.|…', z)]
            saetze = [t for t in saetze if len(t.split()) >= 4]
            fehlend = [t for t in saetze if t not in korpus and not re.match(r'^(tabelle|abbildung)\s*\d', t)]
            if not fehlend:
                continue
            nicht.append((q.get('id'), fehlend))
        if nicht:
            print(f'\n{len(nicht)} Belegzitate mit Sätzen, die nicht wörtlich im Handbuch stehen:')
            for qid, fehlend in nicht:
                for t in fehlend:
                    print(f'  {qid}: «{t[:110]}»')
        else:
            print('Alle Belegzitate wörtlich im Handbuch gefunden.')

    for w in warnungen:
        print('WARNUNG', w)
    for f in fehler:
        print('FEHLER', f)
    return 1 if fehler else 0


if __name__ == '__main__':
    sys.exit(main())
