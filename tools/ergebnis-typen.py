#!/usr/bin/env python3
"""Ergänzt data/ergebnisse.json um «typ» (Dokument, Checkliste, Zustand,
Meilenstein) und «minimalGefordert» (Tabelle 16 des Referenzhandbuchs).

Quelle ist der importierte Kapiteltext data/handbuch/kapitel.json
(Abschnitte 4.2.1.1 Standarddokumente und 4.2.1.2 Standardzustände).
Aufruf nach tools/handbuch-import.py:  python3 tools/ergebnis-typen.py
"""
import json
import os
import sys

projekt = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
kapitel = json.load(open(os.path.join(projekt, 'data', 'handbuch', 'kapitel.json'), encoding='utf-8'))
ergebnisse_pfad = os.path.join(projekt, 'data', 'ergebnisse.json')
ergebnisse = json.load(open(ergebnisse_pfad, encoding='utf-8'))

kap = next(k for k in kapitel if k['id'] == 'ergebnisse')
abschnitte = kap['teile'][0]['abschnitte']


def tabelle(nummer):
    a = next(x for x in abschnitte if x.get('nummer') == nummer)
    return next(b for b in a['bloecke'] if b['t'] == 'tabelle')


dok = tabelle('4.2.1.1')
zust = tabelle('4.2.1.2')

minimal = {}
for zeile in dok['zeilen']:
    if len(zeile) < 2 or zeile[0].get('kopf'):
        continue
    name = zeile[0]['text'].strip()
    minimal[name] = zeile[1]['text'].strip().upper() == 'X'

zustaende = set()
for zeile in zust['zeilen']:
    if zeile and not zeile[0].get('kopf'):
        zustaende.add(zeile[0]['text'].strip())

print('Dokumente in Tabelle 16:', len(minimal), '· davon minimal gefordert:', sum(minimal.values()))
print('Zustände in Tabelle 17:', len(zustaende))

fehlend = []
for e in ergebnisse:
    b = e['begriff']
    if b.startswith('Checkliste ') or b == 'Checklisten':
        e['typ'] = 'Checkliste'
        e['minimalGefordert'] = True          # «Checklisten» ist in Tabelle 16 mit X markiert
    elif b.startswith('Meilenstein ') or b == 'Meilensteine':
        e['typ'] = 'Meilenstein'
        e.pop('minimalGefordert', None)
    elif b in zustaende:
        e['typ'] = 'Zustand'
        e.pop('minimalGefordert', None)
    elif b in minimal:
        e['typ'] = 'Dokument'
        e['minimalGefordert'] = minimal[b]
    else:
        fehlend.append(b)

if fehlend:
    print('Nicht zugeordnet:', fehlend, file=sys.stderr)

with open(ergebnisse_pfad, 'w', encoding='utf-8') as f:
    json.dump(ergebnisse, f, ensure_ascii=False, indent=2)
    f.write('\n')

from collections import Counter
print(Counter(e['typ'] for e in ergebnisse))
print('minimal gefordert (Dokumente):', sum(1 for e in ergebnisse if e['typ'] == 'Dokument' and e.get('minimalGefordert')))
print('nicht minimal gefordert:', [e['begriff'] for e in ergebnisse if e['typ'] == 'Dokument' and not e.get('minimalGefordert')])
